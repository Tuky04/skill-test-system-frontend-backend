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

function normalizeDate(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    }
    return null;
}

function computeCourseStatus(course, today = dateInTimeZone()) {
    if (course.status_override) return course.status_override;
    const open = normalizeDate(course.reg_open_date);
    const close = normalizeDate(course.reg_close_date);
    if (!open || !close) return course.course_status || COURSE_STATUS.CLOSED;
    if (today < open) return COURSE_STATUS.UPCOMING;
    if (today > close) return COURSE_STATUS.CLOSED;
    return COURSE_STATUS.OPEN;
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
    if (value === '' || value === null || value === undefined) {
        throw new HttpError(400, `กรุณาระบุ${fieldName}`, 'VALIDATION_ERROR');
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
    HttpError,
    dateInTimeZone,
    normalizeDate,
    computeCourseStatus,
    isValidThaiNationalId,
    escapeHtml,
    createApplicationNo,
    parseRequiredNumber,
};
