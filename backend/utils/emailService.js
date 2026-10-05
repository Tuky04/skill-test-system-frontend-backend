const nodemailer = require('nodemailer');
const { escapeHtml } = require('./domain');
const APP_URL = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// ── สร้าง transporter จาก .env ───────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Gmail: ใช้ App Password ไม่ใช่รหัสผ่านจริง
    },
    // อีเมลถูกส่งแบบ fire-and-forget: ถ้า SMTP ค้างแล้วไม่มี timeout สั้น ๆ (ค่าเริ่มต้นของ nodemailer นานถึงนาที)
    // คำขอที่รออยู่จะสะสมในหน่วยความจำ จึงตั้งเพดานเวลา และใช้ pool เพื่อใช้การเชื่อมต่อซ้ำ
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
});

const FROM = `"ระบบทดสอบมาตรฐานฝีมือแรงงาน" <${process.env.SMTP_USER}>`;

// วันที่แบบไทยสำหรับอีเมล: รับสตริง 'YYYY-MM-DD' (คอลัมน์ DATE) หรือ Date
// เดิมส่ง Date ตรง ๆ เข้า escapeHtml ทำให้อีเมลขึ้นข้อความอย่าง "Sat Jul 18 2026 00:00:00 GMT+0700 (Indochina Time)"
function formatThaiDate(value) {
    if (!value) return '';
    const text = value instanceof Date && !Number.isNaN(value.getTime())
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
        : String(value).slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

// ── Template Helper ───────────────────────────────────────────────────────────
function wrapHTML(title, content) {
    return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #F4F6F7; margin: 0; padding: 20px; }
  .card { background: white; max-width: 560px; margin: 0 auto; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #1F4E6B; color: white; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
  .body { padding: 28px 32px; color: #2C3E50; line-height: 1.7; }
  .info-box { background: #F8F9FA; border-left: 4px solid #1F4E6B; border-radius: 4px; padding: 14px 18px; margin: 16px 0; font-size: 14px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .info-label { color: #7f8c8d; }
  .info-value { font-weight: 600; color: #2C3E50; }
  .badge { display: inline-block; padding: 4px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; }
  .badge-green  { background: #EAFAF1; color: #1E8449; }
  .badge-red    { background: #FADBD8; color: #78281F; }
  .badge-orange { background: #FEF9E7; color: #7D6608; }
  .footer { background: #F4F6F7; padding: 16px 32px; font-size: 12px; color: #95A5A6; text-align: center; }
  .btn { display: inline-block; background: #1F4E6B; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>🏛️ ระบบทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ</h1>
    <p>การแจ้งเตือนอัตโนมัติจากระบบ</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ | หากมีปัญหาติดต่อเจ้าหน้าที่</div>
</div>
</body></html>`;
}

// ── 1. แจ้งผลตรวจสอบเอกสาร (อนุมัติ / ไม่ครบ) ────────────────────────────
async function sendDocumentVerificationEmail({ to, full_name, status, note, student_code }) {
    const isApproved = status === 'อนุมัติ';
    const badge = isApproved
        ? `<span class="badge badge-green">✅ อนุมัติแล้ว</span>`
        : `<span class="badge badge-orange">⚠️ เอกสารไม่ครบ</span>`;

    const content = `
        <p>เรียน คุณ<strong>${escapeHtml(full_name)}</strong></p>
        <p>ระบบได้ดำเนินการตรวจสอบเอกสารของท่านเรียบร้อยแล้ว</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">รหัสผู้สมัคร</span><span class="info-value">${escapeHtml(student_code)}</span></div>
            <div class="info-row"><span class="info-label">ผลการตรวจสอบ</span><span>${badge}</span></div>
            ${note ? `<div class="info-row"><span class="info-label">หมายเหตุ</span><span class="info-value">${escapeHtml(note)}</span></div>` : ''}
        </div>
        ${isApproved
            ? `<p>✅ ท่านสามารถ <strong>เข้าสู่ระบบและสมัครสอบ</strong> ได้ทันที</p>
               <a href="${APP_URL}/login" class="btn">เข้าสู่ระบบ →</a>`
            : `<p>⚠️ กรุณาแก้ไขและ<strong>อัปโหลดเอกสารใหม่</strong> ภายใน 7 วัน มิฉะนั้นใบสมัครจะถูกยกเลิก</p>`
        }`;

    await transporter.sendMail({
        from: FROM,
        to,
        subject: isApproved
            ? `✅ เอกสารของท่านได้รับการอนุมัติแล้ว — รหัส ${student_code}`
            : `⚠️ กรุณาส่งเอกสารเพิ่มเติม — รหัส ${student_code}`,
        html: wrapHTML('ผลการตรวจสอบเอกสาร', content),
    });
    console.log(`📧 [Email] ส่งผลตรวจสอบเอกสาร → ${to}`);
}

// ── 2. แจ้งผลคะแนนสอบ ────────────────────────────────────────────────────────
async function sendScoreResultEmail({ to, full_name, student_code, course_name,
        theory_score, practical_score, theory_max_score = 30, practical_max_score = 70,
        total_score, department_status, corrected = false }) {
    const isPassed = department_status === 'ได้รับวุฒิบัตร';
    const maxTotal = Number(theory_max_score) + Number(practical_max_score);
    const badge = isPassed
        ? `<span class="badge badge-green">🏆 ได้รับวุฒิบัตร</span>`
        : `<span class="badge badge-red">❌ ไม่ได้รับวุฒิบัตร</span>`;

    const content = `
        <p>เรียน คุณ<strong>${escapeHtml(full_name)}</strong></p>
        <p>${corrected ? 'ผลการทดสอบมาตรฐานฝีมือแรงงานของท่านได้รับการ<strong>แก้ไข</strong>โดยผู้ดูแลระบบ ผลล่าสุดมีดังนี้' : 'ผลการทดสอบมาตรฐานฝีมือแรงงานของท่านมีดังนี้'}</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">รหัสผู้สมัคร</span><span class="info-value">${escapeHtml(student_code)}</span></div>
            <div class="info-row"><span class="info-label">สาขาวิชา</span><span class="info-value">${escapeHtml(course_name)}</span></div>
            <div class="info-row"><span class="info-label">ภาคทฤษฎี (เต็ม ${escapeHtml(Number(theory_max_score))})</span><span class="info-value">${escapeHtml(theory_score)} คะแนน</span></div>
            <div class="info-row"><span class="info-label">ภาคปฏิบัติ (เต็ม ${escapeHtml(Number(practical_max_score))})</span><span class="info-value">${escapeHtml(practical_score)} คะแนน</span></div>
            <div class="info-row"><span class="info-label">คะแนนรวม</span><span class="info-value" style="font-size:18px;color:#1F4E6B">${escapeHtml(total_score)} / ${escapeHtml(maxTotal)}</span></div>
            <div class="info-row"><span class="info-label">ผลการประเมิน</span><span>${badge}</span></div>
        </div>
        ${isPassed
            ? `<p>🎉 ยินดีด้วย! ท่านสามารถพิมพ์ใบรับรองได้จากระบบ</p>
               <a href="${APP_URL}/student-dashboard" class="btn">ดูใบรับรอง →</a>`
            : `<p>ท่านสามารถติดต่อเจ้าหน้าที่เพื่อสมัครสอบในรอบถัดไปได้</p>`
        }`;

    await transporter.sendMail({
        from: FROM,
        to,
        subject: `${corrected ? '✏️ แก้ไขผลสอบ: ' : ''}${isPassed
            ? `🏆 ผลสอบ: ท่านผ่านเกณฑ์ — ${course_name}`
            : `📋 ผลสอบ: ${course_name} — ${student_code}`}`,
        html: wrapHTML('ผลการทดสอบมาตรฐาน', content),
    });
    console.log(`📧 [Email] ส่งผลคะแนน → ${to}`);
}

// ── 3. แจ้งเตือนอาจารย์เมื่อมีใบสมัครใหม่รอตรวจสอบ ─────────────────────────
async function sendNewApplicationAlert({ to, student_name, student_code, application_no, course_name, submitted_at }) {
    const content = `
        <p>มีใบสมัครสอบใหม่รอการอนุมัติสิทธิ์สอบ</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">ชื่อผู้สมัคร</span><span class="info-value">${escapeHtml(student_name)}</span></div>
            <div class="info-row"><span class="info-label">รหัสผู้สมัคร</span><span class="info-value">${escapeHtml(student_code)}</span></div>
            <div class="info-row"><span class="info-label">เลขที่ใบสมัคร</span><span class="info-value">${escapeHtml(application_no)}</span></div>
            <div class="info-row"><span class="info-label">วิชาสอบ</span><span class="info-value">${escapeHtml(course_name)}</span></div>
            <div class="info-row"><span class="info-label">เวลาสมัคร</span><span class="info-value">${escapeHtml(submitted_at)}</span></div>
        </div>
        <a href="${APP_URL}/grading-panel" class="btn">ไปหน้าคัดกรองใบสมัคร →</a>`;

    await transporter.sendMail({
        from: FROM,
        to,
        subject: `📋 มีใบสมัครสอบใหม่รออนุมัติ — ${student_name}`,
        html: wrapHTML('แจ้งเตือนใบสมัครใหม่', content),
    });
    console.log(`📧 [Email] แจ้งเตือนอาจารย์ → ${to}`);
}

async function sendExamApplicationReceivedEmail({
    to, full_name, student_code, application_no, course_name,
    exam_date, exam_time, exam_location,
}) {
    const content = `
        <p>เรียน คุณ<strong>${escapeHtml(full_name)}</strong></p>
        <p>ระบบได้รับใบสมัครสอบของท่านแล้ว กรุณารอเจ้าหน้าที่อนุมัติสิทธิ์สอบ</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">รหัสผู้สมัคร</span><span class="info-value">${escapeHtml(student_code)}</span></div>
            <div class="info-row"><span class="info-label">เลขที่ใบสมัคร</span><span class="info-value">${escapeHtml(application_no)}</span></div>
            <div class="info-row"><span class="info-label">วิชาสอบ</span><span class="info-value">${escapeHtml(course_name)}</span></div>
            ${exam_date ? `<div class="info-row"><span class="info-label">วันที่สอบ</span><span class="info-value">${escapeHtml(formatThaiDate(exam_date))}</span></div>` : ''}
            ${exam_time ? `<div class="info-row"><span class="info-label">เวลา</span><span class="info-value">${escapeHtml(exam_time)}</span></div>` : ''}
            ${exam_location ? `<div class="info-row"><span class="info-label">สถานที่</span><span class="info-value">${escapeHtml(exam_location)}</span></div>` : ''}
        </div>
        <p><strong>หมายเหตุ:</strong> อีเมลนี้เป็นเพียงการยืนยันว่าได้รับใบสมัคร ยังไม่ใช่การอนุมัติสิทธิ์เข้าสอบ</p>
        <a href="${APP_URL}/student-dashboard" class="btn">ตรวจสอบสถานะใบสมัคร →</a>`;

    await transporter.sendMail({
        from: FROM,
        to,
        subject: `ได้รับใบสมัครสอบแล้ว — ${course_name} (${application_no})`,
        html: wrapHTML('ได้รับใบสมัครสอบแล้ว', content),
    });
}

async function sendExamApplicationStatusEmail({
    to, full_name, student_code, application_no, course_name, status,
    exam_date, exam_time, exam_location,
}) {
    const isApproved = status === 'อนุมัติสิทธิ์สอบ';
    const badge = isApproved
        ? '<span class="badge badge-green">✅ อนุมัติสิทธิ์สอบ</span>'
        : '<span class="badge badge-red">❌ ไม่อนุมัติสิทธิ์สอบ</span>';
    const content = `
        <p>เรียน คุณ<strong>${escapeHtml(full_name)}</strong></p>
        <p>เจ้าหน้าที่ได้ตรวจสอบใบสมัครสอบของท่านแล้ว</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">รหัสผู้สมัคร</span><span class="info-value">${escapeHtml(student_code)}</span></div>
            <div class="info-row"><span class="info-label">เลขที่ใบสมัคร</span><span class="info-value">${escapeHtml(application_no)}</span></div>
            <div class="info-row"><span class="info-label">วิชาสอบ</span><span class="info-value">${escapeHtml(course_name)}</span></div>
            <div class="info-row"><span class="info-label">ผลการพิจารณา</span><span>${badge}</span></div>
            ${isApproved && exam_date ? `<div class="info-row"><span class="info-label">วันที่สอบ</span><span class="info-value">${escapeHtml(formatThaiDate(exam_date))}</span></div>` : ''}
            ${isApproved && exam_time ? `<div class="info-row"><span class="info-label">เวลา</span><span class="info-value">${escapeHtml(exam_time)}</span></div>` : ''}
            ${isApproved && exam_location ? `<div class="info-row"><span class="info-label">สถานที่</span><span class="info-value">${escapeHtml(exam_location)}</span></div>` : ''}
        </div>
        ${isApproved
            ? '<p>กรุณาตรวจสอบวัน เวลา สถานที่สอบ และนำเอกสารยืนยันตัวตนไปในวันสอบ</p>'
            : '<p>กรุณาติดต่อเจ้าหน้าที่หากต้องการทราบรายละเอียดหรือแก้ไขข้อมูล</p>'}
        <a href="${APP_URL}/student-dashboard" class="btn">ดูรายละเอียดในระบบ →</a>`;

    await transporter.sendMail({
        from: FROM,
        to,
        subject: isApproved
            ? `✅ อนุมัติสิทธิ์สอบแล้ว — ${course_name}`
            : `ผลการพิจารณาใบสมัครสอบ — ${course_name}`,
        html: wrapHTML('ผลการพิจารณาใบสมัครสอบ', content),
    });
}

async function verifySmtpConnection() {
    return transporter.verify();
}

async function sendTestEmail(to) {
    return transporter.sendMail({
        from: FROM,
        to,
        subject: 'ทดสอบการส่งอีเมล — ระบบทดสอบมาตรฐานฝีมือแรงงาน',
        html: wrapHTML('ทดสอบการส่งอีเมล', `
            <p>ระบบเชื่อมต่อผู้ให้บริการอีเมลและส่งข้อความได้สำเร็จ</p>
            <div class="info-box">เวลาทดสอบ: ${escapeHtml(new Date().toISOString())}</div>`),
    });
}

async function sendPasswordResetEmail({ to, token }) {
    const resetUrl = `${APP_URL}/reset-password/${encodeURIComponent(token)}`;
    const content = `
        <p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของท่าน</p>
        <p>ลิงก์นี้ใช้ได้ 30 นาทีและใช้ได้เพียงครั้งเดียว หากไม่ได้เป็นผู้ร้องขอสามารถละเว้นอีเมลนี้ได้</p>
        <a href="${resetUrl}" class="btn">ตั้งรหัสผ่านใหม่ →</a>`;
    await transporter.sendMail({
        from: FROM,
        to,
        subject: 'ตั้งรหัสผ่านใหม่ — ระบบทดสอบมาตรฐานฝีมือแรงงาน',
        html: wrapHTML('ตั้งรหัสผ่านใหม่', content),
    });
}

async function sendEmailVerification({ to, token }) {
    const verifyUrl = `${APP_URL}/verify-email/${encodeURIComponent(token)}`;
    const content = `<p>กรุณายืนยันอีเมลเพื่อเปิดใช้งานบัญชีผู้สมัคร</p>
        <p>ลิงก์นี้ใช้ได้ 24 ชั่วโมง</p><a href="${verifyUrl}" class="btn">ยืนยันอีเมล →</a>`;
    await transporter.sendMail({
        from: FROM, to,
        subject: 'ยืนยันอีเมล — ระบบทดสอบมาตรฐานฝีมือแรงงาน',
        html: wrapHTML('ยืนยันอีเมล', content),
    });
}

module.exports = {
    _formatThaiDate: formatThaiDate,
    sendDocumentVerificationEmail,
    sendScoreResultEmail,
    sendNewApplicationAlert,
    sendExamApplicationReceivedEmail,
    sendExamApplicationStatusEmail,
    sendPasswordResetEmail,
    sendEmailVerification,
    verifySmtpConnection,
    sendTestEmail,
};
