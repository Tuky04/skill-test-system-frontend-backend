// ทดสอบระบบค่าสมัครสอบ (100 บาท): ส่งสลิป ตรวจสลิป บังคับชำระก่อนอนุมัติสิทธิ์สอบ และสร้างรายการชำระตอนสมัคร
// ใช้ HTTP จริงกับ app (ฐานข้อมูลและอีเมลถูกแทนด้วยตัวปลอม) และโฟลเดอร์อัปโหลดชั่วคราว
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payment-uploads-'));
process.env.UPLOAD_DIR = uploadsDir;
process.env.JWT_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.RATE_LIMIT_API_MAX = '0';
delete process.env.FRONTEND_DIR;
delete process.env.PAYMENT_ACCOUNT_NAME;
delete process.env.PAYMENT_ACCOUNT_NO;
delete process.env.PAYMENT_PROMPTPAY_ID;
delete process.env.PAYMENT_AMOUNT;

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createFakeDb, installFakeDb, installFakeEmail, rows, ok } = require('../test-support/fakeDb');

const db = installFakeDb(createFakeDb());
installFakeEmail();
const app = require('../server');
const { dateInTimeZone } = require('../utils/domain');

let server;
let base;
test.before(() => new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => new Promise((resolve) => { fs.rmSync(uploadsDir, { recursive: true, force: true }); server.close(resolve); }));
test.beforeEach(() => { db.reset(); for (const f of fs.readdirSync(uploadsDir)) fs.rmSync(path.join(uploadsDir, f)); });

