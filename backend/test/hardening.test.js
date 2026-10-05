// ทดสอบตรรกะล้วนที่เคยเป็นบั๊ก: วันที่เลื่อนตามเขตเวลา, การตรวจ input, การสร้างไฟล์ส่งออกใน worker
// ตั้งเขตเวลาแบบประเทศไทยก่อนมีการใช้ Date: ทุกไฟล์ทดสอบรันเป็นโปรเซสแยก จึงไม่กระทบไฟล์อื่น
process.env.TZ = 'Asia/Bangkok';
process.env.APP_TIMEZONE = 'Asia/Bangkok';
process.env.JWT_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.EXPORT_MAX_CONCURRENT = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDb, installFakeDb } = require('../test-support/fakeDb');

installFakeDb(createFakeDb());

const domain = require('../utils/domain');
const { _validateRegistration: validateRegistration, _sanitizeBody: sanitizeBody } = require('../controllers/registrationController');
const { _parseScores: parseScores } = require('../controllers/scoreController');
const { _validateCourse: validateCourse } = require('../controllers/courseController');
const { _parseCookies: parseCookies } = require('../controllers/authController');
const { _safeCsvCell: safeCsvCell } = require('../controllers/exportController');
const { _formatThaiDate: formatThaiDate } = require('../utils/emailService');
const { buildWorkbookBuffer } = require('../utils/exportRunner');

const bangkok = new Date(2026, 6, 16).getTimezoneOffset() === -420;

test('DATE values from the driver keep their calendar day in UTC+7 (was shifted back one day)', { skip: !bangkok && 'runtime ไม่รองรับการเปลี่ยน TZ' }, () => {
    const openDate = new Date(2026, 6, 16); // สิ่งที่ mysql2 คืนสำหรับ DATE '2026-07-16' เมื่อ timezone เป็น local
    assert.equal(domain.normalizeDate(openDate), '2026-07-16');
    const course = { reg_open_date: new Date(2026, 6, 16), reg_close_date: new Date(2026, 6, 17) };
    assert.equal(domain.computeCourseStatus(course, '2026-07-17'), domain.COURSE_STATUS.OPEN, 'วันสุดท้ายของการรับสมัครต้องยังสมัครได้');
    assert.equal(domain.computeCourseStatus(course, '2026-07-15'), domain.COURSE_STATUS.UPCOMING, 'ก่อนวันเปิดต้องยังไม่เปิด');
    assert.equal(domain.computeCourseStatus(course, '2026-07-18'), domain.COURSE_STATUS.CLOSED);
});

test('hasExamDatePassed blocks only exams that are strictly in the past', () => {
    assert.equal(domain.hasExamDatePassed({ exam_date: '2026-07-17' }, '2026-07-18'), true);
    assert.equal(domain.hasExamDatePassed({ exam_date: '2026-07-18' }, '2026-07-18'), false);
    assert.equal(domain.hasExamDatePassed({ exam_date: null }, '2026-07-18'), false);
});

test('isValidDateOnly rejects impossible calendar dates', () => {
    assert.equal(domain.isValidDateOnly('2026-02-28'), true);
    assert.equal(domain.isValidDateOnly('2026-02-31'), false);
    assert.equal(domain.isValidDateOnly('2026-13-01'), false);
    assert.equal(domain.isValidDateOnly('26-1-1'), false);
    assert.equal(domain.isValidDateOnly(20260101), false);
});

test('passwords are limited to 72 bytes because bcrypt silently truncates beyond that', () => {
    assert.throws(() => domain.validatePassword('short'), /อย่างน้อย 8/);
    assert.throws(() => domain.validatePassword('a'.repeat(73)), /72/);
    assert.throws(() => domain.validatePassword('ก'.repeat(25)), /72/, 'ตัวอักษรไทยกิน 3 ไบต์');
    assert.throws(() => domain.validatePassword(['12345678']));
    assert.equal(domain.validatePassword('a'.repeat(72)), 'a'.repeat(72));
});

