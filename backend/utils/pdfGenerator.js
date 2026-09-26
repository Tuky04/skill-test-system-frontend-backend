const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { uploadDir } = require('../middleware/upload');
const { escapeHtml } = require('./domain');
const { logAdminAction } = require('./adminAudit');

async function loadPassedRegistration(registrationId) {
    const [[row]] = await db.query(
        `SELECT r.registration_id, r.student_id, r.result_published_at,
                s.user_id, s.title, s.full_name, s.student_code, s.university_student_code, s.id_card_number, s.doc_photo,
                c.course_name, c.course_code,
                sc.theory_score, sc.practical_score, sc.total_score, sc.department_status
         FROM registrations r
         JOIN students s ON r.student_id = s.student_id
         JOIN exam_courses c ON r.course_id = c.course_id
         JOIN scores sc ON r.registration_id = sc.registration_id
         WHERE r.registration_id = ? AND r.result_published_at IS NOT NULL
           AND sc.department_status = 'ได้รับวุฒิบัตร'`,
        [registrationId]
    );
    return row;
}

async function ensureCertificate(row) {
    const [[existing]] = await db.query('SELECT * FROM certificates WHERE registration_id = ?', [row.registration_id]);
    if (existing) return existing;
    const issuedAt = new Date();
    const buddhistYear = issuedAt.getFullYear() + 543;
    const certNo = `CERT-${buddhistYear}-${String(row.registration_id).padStart(8, '0')}`;
    const verificationCode = crypto.randomBytes(24).toString('hex');
    try {
        await db.query(
            `INSERT INTO certificates
             (registration_id, certificate_no, verification_code, issued_at, holder_name, course_name, total_score)
             VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
            [row.registration_id, certNo, verificationCode, row.full_name, row.course_name, row.total_score]
        );
    } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
    const [[created]] = await db.query('SELECT * FROM certificates WHERE registration_id = ?', [row.registration_id]);
    return created;
}

async function photoDataUri(filename) {
    if (!filename || path.basename(filename) !== filename) return null;
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg' : null;
    if (!mime) return null;
    const target = path.resolve(uploadDir, filename);
    if (!target.startsWith(`${uploadDir}${path.sep}`) || !fs.existsSync(target)) return null;
    const data = await fs.promises.readFile(target);
    return `data:${mime};base64,${data.toString('base64')}`;
}

function certificateHtml(row, certificate, photo) {
    const issued = new Date(certificate.issued_at).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: process.env.APP_TIMEZONE || 'Asia/Bangkok' });
    const maskedId = `${'*'.repeat(9)}${String(row.id_card_number).slice(-4)}`;
    const verifyBase = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const verifyUrl = `${verifyBase}/verify-certificate/${certificate.verification_code}`;
    return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(certificate.certificate_no)}</title>
<style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#eee;font-family:Tahoma,"Noto Sans Thai",sans-serif;color:#172554}.sheet{width:297mm;min-height:210mm;margin:auto;background:#fff;padding:13mm}.frame{height:184mm;border:8px double #a16207;padding:12mm;text-align:center;position:relative}.org{font-size:18px;font-weight:700}.title{font-size:34px;color:#991b1b;margin:18px 0 8px}.name{font-size:32px;font-weight:700;margin:16px;color:#1e3a8a}.course{font-size:22px;font-weight:700;color:#991b1b;margin:12px}.details{display:flex;justify-content:center;gap:40px;margin:18px}.photo{position:absolute;left:18mm;bottom:18mm;width:28mm;height:36mm;object-fit:cover;border:1px solid #aaa}.verify{position:absolute;right:14mm;bottom:12mm;width:75mm;text-align:left;font-size:11px;color:#475569;overflow-wrap:anywhere}.signature{margin:28px auto 0;width:70mm;border-top:1px solid #333;padding-top:6px}.no{font-size:13px;color:#475569}@media print{body{background:#fff}.sheet{margin:0}}
</style></head><body><main class="sheet"><section class="frame">
<div class="org">ศูนย์ทดสอบมาตรฐานฝีมือแรงงาน</div>
<div class="title">หนังสือรับรองผลการทดสอบมาตรฐานฝีมือแรงงาน</div>
<div class="no">เลขที่ ${escapeHtml(certificate.certificate_no)}</div>
<p>หนังสือรับรองฉบับนี้ให้ไว้เพื่อแสดงว่า</p>
<div class="name">${escapeHtml(row.title)}${escapeHtml(row.full_name)}</div>
<p>ผ่านการทดสอบมาตรฐานฝีมือแรงงาน สาขา</p>
<div class="course">${escapeHtml(row.course_name)}</div>
<div class="details"><span>คะแนนรวม ${escapeHtml(row.total_score)} / 100</span><span>ให้ไว้ ณ วันที่ ${escapeHtml(issued)}</span></div>
<div class="signature">ผู้ดำเนินการทดสอบมาตรฐานฝีมือแรงงาน</div>
${photo ? `<img class="photo" src="${photo}" alt="รูปผู้ผ่านการทดสอบ">` : ''}
<div class="verify">รหัสนักศึกษา: ${escapeHtml(row.university_student_code)}<br>รหัสผู้สมัคร: ${escapeHtml(row.student_code)}<br>เลขบัตร: ${escapeHtml(maskedId)}<br>ตรวจสอบความถูกต้อง: ${escapeHtml(verifyUrl)}</div>
</section></main></body></html>`;
}

exports.generateCertificate = async (req, res) => {
    try {
        const row = await loadPassedRegistration(Number(req.params.registration_id));
        if (!row) return res.status(404).json({ success: false, message: 'ไม่พบผลสอบที่ผ่านเกณฑ์' });
        if (req.user.role === 'student' && Number(row.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เปิดใบรับรองนี้' });
        }
        const certificate = await ensureCertificate(row);
        if (certificate.revoked_at) return res.status(410).json({ success: false, message: 'ใบรับรองนี้ถูกเพิกถอนแล้ว' });
        const photo = await photoDataUri(row.doc_photo);
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${certificate.certificate_no}.html"`);
        return res.send(certificateHtml(row, certificate, photo));
    } catch (error) {
        console.error('[Certificate]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถสร้างใบรับรองได้' });
    }
};

exports.verifyCertificate = async (req, res) => {
    try {
        const code = String(req.params.verification_code || '');
        if (!/^[a-f0-9]{48}$/i.test(code)) return res.status(400).json({ success: false, message: 'รหัสตรวจสอบไม่ถูกต้อง' });
        const [[certificate]] = await db.query(
            `SELECT certificate_no, holder_name, course_name, total_score, issued_at, revoked_at
             FROM certificates WHERE verification_code = ?`,
            [code]
        );
        if (!certificate) return res.status(404).json({ success: false, message: 'ไม่พบใบรับรอง' });
        return res.json({ success: true, valid: !certificate.revoked_at, data: certificate });
    } catch {
        return res.status(500).json({ success: false, message: 'ไม่สามารถตรวจสอบใบรับรองได้' });
    }
};

exports.getPassedList = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT r.registration_id, s.student_code, s.university_student_code, s.title, s.full_name,
                    c.course_name, c.theory_max_score, c.practical_max_score,
                    sc.theory_score, sc.practical_score, sc.total_score,
                    cert.certificate_no, cert.issued_at, cert.revoked_at
             FROM registrations r
             JOIN students s ON r.student_id = s.student_id
             JOIN exam_courses c ON r.course_id = c.course_id
             JOIN scores sc ON r.registration_id = sc.registration_id
             LEFT JOIN certificates cert ON cert.registration_id = r.registration_id
             WHERE r.result_published_at IS NOT NULL AND sc.department_status = 'ได้รับวุฒิบัตร'
             ORDER BY s.student_code`
        );
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายชื่อได้' });
    }
};

exports.revokeCertificate = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    const reason = String(req.body.reason || '').trim();
    if (!Number.isInteger(registrationId) || registrationId <= 0 || reason.length < 3 || reason.length > 255) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลการเพิกถอน 3-255 ตัวอักษร' });
    }
    try {
        const [result] = await db.query(
            `UPDATE certificates SET revoked_at=NOW(), revoked_reason=?
             WHERE registration_id=? AND revoked_at IS NULL`,
            [reason, registrationId]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'ไม่พบใบรับรองที่ยังมีผล' });
        logAdminAction({ actorId:req.user.id, action:'REVOKE_CERTIFICATE', targetType:'registration', targetId:registrationId, details:{ reason } })
            .catch((error)=>console.error('[Certificate audit]',error.message));
        return res.json({ success:true, message:'เพิกถอนใบรับรองแล้ว' });
    } catch (error) {
        return res.status(500).json({ success:false, message:'ไม่สามารถเพิกถอนใบรับรองได้' });
    }
};

exports.reissueCertificate = async (req, res) => {
    const registrationId = Number(req.params.registration_id);
    if (!Number.isInteger(registrationId) || registrationId <= 0) return res.status(400).json({ success:false, message:'เลขใบสมัครไม่ถูกต้อง' });
    try {
        const [[certificate]] = await db.query('SELECT certificate_no, issue_version, revoked_at FROM certificates WHERE registration_id=?', [registrationId]);
        if (!certificate || !certificate.revoked_at) return res.status(409).json({ success:false, message:'ออกใหม่ได้เฉพาะใบรับรองที่ถูกเพิกถอนแล้ว' });
        const nextVersion = Number(certificate.issue_version || 1) + 1;
        const certificateNo = `${certificate.certificate_no.replace(/-R\d+$/, '')}-R${nextVersion}`;
        const verificationCode = crypto.randomBytes(24).toString('hex');
        await db.query(
            `UPDATE certificates SET certificate_no=?, verification_code=?, issue_version=?, issued_at=NOW(),
                    revoked_at=NULL, revoked_reason=NULL WHERE registration_id=?`,
            [certificateNo, verificationCode, nextVersion, registrationId]
        );
        logAdminAction({ actorId:req.user.id, action:'REISSUE_CERTIFICATE', targetType:'registration', targetId:registrationId, details:{ certificate_no:certificateNo, issue_version:nextVersion } })
            .catch((error)=>console.error('[Certificate audit]',error.message));
        return res.json({ success:true, message:`ออกใบรับรองใหม่แล้ว (${certificateNo})` });
    } catch (error) {
        return res.status(500).json({ success:false, message:'ไม่สามารถออกใบรับรองใหม่ได้' });
    }
};
