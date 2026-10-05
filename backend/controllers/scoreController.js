const db = require('../config/db');
const emailService = require('../utils/emailService');
const { createNotification, templates } = require('./notificationController');
const { logAdminAction } = require('../utils/adminAudit');
const { APPLICATION_STATUS, EXAM_STATUS, HttpError, parseRequiredNumber } = require('../utils/domain');

const PASS_STATUS = 'ได้รับวุฒิบัตร';

const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

// อ่านและตรวจคะแนนจาก request ให้เป็นตัวเลขที่ถูกต้องตามข้อกำหนดของวิชานั้น
function parseScores(body, registration) {
    const theory = parseRequiredNumber(body.theory_score, 'คะแนนทฤษฎี');
    const practical = parseRequiredNumber(body.practical_score, 'คะแนนปฏิบัติ');
    const deducted = parseRequiredNumber(body.deducted_score, 'คะแนนหัก');
    for (const [label, value] of [['คะแนนทฤษฎี', theory], ['คะแนนปฏิบัติ', practical], ['คะแนนหัก', deducted]]) {
        // คอลัมน์เป็น DECIMAL(5,2): ทศนิยมเกิน 2 ตำแหน่งจะถูกปัดเงียบ ๆ ทำให้ผลรวมไม่ตรงกับที่ผู้กรอกเห็น
        if (!hasAtMostTwoDecimals(value)) throw new HttpError(400, `${label}ต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง`, 'VALIDATION_ERROR');
    }
    const theoryMax = Number(registration.theory_max_score || 30);
    const practicalMax = Number(registration.practical_max_score || 70);
    if (theory < 0 || theory > theoryMax) throw new HttpError(400, `คะแนนทฤษฎีต้องอยู่ระหว่าง 0-${theoryMax}`);
    if (practical < 0 || practical > practicalMax) throw new HttpError(400, `คะแนนปฏิบัติต้องอยู่ระหว่าง 0-${practicalMax}`);
    if (deducted < 0 || deducted > theory + practical) throw new HttpError(400, 'คะแนนหักต้องไม่ติดลบหรือมากกว่าคะแนนที่ได้');
    return { theory, practical, deducted };
}

async function loadRegistration(conn, registrationId) {
    const [[registration]] = await conn.query(
        `SELECT r.registration_id, r.application_status, r.exam_status, r.result_published_at,
                c.theory_max_score, c.practical_max_score, c.course_name,
                s.user_id, s.full_name, s.student_code, u.email
         FROM registrations r
         JOIN exam_courses c ON r.course_id = c.course_id
         JOIN students s ON r.student_id = s.student_id
         JOIN users u ON s.user_id = u.user_id
         WHERE r.registration_id = ? FOR UPDATE`,
        [registrationId]
    );
    if (!registration) throw new HttpError(404, 'ไม่พบใบสมัคร');
    return registration;
}

