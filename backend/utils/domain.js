const crypto = require('crypto');

const APPLICATION_STATUS = Object.freeze({
    PENDING: 'รอดำเนินการ',
    APPROVED: 'อนุมัติสิทธิ์สอบ',
    REJECTED: 'ปฏิเสธเอกสาร',
});

const STUDENT_STATUS = Object.freeze({
    PENDING: 'รอตรวจสอบเอกสาร',
    INCOMPLETE: 'เอกสารไม่ครบ',
    APPROVED: 'อนุมัติ',
});

const COURSE_STATUS = Object.freeze({
    UPCOMING: 'ยังไม่เปิดรับสมัคร',
    OPEN: 'เปิดรับสมัคร',
    CLOSED: 'ปิดรับสมัคร',
});

// สถานะการชำระค่าสมัครสอบ (1 ใบสมัคร = 1 รายการชำระ ไม่คืนเงินทุกกรณี)
const PAYMENT_STATUS = Object.freeze({
    UNPAID: 'รอชำระเงิน',
    SUBMITTED: 'รอตรวจสลิป',
    PAID: 'ชำระแล้ว',
    REJECTED: 'สลิปไม่ผ่าน',
});

const EXAM_STATUS = Object.freeze({
    WAITING: 'รอสอบ',
    ATTENDED: 'เข้าสอบ',
    ABSENT: 'ขาดสอบ',
    CANCELLED: 'ยกเลิก',
    PUBLISHED: 'ประกาศผลแล้ว',
});

class HttpError extends Error {
    constructor(status, message, code = 'REQUEST_FAILED') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function dateInTimeZone(timeZone = process.env.APP_TIMEZONE || 'Asia/Bangkok', date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date).reduce((out, part) => {
        if (part.type !== 'literal') out[part.type] = part.value;
        return out;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}

// คืนค่า 'YYYY-MM-DD' จากสตริงหรือ Date
// Date ที่มาจาก driver เป็นเที่ยงคืน "ตามเวลาท้องถิ่น" (new Date(y, m, d)) จึงต้องอ่านด้วย getFullYear/getMonth/getDate
// การอ่านด้วย getUTC* ทำให้ UTC+7 ได้วันก่อนหน้า (pool ตั้ง dateStrings แล้ว แต่ยังกันไว้สำหรับ Date จากที่อื่น)
function normalizeDate(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return null;
}

// ตรวจว่าเป็นวันที่จริงในรูป YYYY-MM-DD (ปฏิเสธ 2026-02-31 ที่ JS บางเวอร์ชันเลื่อนเป็นมีนาคม)
function isValidDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const PASSWORD_MIN_LENGTH = 8;
// bcrypt ใช้เฉพาะ 72 ไบต์แรก; รหัสผ่านที่ยาวกว่าจะถูกตัดเงียบ ๆ จึงปฏิเสธตั้งแต่ต้น
const PASSWORD_MAX_BYTES = 72;

function validatePassword(value) {
    const password = typeof value === 'string' ? value : '';
    if (password.length < PASSWORD_MIN_LENGTH) {
        throw new HttpError(400, `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`, 'WEAK_PASSWORD');
    }
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
        throw new HttpError(400, `รหัสผ่านต้องยาวไม่เกิน ${PASSWORD_MAX_BYTES} ไบต์ (ประมาณ 72 ตัวอักษรอังกฤษ)`, 'WEAK_PASSWORD');
    }
    return password;
}

// ค่าตัวเลือกที่ฟอร์มสมัครอนุญาต (ต้องตรงกับ frontend/src/pages/Register.jsx)
const REGISTRATION_OPTIONS = Object.freeze({
    gender: ['ชาย', 'หญิง', 'อื่นๆ'],
    education_level: [
        'ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย / ปวช.',
        'อนุปริญญา / ปวส.', 'ปริญญาตรี', 'สูงกว่าปริญญาตรี',
    ],
    employment_status: ['ผู้มีงานทำ', 'ผู้ที่ไม่มีงานทำ', 'นักเรียน/นักศึกษา', 'อื่นๆ'],
});

function computeCourseStatus(course, today = dateInTimeZone()) {
    if (course.status_override) return course.status_override;
    const open = normalizeDate(course.reg_open_date);
    const close = normalizeDate(course.reg_close_date);
    if (!open || !close) return course.course_status || COURSE_STATUS.CLOSED;
    if (today < open) return COURSE_STATUS.UPCOMING;
    if (today > close) return COURSE_STATUS.CLOSED;
    return COURSE_STATUS.OPEN;
}

// วันสอบผ่านไปแล้วหรือยัง (เทียบวันที่ตามเขตเวลา APP_TIMEZONE): ห้ามสมัครสอบรอบที่สอบเสร็จไปแล้ว แม้แอดมินเปิดสถานะ override ไว้
function hasExamDatePassed(course, today = dateInTimeZone()) {
    const exam = normalizeDate(course.exam_date);
    return Boolean(exam) && exam < today;
}

function isValidThaiNationalId(value) {
    if (!/^\d{13}$/.test(String(value || ''))) return false;
    const digits = String(value).split('').map(Number);
    const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
    return (11 - (sum % 11)) % 10 === digits[12];
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character]);
}

function createApplicationNo() {
    return `APP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

function parseRequiredNumber(value, fieldName) {
    if (value === '' || value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
        throw new HttpError(400, `กรุณาระบุ${fieldName}`, 'VALIDATION_ERROR');
    }
    // รับเฉพาะ number หรือสตริงตัวเลข: กัน true/[5]/{} ที่ Number() แปลงเป็นตัวเลขได้เงียบ ๆ
    if (typeof value !== 'number' && typeof value !== 'string') {
        throw new HttpError(400, `${fieldName}ต้องเป็นตัวเลข`, 'VALIDATION_ERROR');
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new HttpError(400, `${fieldName}ต้องเป็นตัวเลข`, 'VALIDATION_ERROR');
    }
    return parsed;
}

module.exports = {
    APPLICATION_STATUS,
    STUDENT_STATUS,
    COURSE_STATUS,
    EXAM_STATUS,
    PAYMENT_STATUS,
    REGISTRATION_OPTIONS,
    PASSWORD_MAX_BYTES,
    HttpError,
    dateInTimeZone,
    normalizeDate,
    isValidDateOnly,
    validatePassword,
    computeCourseStatus,
    hasExamDatePassed,
    isValidThaiNationalId,
    escapeHtml,
    createApplicationNo,
    parseRequiredNumber,
};
