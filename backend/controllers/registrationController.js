const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { cleanupFiles } = require('../middleware/upload');
const { createNotification, templates } = require('./notificationController');
const emailService = require('../utils/emailService');
const { STUDENT_STATUS, HttpError, isValidThaiNationalId } = require('../utils/domain');
const { logAdminAction } = require('../utils/adminAudit');

const clean = (value) => {
    const normalized = String(value ?? '').trim();
    return normalized && normalized !== 'null' && normalized !== 'undefined' ? normalized : null;
};

function validateRegistration(body, files) {
    const required = ['username','password','email','university_student_code','title','full_name','id_card','birth_date','gender','phone','address','education_level','education_major','employment_status'];
    const missing = required.filter((field) => !clean(body[field]));
    if (missing.length) throw new HttpError(400, `กรุณากรอกข้อมูลให้ครบ: ${missing.join(', ')}`, 'VALIDATION_ERROR');
    if (!/^[A-Za-z0-9._-]{4,50}$/.test(body.username)) throw new HttpError(400, 'ชื่อผู้ใช้ต้องยาว 4-50 ตัวและใช้เฉพาะตัวอักษร ตัวเลข จุด ขีดกลางหรือขีดล่าง');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new HttpError(400, 'รูปแบบอีเมลไม่ถูกต้อง');
    if (String(body.password).length < 8) throw new HttpError(400, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    if (!/^[A-Za-z0-9-]{4,30}$/.test(body.university_student_code)) throw new HttpError(400, 'รหัสนักศึกษามหาวิทยาลัยต้องยาว 4-30 ตัว และใช้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข หรือขีดกลาง');
    if (!isValidThaiNationalId(body.id_card)) throw new HttpError(400, 'เลขบัตรประชาชนไม่ผ่านการตรวจสอบ');
    if (!/^0\d{8,9}$/.test(body.phone)) throw new HttpError(400, 'เบอร์โทรศัพท์ไม่ถูกต้อง');
    const birthDate = new Date(`${body.birth_date}T00:00:00Z`);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) throw new HttpError(400, 'วันเกิดไม่ถูกต้อง');
    if (!files?.doc_id_card?.[0]) throw new HttpError(400, 'กรุณาแนบสำเนาบัตรประชาชน');
    if (String(body.privacy_consent).toLowerCase() !== 'true') throw new HttpError(400, 'กรุณายินยอมการเก็บและใช้ข้อมูลส่วนบุคคลตามวัตถุประสงค์ของระบบ');
}