test('parseRequiredNumber does not coerce booleans, arrays or blank strings', () => {
    for (const bad of [true, [5], {}, '   ', null, undefined, 'abc', Infinity]) {
        assert.throws(() => domain.parseRequiredNumber(bad, 'คะแนน'), undefined, String(bad));
    }
    assert.equal(domain.parseRequiredNumber('12.5', 'คะแนน'), 12.5);
    assert.equal(domain.parseRequiredNumber(0, 'คะแนน'), 0);
});

const validBody = () => ({
    username: 'student01', password: 'Passw0rd!', email: 'student@example.test', university_student_code: '66-0001',
    title: 'นาย', full_name: 'ทดสอบ ระบบ', id_card: '1101700020703', birth_date: '2002-05-01', gender: 'ชาย', phone: '0812345678',
    address: '1 ถนนตัวอย่าง', education_level: 'ปริญญาตรี', education_major: 'คอมพิวเตอร์', employment_status: 'นักเรียน/นักศึกษา', privacy_consent: 'true',
});
const files = { doc_id_card: [{ filename: 'x.jpg' }] };

test('registration validation accepts a complete valid form', () => {
    const body = sanitizeBody(validBody());
    // เลขบัตรในชุดทดสอบเดิมใช้ checksum จริง: คำนวณให้ถูกต้องก่อน
    const base = '110170020703';
    const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
    body.id_card = `${base}${(11 - (sum % 11)) % 10}`;
    assert.doesNotThrow(() => validateRegistration(body, files));
});

test('registration rejects array/object fields, bad dates, unknown options and over-long values with 400 (not 500)', () => {
    const idCard = (() => { const base = '110170020703'; const sum = [...base].reduce((t, d, i) => t + Number(d) * (13 - i), 0); return `${base}${(11 - (sum % 11)) % 10}`; })();
    const make = (patch) => sanitizeBody({ ...validBody(), id_card: idCard, ...patch });
    const expect400 = (patch, pattern) => assert.throws(() => validateRegistration(make(patch), files), (error) => error.status === 400 && pattern.test(error.message));
    expect400({ username: ['student01'] }, /กรุณากรอกข้อมูลให้ครบ/); // array ถูกตัดทิ้งเป็นค่าว่าง
    expect400({ birth_date: '2026-02-31' }, /วันเกิด/);
    expect400({ birth_date: '2999-01-01' }, /วันเกิด/);
    expect400({ birth_date: '1800-01-01' }, /วันเกิด/);
    expect400({ gender: 'อื่นๆๆ' }, /gender/);
    expect400({ full_name: 'ก'.repeat(151) }, /full_name/);
    expect400({ password: 'a'.repeat(80) }, /72/);
    expect400({ work_experience_years: '99' }, /ประสบการณ์/);
    assert.throws(() => validateRegistration(make({}), {}), /สำเนาบัตรประชาชน/);
});

test('score parsing enforces course maximums, deduction bound and two decimal places', () => {
    const registration = { theory_max_score: 30, practical_max_score: 70 };
    assert.deepEqual(parseScores({ theory_score: '20.5', practical_score: 60, deducted_score: 0 }, registration), { theory: 20.5, practical: 60, deducted: 0 });
    assert.throws(() => parseScores({ theory_score: 31, practical_score: 0, deducted_score: 0 }, registration), /0-30/);
    assert.throws(() => parseScores({ theory_score: 10, practical_score: 71, deducted_score: 0 }, registration), /0-70/);
    assert.throws(() => parseScores({ theory_score: 10, practical_score: 10, deducted_score: 21 }, registration), /คะแนนหัก/);
    assert.throws(() => parseScores({ theory_score: 10.125, practical_score: 10, deducted_score: 0 }, registration), /ทศนิยม/);
    assert.throws(() => parseScores({ theory_score: true, practical_score: 10, deducted_score: 0 }, registration));
});

