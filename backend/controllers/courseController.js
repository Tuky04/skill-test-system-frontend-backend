const db = require('../config/db');
const {
    APPLICATION_STATUS,
    COURSE_STATUS,
    HttpError,
    computeCourseStatus,
    normalizeDate,
    isValidDateOnly,
} = require('../utils/domain');
const { logAdminAction } = require('../utils/adminAudit');
const { resyncCourseSessions } = require('../utils/sessions');

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function scoreLimit(value, fallback, label) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    // คอลัมน์เป็น DECIMAL(5,2): ต้องเป็นบวก ไม่เกิน 999.99 และทศนิยมไม่เกิน 2 ตำแหน่ง
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999.99 || Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-6) {
        throw new HttpError(400, `${label}ต้องเป็นตัวเลขมากกว่า 0 ไม่เกิน 999.99`, 'VALIDATION_ERROR');
    }
    return parsed;
}

function validateCourse(body, requireNames = true) {
    const courseCode = text(body.course_code);
    const courseName = text(body.course_name);
    if (requireNames && (!courseCode || !courseName)) throw new HttpError(400, 'กรุณาระบุรหัสและชื่อวิชา');
    if (courseCode.length > 50 || courseName.length > 255) throw new HttpError(400, 'รหัสวิชาต้องไม่เกิน 50 ตัวอักษร และชื่อวิชาไม่เกิน 255 ตัวอักษร');
    const open = normalizeDate(body.reg_open_date);
    const close = normalizeDate(body.reg_close_date);
    const exam = normalizeDate(body.exam_date);
    if (!open || !close) throw new HttpError(400, 'กรุณาระบุวันเปิดและวันปิดรับสมัคร');
    for (const [label, value] of [['วันเปิดรับสมัคร', open], ['วันปิดรับสมัคร', close], ['วันสอบ', exam]]) {
        if (value && !isValidDateOnly(value)) throw new HttpError(400, `${label}ไม่ถูกต้อง`);
    }
    if (open > close) throw new HttpError(400, 'วันเปิดรับสมัครต้องไม่เกินวันปิดรับสมัคร');
    if (exam && close > exam) throw new HttpError(400, 'วันปิดรับสมัครต้องไม่เกินวันสอบ');
    const maxSeats = Number(body.max_seats);
    if (!Number.isInteger(maxSeats) || maxSeats <= 0 || maxSeats > 100000) throw new HttpError(400, 'จำนวนที่รับต้องเป็นจำนวนเต็มมากกว่าศูนย์');
    const maxAttempts = Number(body.max_attempts || 3);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new HttpError(400, 'จำนวนครั้งสอบต้องอยู่ระหว่าง 1-10');
    const examTime = text(body.exam_time) || null;
    const examLocation = text(body.exam_location) || null;
    const description = text(body.description) || null;
    if ((examTime && examTime.length > 50) || (examLocation && examLocation.length > 255) || (description && description.length > 5000)) {
        throw new HttpError(400, 'เวลาสอบ (≤50), สถานที่สอบ (≤255) หรือคำอธิบาย (≤5000) ยาวเกินกำหนด');
    }
    const theoryMax = scoreLimit(body.theory_max_score, 30, 'คะแนนเต็มภาคทฤษฎี');
    const practicalMax = scoreLimit(body.practical_max_score, 70, 'คะแนนเต็มภาคปฏิบัติ');
    return { courseCode, courseName, open, close, exam, maxSeats, maxAttempts, examTime, examLocation, description, theoryMax, practicalMax };
}

function withComputedStatus(course) {
    return { ...course, course_status: computeCourseStatus(course) };
}

function sendError(res, error, fallback) {
    if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'รหัสวิชานี้มีอยู่แล้ว' });
    console.error('[Course]', error.message);
    return res.status(500).json({ success: false, message: fallback });
}

const parseCourseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'รหัสวิชาไม่ถูกต้อง');
    return id;
};