exports.register = async (req, res) => {
    let conn;
    try {
        validateRegistration(req.body, req.files);
        conn = await db.getConnection();
        await conn.beginTransaction();

        const username = req.body.username.trim();
        const email = req.body.email.trim().toLowerCase();
        const universityStudentCode = req.body.university_student_code.trim().toUpperCase();
        const idCard = String(req.body.id_card).trim();
        // ให้ MySQL เป็นคนบอกว่า "ซ้ำที่ field ไหน" แทนการเทียบค่าใน JS
        // (คอลัมน์เป็น utf8mb4_unicode_ci = case-insensitive ทำให้ === ใน JS ไม่ตรงและรายงานผิด field)
        const [[duplicate]] = await conn.query(
            `SELECT
                MAX(u.username = ?)                  AS dup_username,
                MAX(u.email = ?)                     AS dup_email,
                MAX(s.id_card_number = ?)            AS dup_id_card,
                MAX(s.university_student_code = ?)   AS dup_university_code
             FROM users u LEFT JOIN students s ON u.user_id = s.user_id
             WHERE u.username = ? OR u.email = ? OR s.id_card_number = ? OR s.university_student_code = ?
             FOR UPDATE`,
            [username, email, idCard, universityStudentCode, username, email, idCard, universityStudentCode]
        );
        if (duplicate && (duplicate.dup_username || duplicate.dup_email || duplicate.dup_id_card || duplicate.dup_university_code)) {
            if (Number(duplicate.dup_username)) throw new HttpError(409, 'ชื่อผู้ใช้นี้ถูกใช้แล้ว', 'DUPLICATE_USERNAME');
            if (Number(duplicate.dup_email)) throw new HttpError(409, 'อีเมลนี้ถูกใช้แล้ว', 'DUPLICATE_EMAIL');
            if (Number(duplicate.dup_university_code)) throw new HttpError(409, 'รหัสนักศึกษามหาวิทยาลัยนี้ลงทะเบียนแล้ว', 'DUPLICATE_UNIVERSITY_STUDENT_CODE');
            throw new HttpError(409, 'เลขบัตรประชาชนนี้ถูกลงทะเบียนแล้ว', 'DUPLICATE_ID_CARD');
        }

        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const [userResult] = await conn.query(
            `INSERT INTO users
             (username, password_hash, email, role, email_verified_at, email_verification_token, email_verification_expires)
             VALUES (?, ?, ?, 'student', ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
            [username, passwordHash, email, requireEmailVerification ? null : new Date(), requireEmailVerification ? verificationHash : null]
        );
        const userId = userResult.insertId;
        const year = new Date().getFullYear() + 543;
        const studentCode = `STD-${year}-${String(userId).padStart(6, '0')}`;
        const uploaded = Object.fromEntries(Object.entries(req.files || {}).map(([field, list]) => [field, list[0].filename]));

        const [studentResult] = await conn.query(
            `INSERT INTO students (
                user_id, student_code, university_student_code, title, full_name,
                id_card_number, birth_date, gender, nationality, phone_number, address_text,
                highest_education, education_major, employment_status,
                applicant_type, work_status, industry_group, monthly_income,
                current_occupation, current_position, work_experience_years, average_income,
                doc_id_card, doc_education, doc_photo,
                privacy_consent_at, privacy_policy_version, registration_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
            [
                userId, studentCode, universityStudentCode, clean(req.body.title), clean(req.body.full_name),
                idCard, req.body.birth_date, req.body.gender, clean(req.body.nationality) || 'ไทย', req.body.phone, req.body.address,
                req.body.education_level, req.body.education_major, req.body.employment_status,
                clean(req.body.applicant_type), clean(req.body.work_status), clean(req.body.industry_group), clean(req.body.monthly_income),
                clean(req.body.current_occupation), clean(req.body.current_position), Number.parseInt(req.body.work_experience_years, 10) || 0, clean(req.body.average_income),
                uploaded.doc_id_card || null, uploaded.doc_education || null, uploaded.doc_photo || null,
                process.env.PRIVACY_POLICY_VERSION || '1.0', STUDENT_STATUS.PENDING,
            ]
        );
        for (const [documentType, filename] of Object.entries(uploaded)) {
            await conn.query(
                `INSERT INTO student_document_versions
                 (student_id, document_type, filename, uploaded_by, is_current)
                 VALUES (?, ?, ?, ?, 1)`,
                [studentResult.insertId, documentType, filename, userId]
            );
        }
        await conn.commit();
        if (requireEmailVerification) {
            emailService.sendEmailVerification({ to: email, token: verificationToken })
                .catch((error) => console.error('[Verification email]', error.message));
        }
        return res.status(201).json({
            success: true,
            message: requireEmailVerification ? 'ลงทะเบียนสำเร็จ กรุณาตรวจอีเมลเพื่อยืนยันบัญชี' : 'ลงทะเบียนสำเร็จ',
            student_code: studentCode,
            university_student_code: universityStudentCode,
        });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        cleanupFiles(req.files);
        if (error.code === 'ER_DUP_ENTRY') {
            const key = String(error.sqlMessage || '');
            const message = key.includes('uq_students_university_code') ? 'รหัสนักศึกษามหาวิทยาลัยนี้ลงทะเบียนแล้ว'
                : key.includes('uq_students_id_card') ? 'เลขบัตรประชาชนนี้ถูกลงทะเบียนแล้ว'
                : key.includes('uq_users_email') ? 'อีเมลนี้ถูกใช้แล้ว'
                : key.includes('uq_users_username') ? 'ชื่อผู้ใช้นี้ถูกใช้แล้ว'
                : 'ข้อมูลบัญชีหรือผู้สมัครซ้ำในระบบ';
            return res.status(409).json({ success: false, code: 'DUPLICATE_ENTRY', message });
        }
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        console.error('[Register]', error.code || '', error.sqlMessage || error.message);
        return res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production'
                ? 'เกิดข้อผิดพลาดในการลงทะเบียน'
                : `เกิดข้อผิดพลาดในการลงทะเบียน: ${error.sqlMessage || error.message}`,
        });
    } finally {
        if (conn) conn.release();
    }
};