test('course validation rejects NaN/oversized scores, impossible dates and over-long text', () => {
    const good = { course_code: 'EX-01', course_name: 'Excel', reg_open_date: '2026-07-01', reg_close_date: '2026-07-10', exam_date: '2026-07-20', max_seats: 30 };
    assert.equal(validateCourse(good).theoryMax, 30);
    assert.throws(() => validateCourse({ ...good, theory_max_score: 'abc' }), /คะแนนเต็ม/);
    assert.throws(() => validateCourse({ ...good, practical_max_score: 100000 }), /999.99/);
    assert.throws(() => validateCourse({ ...good, theory_max_score: 10.123 }), /999.99/);
    assert.throws(() => validateCourse({ ...good, reg_open_date: '2026-02-31' }), /ไม่ถูกต้อง/);
    assert.throws(() => validateCourse({ ...good, exam_time: 'x'.repeat(51) }), /ยาวเกินกำหนด/);
    assert.throws(() => validateCourse({ ...good, course_name: ['x'] }), /รหัสและชื่อ/);
});

test('cookie parsing tolerates malformed percent-encoding', () => {
    assert.deepEqual(parseCookies({ headers: { cookie: 'a=1; refresh_token=%; b=%E0%A4%A' } }), { a: '1', refresh_token: '%', b: '%E0%A4%A' });
    assert.deepEqual(parseCookies({ headers: {} }), {});
    assert.equal(parseCookies({ headers: { cookie: 'refresh_token=abc%20def' } }).refresh_token, 'abc def');
});

test('email dates are Thai calendar text, not a raw JavaScript Date string', () => {
    assert.match(formatThaiDate('2026-07-18'), /18/);
    assert.match(formatThaiDate('2026-07-18'), /2569/);
    assert.match(formatThaiDate(new Date(2026, 6, 18)), /18/);
    assert.doesNotMatch(formatThaiDate(new Date(2026, 6, 18)), /GMT|Indochina/);
    assert.equal(formatThaiDate(null), '');
});

test('CSV cells starting with a formula trigger or newline are neutralized', () => {
    assert.equal(safeCsvCell('+1+1'), '"\'+1+1"');
    assert.equal(safeCsvCell('\t=cmd'), '"\'\t=cmd"');
    assert.equal(safeCsvCell('ปกติ'), '"ปกติ"');
});

test('the XLSX export is built in a worker thread and concurrent builds are limited', async () => {
    const rows = [{
        registration_id: 1, application_no: 'APP-1', student_id: 7, student_code: 'STD-7', university_student_code: '660001', title: 'นาย', full_name: 'ทดสอบ',
        id_card_number: '1100000000001', birth_date: '2002-01-01', phone_number: '0812345678', email: 's@x.test', is_active: 1, course_code: 'EX', course_name: 'Excel',
        session_name: 'รอบ 1', session_exam_date: '2026-06-20', exam_time: '09:00', session_location: '2301', attempt_no: 1, application_status: 'อนุมัติสิทธิ์สอบ',
        exam_status: 'เข้าสอบ', theory_score: 25, practical_score: 55, deducted_score: 0, total_score: 80, department_status: 'ได้รับวุฒิบัตร', registered_at: new Date(),
    }];
    const first = buildWorkbookBuffer(rows, { date_type: 'registered' }, {});
    const second = buildWorkbookBuffer(rows, { date_type: 'registered' }, {});
    await assert.rejects(second, (error) => error.status === 429 && error.code === 'EXPORT_BUSY');
    const buffer = await first;
    assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');
    // เมื่องานแรกเสร็จ ต้องรับงานใหม่ได้อีก (ตัวนับไม่ค้าง)
    assert.equal((await buildWorkbookBuffer(rows, { date_type: 'registered' }, {})).subarray(0, 2).toString(), 'PK');
});
