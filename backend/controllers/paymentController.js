const crypto = require('crypto');
const fs = require('fs');
const db = require('../config/db');
const { cleanupFiles } = require('../middleware/upload');
const { createNotification, templates } = require('./notificationController');
const { logAdminAction } = require('../utils/adminAudit');
const { paymentInfo } = require('../utils/payment');
const { HttpError, PAYMENT_STATUS, APPLICATION_STATUS } = require('../utils/domain');

const TRANSFER_REF = /^[\p{L}\p{N} _\-/.]{0,64}$/u;
const PAID_AT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

// วันเวลาที่ผู้สมัครแจ้งว่าโอน (ไม่บังคับ) ต้องเป็นเวลาจริงและไม่อยู่ในอนาคต
function parsePaidAt(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const match = PAID_AT.exec(String(value).trim());
    if (!match) throw new HttpError(400, 'วันเวลาที่โอนไม่ถูกต้อง');
    const [, y, mo, d, h, mi] = match.map(Number);
    const date = new Date(y, mo - 1, d, h, mi);
    const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h && date.getMinutes() === mi;
    if (!valid) throw new HttpError(400, 'วันเวลาที่โอนไม่ถูกต้อง');
    if (date.getTime() > Date.now() + 5 * 60 * 1000) throw new HttpError(400, 'วันเวลาที่โอนต้องไม่อยู่ในอนาคต');
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:00`;
}

// ผู้สมัคร: ดูยอดและบัญชีรับเงิน
exports.getPaymentInfo = (req, res) => res.json({ success: true, data: paymentInfo() });

// ผู้สมัคร: แนบสลิปการโอนเงินของใบสมัครตนเอง
exports.submitSlip = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    const slip = req.files?.payment_slip?.[0];
    let keepFile = false;
    try {
        if (!Number.isInteger(registrationId) || registrationId <= 0) throw new HttpError(400, 'เลขใบสมัครไม่ถูกต้อง');
        if (!slip) throw new HttpError(400, 'กรุณาแนบหลักฐานการชำระเงิน (สลิปโอนเงิน)');
        const transferRef = typeof req.body.transfer_ref === 'string' ? req.body.transfer_ref.trim() : '';
        if (!TRANSFER_REF.test(transferRef)) throw new HttpError(400, 'เลขอ้างอิงรายการโอนมีอักขระที่ไม่อนุญาตหรือยาวเกิน 64 ตัว');
        const paidAt = parsePaidAt(req.body.paid_at);
        const hash = crypto.createHash('sha256').update(await fs.promises.readFile(slip.path)).digest('hex');

        await db.withTransaction(async (conn) => {
            const [[row]] = await conn.query(
                `SELECT p.payment_id, p.payment_status, r.application_status, s.user_id
                 FROM payments p
                 JOIN registrations r ON r.registration_id = p.registration_id
                 JOIN students s ON s.student_id = r.student_id
                 WHERE p.registration_id = ? FOR UPDATE`,
                [registrationId]
            );
            // ไม่บอกว่ามีใบสมัครของคนอื่นอยู่จริงหรือไม่
            if (!row || Number(row.user_id) !== Number(req.user.id)) throw new HttpError(404, 'ไม่พบรายการชำระเงินของใบสมัครนี้');
            if (row.application_status === APPLICATION_STATUS.REJECTED) throw new HttpError(409, 'ใบสมัครนี้ถูกปฏิเสธ ไม่สามารถส่งหลักฐานการชำระเงินได้');
            if (row.payment_status === PAYMENT_STATUS.PAID) throw new HttpError(409, 'ใบสมัครนี้ชำระเงินแล้ว');
            if (row.payment_status === PAYMENT_STATUS.SUBMITTED) throw new HttpError(409, 'ส่งหลักฐานแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบ');
            await conn.query(
                `UPDATE payments SET slip_filename = ?, slip_hash = ?, transfer_ref = ?, paid_at = ?, submitted_at = NOW(),
                        payment_status = ?, verified_by = NULL, verified_at = NULL, verify_note = NULL
                 WHERE payment_id = ?`,
                [slip.filename, hash, transferRef || null, paidAt, PAYMENT_STATUS.SUBMITTED, row.payment_id]
            );
        });
        keepFile = true;
        // ไฟล์อื่นที่ไม่เกี่ยวข้อง (ถ้าส่งมา) ไม่เก็บไว้
        const extra = { ...req.files }; delete extra.payment_slip; cleanupFiles(extra);
        return res.status(201).json({ success: true, message: 'ส่งหลักฐานการชำระเงินแล้ว รอเจ้าหน้าที่ตรวจสอบ', data: { payment_status: PAYMENT_STATUS.SUBMITTED } });
    } catch (error) {
        if (!keepFile) cleanupFiles(req.files);
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'สลิปนี้เคยถูกใช้กับใบสมัครอื่นแล้ว กรุณาแนบสลิปของรายการโอนนี้เท่านั้น' });
        console.error('[Payment slip]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถส่งหลักฐานการชำระเงินได้' });
    }
};

// เจ้าหน้าที่: ยืนยันหรือปฏิเสธสลิป
exports.verifyPayment = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    const status = req.body.status;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    try {
        if (!Number.isInteger(registrationId) || registrationId <= 0) throw new HttpError(400, 'เลขใบสมัครไม่ถูกต้อง');
        if (![PAYMENT_STATUS.PAID, PAYMENT_STATUS.REJECTED].includes(status)) throw new HttpError(400, 'สถานะการชำระเงินไม่ถูกต้อง');
        if (note.length > 255) throw new HttpError(400, 'หมายเหตุต้องไม่เกิน 255 ตัวอักษร');
        if (status === PAYMENT_STATUS.REJECTED && note.length < 3) throw new HttpError(400, 'กรุณาระบุเหตุผลที่สลิปไม่ผ่าน (อย่างน้อย 3 ตัวอักษร)');

        const row = await db.withTransaction(async (conn) => {
            const [[found]] = await conn.query(
                `SELECT p.payment_id, p.payment_status, p.amount, p.slip_filename, r.registration_id, s.user_id, c.course_name
                 FROM payments p
                 JOIN registrations r ON r.registration_id = p.registration_id
                 JOIN students s ON s.student_id = r.student_id
                 JOIN exam_courses c ON c.course_id = r.course_id
                 WHERE p.registration_id = ? FOR UPDATE`,
                [registrationId]
            );
            if (!found) throw new HttpError(404, 'ไม่พบรายการชำระเงิน');
            if (found.payment_status !== PAYMENT_STATUS.SUBMITTED) throw new HttpError(409, 'รายการนี้ไม่ได้อยู่ในสถานะรอตรวจสลิป');
            await conn.query(
                `UPDATE payments SET payment_status = ?, verified_by = ?, verified_at = NOW(), verify_note = ? WHERE payment_id = ?`,
                [status, req.user.id, note || null, found.payment_id]
            );
            await logAdminAction({
                actorId: req.user.id, action: 'VERIFY_PAYMENT', targetType: 'registration', targetId: registrationId,
                details: { from: found.payment_status, to: status, amount: Number(found.amount), slip_filename: found.slip_filename, note: note || null },
            }, conn);
            return found;
        });

        const template = status === PAYMENT_STATUS.PAID
            ? templates.payment_confirmed(row.course_name)
            : templates.payment_rejected(row.course_name, note);
        createNotification({ user_id: row.user_id, ...template })
            .catch((error) => console.error('[Payment notification]', error.message));
        return res.json({
            success: true,
            message: status === PAYMENT_STATUS.PAID ? 'ยืนยันการชำระเงินเรียบร้อย' : 'บันทึกว่าสลิปไม่ผ่านและแจ้งผู้สมัครแล้ว',
        });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Verify payment]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกผลการตรวจสลิปได้' });
    }
};

// เจ้าหน้าที่: ยกเลิกผล "ชำระแล้ว" ที่ยืนยันผิด เพื่อตรวจสลิปใหม่ (ทำได้เฉพาะก่อนอนุมัติสิทธิ์สอบ)
exports.reopenPayment = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    try {
        if (!Number.isInteger(registrationId) || registrationId <= 0) throw new HttpError(400, 'เลขใบสมัครไม่ถูกต้อง');
        if (reason.length < 3 || reason.length > 255) throw new HttpError(400, 'กรุณาระบุเหตุผลที่ต้องตรวจสลิปใหม่ 3-255 ตัวอักษร');

        const row = await db.withTransaction(async (conn) => {
            const [[found]] = await conn.query(
                `SELECT p.payment_id, p.payment_status, p.amount, p.slip_filename, r.registration_id, r.application_status, s.user_id, c.course_name
                 FROM payments p
                 JOIN registrations r ON r.registration_id = p.registration_id
                 JOIN students s ON s.student_id = r.student_id
                 JOIN exam_courses c ON c.course_id = r.course_id
                 WHERE p.registration_id = ? FOR UPDATE`,
                [registrationId]
            );
            if (!found) throw new HttpError(404, 'ไม่พบรายการชำระเงิน');
            if (found.payment_status !== PAYMENT_STATUS.PAID || !found.slip_filename || Number(found.amount) <= 0) {
                throw new HttpError(409, 'แก้ผลได้เฉพาะรายการที่ยืนยันการชำระจากสลิปแล้วเท่านั้น');
            }
            if (found.application_status !== APPLICATION_STATUS.PENDING) {
                throw new HttpError(409, 'ใบสมัครนี้ได้รับการพิจารณาแล้ว กรุณาส่งกลับรอตรวจก่อนแก้ผลการชำระ');
            }
            await conn.query(
                `UPDATE payments SET payment_status = ?, verified_by = NULL, verified_at = NULL, verify_note = ? WHERE payment_id = ?`,
                [PAYMENT_STATUS.SUBMITTED, reason, found.payment_id]
            );
            await logAdminAction({
                actorId: req.user.id, action: 'REOPEN_PAYMENT', targetType: 'registration', targetId: registrationId,
                details: { from: found.payment_status, to: PAYMENT_STATUS.SUBMITTED, amount: Number(found.amount), reason },
            }, conn);
            return found;
        });

        createNotification({ user_id: row.user_id, ...templates.payment_reopened(row.course_name, reason) })
            .catch((error) => console.error('[Payment notification]', error.message));
        return res.json({ success: true, message: 'ยกเลิกผลยืนยันแล้ว รายการกลับเป็นรอตรวจสลิป' });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Reopen payment]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถแก้ผลการตรวจสลิปได้' });
    }
};
