// ทดสอบระดับ HTTP กับ app จริง (ไม่ต่อ MySQL/SMTP): ฐานข้อมูลและอีเมลถูกแทนด้วยตัวปลอม
// เน้นพฤติกรรมที่เคยพังจริง: โปรเซสล่มจากคุกกี้เสีย, rate limit ใช้ร่วมกัน, แก้คะแนนหลังประกาศผลไม่ได้, อีเมล/แจ้งเตือนซ้ำ
process.env.JWT_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.RATE_LIMIT_REGISTER_MAX = '2';
process.env.RATE_LIMIT_FORGOT_MAX = '50';
process.env.RATE_LIMIT_LOGIN_MAX = '100';
process.env.RATE_LIMIT_LOGIN_ACCOUNT_MAX = '3';
process.env.RATE_LIMIT_API_MAX = '0';

// โฟลเดอร์หน้าเว็บจำลองสำหรับโหมดโปรเซสเดียว (FRONTEND_DIR)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-test-'));
fs.mkdirSync(path.join(webDir, 'static'));
fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><title>skill-test-app</title><div id="root"></div>');
fs.writeFileSync(path.join(webDir, 'static', 'app.123.js'), 'console.log(1)');
process.env.FRONTEND_DIR = webDir;

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createFakeDb, installFakeDb, installFakeEmail, rows, ok } = require('../test-support/fakeDb');

const db = installFakeDb(createFakeDb());
const email = installFakeEmail();
const app = require('../server');
const { withAsyncErrors } = require('../utils/asyncRoutes');

let server;
let base;
test.before(() => new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => new Promise((resolve) => { fs.rmSync(webDir, { recursive: true, force: true }); server.close(resolve); }));
test.beforeEach(() => { db.reset(); email.calls.length = 0; });

