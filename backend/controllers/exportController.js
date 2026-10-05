const db = require('../config/db');
const { logAdminAction } = require('../utils/adminAudit');
const { createRegistrationWorkbook } = require('../utils/registrationWorkbook');
const { buildWorkbookBuffer } = require('../utils/exportRunner');

// เพดานจำนวนแถวต่อการส่งออก (ปรับได้ด้วย EXPORT_MAX_ROWS)
const MAX_EXPORT_ROWS = Number(process.env.EXPORT_MAX_ROWS) > 0 ? Number(process.env.EXPORT_MAX_ROWS) : 50000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function safeCsvCell(value) {
    let text = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // ค่าที่ขึ้นต้นด้วย = + - @ หรือ tab/ขึ้นบรรทัดใหม่ ถูก Excel ตีความเป็นสูตรได้ จึงนำหน้าด้วย ' ให้เป็นข้อความ
    if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

function toCSV(rows, columns) {
    const header = columns.map((column) => safeCsvCell(column.label)).join(',');
    const body = rows.map((row) => columns.map((column) => safeCsvCell(row[column.key])).join(',')).join('\r\n');
    return `\uFEFF${header}\r\n${body}`;
}

async function sendCsv(req, res, reportType, filenamePrefix, query, columns) {
    const [rows] = await db.query(query);
    await db.query('INSERT INTO report_logs (admin_id, report_type) VALUES (?, ?)', [req.user.id, reportType]);
    const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(toCSV(rows, columns));
}

function validDate(value) {
    if (!DATE_PATTERN.test(String(value || ''))) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function positiveId(value, label) {
    if (value === undefined || value === null || value === '') return null;
    if (!/^\d+$/.test(String(value))) {
        const error = new Error(label + 'ไม่ถูกต้อง');
        error.status = 400;
        throw error;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        const error = new Error(`${label}ไม่ถูกต้อง`);
        error.status = 400;
        throw error;
    }
    return parsed;
}

function buildRegistrationFilters(query = {}) {
    const where = ['1=1'];
    const params = [];
    const filters = {
        date_type: query.date_type === 'exam' ? 'exam' : 'registered',
        date_from: query.date_from || '',
        date_to: query.date_to || '',
        course_id: positiveId(query.course_id, 'สาขาวิชาสอบ'),
        session_id: positiveId(query.session_id, 'รอบสอบ'),
        attempt_no: positiveId(query.attempt_no, 'ครั้งที่สอบ'),
        application_status: String(query.application_status || '').trim().slice(0, 50),
        exam_status: String(query.exam_status || '').trim().slice(0, 50),
        student_status: String(query.student_status || '').trim().slice(0, 50),
        result: String(query.result || '').trim(),
        search: String(query.search || '').trim().slice(0, 100),
    };

    if (filters.date_from && !validDate(filters.date_from)) {
        const error = new Error('วันที่เริ่มต้นไม่ถูกต้อง'); error.status = 400; throw error;
    }
    if (filters.date_to && !validDate(filters.date_to)) {
        const error = new Error('วันที่สิ้นสุดไม่ถูกต้อง'); error.status = 400; throw error;
    }
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
        const error = new Error('วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด'); error.status = 400; throw error;
    }

    const dateColumn = filters.date_type === 'exam' ? 'COALESCE(es.exam_date, c.exam_date)' : 'DATE(r.registered_at)';
    if (filters.date_from) { where.push(`${dateColumn} >= ?`); params.push(filters.date_from); }
    if (filters.date_to) { where.push(`${dateColumn} <= ?`); params.push(filters.date_to); }
    if (filters.course_id) { where.push('r.course_id = ?'); params.push(filters.course_id); }
    if (filters.session_id) { where.push('r.session_id = ?'); params.push(filters.session_id); }
    if (filters.attempt_no) { where.push('r.attempt_no = ?'); params.push(filters.attempt_no); }
    if (filters.application_status) { where.push('r.application_status = ?'); params.push(filters.application_status); }
    if (filters.exam_status) { where.push('r.exam_status = ?'); params.push(filters.exam_status); }
    if (filters.student_status) { where.push('s.registration_status = ?'); params.push(filters.student_status); }
    if (filters.result === 'passed') where.push("sc.department_status = 'ได้รับวุฒิบัตร'");
    else if (filters.result === 'failed') where.push("sc.department_status = 'ไม่ได้รับวุฒิบัตร' AND r.result_published_at IS NOT NULL");
    else if (filters.result === 'pending') where.push('r.result_published_at IS NULL');
    else if (filters.result) {
        const error = new Error('ตัวกรองผลสอบไม่ถูกต้อง'); error.status = 400; throw error;
    }
    if (filters.search) {
        const term = `%${filters.search}%`;
        where.push(`(s.student_code LIKE ? OR s.university_student_code LIKE ? OR s.full_name LIKE ?
                    OR r.application_no LIKE ? OR u.email LIKE ? OR s.phone_number LIKE ?)`);
        params.push(term, term, term, term, term, term);
    }

    return { whereSql: where.join(' AND '), params, filters };
}

const registrationSelect = `
    SELECT r.registration_id, r.application_no, r.application_status, r.attempt_no, r.is_retake,
           r.retake_reason, r.exam_status, r.result_published_at, r.registered_at,
           s.student_id, s.student_code, s.university_student_code, s.title, s.full_name,
           s.id_card_number, s.birth_date, s.gender, s.nationality, s.phone_number, s.address_text,
           s.highest_education, s.education_major, s.employment_status, s.applicant_type,
           s.work_status, s.current_occupation, s.current_position, s.work_experience_years,
           s.average_income, s.industry_group, s.monthly_income, s.registration_status AS student_status,
           u.username, u.email, u.is_active, u.email_verified_at, u.last_login,
           c.course_id, c.course_code, c.course_name, c.exam_date AS course_exam_date,
           c.exam_time, c.exam_location, c.theory_max_score, c.practical_max_score,
           es.session_id, es.session_name, es.exam_date AS session_exam_date, es.location AS session_location,
           sc.theory_score, sc.practical_score, sc.deducted_score, sc.total_score,
           sc.university_status, sc.department_status, sc.updated_at AS score_updated_at,
           examiner.username AS examiner_username,
           cert.certificate_no, cert.issued_at, cert.revoked_at
    FROM registrations r
    JOIN students s ON s.student_id=r.student_id
    LEFT JOIN users u ON u.user_id=s.user_id
    JOIN exam_courses c ON c.course_id=r.course_id
    LEFT JOIN exam_sessions es ON es.session_id=r.session_id
    LEFT JOIN scores sc ON sc.registration_id=r.registration_id
    LEFT JOIN users examiner ON examiner.user_id=sc.examiner_id
    LEFT JOIN certificates cert ON cert.registration_id=r.registration_id`;

exports.getExportOptions = async (_req, res) => {
    try {
        const [courses] = await db.query('SELECT course_id, course_code, course_name FROM exam_courses ORDER BY course_name');
        const [sessions] = await db.query(
            `SELECT es.session_id, es.session_name, es.exam_date, es.location,
                    GROUP_CONCAT(DISTINCT r.course_id ORDER BY r.course_id) AS course_ids
             FROM exam_sessions es LEFT JOIN registrations r ON r.session_id=es.session_id
             GROUP BY es.session_id, es.session_name, es.exam_date, es.location ORDER BY es.exam_date DESC, es.session_id DESC`
        );
        const [[range]] = await db.query(
            `SELECT MIN(DATE(r.registered_at)) AS min_registered_date, MAX(DATE(r.registered_at)) AS max_registered_date,
                    MIN(COALESCE(es.exam_date,c.exam_date)) AS min_exam_date,
                    MAX(COALESCE(es.exam_date,c.exam_date)) AS max_exam_date,
                    MAX(r.attempt_no) AS max_attempt_no
             FROM registrations r JOIN exam_courses c ON c.course_id=r.course_id
             LEFT JOIN exam_sessions es ON es.session_id=r.session_id`
        );
        return res.json({ success: true, data: { courses, sessions, range } });
    } catch (error) {
        console.error('[Export options]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดตัวเลือกการส่งออกได้' });
    }
};