// เขียนคะแนน + audit ใน transaction ที่เปิดอยู่; คืนคะแนนเดิม/ใหม่ (total/status คำนวณโดย generated column)
async function writeScore(conn, registrationId, { theory, practical, deducted }, actorId) {
    const [[oldScore]] = await conn.query('SELECT * FROM scores WHERE registration_id = ? FOR UPDATE', [registrationId]);
    if (oldScore) {
        await conn.query(
            'UPDATE scores SET theory_score=?, practical_score=?, deducted_score=?, examiner_id=? WHERE registration_id=?',
            [theory, practical, deducted, actorId, registrationId]
        );
    } else {
        await conn.query(
            'INSERT INTO scores (registration_id, theory_score, practical_score, deducted_score, examiner_id) VALUES (?, ?, ?, ?, ?)',
            [registrationId, theory, practical, deducted, actorId]
        );
    }
    const [[newScore]] = await conn.query(
        'SELECT total_score, university_status, department_status FROM scores WHERE registration_id = ?',
        [registrationId]
    );
    await conn.query(
        `INSERT INTO score_audit_logs
         (registration_id, examiner_id, action, old_theory, old_practical, old_deducted, old_status,
          new_theory, new_practical, new_deducted, new_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            registrationId, actorId, oldScore ? 'UPDATE' : 'INSERT',
            oldScore?.theory_score ?? null, oldScore?.practical_score ?? null,
            oldScore?.deducted_score ?? null, oldScore?.department_status ?? null,
            theory, practical, deducted, newScore.department_status,
        ]
    );
    return { oldScore, newScore };
}

// เจ้าหน้าที่ (staff) บันทึกคะแนนครั้งแรกและประกาศผล; ผลที่ประกาศแล้วแก้ผ่านหน้านี้ไม่ได้
exports.submitScores = async (req, res) => {
    const registrationId = Number(req.body.registration_id);
    try {
        if (!Number.isInteger(registrationId) || registrationId <= 0) throw new HttpError(400, 'เลขใบสมัครไม่ถูกต้อง');
        const result = await db.withTransaction(async (conn) => {
            const registration = await loadRegistration(conn, registrationId);
            if (registration.application_status !== APPLICATION_STATUS.APPROVED) throw new HttpError(409, 'บันทึกคะแนนได้เฉพาะใบสมัครที่อนุมัติสิทธิ์สอบแล้ว');
            if (registration.result_published_at) throw new HttpError(403, 'ผลถูกประกาศแล้ว เจ้าหน้าที่แก้ไขเองไม่ได้ กรุณาแจ้งผู้ดูแลระบบเพื่อแก้ไขพร้อมระบุเหตุผล');
            if (registration.exam_status !== EXAM_STATUS.ATTENDED) throw new HttpError(409, 'ต้องยืนยันว่าผู้สมัครเข้าสอบก่อนบันทึกคะแนน');
            const scores = parseScores(req.body, registration);
            const { newScore } = await writeScore(conn, registrationId, scores, req.user.id);
            await conn.query('UPDATE registrations SET result_published_at = NOW(), exam_status = ? WHERE registration_id = ?', [EXAM_STATUS.PUBLISHED, registrationId]);
            return { registration, scores, newScore };
        });

        const { registration, scores, newScore } = result;
        createNotification({
            user_id: registration.user_id,
            ...templates.score_released(registration.course_name, newScore.department_status),
        }).catch((error) => console.error('[Score notification]', error.message));
        emailService.sendScoreResultEmail({
            to: registration.email,
            full_name: registration.full_name,
            student_code: registration.student_code,
            course_name: registration.course_name,
            theory_score: scores.theory,
            practical_score: scores.practical,
            theory_max_score: registration.theory_max_score,
            practical_max_score: registration.practical_max_score,
            total_score: newScore.total_score,
            department_status: newScore.department_status,
        }).catch((error) => console.error('[Score email]', error.message));

        return res.json({
            success: true,
            message: `บันทึกและประกาศผลสำเร็จ รวม ${newScore.total_score} คะแนน`,
            details: { theory_score: scores.theory, practical_score: scores.practical, deducted_score: scores.deducted, ...newScore },
        });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        console.error('[Submit score]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกคะแนนได้' });
    }
};

// ผู้ดูแลระบบ (admin) แก้ไขคะแนนที่ประกาศแล้ว: ต้องระบุเหตุผล, บันทึก audit ทั้งสองตาราง และปรับใบรับรองให้ตรงกับผลใหม่
exports.correctScore = async (req, res) => {
    const registrationId = Number(req.body.registration_id);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    try {
        if (!Number.isInteger(registrationId) || registrationId <= 0) throw new HttpError(400, 'เลขใบสมัครไม่ถูกต้อง');
        if (reason.length < 3 || reason.length > 255) throw new HttpError(400, 'กรุณาระบุเหตุผลการแก้ไข 3-255 ตัวอักษร');
        const result = await db.withTransaction(async (conn) => {
            const registration = await loadRegistration(conn, registrationId);
            if (!registration.result_published_at) throw new HttpError(409, 'ใบสมัครนี้ยังไม่ประกาศผล ให้เจ้าหน้าที่บันทึกคะแนนตามขั้นตอนปกติ');
            const scores = parseScores(req.body, registration);
            const { oldScore, newScore } = await writeScore(conn, registrationId, scores, req.user.id);

            let certificate = 'none';
            const [[existing]] = await conn.query('SELECT certificate_id, revoked_at FROM certificates WHERE registration_id = ? FOR UPDATE', [registrationId]);
            if (existing && !existing.revoked_at) {
                if (newScore.department_status === PASS_STATUS) {
                    await conn.query('UPDATE certificates SET total_score = ? WHERE registration_id = ?', [newScore.total_score, registrationId]);
                    certificate = 'updated';
                } else {
                    await conn.query(
                        'UPDATE certificates SET revoked_at = NOW(), revoked_reason = ? WHERE registration_id = ? AND revoked_at IS NULL',
                        ['คะแนนถูกแก้ไขและไม่ผ่านเกณฑ์', registrationId]
                    );
                    certificate = 'revoked';
                }
            }
            await logAdminAction({
                actorId: req.user.id, action: 'CORRECT_SCORE', targetType: 'registration', targetId: registrationId,
                details: {
                    reason,
                    from: oldScore ? { theory: oldScore.theory_score, practical: oldScore.practical_score, deducted: oldScore.deducted_score, status: oldScore.department_status } : null,
                    to: { theory: scores.theory, practical: scores.practical, deducted: scores.deducted, status: newScore.department_status },
                    certificate,
                },
            }, conn);
            return { registration, scores, newScore, certificate };
        });

        const { registration, scores, newScore, certificate } = result;
        createNotification({ user_id: registration.user_id, ...templates.score_corrected(registration.course_name) })
            .catch((error) => console.error('[Score correction notification]', error.message));
        emailService.sendScoreResultEmail({
            to: registration.email,
            full_name: registration.full_name,
            student_code: registration.student_code,
            course_name: registration.course_name,
            theory_score: scores.theory,
            practical_score: scores.practical,
            theory_max_score: registration.theory_max_score,
            practical_max_score: registration.practical_max_score,
            total_score: newScore.total_score,
            department_status: newScore.department_status,
            corrected: true,
        }).catch((error) => console.error('[Score correction email]', error.message));

        return res.json({
            success: true,
            message: `แก้ไขคะแนนสำเร็จ รวม ${newScore.total_score} คะแนน`,
            certificate,
            details: { theory_score: scores.theory, practical_score: scores.practical, deducted_score: scores.deducted, ...newScore },
        });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        console.error('[Correct score]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถแก้ไขคะแนนได้' });
    }
};

// รายการผลสอบที่ประกาศแล้ว สำหรับหน้าแก้ไขคะแนนของผู้ดูแลระบบ (ค้นด้วยชื่อ/รหัส/เลขใบสมัคร)
exports.listPublishedResults = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = ['r.result_published_at IS NOT NULL'];
    const params = [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    if (search) {
        where.push('(s.full_name LIKE ? OR s.student_code LIKE ? OR s.university_student_code LIKE ? OR r.application_no LIKE ?)');
        const term = `%${search}%`;
        params.push(term, term, term, term);
    }
    try {
        const base = `FROM registrations r
             JOIN students s ON r.student_id = s.student_id
             JOIN exam_courses c ON r.course_id = c.course_id
             JOIN scores sc ON sc.registration_id = r.registration_id
             WHERE ${where.join(' AND ')}`;
        const [rows] = await db.query(
            `SELECT r.registration_id, r.application_no, r.attempt_no, r.result_published_at,
                    s.student_code, s.university_student_code, s.title, s.full_name,
                    c.course_name, c.theory_max_score, c.practical_max_score,
                    sc.theory_score, sc.practical_score, sc.deducted_score, sc.total_score, sc.department_status
             ${base} ORDER BY r.result_published_at DESC, r.registration_id DESC LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );
        const [[count]] = await db.query(`SELECT COUNT(*) AS total ${base}`, params);
        return res.json({ success: true, data: rows, pagination: { page, limit, total: Number(count.total), pages: Math.max(1, Math.ceil(Number(count.total) / limit)) } });
    } catch (error) {
        console.error('[Published results]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดผลสอบที่ประกาศแล้วได้' });
    }
};

module.exports._parseScores = parseScores;