const token = (id) => jwt.sign({ id, ver: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const ADMIN = 1;
const STAFF = 2;
const userLookup = [/FROM users WHERE user_id/, (sql, params) => rows({
    user_id: params[0], username: params[0] === ADMIN ? 'admin' : 'staff', role: params[0] === ADMIN ? 'admin' : 'staff', is_active: 1, token_version: 0,
})];

async function call(method, path, { body, headers = {}, auth } = {}) {
    const response = await fetch(base + path, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${token(auth)}` } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
    return { status: response.status, json, headers: response.headers };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test('a malformed refresh cookie is a 401, not a process crash', async () => {
    const bad = await call('POST', '/api/auth/refresh', { headers: { Cookie: 'refresh_token=%' } });
    assert.equal(bad.status, 401);
    // เซิร์ฟเวอร์ต้องยังตอบคำขอถัดไป (เดิม URIError ทำให้ Node ปิดโปรเซส)
    const next = await call('GET', '/health');
    assert.equal(next.status, 200);
});

test('a disallowed CORS origin is answered with 403 instead of 500', async () => {
    const response = await call('GET', '/api/courses/public', { headers: { Origin: 'http://evil.example' } });
    assert.equal(response.status, 403);
    assert.equal(response.json.code, 'ORIGIN_FORBIDDEN');
});

test('rate limit buckets are independent: registering does not block password reset', async () => {
    for (let i = 0; i < 2; i += 1) {
        assert.equal((await call('POST', '/api/auth/register', { body: {} })).status, 400);
    }
    assert.equal((await call('POST', '/api/auth/register', { body: {} })).status, 429);
    const forgot = await call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@example.test' } });
    assert.equal(forgot.status, 200);
});

test('successful logins do not burn the failure budget, but repeated failures lock that account', async () => {
    const hash = bcrypt.hashSync('Passw0rd!', 4);
    db.setRoutes([[/FROM users WHERE username/, rows({
        user_id: 5, username: 'alice01', password_hash: hash, role: 'admin', email: 'a@x.test', is_active: 1, token_version: 0, email_verified_at: new Date(),
    })], [/UPDATE users SET last_login/, ok()]]);
    for (let i = 0; i < 5; i += 1) {
        const good = await call('POST', '/api/login', { body: { username: 'alice01', password: 'Passw0rd!' } });
        assert.equal(good.status, 200, `login #${i + 1}`);
        assert.ok(good.json.token);
        assert.match(good.headers.get('set-cookie') || '', /refresh_token=/);
    }
    for (let i = 0; i < 3; i += 1) {
        assert.equal((await call('POST', '/api/login', { body: { username: 'alice01', password: 'wrong-password' } })).status, 401);
    }
    const locked = await call('POST', '/api/login', { body: { username: 'alice01', password: 'wrong-password' } });
    assert.equal(locked.status, 429);
    // บัญชีอื่นไม่ได้รับผลกระทบ
    const other = await call('POST', '/api/login', { body: { username: 'bob0001', password: 'whatever1' } });
    assert.equal(other.status, 401);
});

test('login compares against a dummy hash when the user does not exist (no timing oracle)', async () => {
    let compares = 0;
    const original = bcrypt.compare;
    bcrypt.compare = (...args) => { compares += 1; return original(...args); };
    try {
        db.setRoutes([[/FROM users WHERE username/, rows()]]);
        const response = await call('POST', '/api/login', { body: { username: 'ghost-user', password: 'Passw0rd!' } });
        assert.equal(response.status, 401);
        assert.equal(compares, 1);
    } finally {
        bcrypt.compare = original;
    }
});

test('refresh with a database outage is 503 and keeps the cookie', async () => {
    const refresh = jwt.sign({ id: 5, ver: 0 }, process.env.JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    db.setRoutes([[/FROM users WHERE user_id/, new Error('connect ECONNREFUSED')]]);
    const response = await call('POST', '/api/auth/refresh', { headers: { Cookie: `refresh_token=${refresh}` } });
    assert.equal(response.status, 503);
    assert.doesNotMatch(response.headers.get('set-cookie') || '', /refresh_token=;/);
});

test('refresh restores the session user so a new tab does not need a second login', async () => {
    const refresh = jwt.sign({ id: 5, ver: 0 }, process.env.JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    db.setRoutes([
        [/FROM users WHERE user_id/, rows({ user_id: 5, username: 'stu0001', email: 's@x.test', role: 'student', is_active: 1, token_version: 0 })],
        [/FROM students WHERE user_id/, rows({ student_id: 9, student_code: 'STD-2569-000005', full_name: 'ทดสอบ', registration_status: 'อนุมัติ' })],
    ]);
    const response = await call('POST', '/api/auth/refresh', { headers: { Cookie: `refresh_token=${refresh}` } });
    assert.equal(response.status, 200);
    assert.equal(response.json.role, 'student');
    assert.equal(response.json.user.student_code, 'STD-2569-000005');
});

test('forgot-password replies identically for unknown and known emails and throttles per account', async () => {
    const unknown = await call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@example.test' } });
    db.setRoutes([
        [/SELECT user_id, email FROM users WHERE email/, rows({ user_id: 5, email: 'known@example.test' })],
        [/UPDATE users SET reset_token/, ok()],
    ]);
    const known = await call('POST', '/api/auth/forgot-password', { body: { email: 'known@example.test' } });
    assert.deepEqual(unknown.json, known.json);
    await settle();
    assert.equal(email.calls.filter((c) => c.name === 'sendPasswordResetEmail').length, 1);

    // ครั้งที่สองภายในนาทีเดียวกัน: UPDATE ไม่ถูกเงื่อนไข (affectedRows=0) จึงต้องไม่ส่งอีเมลซ้ำ
    db.setRoutes([
        [/SELECT user_id, email FROM users WHERE email/, rows({ user_id: 5, email: 'known@example.test' })],
        [/UPDATE users SET reset_token/, [{ affectedRows: 0 }, undefined]],
    ]);
    await call('POST', '/api/auth/forgot-password', { body: { email: 'known@example.test' } });
    await settle();
    assert.equal(email.calls.filter((c) => c.name === 'sendPasswordResetEmail').length, 1);
});

test('async handler rejections reach the error middleware instead of becoming unhandled rejections', async () => {
    const mini = express();
    const router = withAsyncErrors(express.Router());
    router.get('/boom', async () => { throw new Error('async failure'); });
    router.get('/sync-boom', () => { throw new Error('sync failure'); });
    mini.use(router);
    mini.use((error, req, res, next) => res.status(500).json({ message: error.message })); // eslint-disable-line no-unused-vars
    const listener = await new Promise((resolve) => { const s = mini.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
        const url = `http://127.0.0.1:${listener.address().port}`;
        const async500 = await fetch(`${url}/boom`);
        assert.equal(async500.status, 500);
        assert.equal((await async500.json()).message, 'async failure');
        assert.equal((await fetch(`${url}/sync-boom`)).status, 500);
    } finally {
        await new Promise((resolve) => listener.close(resolve));
    }
});

const publishedRegistration = {
    registration_id: 9, application_status: 'อนุมัติสิทธิ์สอบ', exam_status: 'ประกาศผลแล้ว', result_published_at: new Date(),
    theory_max_score: 30, practical_max_score: 70, course_name: 'Excel', user_id: 77, full_name: 'ผู้สอบ', student_code: 'STD-1', email: 'a@x.test',
};
const scoreRoutes = (newStatus, newTotal) => [
    userLookup,
    [/FROM registrations r\s+JOIN exam_courses c/, rows(publishedRegistration)],
    [/SELECT \* FROM scores WHERE registration_id/, rows({ theory_score: 25, practical_score: 55, deducted_score: 0, department_status: 'ได้รับวุฒิบัตร' })],
    [/SELECT total_score, university_status, department_status FROM scores/, rows({ total_score: newTotal, university_status: 'ผ่าน', department_status: newStatus })],
    [/SELECT certificate_id, revoked_at FROM certificates/, rows({ certificate_id: 1, revoked_at: null })],
    [/^\s*(UPDATE|INSERT)/i, ok()],
];

test('staff cannot edit a published score and is told to ask an admin', async () => {
    db.setRoutes(scoreRoutes('ได้รับวุฒิบัตร', 80));
    const response = await call('POST', '/api/scores/submit', { auth: STAFF, body: { registration_id: 9, theory_score: 20, practical_score: 50, deducted_score: 0 } });
    assert.equal(response.status, 403);
    assert.match(response.json.message, /ผู้ดูแลระบบ/);
    assert.equal(db.ran(/UPDATE scores/), false);
});

test('score correction is admin-only', async () => {
    db.setRoutes(scoreRoutes('ได้รับวุฒิบัตร', 80));
    const response = await call('POST', '/api/admin/scores/correct', { auth: STAFF, body: { registration_id: 9, theory_score: 20, practical_score: 50, deducted_score: 0, reason: 'พิมพ์ผิด' } });
    assert.equal(response.status, 403);
});

test('admin correction needs a reason, is audited, and revokes the certificate when the new result fails', async () => {
    db.setRoutes(scoreRoutes('ไม่ได้รับวุฒิบัตร', 40));
    const noReason = await call('POST', '/api/admin/scores/correct', { auth: ADMIN, body: { registration_id: 9, theory_score: 10, practical_score: 30, deducted_score: 0 } });
    assert.equal(noReason.status, 400);
    assert.equal(db.ran(/UPDATE scores/), false);

    const response = await call('POST', '/api/admin/scores/correct', { auth: ADMIN, body: { registration_id: 9, theory_score: 10, practical_score: 30, deducted_score: 0, reason: 'กรอกคะแนนผิดช่อง' } });
    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.json.certificate, 'revoked');
    assert.ok(db.ran(/UPDATE scores SET/));
    assert.ok(db.ran(/INSERT INTO score_audit_logs/));
    assert.ok(db.ran(/UPDATE certificates SET revoked_at = NOW\(\)/));
    const audit = db.log.find((entry) => /INSERT INTO admin_audit_logs/.test(entry.sql));
    assert.ok(audit, 'admin audit row must be written');
    assert.equal(audit.params[1], 'CORRECT_SCORE');
    assert.match(audit.params[4], /กรอกคะแนนผิดช่อง/);
    assert.ok(db.ran(/^COMMIT$/));
    await settle();
    assert.equal(email.calls.filter((c) => c.name === 'sendScoreResultEmail' && c.payload.corrected).length, 1);
});

test('admin correction rejects scores that exceed the course maximum or have 3 decimals', async () => {
    db.setRoutes(scoreRoutes('ได้รับวุฒิบัตร', 80));
    const tooHigh = await call('POST', '/api/admin/scores/correct', { auth: ADMIN, body: { registration_id: 9, theory_score: 31, practical_score: 50, deducted_score: 0, reason: 'ทดสอบ' } });
    assert.equal(tooHigh.status, 400);
    const decimals = await call('POST', '/api/admin/scores/correct', { auth: ADMIN, body: { registration_id: 9, theory_score: 20.123, practical_score: 50, deducted_score: 0, reason: 'ทดสอบ' } });
    assert.equal(decimals.status, 400);
    assert.equal(db.ran(/UPDATE scores/), false);
});

test('re-verifying a student with the same result does not email or notify again', async () => {
    db.setRoutes([
        userLookup,
        [/FROM students s JOIN users u ON u\.user_id = s\.user_id/, rows({ student_id: 5, student_code: 'STD-5', full_name: 'นักศึกษา', user_id: 50, registration_status: 'อนุมัติ', verify_note: null, email: 's@x.test' })],
        [/^\s*(UPDATE|INSERT)/i, ok()],
    ]);
    const response = await call('PUT', '/api/staff/students/5/verify', { auth: STAFF, body: { status: 'อนุมัติ' } });
    assert.equal(response.status, 200);
    assert.equal(response.json.unchanged, true);
    assert.equal(db.ran(/UPDATE students/), false);
    await settle();
    assert.equal(email.calls.length, 0);
});

test('a rejected application cannot be re-approved once the course seats are full', async () => {
    db.setRoutes([
        userLookup,
        [/FROM registrations r\s+JOIN students s ON r\.student_id = s\.student_id\s+JOIN users u/, rows({
            registration_id: 3, course_id: 4, application_no: 'APP-1', application_status: 'ปฏิเสธเอกสาร', exam_status: 'รอสอบ', result_published_at: null,
            user_id: 50, student_code: 'STD-5', full_name: 'นักศึกษา', email: 's@x.test', course_name: 'Excel', exam_date: '2026-12-01', max_seats: 1,
        })],
        [/SELECT COUNT\(\*\) AS total FROM registrations WHERE course_id/, rows({ total: 1 })],
        [/^\s*(UPDATE|INSERT)/i, ok()],
    ]);
    const response = await call('PUT', '/api/registrations/3/status', { auth: STAFF, body: { status: 'อนุมัติสิทธิ์สอบ' } });
    assert.equal(response.status, 409);
    assert.equal(db.ran(/UPDATE registrations/), false);
    assert.ok(db.ran(/^ROLLBACK$/));
});

test('single-process mode serves the React app with a CSP that allows its own scripts, and keeps /api strict', async () => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /skill-test-app/);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(page.headers.get('cache-control'), 'no-cache');

    // เส้นทางของ React Router ที่เปิดตรง/รีเฟรชต้องได้ index.html
    const deep = await fetch(`${base}/student-dashboard`);
    assert.equal(deep.status, 200);
    assert.match(await deep.text(), /skill-test-app/);

    const asset = await fetch(`${base}/static/app.123.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);

    // API ที่ไม่พบยังเป็น 404 JSON และ CSP ของ API เข้มเหมือนเดิม
    const missing = await call('GET', '/api/nothing-here');
    assert.equal(missing.status, 404);
    assert.equal(missing.json.success, false);
    assert.match(missing.headers.get('content-security-policy'), /default-src 'none'/);
});

test('requests from the page served by this very host pass CORS without CORS_ORIGINS', async () => {
    const origin = base; // Origin = http://127.0.0.1:<port> ตรงกับ Host
    db.setRoutes([[/FROM exam_courses/, rows()]]);
    const same = await call('GET', '/api/courses/public', { headers: { Origin: origin } });
    assert.equal(same.status, 200);
    const other = await call('GET', '/api/courses/public', { headers: { Origin: 'http://127.0.0.1:1' } });
    assert.equal(other.status, 403);
    const spoof = await call('GET', '/api/courses/public', { headers: { Origin: 'http://evil.example' } });
    assert.equal(spoof.status, 403);
});
