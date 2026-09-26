const db = require('../config/db');
const { createNotification, templates } = require('./notificationController');
const emailService = require('../utils/emailService');
const { logAdminAction } = require('../utils/adminAudit');
const {
    APPLICATION_STATUS,
    STUDENT_STATUS,
    COURSE_STATUS,
    EXAM_STATUS,
    HttpError,
    computeCourseStatus,
    createApplicationNo,
} = require('../utils/domain');

exports.getStudentMe = async (req, res) => {
    try {
        const [[student]] = await db.query(
            `SELECT student_id, student_code, university_student_code, title, full_name, registration_status,
                    verify_note, doc_id_card, doc_education, doc_photo
             FROM students WHERE user_id = ?`,
            [req.user.id]
        );
        if (!student) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้สมัคร' });
        const [applications] = await db.query(
            `SELECT r.registration_id, r.application_no, r.application_status, r.registered_at,
                    r.attempt_no, r.is_retake, r.exam_status, r.result_published_at,
                    c.course_name, c.exam_date, c.exam_time, c.exam_location,
                    sc.theory_score, sc.practical_score, sc.deducted_score,
                    sc.total_score, sc.department_status
             FROM registrations r
             JOIN exam_courses c ON r.course_id = c.course_id
             LEFT JOIN scores sc ON r.registration_id = sc.registration_id
             WHERE r.student_id = ? ORDER BY r.registered_at DESC`,
            [student.student_id]
        );
        return res.json({ success: true, student, data: applications });
    } catch (error) {
        console.error('[Student me]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลผู้สมัครได้' });
    }
};

