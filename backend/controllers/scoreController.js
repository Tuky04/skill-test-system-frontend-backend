const db = require('../config/db');
const emailService = require('../utils/emailService');
const { createNotification, templates } = require('./notificationController');
const { APPLICATION_STATUS, EXAM_STATUS, HttpError, parseRequiredNumber } = require('../utils/domain');

exports.submitScores = async (req, res) => {
    const registrationId = Number(req.body.registration_id);
    let conn;
    try {
        if (!Number.isInteger(registrationId) || registrationId <= 0) throw new HttpError(400, 'เลขใบสมัครไม่ถูกต้อง');
        const theory = parseRequiredNumber(req.body.theory_score, 'คะแนนทฤษฎี');
        const practical = parseRequiredNumber(req.body.practical_score, 'คะแนนปฏิบัติ');
        const deducted = parseRequiredNumber(req.body.deducted_score, 'คะแนนหัก');

        conn = await db.getConnection();
        await conn.beginTransaction();
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
        if (registration.application_status !== APPLICATION_STATUS.APPROVED) throw new HttpError(409, 'บันทึกคะแนนได้เฉพาะใบสมัครที่อนุมัติสิทธิ์สอบแล้ว');
        if (registration.exam_status !== EXAM_STATUS.ATTENDED && !registration.result_published_at) throw new HttpError(409, 'ต้องยืนยันว่าผู้สมัครเข้าสอบก่อนบันทึกคะแนน');
        if (registration.result_published_at && req.user.role !== 'admin') throw new HttpError(403, 'ผลถูกประกาศแล้ว การแก้ไขต้องใช้สิทธิ์ผู้ดูแลระบบ');

        const theoryMax = Number(registration.theory_max_score || 30);
        const practicalMax = Number(registration.practical_max_score || 70);
        if (theory < 0 || theory > theoryMax) throw new HttpError(400, `คะแนนทฤษฎีต้องอยู่ระหว่าง 0-${theoryMax}`);
        if (practical < 0 || practical > practicalMax) throw new HttpError(400, `คะแนนปฏิบัติต้องอยู่ระหว่าง 0-${practicalMax}`);
        if (deducted < 0 || deducted > theory + practical) throw new HttpError(400, 'คะแนนหักต้องไม่ติดลบหรือมากกว่าคะแนนที่ได้');

        const [[oldScore]] = await conn.query('SELECT * FROM scores WHERE registration_id = ? FOR UPDATE', [registrationId]);
        if (oldScore) {
            await conn.query(
                'UPDATE scores SET theory_score=?, practical_score=?, deducted_score=?, examiner_id=? WHERE registration_id=?',
                [theory, practical, deducted, req.user.id, registrationId]
            );
        } else {
            await conn.query(
                'INSERT INTO scores (registration_id, theory_score, practical_score, deducted_score, examiner_id) VALUES (?, ?, ?, ?, ?)',
                [registrationId, theory, practical, deducted, req.user.id]
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
                registrationId, req.user.id, oldScore ? 'UPDATE' : 'INSERT',
                oldScore?.theory_score ?? null, oldScore?.practical_score ?? null,
                oldScore?.deducted_score ?? null, oldScore?.department_status ?? null,
                theory, practical, deducted, newScore.department_status,
            ]
        );
        await conn.query('UPDATE registrations SET result_published_at = NOW(), exam_status = ? WHERE registration_id = ?', [EXAM_STATUS.PUBLISHED, registrationId]);
        await conn.commit();

        createNotification({
            user_id: registration.user_id,
            ...templates.score_released(registration.course_name, newScore.department_status),
        }).catch((error) => console.error('[Score notification]', error.message));
        emailService.sendScoreResultEmail({
            to: registration.email,
            full_name: registration.full_name,
            student_code: registration.student_code,
            course_name: registration.course_name,
            theory_score: theory,
            practical_score: practical,
            total_score: newScore.total_score,
            department_status: newScore.department_status,
        }).catch((error) => console.error('[Score email]', error.message));

        return res.json({
            success: true,
            message: `บันทึกและประกาศผลสำเร็จ รวม ${newScore.total_score} คะแนน`,
            details: { theory_score: theory, practical_score: practical, deducted_score: deducted, ...newScore },
        });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('[Submit score]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกคะแนนได้' });
    } finally {
        if (conn) conn.release();
    }
};