exports.getPendingRegistrations = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT s.student_id, s.student_code, s.university_student_code, s.title, s.full_name,
                    s.id_card_number, s.phone_number, s.highest_education,
                    s.education_major, s.employment_status, s.registration_status,
                    s.verify_note, s.doc_id_card, s.doc_education, s.doc_photo,
                    u.email, s.created_at
             FROM students s JOIN users u ON s.user_id = u.user_id
             WHERE s.registration_status IN (?, ?)
             ORDER BY s.created_at ASC`,
            [STUDENT_STATUS.PENDING, STUDENT_STATUS.INCOMPLETE]
        );
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('[Pending registrations]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายการได้' });
    }
};

exports.verifyStudent = async (req, res) => {
    const studentId = Number(req.params.id);
    const { status, note } = req.body;
    if (![STUDENT_STATUS.APPROVED, STUDENT_STATUS.INCOMPLETE].includes(status)) {
        return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        const [[student]] = await conn.query(
            `SELECT s.student_id, s.student_code, s.full_name, s.user_id, s.registration_status, u.email
             FROM students s JOIN users u ON u.user_id = s.user_id
             WHERE s.student_id = ? FOR UPDATE`,
            [studentId]
        );
        if (!student) throw new HttpError(404, 'ไม่พบผู้สมัคร');
        await conn.query(
            'UPDATE students SET registration_status=?, verify_note=?, verified_by=?, verified_at=NOW() WHERE student_id=?',
            [status, clean(note), req.user.id, studentId]
        );
        await conn.query(
            'INSERT INTO student_verifications (student_id, action, note, admin_id) VALUES (?, ?, ?, ?)',
            [studentId, status, clean(note), req.user.id]
        );
        await conn.commit();
        logAdminAction({ actorId: req.user.id, action: 'VERIFY_STUDENT_DOCUMENTS', targetType: 'student', targetId: studentId, details: { from: student.registration_status, to: status } })
            .catch((error) => console.error('[Admin audit]', error.message));

        const template = status === STUDENT_STATUS.APPROVED
            ? templates.doc_approved(student.student_code)
            : templates.doc_rejected(clean(note));
        createNotification({ user_id: student.user_id, ...template })
            .catch((error) => console.error('[Verification notification]', error.message));
        emailService.sendDocumentVerificationEmail({
            to: student.email,
            full_name: student.full_name,
            status,
            note: clean(note),
            student_code: student.student_code,
        }).catch((error) => console.error('[Verification email]', error.message));
        return res.json({ success: true, message: `อัปเดตสถานะเป็น "${status}" สำเร็จ` });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Verify student]', error.message);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการตรวจเอกสาร' });
    } finally {
        if (conn) conn.release();
    }
};

exports.resubmitDocuments = async (req, res) => {
    const uploaded = Object.fromEntries(Object.entries(req.files || {}).map(([field, list]) => [field, list[0].filename]));
    if (!Object.keys(uploaded).length) return res.status(400).json({ success: false, message: 'กรุณาเลือกเอกสารอย่างน้อยหนึ่งไฟล์' });
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        const [[student]] = await conn.query(
            'SELECT student_id, registration_status, doc_id_card, doc_education, doc_photo FROM students WHERE user_id = ? FOR UPDATE',
            [req.user.id]
        );
        if (!student) throw new HttpError(404, 'ไม่พบข้อมูลผู้สมัคร');
        if (student.registration_status !== STUDENT_STATUS.INCOMPLETE) throw new HttpError(409, 'ส่งเอกสารใหม่ได้เฉพาะรายการที่แจ้งว่าเอกสารไม่ครบ');

        const fields = ['doc_id_card','doc_education','doc_photo'].filter((field) => uploaded[field]);
        const assignments = fields.map((field) => `${field} = ?`).join(', ');
        for (const field of fields) {
            await conn.query(
                'UPDATE student_document_versions SET is_current=0 WHERE student_id=? AND document_type=? AND is_current=1',
                [student.student_id, field]
            );
            await conn.query(
                `INSERT INTO student_document_versions
                 (student_id, document_type, filename, uploaded_by, is_current)
                 VALUES (?, ?, ?, ?, 1)`,
                [student.student_id, field, uploaded[field], req.user.id]
            );
        }
        await conn.query(
            `UPDATE students SET ${assignments}, registration_status=?, verify_note=NULL, verified_by=NULL, verified_at=NULL WHERE student_id=?`,
            [...fields.map((field) => uploaded[field]), STUDENT_STATUS.PENDING, student.student_id]
        );
        await conn.commit();
        return res.json({ success: true, message: 'ส่งเอกสารใหม่เรียบร้อยแล้ว กรุณารอการตรวจสอบ' });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        cleanupFiles(req.files);
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Resubmit documents]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถส่งเอกสารใหม่ได้' });
    } finally {
        if (conn) conn.release();
    }
};