exports.getAllCourses = async (req, res) => {
    try {
        const [courses] = await db.query('SELECT * FROM exam_courses ORDER BY course_id DESC');
        return res.json({ success: true, data: courses.map(withComputedStatus) });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถโหลดวิชาสอบได้');
    }
};

exports.getPublicCourses = async (req, res) => {
    try {
        const [courses] = await db.query(
            `SELECT course_id, course_code, course_name, exam_date, exam_time, exam_location,
                    reg_open_date, reg_close_date, max_seats, course_status, status_override
             FROM exam_courses ORDER BY exam_date ASC`
        );
        res.setHeader('Cache-Control', 'public, max-age=30');
        return res.json({ success: true, data: courses.map(withComputedStatus) });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถโหลดวิชาสอบได้');
    }
};

exports.createCourse = async (req, res) => {
    try {
        const v = validateCourse(req.body);
        const courseId = await db.withTransaction(async (conn) => {
            const [result] = await conn.query(
                `INSERT INTO exam_courses
                 (course_code, course_name, exam_date, exam_time, exam_location,
                  reg_open_date, reg_close_date, max_seats, max_attempts, description,
                  theory_max_score, practical_max_score, course_status, status_override)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
                [
                    v.courseCode, v.courseName, v.exam, v.examTime, v.examLocation,
                    v.open, v.close, v.maxSeats, v.maxAttempts, v.description,
                    v.theoryMax, v.practicalMax, COURSE_STATUS.CLOSED,
                ]
            );
            await logAdminAction({ actorId: req.user.id, action: 'CREATE_COURSE', targetType: 'course', targetId: result.insertId, details: { course_code: v.courseCode } }, conn);
            return result.insertId;
        });
        return res.status(201).json({ success: true, course_id: courseId, message: 'เพิ่มวิชาสอบสำเร็จ' });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถเพิ่มวิชาสอบได้');
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const courseId = parseCourseId(req.params.course_id);
        const v = validateCourse(req.body);
        await db.withTransaction(async (conn) => {
            const [[existing]] = await conn.query('SELECT * FROM exam_courses WHERE course_id = ? FOR UPDATE', [courseId]);
            if (!existing) throw new HttpError(404, 'ไม่พบวิชาสอบ');

            // ห้ามแก้ค่าให้ขัดกับข้อมูลที่เกิดขึ้นแล้ว (เดิมแก้ได้อิสระ ทำให้ผู้สมัครเกินที่นั่งหรือคะแนนเกินคะแนนเต็ม)
            const [[usage]] = await conn.query(
                'SELECT COUNT(*) AS seats, COALESCE(MAX(attempt_no), 0) AS max_attempt FROM registrations WHERE course_id = ? AND application_status <> ?',
                [courseId, APPLICATION_STATUS.REJECTED]
            );
            if (Number(usage.seats) > v.maxSeats) throw new HttpError(409, `มีผู้สมัครอยู่แล้ว ${usage.seats} คน จึงลดจำนวนที่รับให้ต่ำกว่านี้ไม่ได้`);
            if (Number(usage.max_attempt) > v.maxAttempts) throw new HttpError(409, `มีผู้สอบถึงครั้งที่ ${usage.max_attempt} แล้ว จึงลดจำนวนครั้งสอบสูงสุดให้ต่ำกว่านี้ไม่ได้`);
            const [[overflow]] = await conn.query(
                `SELECT 1 AS found FROM scores sc JOIN registrations r ON r.registration_id = sc.registration_id
                 WHERE r.course_id = ? AND (sc.theory_score > ? OR sc.practical_score > ?) LIMIT 1`,
                [courseId, v.theoryMax, v.practicalMax]
            );
            if (overflow) throw new HttpError(409, 'มีคะแนนที่บันทึกไว้เกินคะแนนเต็มใหม่ จึงลดคะแนนเต็มไม่ได้');

            await conn.query(
                `UPDATE exam_courses SET course_code=?, course_name=?, exam_date=?, exam_time=?, exam_location=?,
                        reg_open_date=?, reg_close_date=?, max_seats=?, max_attempts=?, description=?,
                        theory_max_score=?, practical_max_score=? WHERE course_id=?`,
                [
                    v.courseCode, v.courseName, v.exam, v.examTime, v.examLocation,
                    v.open, v.close, v.maxSeats, v.maxAttempts, v.description,
                    v.theoryMax, v.practicalMax, courseId,
                ]
            );
            // ย้ายใบสมัครที่ยังไม่ประกาศผลไปรอบสอบใหม่ให้ตรงกับวัน/เวลา/สถานที่ที่แก้
            const resynced = await resyncCourseSessions(conn, {
                course_id: courseId, course_code: v.courseCode, exam_date: v.exam, exam_time: v.examTime, exam_location: v.examLocation,
            });
            await logAdminAction({ actorId: req.user.id, action: 'UPDATE_COURSE', targetType: 'course', targetId: courseId, details: { course_code: v.courseCode, registrations_moved_to_new_session: resynced } }, conn);
        });
        return res.json({ success: true, message: 'อัปเดตวิชาสอบสำเร็จ' });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถแก้ไขวิชาสอบได้');
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const courseId = parseCourseId(req.params.course_id);
        await db.withTransaction(async (conn) => {
            const [[course]] = await conn.query('SELECT course_code FROM exam_courses WHERE course_id = ? FOR UPDATE', [courseId]);
            if (!course) throw new HttpError(404, 'ไม่พบวิชาสอบ');
            const [[usage]] = await conn.query('SELECT COUNT(*) AS total FROM registrations WHERE course_id = ?', [courseId]);
            if (usage.total) throw new HttpError(409, 'ไม่สามารถลบวิชาที่มีใบสมัครได้');
            await conn.query('DELETE FROM exam_courses WHERE course_id = ?', [courseId]);
            await logAdminAction({ actorId: req.user.id, action: 'DELETE_COURSE', targetType: 'course', targetId: courseId, details: { course_code: course.course_code } }, conn);
        });
        return res.json({ success: true, message: 'ลบวิชาสอบสำเร็จ' });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถลบวิชาสอบได้');
    }
};

exports.toggleCourseStatus = async (req, res) => {
    try {
        const courseId = parseCourseId(req.params.course_id);
        const newStatus = await db.withTransaction(async (conn) => {
            const [[course]] = await conn.query('SELECT * FROM exam_courses WHERE course_id = ? FOR UPDATE', [courseId]);
            if (!course) throw new HttpError(404, 'ไม่พบวิชาสอบ');
            const next = computeCourseStatus(course) === COURSE_STATUS.OPEN ? COURSE_STATUS.CLOSED : COURSE_STATUS.OPEN;
            await conn.query('UPDATE exam_courses SET status_override = ? WHERE course_id = ?', [next, courseId]);
            await logAdminAction({ actorId: req.user.id, action: 'OVERRIDE_COURSE_STATUS', targetType: 'course', targetId: courseId, details: { to: next } }, conn);
            return next;
        });
        return res.json({ success: true, message: `เปลี่ยนสถานะเป็น ${newStatus}`, new_status: newStatus });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถเปลี่ยนสถานะได้');
    }
};

exports.clearCourseStatusOverride = async (req, res) => {
    try {
        const courseId = parseCourseId(req.params.course_id);
        await db.withTransaction(async (conn) => {
            const [result] = await conn.query('UPDATE exam_courses SET status_override = NULL WHERE course_id = ?', [courseId]);
            if (!result.affectedRows) throw new HttpError(404, 'ไม่พบวิชาสอบ');
            await logAdminAction({ actorId: req.user.id, action: 'CLEAR_COURSE_STATUS_OVERRIDE', targetType: 'course', targetId: courseId }, conn);
        });
        return res.json({ success: true, message: 'กลับมาใช้สถานะตามวันที่แล้ว' });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถกลับไปใช้สถานะอัตโนมัติได้');
    }
};

module.exports._validateCourse = validateCourse;
