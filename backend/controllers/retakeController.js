const db = require('../config/db');
const {
    APPLICATION_STATUS,
    STUDENT_STATUS,
    COURSE_STATUS,
    HttpError,
    computeCourseStatus,
    createApplicationNo,
    hasExamDatePassed,
} = require('../utils/domain');
const { getOrCreateSession } = require('../utils/sessions');
const { feeAmount } = require('../utils/payment');

async function loadStudent(dbLike, userId) {
    const [[student]] = await dbLike.query(
        'SELECT student_id, student_code, full_name, registration_status FROM students WHERE user_id = ?',
        [userId]
    );
    return student;
}

async function loadHistory(dbLike, studentId, courseId, lock = false) {
    const [rows] = await dbLike.query(
        `SELECT r.registration_id, r.attempt_no, r.is_retake, r.application_status,
                r.registered_at, r.retake_reason, r.result_published_at,
                sc.theory_score, sc.practical_score, sc.total_score, sc.department_status
         FROM registrations r
         LEFT JOIN scores sc ON r.registration_id = sc.registration_id
         WHERE r.student_id = ? AND r.course_id = ?
         ORDER BY r.attempt_no ASC${lock ? ' FOR UPDATE' : ''}`,
        [studentId, courseId]
    );
    return rows;
}

function eligibility(history, course) {
    const latest = history.at(-1) || null;
    const usedAttempts = history.filter((item) => item.application_status !== APPLICATION_STATUS.REJECTED).length;
    const reuseRejected = latest?.application_status === APPLICATION_STATUS.REJECTED;
    const nextAttempt = reuseRejected ? latest.attempt_no : usedAttempts + 1;
    const maxAttempts = Number(course.max_attempts || 3);
    if (!latest) return { can_retake: false, reason: 'ยังไม่มีผลสอบครั้งแรก', next_attempt: 1, attempted: usedAttempts };
    if ([APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED].includes(latest.application_status) && !latest.result_published_at) {
        return { can_retake: false, reason: 'ใบสมัครล่าสุดยังไม่เสร็จสิ้นหรือยังไม่ประกาศผล', next_attempt: nextAttempt, attempted: usedAttempts };
    }
    const lastCompleted = [...history].reverse().find((item) => item.result_published_at && item.department_status);
    if (!lastCompleted) return { can_retake: false, reason: 'ยังไม่มีผลสอบที่ประกาศอย่างเป็นทางการ', next_attempt: nextAttempt, attempted: usedAttempts };
    if (lastCompleted.department_status === 'ได้รับวุฒิบัตร') return { can_retake: false, reason: 'ผ่านการทดสอบแล้ว', next_attempt: nextAttempt, attempted: usedAttempts };
    if (nextAttempt > maxAttempts) return { can_retake: false, reason: `ครบจำนวนสอบสูงสุด ${maxAttempts} ครั้งแล้ว`, next_attempt: nextAttempt, attempted: usedAttempts };
    if (computeCourseStatus(course) !== COURSE_STATUS.OPEN) return { can_retake: false, reason: 'วิชานี้ไม่ได้อยู่ในช่วงเปิดรับสมัคร', next_attempt: nextAttempt, attempted: usedAttempts };
    return { can_retake: true, reason: `สมัครสอบซ่อมรอบที่ ${nextAttempt}/${maxAttempts} ได้`, next_attempt: nextAttempt, attempted: usedAttempts };
}

exports.checkRetakeEligibility = async (req, res) => {
    const courseId = Number(req.params.course_id);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ success: false, message: 'รหัสวิชาไม่ถูกต้อง' });
    try {
        const student = await loadStudent(db, req.user.id);
        if (!student) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้สมัคร' });
        const [[course]] = await db.query('SELECT * FROM exam_courses WHERE course_id = ?', [courseId]);
        if (!course) return res.status(404).json({ success: false, message: 'ไม่พบวิชาสอบ' });
        const history = await loadHistory(db, student.student_id, courseId);
        return res.json({
            success: true,
            data: {
                student_code: student.student_code,
                full_name: student.full_name,
                course_name: course.course_name,
                max_attempts: Number(course.max_attempts || 3),
                ...eligibility(history, course),
                history,
            },
        });
    } catch (error) {
        console.error('[Retake eligibility]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถตรวจสอบสิทธิ์สอบซ่อมได้' });
    }
};