const ADMIN = 1;
const STAFF = 2;
const STUDENT = 7;
const token = (id) => jwt.sign({ id, ver: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const roleOf = (id) => (id === ADMIN ? 'admin' : id === STAFF ? 'staff' : 'student');
const userLookup = [/FROM users WHERE user_id/, (sql, params) => rows({
    user_id: params[0], username: `u${params[0]}`, role: roleOf(params[0]), is_active: 1, token_version: 0,
})];

async function call(method, url, { body, auth, form } = {}) {
    const response = await fetch(base + url, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${token(auth)}` } : {}) },
        body: form || (body ? JSON.stringify(body) : undefined),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
    return { status: response.status, json };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('slip-image-bytes')]);
function slipForm({ bytes = PNG, name = 'slip.png', type = 'image/png', fields = {} } = {}) {
    const form = new FormData();
    if (bytes) form.append('payment_slip', new Blob([bytes], { type }), name);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return form;
}
const uploaded = () => fs.readdirSync(uploadsDir);

const paymentRow = (extra = {}) => ({ payment_id: 11, payment_status: 'รอชำระเงิน', application_status: 'รอดำเนินการ', user_id: STUDENT, ...extra });
const slipRoutes = (row) => [userLookup, [/FROM payments p\s+JOIN registrations r/, rows(row)], [/^\s*(UPDATE|INSERT)/i, ok()]];

test('payment info shows the 100 baht fee and says when the receiving account is not configured yet', async () => {
    db.setRoutes([userLookup]);
    const blank = await call('GET', '/api/student/payment-info', { auth: STUDENT });
    assert.equal(blank.status, 200);
    assert.equal(blank.json.data.amount, 100);
    assert.equal(blank.json.data.configured, false);
    process.env.PAYMENT_ACCOUNT_NAME = 'มหาวิทยาลัยทดสอบ';
    process.env.PAYMENT_ACCOUNT_NO = '123-4-56789-0';
    try {
        const filled = await call('GET', '/api/student/payment-info', { auth: STUDENT });
        assert.equal(filled.json.data.configured, true);
        assert.equal(filled.json.data.account_no, '123-4-56789-0');
    } finally {
        delete process.env.PAYMENT_ACCOUNT_NAME;
        delete process.env.PAYMENT_ACCOUNT_NO;
    }
    assert.equal((await call('GET', '/api/student/payment-info', { auth: STAFF })).status, 403);
});

test('a student can attach a slip for their own application and it waits for staff review', async () => {
    db.setRoutes(slipRoutes(paymentRow()));
    const response = await call('POST', '/api/student/payments/5/slip', {
        auth: STUDENT, form: slipForm({ fields: { transfer_ref: 'REF 2569-001', paid_at: '2026-10-20T10:30' } }),
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.data.payment_status, 'รอตรวจสลิป');
    const update = db.log.find((e) => /UPDATE payments SET slip_filename/.test(e.sql));
    assert.ok(update, 'ต้อง UPDATE รายการชำระ');
    assert.match(update.params[0], /^payment_slip-[0-9a-f]{32}\.png$/);
    assert.match(update.params[1], /^[0-9a-f]{64}$/);          // sha256 ของไฟล์
    assert.equal(update.params[2], 'REF 2569-001');
    assert.equal(update.params[3], '2026-10-20 10:30:00');
    assert.equal(update.params[4], 'รอตรวจสลิป');
    assert.equal(uploaded().length, 1);
});

test('a student cannot attach a slip to someone else\'s application, and the stray file is deleted', async () => {
    db.setRoutes(slipRoutes(paymentRow({ user_id: 999 })));
    const response = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm() });
    assert.equal(response.status, 404);
    assert.equal(uploaded().length, 0);
    assert.equal(db.ran(/UPDATE payments/), false);
});

test('the same slip image cannot be reused for another application', async () => {
    db.setRoutes([
        userLookup,
        [/FROM payments p\s+JOIN registrations r/, rows(paymentRow())],
        [/UPDATE payments SET slip_filename/, Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })],
    ]);
    const response = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm() });
    assert.equal(response.status, 409);
    assert.match(response.json.message, /สลิปนี้เคยถูกใช้/);
    assert.equal(uploaded().length, 0);
    assert.ok(db.ran(/^ROLLBACK$/));
});

test('slips are refused when already paid, already waiting for review, or the application was rejected', async () => {
    for (const [extra, pattern] of [
        [{ payment_status: 'ชำระแล้ว' }, /ชำระเงินแล้ว/],
        [{ payment_status: 'รอตรวจสลิป' }, /รอเจ้าหน้าที่ตรวจสอบ/],
        [{ application_status: 'ปฏิเสธเอกสาร' }, /ถูกปฏิเสธ/],
    ]) {
        db.reset();
        db.setRoutes(slipRoutes(paymentRow(extra)));
        const response = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm() });
        assert.equal(response.status, 409);
        assert.match(response.json.message, pattern);
        assert.equal(uploaded().length, 0);
    }
});

test('a rejected slip can be replaced with a new one', async () => {
    db.setRoutes(slipRoutes(paymentRow({ payment_status: 'สลิปไม่ผ่าน' })));
    const response = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm() });
    assert.equal(response.status, 201);
});

test('slip upload validates the file, the reference and the transfer time', async () => {
    db.setRoutes(slipRoutes(paymentRow()));
    const noFile = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm({ bytes: null }) });
    assert.equal(noFile.status, 400);
    const fake = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm({ bytes: Buffer.from('not really a png at all') }) });
    assert.equal(fake.status, 400);
    const text = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm({ name: 'slip.exe', type: 'application/octet-stream' }) });
    assert.equal(text.status, 400);
    const future = `${dateInTimeZone('Asia/Bangkok', new Date(Date.now() + 3 * 86400000))}T10:00`;
    const late = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm({ fields: { paid_at: future } }) });
    assert.equal(late.status, 400);
    assert.match(late.json.message, /อนาคต/);
    const badRef = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm({ fields: { transfer_ref: '<script>' } }) });
    assert.equal(badRef.status, 400);
    const badDate = await call('POST', '/api/student/payments/5/slip', { auth: STUDENT, form: slipForm({ fields: { paid_at: '2026-02-31T10:00' } }) });
    assert.equal(badDate.status, 400);
    assert.equal(uploaded().length, 0, 'ไฟล์ที่ถูกปฏิเสธต้องไม่ค้างในโฟลเดอร์อัปโหลด');
    assert.equal(db.ran(/UPDATE payments/), false);
});

test('only staff can verify slips; students and admins are refused', async () => {
    db.setRoutes([userLookup]);
    for (const who of [STUDENT, ADMIN]) {
        const response = await call('PUT', '/api/staff/payments/5/verify', { auth: who, body: { status: 'ชำระแล้ว' } });
        assert.equal(response.status, 403);
    }
});

const verifyRoutes = (status = 'รอตรวจสลิป') => [
    userLookup,
    [/FROM payments p\s+JOIN registrations r ON r\.registration_id = p\.registration_id\s+JOIN students s ON s\.student_id = r\.student_id\s+JOIN exam_courses c/,
        rows({ payment_id: 11, payment_status: status, amount: '100.00', slip_filename: 'payment_slip-x.png', registration_id: 5, user_id: STUDENT, course_name: 'Excel' })],
    [/^\s*(UPDATE|INSERT)/i, ok()],
];

test('staff confirm a slip: the payment is marked paid, audited, and the student is notified', async () => {
    db.setRoutes(verifyRoutes());
    const response = await call('PUT', '/api/staff/payments/5/verify', { auth: STAFF, body: { status: 'ชำระแล้ว' } });
    assert.equal(response.status, 200, JSON.stringify(response.json));
    const update = db.log.find((e) => /UPDATE payments SET payment_status/.test(e.sql));
    assert.deepEqual(update.params.slice(0, 2), ['ชำระแล้ว', STAFF]);
    const audit = db.log.find((e) => /INSERT INTO admin_audit_logs/.test(e.sql));
    assert.equal(audit.params[1], 'VERIFY_PAYMENT');
    assert.match(audit.params[4], /"to":"ชำระแล้ว"/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(db.ran(/INSERT INTO notifications/), 'ต้องแจ้งผู้สมัคร');
});

test('rejecting a slip needs a reason; only slips awaiting review can be decided', async () => {
    db.setRoutes(verifyRoutes());
    const noReason = await call('PUT', '/api/staff/payments/5/verify', { auth: STAFF, body: { status: 'สลิปไม่ผ่าน' } });
    assert.equal(noReason.status, 400);
    const bad = await call('PUT', '/api/staff/payments/5/verify', { auth: STAFF, body: { status: 'รอชำระเงิน' } });
    assert.equal(bad.status, 400);
    const rejected = await call('PUT', '/api/staff/payments/5/verify', { auth: STAFF, body: { status: 'สลิปไม่ผ่าน', note: 'ยอดโอนไม่ครบ 100 บาท' } });
    assert.equal(rejected.status, 200);
    db.reset();
    db.setRoutes(verifyRoutes('ชำระแล้ว'));
    const again = await call('PUT', '/api/staff/payments/5/verify', { auth: STAFF, body: { status: 'ชำระแล้ว' } });
    assert.equal(again.status, 409);
    assert.equal(db.ran(/UPDATE payments/), false);
});

const reopenRoutes = (extra = {}) => [
    userLookup,
    [/FROM payments p\s+JOIN registrations r ON r\.registration_id = p\.registration_id\s+JOIN students s ON s\.student_id = r\.student_id\s+JOIN exam_courses c/,
        rows({ payment_id: 11, payment_status: 'ชำระแล้ว', amount: '100.00', slip_filename: 'payment_slip-x.png', registration_id: 5,
            application_status: 'รอดำเนินการ', user_id: STUDENT, course_name: 'Excel', ...extra })],
    [/^\s*(UPDATE|INSERT)/i, ok()],
];

test('staff can undo a mistaken "paid" decision before exam rights are approved, with a reason that is audited', async () => {
    db.setRoutes(reopenRoutes());
    const noReason = await call('PUT', '/api/staff/payments/5/reopen', { auth: STAFF, body: { reason: '' } });
    assert.equal(noReason.status, 400);
    const asAdmin = await call('PUT', '/api/staff/payments/5/reopen', { auth: ADMIN, body: { reason: 'กดผิดรายการ' } });
    assert.equal(asAdmin.status, 403);
    const done = await call('PUT', '/api/staff/payments/5/reopen', { auth: STAFF, body: { reason: 'กดยืนยันผิดรายการ' } });
    assert.equal(done.status, 200, JSON.stringify(done.json));
    const update = db.log.find((e) => /UPDATE payments SET payment_status/.test(e.sql));
    assert.equal(update.params[0], 'รอตรวจสลิป');
    const audit = db.log.find((e) => /INSERT INTO admin_audit_logs/.test(e.sql));
    assert.equal(audit.params[1], 'REOPEN_PAYMENT');

    for (const [extra, label] of [[{ application_status: 'อนุมัติสิทธิ์สอบ' }, 'approved'], [{ payment_status: 'รอตรวจสลิป' }, 'waiting'], [{ amount: '0.00', slip_filename: null }, 'legacy']]) {
        db.reset();
        db.setRoutes(reopenRoutes(extra));
        const refused = await call('PUT', '/api/staff/payments/5/reopen', { auth: STAFF, body: { reason: 'กดยืนยันผิดรายการ' } });
        assert.equal(refused.status, 409, label);
        assert.equal(db.ran(/UPDATE payments/), false, label);
    }
});

const approvalRoutes = (paymentStatus) => [
    userLookup,
    [/FROM registrations r\s+JOIN students s ON r\.student_id = s\.student_id\s+JOIN users u/, rows({
        registration_id: 3, course_id: 4, application_no: 'APP-1', application_status: 'รอดำเนินการ', exam_status: 'รอสอบ', result_published_at: null,
        user_id: STUDENT, student_code: 'STD-5', full_name: 'นักศึกษา', email: 's@x.test', course_name: 'Excel', exam_date: '2030-12-01', max_seats: 10,
        payment_status: paymentStatus,
    })],
    [/^\s*(UPDATE|INSERT)/i, ok()],
];

test('exam rights cannot be approved until the fee is confirmed paid', async () => {
    for (const status of ['รอชำระเงิน', 'รอตรวจสลิป', 'สลิปไม่ผ่าน', undefined]) {
        db.reset();
        db.setRoutes(approvalRoutes(status));
        const response = await call('PUT', '/api/registrations/3/status', { auth: STAFF, body: { status: 'อนุมัติสิทธิ์สอบ' } });
        assert.equal(response.status, 409, String(status));
        assert.match(response.json.message, /ชำระ/);
        assert.equal(db.ran(/UPDATE registrations/), false);
    }
    db.reset();
    db.setRoutes(approvalRoutes('ชำระแล้ว'));
    const paid = await call('PUT', '/api/registrations/3/status', { auth: STAFF, body: { status: 'อนุมัติสิทธิ์สอบ' } });
    assert.equal(paid.status, 200, JSON.stringify(paid.json));
    assert.ok(db.ran(/UPDATE registrations SET application_status/));
});

test('rejecting an application does not require payment, and no refund flow exists', async () => {
    db.setRoutes(approvalRoutes('รอชำระเงิน'));
    const response = await call('PUT', '/api/registrations/3/status', { auth: STAFF, body: { status: 'ปฏิเสธเอกสาร' } });
    assert.equal(response.status, 200);
    assert.equal(db.ran(/refund/i), false);
});

const shift = (days) => dateInTimeZone('Asia/Bangkok', new Date(Date.now() + days * 86400000));

const openCourse = () => ({
    course_id: 4, course_code: 'EXCEL-01', course_name: 'Excel', exam_date: shift(10), exam_time: '09:00', exam_location: 'ห้อง 1',
        reg_open_date: shift(-3), reg_close_date: shift(3), max_seats: 20, max_attempts: 3, status_override: null,
});

test('applying for an exam creates a 100 baht payment record waiting for the slip', async () => {
    const course = openCourse();
    db.setRoutes([
        userLookup,
        [/FROM students s JOIN users u/, rows({ student_id: 9, student_code: 'STD-9', full_name: 'นักศึกษา', registration_status: 'อนุมัติ', email: 's@x.test' })],
        [/SELECT \* FROM exam_courses WHERE course_id/, rows(course)],
        [/SELECT COUNT\(\*\) AS total FROM registrations WHERE course_id/, rows({ total: 0 })],
        [/FROM registrations WHERE student_id = \? AND course_id/, [[], undefined]],
        [/INSERT INTO exam_sessions/, ok({ insertId: 3 })],
        [/INSERT INTO registrations/, ok({ insertId: 55 })],
        [/^\s*(UPDATE|INSERT)/i, ok()],
    ]);
    const response = await call('POST', '/api/student/apply', { auth: STUDENT, body: { course_id: 4 } });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.payment_amount, 100);
    assert.match(response.json.message, /100 บาท/);
    const insert = db.log.find((e) => /INSERT INTO payments/.test(e.sql));
    assert.deepEqual(insert.params, [55, 100]);
});

test('the fee amount is configurable but falls back to 100 when the value is nonsense', () => {
    const { feeAmount } = require('../utils/payment');
    process.env.PAYMENT_AMOUNT = '150.456';
    assert.equal(feeAmount(), 150.46);
    for (const bad of ['-5', 'abc', '99999999']) {
        process.env.PAYMENT_AMOUNT = bad;
        assert.equal(feeAmount(), 100, bad);
    }
    delete process.env.PAYMENT_AMOUNT;
    assert.equal(feeAmount(), 100);
});

test('applying for a retake after a failed result creates a brand-new payment (no refund, pay again)', async () => {
    const course = openCourse();
    db.setRoutes([
        userLookup,
        [/FROM students WHERE user_id = \?/, rows({ student_id: 9, student_code: 'STD-9', full_name: 'นักศึกษา', registration_status: 'อนุมัติ' })],
        [/SELECT \* FROM exam_courses WHERE course_id/, rows(course)],
        [/FROM registrations r\s+LEFT JOIN scores sc/, rows({
            registration_id: 40, attempt_no: 1, is_retake: 0, application_status: 'อนุมัติสิทธิ์สอบ', registered_at: new Date(), retake_reason: null,
            result_published_at: new Date(), theory_score: 10, practical_score: 20, total_score: 30, department_status: 'ไม่ได้รับวุฒิบัตร',
        })],
        [/SELECT COUNT\(\*\) AS total FROM registrations WHERE course_id/, rows({ total: 0 })],
        [/INSERT INTO exam_sessions/, ok({ insertId: 3 })],
        [/INSERT INTO registrations/, ok({ insertId: 77 })],
        [/^\s*(UPDATE|INSERT)/i, ok()],
    ]);
    const response = await call('POST', '/api/student/apply-retake', { auth: STUDENT, body: { course_id: 4, retake_reason: 'พัฒนาคะแนน' } });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.match(response.json.message, /100 บาท/);
    const insert = db.log.find((e) => /INSERT INTO payments/.test(e.sql));
    assert.deepEqual(insert.params, [77, 100]);
});

test('slip files are only downloadable by their owner and by staff (staff views are audited)', async () => {
    const name = 'payment_slip-0123456789abcdef0123456789abcdef.png';
    fs.writeFileSync(path.join(uploadsDir, name), PNG);
    const owner = (id) => [userLookup, [/SELECT user_id FROM \(/, rows({ user_id: id })], [/^\s*(UPDATE|INSERT)/i, ok()]];
    db.setRoutes(owner(STUDENT));
    const mine = await fetch(`${base}/api/documents/${name}`, { headers: { Authorization: `Bearer ${token(STUDENT)}` } });
    assert.equal(mine.status, 200);
    assert.equal(mine.headers.get('content-type'), 'image/png');
    db.reset();
    db.setRoutes(owner(999));
    const other = await fetch(`${base}/api/documents/${name}`, { headers: { Authorization: `Bearer ${token(STUDENT)}` } });
    assert.equal(other.status, 403);
    db.reset();
    db.setRoutes(owner(STUDENT));
    const staff = await fetch(`${base}/api/documents/${name}`, { headers: { Authorization: `Bearer ${token(STAFF)}` } });
    assert.equal(staff.status, 200);
    assert.ok(db.log.some((e) => /INSERT INTO admin_audit_logs/.test(e.sql) && e.params[1] === 'VIEW_PRIVATE_DOCUMENT'));
    const query = db.log.find((e) => /SELECT user_id FROM \(/.test(e.sql));
    assert.match(query.sql, /FROM payments p/, 'ต้องตรวจเจ้าของจากตารางชำระเงินด้วย');
});