exports.getAllRegistrations = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    try {
        const [rows] = await db.query(
            `SELECT r.registration_id, r.application_no, r.application_status, r.registered_at,
                    r.attempt_no, r.is_retake, r.exam_status, r.result_published_at,
                    s.student_code, s.university_student_code, s.title, s.full_name,
                    c.course_code, c.course_name, c.exam_date, c.exam_time, c.exam_location,
                    c.theory_max_score, c.practical_max_score,
                    sc.theory_score, sc.practical_score, sc.deducted_score,
                    sc.total_score, sc.department_status
             FROM registrations r
             JOIN students s ON r.student_id = s.student_id
             JOIN exam_courses c ON r.course_id = c.course_id
             LEFT JOIN scores sc ON r.registration_id = sc.registration_id
             ORDER BY r.registered_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const [[count]] = await db.query('SELECT COUNT(*) AS total FROM registrations');
        return res.json({ success: true, data: rows, total: count.total, page, per_page: limit });
    } catch (error) {
        console.error('[Registrations]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดใบสมัครได้' });
    }
};

exports.updateRegistrationStatus = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    const { status } = req.body;
    if (![APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED].includes(status)) {
        return res.status(400).json({ success: false, message: 'สถานะใบสมัครไม่ถูกต้อง' });
    }
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        const [[registration]] = await conn.query(
            `SELECT r.registration_id, r.application_no, r.application_status, r.exam_status, r.result_published_at,
                    s.user_id, s.student_code, s.full_name, u.email,
                    c.course_name, c.exam_date, c.exam_time, c.exam_location
             FROM registrations r
             JOIN students s ON r.student_id = s.student_id
             JOIN users u ON s.user_id = u.user_id
             JOIN exam_courses c ON r.course_id = c.course_id
             WHERE r.registration_id = ? FOR UPDATE`,
            [registrationId]
        );
        if (!registration) throw new HttpError(404, 'ไม่พบใบสมัคร');
        if (registration.result_published_at) throw new HttpError(409, 'ไม่สามารถเปลี่ยนสถานะหลังประกาศผลแล้ว');
        const nextExamStatus = status === APPLICATION_STATUS.APPROVED ? (registration.exam_status || EXAM_STATUS.WAITING) : EXAM_STATUS.WAITING;
        await conn.query('UPDATE registrations SET application_status = ?, exam_status = ? WHERE registration_id = ?', [status, nextExamStatus, registrationId]);
        await conn.commit();
        logAdminAction({ actorId: req.user.id, action: 'CHANGE_APPLICATION_STATUS', targetType: 'registration', targetId: registrationId, details: { from: registration.application_status, to: status } })
            .catch((error) => console.error('[Admin audit]', error.message));

        const template = status === APPLICATION_STATUS.APPROVED
            ? templates.exam_approved(registration.course_name)
            : status === APPLICATION_STATUS.REJECTED
                ? templates.exam_rejected(registration.course_name)
                : null;
        if (template) {
            createNotification({ user_id: registration.user_id, ...template })
                .catch((error) => console.error('[Application notification]', error.message));
        }
        if (template && registration.email) {
            emailService.sendExamApplicationStatusEmail({
                to: registration.email,
                full_name: registration.full_name,
                student_code: registration.student_code,
                application_no: registration.application_no,
                course_name: registration.course_name,
                status,
                exam_date: registration.exam_date,
                exam_time: registration.exam_time,
                exam_location: registration.exam_location,
            }).catch((error) => console.error('[Application status email]', error.message));
        }
        return res.json({ success: true, message: `เปลี่ยนสถานะเป็น "${status}" เรียบร้อย` });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Update registration]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะใบสมัครได้' });
    } finally {
        if (conn) conn.release();
    }
};

exports.updateExamStatus = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    const { status } = req.body;
    if (![EXAM_STATUS.WAITING, EXAM_STATUS.ATTENDED, EXAM_STATUS.ABSENT, EXAM_STATUS.CANCELLED].includes(status)) {
        return res.status(400).json({ success: false, message: 'สถานะการเข้าสอบไม่ถูกต้อง' });
    }
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        const [[registration]] = await conn.query(
            'SELECT registration_id, application_status, exam_status, result_published_at FROM registrations WHERE registration_id = ? FOR UPDATE',
            [registrationId]
        );
        if (!registration) throw new HttpError(404, 'ไม่พบใบสมัคร');
        if (registration.application_status !== APPLICATION_STATUS.APPROVED) throw new HttpError(409, 'ใบสมัครยังไม่ได้รับอนุมัติสิทธิ์สอบ');
        if (registration.result_published_at) throw new HttpError(409, 'ไม่สามารถเปลี่ยนสถานะหลังประกาศผลแล้ว');
        await conn.query('UPDATE registrations SET exam_status = ? WHERE registration_id = ?', [status, registrationId]);
        await conn.commit();
        logAdminAction({ actorId: req.user.id, action: 'CHANGE_EXAM_STATUS', targetType: 'registration', targetId: registrationId, details: { from: registration.exam_status, to: status } })
            .catch((error) => console.error('[Admin audit]', error.message));
        return res.json({ success: true, message: `เปลี่ยนสถานะการสอบเป็น "${status}" เรียบร้อย` });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Update exam status]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะการสอบได้' });
    } finally {
        if (conn) conn.release();
    }
};

exports.getAvailableCourses = async (req, res) => {
    try {
        const [courses] = await db.query(
            `SELECT course_id, course_code, course_name, exam_date, exam_time, exam_location,
                    reg_open_date, reg_close_date, max_seats, course_status, status_override
             FROM exam_courses ORDER BY exam_date ASC`
        );
        const data = courses.map((course) => ({ ...course, course_status: computeCourseStatus(course) }));
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายวิชาได้' });
    }
};

async function getOrCreateSession(conn, course) {
    if (!course.exam_date || !course.exam_location) throw new HttpError(409, 'วิชานี้ยังไม่ได้กำหนดวันสอบหรือสถานที่สอบ');
    const sessionName = `${course.course_code} ${course.exam_time || ''}`.trim();
    const [result] = await conn.query(
        `INSERT INTO exam_sessions (session_name, exam_date, location) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE session_id=LAST_INSERT_ID(session_id)`,
        [sessionName, course.exam_date, course.exam_location]
    );
    return result.insertId;
}

exports.applyExam = async (req, res) => {
    const courseId = Number(req.body.course_id);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ success: false, message: 'กรุณาเลือกวิชาสอบ' });
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        const [[student]] = await conn.query(
            `SELECT s.student_id, s.student_code, s.full_name, s.registration_status, u.email
             FROM students s JOIN users u ON s.user_id = u.user_id
             WHERE s.user_id = ? FOR UPDATE`,
            [req.user.id]
        );
        if (!student) throw new HttpError(404, 'ไม่พบข้อมูลผู้สมัคร');
        if (student.registration_status !== STUDENT_STATUS.APPROVED) throw new HttpError(409, 'เอกสารยังไม่ได้รับการอนุมัติ');

        const [[course]] = await conn.query('SELECT * FROM exam_courses WHERE course_id = ? FOR UPDATE', [courseId]);
        if (!course) throw new HttpError(404, 'ไม่พบวิชาสอบ');
        if (computeCourseStatus(course) !== COURSE_STATUS.OPEN) throw new HttpError(409, 'วิชานี้ไม่ได้อยู่ในช่วงเปิดรับสมัคร');
        const [[seat]] = await conn.query(
            'SELECT COUNT(*) AS total FROM registrations WHERE course_id = ? AND application_status <> ?',
            [courseId, APPLICATION_STATUS.REJECTED]
        );
        if (course.max_seats && seat.total >= course.max_seats) throw new HttpError(409, 'จำนวนผู้สมัครเต็มแล้ว');

        const [[existing]] = await conn.query(
            'SELECT registration_id, application_status, attempt_no FROM registrations WHERE student_id = ? AND course_id = ? ORDER BY attempt_no DESC LIMIT 1 FOR UPDATE',
            [student.student_id, courseId]
        );
        if (existing && existing.application_status !== APPLICATION_STATUS.REJECTED) throw new HttpError(409, 'คุณมีใบสมัครวิชานี้อยู่แล้ว');
        if (existing && existing.attempt_no > 1) throw new HttpError(409, 'กรุณาใช้ขั้นตอนสมัครสอบซ่อม');

        const sessionId = await getOrCreateSession(conn, course);
        const applicationNo = createApplicationNo();
        if (existing) {
            await conn.query(
                `UPDATE registrations SET session_id=?, application_no=?, application_status=?, registered_at=NOW()
                 WHERE registration_id=?`,
                [sessionId, applicationNo, APPLICATION_STATUS.PENDING, existing.registration_id]
            );
        } else {
            await conn.query(
                `INSERT INTO registrations
                 (student_id, course_id, session_id, application_no, application_status, attempt_no, is_retake)
                 VALUES (?, ?, ?, ?, ?, 1, 0)`,
                [student.student_id, courseId, sessionId, applicationNo, APPLICATION_STATUS.PENDING]
            );
        }
        await conn.commit();
        if (student.email) {
            emailService.sendExamApplicationReceivedEmail({
                to: student.email,
                full_name: student.full_name,
                student_code: student.student_code,
                application_no: applicationNo,
                course_name: course.course_name,
                exam_date: course.exam_date,
                exam_time: course.exam_time,
                exam_location: course.exam_location,
            }).catch((error) => console.error('[Application confirmation email]', error.message));
        }
        if (process.env.STAFF_EMAIL) {
            emailService.sendNewApplicationAlert({
                to: process.env.STAFF_EMAIL,
                student_name: student.full_name,
                student_code: student.student_code,
                application_no: applicationNo,
                course_name: course.course_name,
                submitted_at: new Date().toLocaleString('th-TH', { timeZone: process.env.APP_TIMEZONE || 'Asia/Bangkok' }),
            }).catch((error) => console.error('[Application email]', error.message));
        }
        return res.status(201).json({ success: true, message: 'ยื่นใบสมัครสำเร็จ กรุณารอการอนุมัติสิทธิ์', application_no: applicationNo });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'มีใบสมัครนี้อยู่แล้ว กรุณาโหลดข้อมูลใหม่' });
        console.error('[Apply exam]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถยื่นใบสมัครได้' });
    } finally {
        if (conn) conn.release();
    }
};
