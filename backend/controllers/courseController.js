const db = require('../config/db');
const { COURSE_STATUS, HttpError, computeCourseStatus, normalizeDate } = require('../utils/domain');

function validateCourse(body, requireNames = true) {
    const courseCode = String(body.course_code || '').trim();
    const courseName = String(body.course_name || '').trim();
    if (requireNames && (!courseCode || !courseName)) throw new HttpError(400, 'กรุณาระบุรหัสและชื่อวิชา');
    const open = normalizeDate(body.reg_open_date);
    const close = normalizeDate(body.reg_close_date);
    const exam = normalizeDate(body.exam_date);
    if (!open || !close) throw new HttpError(400, 'กรุณาระบุวันเปิดและวันปิดรับสมัคร');
    if (open > close) throw new HttpError(400, 'วันเปิดรับสมัครต้องไม่เกินวันปิดรับสมัคร');
    if (exam && close > exam) throw new HttpError(400, 'วันปิดรับสมัครต้องไม่เกินวันสอบ');
    const maxSeats = Number(body.max_seats);
    if (!Number.isInteger(maxSeats) || maxSeats <= 0) throw new HttpError(400, 'จำนวนที่รับต้องเป็นจำนวนเต็มมากกว่าศูนย์');
    const maxAttempts = Number(body.max_attempts || 3);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new HttpError(400, 'จำนวนครั้งสอบต้องอยู่ระหว่าง 1-10');
    return { courseCode, courseName, open, close, exam, maxSeats, maxAttempts };
}

function withComputedStatus(course) {
    return { ...course, course_status: computeCourseStatus(course) };
}

exports.getAllCourses = async (req, res) => {
    try {
        const [courses] = await db.query('SELECT * FROM exam_courses ORDER BY course_id DESC');
        return res.json({ success: true, data: courses.map(withComputedStatus) });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดวิชาสอบได้' });
    }
};

exports.getPublicCourses = async (req, res) => {
    try {
        const [courses] = await db.query(
            `SELECT course_id, course_code, course_name, exam_date, exam_time, exam_location,
                    reg_open_date, reg_close_date, max_seats, course_status, status_override
             FROM exam_courses ORDER BY exam_date ASC`
        );
        return res.json({ success: true, data: courses.map(withComputedStatus) });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดวิชาสอบได้' });
    }
};

exports.createCourse = async (req, res) => {
    try {
        const v = validateCourse(req.body);
        const [result] = await db.query(
            `INSERT INTO exam_courses
             (course_code, course_name, exam_date, exam_time, exam_location,
              reg_open_date, reg_close_date, max_seats, max_attempts, description,
              theory_max_score, practical_max_score, course_status, status_override)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            [
                v.courseCode, v.courseName, v.exam, req.body.exam_time || null, req.body.exam_location || null,
                v.open, v.close, v.maxSeats, v.maxAttempts, req.body.description || null,
                Number(req.body.theory_max_score || 30), Number(req.body.practical_max_score || 70), COURSE_STATUS.CLOSED,
            ]
        );
        return res.status(201).json({ success: true, course_id: result.insertId, message: 'เพิ่มวิชาสอบสำเร็จ' });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'รหัสวิชานี้มีอยู่แล้ว' });
        return res.status(500).json({ success: false, message: 'ไม่สามารถเพิ่มวิชาสอบได้' });
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const courseId = Number(req.params.course_id);
        const v = validateCourse(req.body);
        const [result] = await db.query(
            `UPDATE exam_courses SET course_code=?, course_name=?, exam_date=?, exam_time=?, exam_location=?,
                    reg_open_date=?, reg_close_date=?, max_seats=?, max_attempts=?, description=?,
                    theory_max_score=?, practical_max_score=? WHERE course_id=?`,
            [
                v.courseCode, v.courseName, v.exam, req.body.exam_time || null, req.body.exam_location || null,
                v.open, v.close, v.maxSeats, v.maxAttempts, req.body.description || null,
                Number(req.body.theory_max_score || 30), Number(req.body.practical_max_score || 70), courseId,
            ]
        );
        if (!result.affectedRows) throw new HttpError(404, 'ไม่พบวิชาสอบ');
        return res.json({ success: true, message: 'อัปเดตวิชาสอบสำเร็จ' });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'รหัสวิชานี้มีอยู่แล้ว' });
        return res.status(500).json({ success: false, message: 'ไม่สามารถแก้ไขวิชาสอบได้' });
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const courseId = Number(req.params.course_id);
        const [[usage]] = await db.query('SELECT COUNT(*) AS total FROM registrations WHERE course_id = ?', [courseId]);
        if (usage.total) throw new HttpError(409, 'ไม่สามารถลบวิชาที่มีใบสมัครได้');
        const [result] = await db.query('DELETE FROM exam_courses WHERE course_id = ?', [courseId]);
        if (!result.affectedRows) throw new HttpError(404, 'ไม่พบวิชาสอบ');
        return res.json({ success: true, message: 'ลบวิชาสอบสำเร็จ' });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'ไม่สามารถลบวิชาสอบได้' });
    }
};

exports.toggleCourseStatus = async (req, res) => {
    try {
        const courseId = Number(req.params.course_id);
        const [[course]] = await db.query('SELECT * FROM exam_courses WHERE course_id = ?', [courseId]);
        if (!course) throw new HttpError(404, 'ไม่พบวิชาสอบ');
        const newStatus = computeCourseStatus(course) === COURSE_STATUS.OPEN ? COURSE_STATUS.CLOSED : COURSE_STATUS.OPEN;
        await db.query('UPDATE exam_courses SET status_override = ? WHERE course_id = ?', [newStatus, courseId]);
        return res.json({ success: true, message: `เปลี่ยนสถานะเป็น ${newStatus}`, new_status: newStatus });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะได้' });
    }
};

exports.clearCourseStatusOverride = async (req, res) => {
    const [result] = await db.query('UPDATE exam_courses SET status_override = NULL WHERE course_id = ?', [Number(req.params.course_id)]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'ไม่พบวิชาสอบ' });
    return res.json({ success: true, message: 'กลับมาใช้สถานะตามวันที่แล้ว' });
};

module.exports._validateCourse = validateCourse;