exports.applyRetake = async (req, res) => {
    const courseId = Number(req.body.course_id);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ success: false, message: 'กรุณาเลือกวิชาสอบ' });
    const reason = typeof req.body.retake_reason === 'string' ? req.body.retake_reason.trim().slice(0, 255) || null : null;
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        const student = await loadStudent(conn, req.user.id);
        if (!student) throw new HttpError(404, 'ไม่พบข้อมูลผู้สมัคร');
        if (student.registration_status !== STUDENT_STATUS.APPROVED) throw new HttpError(409, 'เอกสารยังไม่ได้รับการอนุมัติ');
        const [[course]] = await conn.query('SELECT * FROM exam_courses WHERE course_id = ? FOR UPDATE', [courseId]);
        if (!course) throw new HttpError(404, 'ไม่พบวิชาสอบ');
        const history = await loadHistory(conn, student.student_id, courseId, true);
        const decision = eligibility(history, course);
        if (!decision.can_retake) throw new HttpError(409, decision.reason);
        if (hasExamDatePassed(course)) throw new HttpError(409, 'วิชานี้ผ่านวันสอบไปแล้ว');

        const [[seat]] = await conn.query(
            'SELECT COUNT(*) AS total FROM registrations WHERE course_id = ? AND application_status <> ?',
            [courseId, APPLICATION_STATUS.REJECTED]
        );
        if (course.max_seats && seat.total >= course.max_seats) throw new HttpError(409, 'จำนวนผู้สมัครเต็มแล้ว');

        const sessionId = await getOrCreateSession(conn, course);
        const applicationNo = createApplicationNo();
        const latest = history.at(-1);
        if (latest?.application_status === APPLICATION_STATUS.REJECTED && latest.is_retake) {
            await conn.query(
                `UPDATE registrations SET session_id=?, application_no=?, application_status=?, retake_reason=?, registered_at=NOW()
                 WHERE registration_id=?`,
                [sessionId, applicationNo, APPLICATION_STATUS.PENDING, reason, latest.registration_id]
            );
        } else {
            const [created] = await conn.query(
                `INSERT INTO registrations
                 (student_id, course_id, session_id, application_no, application_status, attempt_no, is_retake, retake_reason)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                [student.student_id, courseId, sessionId, applicationNo, APPLICATION_STATUS.PENDING, decision.next_attempt, reason]
            );
            // สอบซ่อมต้องชำระค่าสมัครใหม่ทุกครั้ง (ไม่มีการคืนเงิน)
            await conn.query('INSERT INTO payments (registration_id, amount) VALUES (?, ?)', [created.insertId, feeAmount()]);
        }
        await conn.commit();
        return res.status(201).json({
            success: true,
            message: `สมัครสอบซ่อมรอบที่ ${decision.next_attempt} สำเร็จ กรุณาชำระค่าสมัคร ${feeAmount()} บาทและแนบสลิปที่หน้าแดชบอร์ด`,
            data: { application_no: applicationNo, attempt_no: decision.next_attempt },
        });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'มีใบสมัครรอบนี้อยู่แล้ว' });
        console.error('[Apply retake]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถสมัครสอบซ่อมได้' });
    } finally {
        if (conn) conn.release();
    }
};

exports.getExamHistory = async (req, res) => {
    try {
        const student = await loadStudent(db, req.user.id);
        if (!student) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้สมัคร' });
        const [rows] = await db.query(
            `SELECT r.registration_id, r.course_id, r.attempt_no, r.is_retake, r.retake_reason,
                    r.application_no, r.application_status, r.exam_status, r.registered_at, r.result_published_at,
                    c.course_name, c.course_code, c.exam_date, c.exam_time, c.exam_location,
                    sc.theory_score, sc.practical_score, sc.deducted_score,
                    sc.total_score, sc.department_status, sc.updated_at AS scored_at,
                    p.amount AS payment_amount, p.payment_status, p.slip_filename, p.transfer_ref,
                    p.paid_at, p.submitted_at AS payment_submitted_at, p.verify_note AS payment_note
             FROM registrations r
             JOIN exam_courses c ON r.course_id = c.course_id
             LEFT JOIN scores sc ON r.registration_id = sc.registration_id
             LEFT JOIN payments p ON p.registration_id = r.registration_id
             WHERE r.student_id = ? ORDER BY r.registered_at ASC, r.registration_id ASC`,
            [student.student_id]
        );
        const grouped = {};
        for (const row of rows) {
            grouped[row.course_id] ||= { course_id: row.course_id, course_code: row.course_code, course_name: row.course_name, attempts: [] };
            grouped[row.course_id].attempts.push(row);
        }
        return res.json({ success: true, data: Object.values(grouped) });
    } catch (error) {
        console.error('[Exam history]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดประวัติการสอบได้' });
    }
};

module.exports._eligibility = eligibility;