exports.previewRegistrations = async (req, res) => {
    try {
        const { whereSql, params, filters } = buildRegistrationFilters(req.query);
        const [[count]] = await db.query(
            `${registrationSelect.replace(/SELECT[\s\S]*?FROM registrations r/, 'SELECT COUNT(*) AS total FROM registrations r')} WHERE ${whereSql}`,
            params
        );
        const [rows] = await db.query(
            `${registrationSelect} WHERE ${whereSql} ORDER BY r.registered_at DESC, r.registration_id DESC LIMIT 100`,
            params
        );
        const preview = rows.map((row) => ({
            registration_id: row.registration_id,
            application_no: row.application_no,
            student_code: row.student_code,
            university_student_code: row.university_student_code,
            full_name: `${row.title || ''}${row.full_name || ''}`,
            course_name: row.course_name,
            session_name: row.session_name,
            exam_date: row.session_exam_date || row.course_exam_date,
            exam_time: row.exam_time,
            exam_location: row.session_location || row.exam_location,
            attempt_no: row.attempt_no,
            application_status: row.application_status,
            exam_status: row.exam_status,
            total_score: row.total_score,
            department_status: row.result_published_at ? row.department_status : 'รอประกาศผล',
            registered_at: row.registered_at,
        }));
        return res.json({ success: true, data: preview, total: Number(count.total || 0), limited: Number(count.total || 0) > 100, filters });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'ไม่สามารถแสดงตัวอย่างข้อมูลได้' });
    }
};

