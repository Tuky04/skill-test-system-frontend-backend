// ตรวจความพร้อมก่อนเปิดระบบ:  npm run check-config
// แสดงผล PASS / WARN / FAIL (ไม่พิมพ์ค่าลับใดๆ ลงหน้าจอ) และจบด้วย exit code 1 ถ้ามีข้อ FAIL
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const results = [];
const pass = (name, detail = '') => results.push({ level: 'PASS', name, detail });
const warn = (name, detail) => results.push({ level: 'WARN', name, detail });
const fail = (name, detail) => results.push({ level: 'FAIL', name, detail });

const EXAMPLE = /replace-with|example\.com|your-email/i;

function checkNode() {
    const major = Number(process.versions.node.split('.')[0]);
    if (major >= 20) pass('Node.js', `v${process.versions.node}`);
    else fail('Node.js', `ต้องใช้ v20 ขึ้นไป (ตอนนี้ v${process.versions.node})`);
}

function checkSecrets() {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const value = process.env[key] || '';
        if (value.length < 32 || EXAMPLE.test(value)) fail(key, 'ต้องเป็นค่าสุ่มยาวอย่างน้อย 32 ตัวอักษร และห้ามใช้ค่าตัวอย่าง');
        else pass(key, `ยาว ${value.length} ตัวอักษร`);
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) fail('JWT secrets', 'JWT_SECRET และ JWT_REFRESH_SECRET ต้องเป็นคนละค่า');
    if (EXAMPLE.test(process.env.DB_PASSWORD || '')) fail('DB_PASSWORD', 'ยังเป็นค่าตัวอย่าง');
}

function checkNetwork() {
    const port = Number(process.env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT', 'ต้องเป็นเลข 1-65535');
    else pass('PORT', String(port));
    pass('HOST', process.env.HOST || '127.0.0.1 (ค่าเริ่มต้น: เข้าได้เฉพาะเครื่องนี้ — ตั้ง HOST=0.0.0.0 ถ้าต้องให้เครื่องอื่นเข้า)');
    const url = process.env.PUBLIC_APP_URL || '';
    if (!url) warn('PUBLIC_APP_URL', 'ไม่ได้ตั้ง ลิงก์ในอีเมลจะชี้ไป http://localhost:3000');
    else if (/localhost|127\.0\.0\.1/.test(url)) warn('PUBLIC_APP_URL', 'ยังชี้ไป localhost — ลิงก์ในอีเมลจะเปิดไม่ได้จากเครื่องอื่น');
    else pass('PUBLIC_APP_URL', url);
    if (process.env.NODE_ENV === 'production' && !/^https:/.test(url) && process.env.COOKIE_SECURE !== 'false') {
        warn('COOKIE_SECURE', 'NODE_ENV=production ทำให้คุกกี้ต้องใช้ HTTPS ถ้าเข้าผ่าน HTTP ให้ตั้ง COOKIE_SECURE=false ไม่เช่นนั้นผู้ใช้จะถูกเด้งออกทุก 15 นาที');
    }
}

function checkPaths() {
    const web = process.env.FRONTEND_DIR;
    if (!web) warn('FRONTEND_DIR', 'ไม่ได้ตั้ง backend จะไม่เสิร์ฟหน้าเว็บ (ต้องมี Apache/Nginx เสิร์ฟเอง)');
    else if (!fs.existsSync(path.join(path.resolve(web), 'index.html'))) fail('FRONTEND_DIR', `ไม่พบ index.html ที่ ${path.resolve(web)}`);
    else pass('FRONTEND_DIR', path.resolve(web));

    const uploads = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../private_uploads'));
    try {
        fs.mkdirSync(uploads, { recursive: true });
        const probe = path.join(uploads, `.write-test-${process.pid}`);
        fs.writeFileSync(probe, 'ok');
        fs.unlinkSync(probe);
        pass('UPLOAD_DIR', `${uploads} (เขียนได้)`);
    } catch (error) {
        fail('UPLOAD_DIR', `เขียนไฟล์ที่ ${uploads} ไม่ได้ (${error.code})`);
    }
}

async function checkDatabase() {
    const db = require('../config/db');
    try {
        const [[mode]] = await db.query('SELECT @@session.sql_mode AS mode, VERSION() AS version');
        pass('ฐานข้อมูล', `เชื่อมต่อสำเร็จ (${mode.version})`);
        if (/STRICT_TRANS_TABLES/.test(mode.mode)) pass('SQL strict mode', 'เปิดอยู่');
        else warn('SQL strict mode', 'ปิดอยู่ (DB_STRICT_MODE=false) ข้อมูลยาวเกินจะถูกตัดเงียบๆ');
        const required = ['users', 'students', 'exam_courses', 'registrations', 'scores', 'certificates', 'admin_audit_logs'];
        const [tables] = await db.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
        const have = new Set(tables.map((row) => row.name));
        const missing = required.filter((name) => !have.has(name));
        if (missing.length) fail('ตารางในฐานข้อมูล', `ยังไม่มีตาราง: ${missing.join(', ')} — นำเข้า database/skill_test_system.sql ก่อน`);
        else pass('ตารางในฐานข้อมูล', 'ครบ');
        const [[admins]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1").catch(() => [[{ total: -1 }]]);
        if (admins.total === 0) warn('บัญชีผู้ดูแล', 'ยังไม่มี admin — รัน npm run create-admin');
        else if (admins.total > 0) pass('บัญชีผู้ดูแล', `${admins.total} บัญชี`);
    } catch (error) {
        fail('ฐานข้อมูล', `เชื่อมต่อไม่ได้ (${error.code || error.message}) — ตรวจ DB_HOST / DB_USER / DB_PASSWORD / DB_NAME`);
    } finally {
        await db.end().catch(() => {});
    }
}

async function checkSmtp() {
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'false') {
        warn('อีเมล', 'REQUIRE_EMAIL_VERIFICATION=false: ไม่บังคับยืนยันอีเมล (เหมาะกับการทดสอบเท่านั้น)');
        return;
    }
    if (!process.env.SMTP_HOST || EXAMPLE.test(process.env.SMTP_HOST) || !process.env.SMTP_USER) {
        fail('อีเมล (SMTP)', 'ยังไม่ได้ตั้ง SMTP_* แต่เปิดบังคับยืนยันอีเมลอยู่ นักศึกษาจะสมัครแล้วเข้าสู่ระบบไม่ได้');
        return;
    }
    try {
        await Promise.race([
            require('../utils/emailService').verifySmtpConnection(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('หมดเวลา 15 วินาที')), 15000)),
        ]);
        pass('อีเมล (SMTP)', `เชื่อมต่อ ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} สำเร็จ`);
    } catch (error) {
        fail('อีเมล (SMTP)', `เชื่อมต่อไม่ได้: ${error.message}`);
    }
}

(async () => {
    checkNode();
    checkSecrets();
    checkNetwork();
    checkPaths();
    await checkDatabase();
    await checkSmtp();
    const icon = { PASS: '[ผ่าน]', WARN: '[เตือน]', FAIL: '[ไม่ผ่าน]' };
    for (const { level, name, detail } of results) console.log(`${icon[level]} ${name}${detail ? ` — ${detail}` : ''}`);
    const failed = results.filter((row) => row.level === 'FAIL').length;
    const warned = results.filter((row) => row.level === 'WARN').length;
    console.log(`\nสรุป: ผ่าน ${results.length - failed - warned} · เตือน ${warned} · ไม่ผ่าน ${failed}`);
    process.exit(failed ? 1 : 0);
})();
