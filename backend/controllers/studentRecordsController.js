const db = require('../config/db');
const { logAdminAction } = require('../utils/adminAudit');

function asPositiveInt(value, fallback, max = 100) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function handleError(res, error, label) {
    console.error(`[${label}]`, error.message);
    return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลนักศึกษาได้' });
}

exports.listStudents = async (req, res) => {
    try {
        const page = asPositiveInt(req.query.page, 1, 100000);
        const limit = asPositiveInt(req.query.limit, 25, 100);
        const offset = (page - 1) * limit;
        const where = ['1=1'];
        const params = [];
        const search = String(req.query.search || '').trim().slice(0, 100);

        if (search) {
            where.push(`(s.student_code LIKE ? OR s.university_student_code LIKE ? OR s.full_name LIKE ?
                OR u.username LIKE ? OR u.email LIKE ? OR s.phone_number LIKE ?)`);
            const term = `%${search}%`;
            params.push(term, term, term, term, term, term);
        }
        if (req.query.registration_status) {
            where.push('s.registration_status = ?');
            params.push(String(req.query.registration_status).slice(0, 50));
        }
        if (req.query.account_status === 'active') where.push('u.is_active = 1');
        if (req.query.account_status === 'inactive') where.push('u.is_active = 0');
        if (req.query.course_id) {
            const courseId = Number.parseInt(req.query.course_id, 10);
            if (!Number.isInteger(courseId) || courseId < 1) {
                return res.status(400).json({ success: false, message: 'รหัสสาขาวิชาสอบไม่ถูกต้อง' });
            }
            where.push('EXISTS (SELECT 1 FROM registrations rx WHERE rx.student_id=s.student_id AND rx.course_id=?)');
            params.push(courseId);
        }

        const whereSql = where.join(' AND ');
        const [[countRow]] = await db.query(
            `SELECT COUNT(*) AS total FROM students s LEFT JOIN users u ON u.user_id=s.user_id WHERE ${whereSql}`,
            params
        );
        const [rows] = await db.query(
            `SELECT s.student_id, s.student_code, s.university_student_code, s.title, s.full_name,
                    CONCAT('*********', RIGHT(s.id_card_number, 4)) AS masked_id_card,
                    s.phone_number, s.registration_status, s.verified_at, s.created_at,
                    u.user_id, u.username, u.email, u.email_verified_at, u.is_active, u.last_login,
                    (SELECT COUNT(*) FROM registrations rc WHERE rc.student_id=s.student_id) AS registration_count,
                    (SELECT ec.course_name FROM registrations rl JOIN exam_courses ec ON ec.course_id=rl.course_id
                     WHERE rl.student_id=s.student_id ORDER BY rl.registered_at DESC, rl.registration_id DESC LIMIT 1) AS latest_course,
                    (SELECT rl.application_status FROM registrations rl WHERE rl.student_id=s.student_id
                     ORDER BY rl.registered_at DESC, rl.registration_id DESC LIMIT 1) AS latest_application_status,
                    (SELECT rl.registered_at FROM registrations rl WHERE rl.student_id=s.student_id
                     ORDER BY rl.registered_at DESC, rl.registration_id DESC LIMIT 1) AS latest_registered_at
             FROM students s LEFT JOIN users u ON u.user_id=s.user_id
             WHERE ${whereSql}
             ORDER BY s.created_at DESC, s.student_id DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({
            success: true,
            data: rows,
            pagination: { page, limit, total: Number(countRow.total || 0), pages: Math.ceil(Number(countRow.total || 0) / limit) },
        });
    } catch (error) {
        return handleError(res, error, 'Student records list');
    }
};

exports.getStudentDetail = async (req, res) => {
    const studentId = Number.parseInt(req.params.student_id, 10);
    if (!Number.isInteger(studentId) || studentId < 1) {
        return res.status(400).json({ success: false, message: 'รหัสนักศึกษาไม่ถูกต้อง' });
    }

    try {
        const [[student]] = await db.query(
            `SELECT s.student_id, s.user_id, s.student_code, s.university_student_code,
                    s.title, s.full_name, s.id_card_number, s.birth_date, s.gender, s.nationality,
                    s.phone_number, s.avatar_path, s.address_text, s.highest_education, s.education_major,
                    s.employment_status, s.applicant_type, s.work_status, s.current_occupation,
                    s.current_position, s.work_experience_years, s.average_income, s.industry_group,
                    s.monthly_income, s.unemployed_type, s.registration_status, s.verify_note,
                    s.verified_by, s.verified_at, s.privacy_consent_at, s.privacy_policy_version,
                    s.created_at AS student_created_at,
                    u.username, u.email, u.role, u.is_active, u.email_verified_at, u.last_login,
                    u.created_at AS account_created_at, verifier.username AS verified_by_username
             FROM students s
             LEFT JOIN users u ON u.user_id=s.user_id
             LEFT JOIN users verifier ON verifier.user_id=s.verified_by
             WHERE s.student_id=? LIMIT 1`,
            [studentId]
        );
        if (!student) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลนักศึกษา' });

        const [documents] = await db.query(
            `SELECT dv.document_version_id, dv.document_type, dv.filename, dv.is_current,
                    dv.created_at, uploader.username AS uploaded_by_username
             FROM student_document_versions dv
             LEFT JOIN users uploader ON uploader.user_id=dv.uploaded_by
             WHERE dv.student_id=?
             ORDER BY dv.document_type, dv.is_current DESC, dv.created_at DESC`,
            [studentId]
        );
        const [verifications] = await db.query(
            `SELECT sv.id, sv.action, sv.note, sv.admin_id, sv.created_at,
                    reviewer.username AS reviewer_username
             FROM student_verifications sv
             LEFT JOIN users reviewer ON reviewer.user_id=sv.admin_id
             WHERE sv.student_id=? ORDER BY sv.created_at DESC, sv.id DESC`,
            [studentId]
        );
        const [registrations] = await db.query(
            `SELECT r.registration_id, r.application_no, r.application_status, r.attempt_no,
                    r.is_retake, r.retake_reason, r.exam_status, r.result_published_at, r.registered_at,
                    c.course_id, c.course_code, c.course_name, c.exam_date AS course_exam_date,
                    c.exam_time, c.exam_location, c.theory_max_score, c.practical_max_score,
                    es.session_id, es.session_name, es.exam_date AS session_exam_date, es.location AS session_location,
                    sc.theory_score, sc.practical_score, sc.deducted_score, sc.total_score,
                    sc.university_status, sc.department_status, sc.updated_at AS score_updated_at,
                    examiner.username AS examiner_username,
                    cert.certificate_no, cert.verification_code, cert.issued_at, cert.revoked_at, cert.revoked_reason
             FROM registrations r
             JOIN exam_courses c ON c.course_id=r.course_id
             LEFT JOIN exam_sessions es ON es.session_id=r.session_id
             LEFT JOIN scores sc ON sc.registration_id=r.registration_id
             LEFT JOIN users examiner ON examiner.user_id=sc.examiner_id
             LEFT JOIN certificates cert ON cert.registration_id=r.registration_id
             WHERE r.student_id=?
             ORDER BY r.registered_at DESC, r.registration_id DESC`,
            [studentId]
        );

        await logAdminAction({
            actorId: req.user.id,
            action: 'VIEW_STUDENT_PROFILE',
            targetType: 'student',
            targetId: studentId,
            details: { documents: documents.length, registrations: registrations.length },
        });

        return res.json({ success: true, data: { student, documents, verifications, registrations } });
    } catch (error) {
        return handleError(res, error, 'Student record detail');
    }
};