exports.exportRegistrations = async (req, res) => {
    try {
        const { whereSql, params, filters } = buildRegistrationFilters(req.query);
        const includeSensitive = req.user.role === 'admin' && String(req.query.include_sensitive || '') === '1';
        const [[count]] = await db.query(
            `${registrationSelect.replace(/SELECT[\s\S]*?FROM registrations r/, 'SELECT COUNT(*) AS total FROM registrations r')} WHERE ${whereSql}`,
            params
        );
        const total = Number(count.total || 0);
        if (total > MAX_EXPORT_ROWS) {
            return res.status(413).json({ success: false, message: `พบ ${total.toLocaleString('th-TH')} รายการ กรุณาระบุช่วงเวลาหรือสาขาวิชาให้เหลือไม่เกิน ${MAX_EXPORT_ROWS.toLocaleString('th-TH')} รายการ` });
        }
        const [rows] = await db.query(
            `${registrationSelect} WHERE ${whereSql} ORDER BY r.registered_at DESC, r.registration_id DESC`,
            params
        );
        // สร้างไฟล์ใน worker thread: main thread ยังตอบคำขออื่นได้ตามปกติระหว่างที่สร้างไฟล์
        const buffer = await buildWorkbookBuffer(rows, filters, { includeSensitive });

        await db.withTransaction(async (conn) => {
            await conn.query('INSERT INTO report_logs (admin_id, report_type) VALUES (?, ?)', [req.user.id, 'registrations_xlsx']);
            await logAdminAction({
                actorId: req.user.id,
                action: 'EXPORT_STUDENT_EXAM_DATA',
                targetType: 'report',
                targetId: `registrations-${new Date().toISOString().slice(0, 10)}`,
                details: { filters, row_count: rows.length, include_sensitive: includeSensitive },
            }, conn);
        });

        const filename = `student_exam_records_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('[Export registrations xlsx]', error.message);
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'ไม่สามารถส่งออกไฟล์ Excel ได้' });
    }
};

exports.exportAuditLog = async (req, res) => {
    try {
        return await sendCsv(req, res, 'score_audit', 'score_audit',
            `SELECT al.changed_at, s.student_code, s.university_student_code, s.full_name, c.course_name, u.username AS examiner,
                    al.action, al.old_theory, al.old_practical, al.old_deducted, al.old_status,
                    al.new_theory, al.new_practical, al.new_deducted, al.new_status
             FROM score_audit_logs al JOIN registrations r ON al.registration_id=r.registration_id
             JOIN students s ON r.student_id=s.student_id JOIN exam_courses c ON r.course_id=c.course_id
             LEFT JOIN users u ON al.examiner_id=u.user_id ORDER BY al.changed_at DESC LIMIT 100000`,
            [['changed_at','วันที่เปลี่ยน'],['student_code','รหัสผู้สมัคร'],['university_student_code','รหัสนักศึกษา'],['full_name','ชื่อ'],
             ['course_name','วิชา'],['examiner','ผู้แก้ไข'],['action','การกระทำ'],
             ['old_theory','ทฤษฎีเดิม'],['old_practical','ปฏิบัติเดิม'],['old_deducted','หักเดิม'],
             ['old_status','ผลเดิม'],['new_theory','ทฤษฎีใหม่'],['new_practical','ปฏิบัติใหม่'],
             ['new_deducted','หักใหม่'],['new_status','ผลใหม่']].map(([key,label]) => ({ key,label }))
        );
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถ export ได้' });
    }
};

module.exports._safeCsvCell = safeCsvCell;
module.exports._buildRegistrationFilters = buildRegistrationFilters;
module.exports._createRegistrationWorkbook = createRegistrationWorkbook;
