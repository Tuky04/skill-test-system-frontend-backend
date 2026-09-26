const db = require('../config/db');

// GET /api/audit/scores — ดู Audit Log คะแนนทั้งหมด
exports.getScoreAuditLogs = async (req, res) => {
    try {
        const { student_code, from_date, to_date } = req.query;
        const PER_PAGE = 20;
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const offset = (page - 1) * PER_PAGE;

        if (from_date && !/^\d{4}-\d{2}-\d{2}$/.test(from_date))
            return res.status(400).json({ success: false, message: 'รูปแบบ from_date ไม่ถูกต้อง' });
        if (to_date && !/^\d{4}-\d{2}-\d{2}$/.test(to_date))
            return res.status(400).json({ success: false, message: 'รูปแบบ to_date ไม่ถูกต้อง' });

        let where = 'WHERE 1=1';
        const params = [];

        if (student_code) {
            where += ' AND (s.student_code LIKE ? OR s.university_student_code LIKE ?)';
            const search = `%${String(student_code).slice(0, 30)}%`;
            params.push(search, search);
        }
        if (from_date) {
            where += ' AND al.changed_at >= ?';
            params.push(from_date + ' 00:00:00');
        }
        if (to_date) {
            where += ' AND al.changed_at <= ?';
            params.push(to_date + ' 23:59:59');
        }

        const [rows] = await db.query(`
            SELECT
                al.log_id, al.action, al.changed_at,
                s.student_code, s.university_student_code, s.full_name,
                c.course_name,
                u.username AS examiner_name,
                al.old_theory, al.old_practical, al.old_deducted, al.old_status,
                al.new_theory, al.new_practical, al.new_deducted, al.new_status
            FROM score_audit_logs al
            JOIN registrations r ON al.registration_id = r.registration_id
            JOIN students s ON r.student_id = s.student_id
            JOIN exam_courses c ON r.course_id = c.course_id
            LEFT JOIN users u ON al.examiner_id = u.user_id
            ${where}
            ORDER BY al.changed_at DESC
            LIMIT ? OFFSET ?
        `, [...params, PER_PAGE, offset]);

        const [[{ total }]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM score_audit_logs al
            JOIN registrations r ON al.registration_id = r.registration_id
            JOIN students s ON r.student_id = s.student_id
            ${where}
        `, params);

        res.json({ success: true, data: rows, total, page, per_page: PER_PAGE });
    } catch (error) {
        console.error('❌ [Audit Error]:', error.message);
        res.status(500).json({ success: false, message: 'ไม่สามารถโหลด audit log ได้' });
    }
};

exports.getAdminAuditLogs = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * perPage;
    try {
        const [rows] = await db.query(
            `SELECT a.log_id, a.action, a.target_type, a.target_id, a.details, a.created_at,
                    u.username AS actor_username, u.role AS actor_role
             FROM admin_audit_logs a LEFT JOIN users u ON u.user_id = a.actor_id
             ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
            [perPage, offset]
        );
        const [[count]] = await db.query('SELECT COUNT(*) AS total FROM admin_audit_logs');
        return res.json({ success: true, data: rows, total: count.total, page, per_page: perPage });
    } catch (error) {
        console.error('[Admin audit]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดประวัติการดำเนินการได้' });
    }
};
