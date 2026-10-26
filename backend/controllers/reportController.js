const db = require('../config/db');
const { APPLICATION_STATUS, STUDENT_STATUS } = require('../utils/domain');

exports.getStats = async (req, res) => {
    try {
        const [[studentStats]] = await db.query(
            `SELECT COUNT(*) AS total,
                    SUM(registration_status IN (?, ?)) AS pending,
                    SUM(registration_status = ?) AS approved
             FROM students`,
            [STUDENT_STATUS.PENDING, STUDENT_STATUS.INCOMPLETE, STUDENT_STATUS.APPROVED]
        );
        const [[registrationStats]] = await db.query(
            `SELECT COUNT(*) AS total,
                    SUM(application_status = ?) AS waiting,
                    SUM(application_status = ?) AS approved,
                    SUM(application_status = ?) AS rejected,
                    SUM(result_published_at IS NOT NULL) AS scored,
                    SUM(application_status = ? AND result_published_at IS NULL) AS pending_score
             FROM registrations`,
            [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.APPROVED]
        );
        const [[scoreStats]] = await db.query(
            `SELECT SUM(sc.department_status = 'ได้รับวุฒิบัตร') AS passed,
                    SUM(sc.department_status = 'ไม่ได้รับวุฒิบัตร') AS failed
             FROM scores sc JOIN registrations r ON r.registration_id = sc.registration_id
             WHERE r.result_published_at IS NOT NULL`
        );
        const [[paymentStats]] = await db.query(
            `SELECT SUM(payment_status = 'ชำระแล้ว' AND amount > 0) AS paid_count,
                    COALESCE(SUM(CASE WHEN payment_status = 'ชำระแล้ว' THEN amount ELSE 0 END), 0) AS paid_total,
                    SUM(payment_status = 'รอตรวจสลิป') AS pending_review,
                    SUM(payment_status IN ('รอชำระเงิน', 'สลิปไม่ผ่าน')) AS unpaid
             FROM payments`
        );
        const [byCourse] = await db.query(
            `SELECT c.course_name, COUNT(r.registration_id) AS total,
                    SUM(r.result_published_at IS NOT NULL) AS scored,
                    SUM(r.result_published_at IS NOT NULL AND sc.department_status = 'ได้รับวุฒิบัตร') AS passed,
                    SUM(r.result_published_at IS NOT NULL AND sc.department_status = 'ไม่ได้รับวุฒิบัตร') AS failed
             FROM exam_courses c
             LEFT JOIN registrations r ON c.course_id = r.course_id
             LEFT JOIN scores sc ON r.registration_id = sc.registration_id
             GROUP BY c.course_id, c.course_name ORDER BY total DESC`
        );
        return res.json({
            success: true,
            data: {
                payments: {
                    paid_count: Number(paymentStats?.paid_count || 0),
                    paid_total: Number(paymentStats?.paid_total || 0),
                    pending_review: Number(paymentStats?.pending_review || 0),
                    unpaid: Number(paymentStats?.unpaid || 0),
                },
                total_students: Number(studentStats.total || 0),
                pending_verify: Number(studentStats.pending || 0),
                approved_students: Number(studentStats.approved || 0),
                total_registrations: Number(registrationStats.total || 0),
                reg_waiting: Number(registrationStats.waiting || 0),
                reg_approved: Number(registrationStats.approved || 0),
                reg_rejected: Number(registrationStats.rejected || 0),
                total_scored: Number(registrationStats.scored || 0),
                total_pending_score: Number(registrationStats.pending_score || 0),
                total_passed: Number(scoreStats.passed || 0),
                total_failed: Number(scoreStats.failed || 0),
                by_course: byCourse,
            },
        });
    } catch (error) {
        console.error('[Stats]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดสถิติได้' });
    }
};
