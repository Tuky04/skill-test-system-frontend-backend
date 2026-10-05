const { HttpError } = require('./domain');

// รอบสอบ = วิชา + เวลา + วันที่ + สถานที่ (unique key uq_exam_sessions_slot กันรอบซ้ำ)
async function getOrCreateSession(conn, course) {
    if (!course.exam_date || !course.exam_location) {
        throw new HttpError(409, 'วิชานี้ยังไม่ได้กำหนดวันสอบหรือสถานที่สอบ');
    }
    const sessionName = `${course.course_code} ${course.exam_time || ''}`.trim();
    const [result] = await conn.query(
        `INSERT INTO exam_sessions (session_name, exam_date, location) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE session_id=LAST_INSERT_ID(session_id)`,
        [sessionName, course.exam_date, course.exam_location]
    );
    return result.insertId;
}

// เมื่อแอดมินแก้วัน/เวลา/สถานที่สอบ ใบสมัครที่ยังไม่ประกาศผลต้องย้ายไปรอบสอบใหม่ด้วย
// มิฉะนั้น export/รายงานที่อ้างรอบสอบจะแสดงวันที่เก่าไม่ตรงกับตารางสอบจริง
async function resyncCourseSessions(conn, course) {
    if (!course.exam_date || !course.exam_location) return 0;
    const sessionId = await getOrCreateSession(conn, course);
    const [result] = await conn.query(
        `UPDATE registrations SET session_id = ?
         WHERE course_id = ? AND result_published_at IS NULL AND (session_id IS NULL OR session_id <> ?)`,
        [sessionId, course.course_id, sessionId]
    );
    return result.affectedRows;
}

module.exports = { getOrCreateSession, resyncCourseSessions };
