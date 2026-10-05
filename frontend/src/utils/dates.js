// คอลัมน์ DATE จาก API เป็นสตริง 'YYYY-MM-DD' (ไม่มีเขตเวลา)
// new Date('2026-07-18') ตีความเป็นเที่ยงคืน UTC ซึ่งในเขตเวลาที่ตามหลัง UTC จะแสดงเป็นวันก่อนหน้า
// จึงแปลงเป็นเที่ยงคืน "ตามเวลาท้องถิ่น" ก่อนจัดรูปแบบ ส่วนค่าที่มีเวลา (ISO) ใช้ตามปกติ
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const text = String(value).trim();
    const match = DATE_ONLY.exec(text);
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatThaiDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }, fallback = '—') {
    const date = toDate(value);
    return date ? date.toLocaleDateString('th-TH', options) : fallback;
}

export function formatThaiDateTime(value, options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, fallback = '—') {
    const date = toDate(value);
    return date ? date.toLocaleString('th-TH', options) : fallback;
}

// จำนวนวันจากวันนี้ถึงวันที่ที่กำหนด (นับถึงสิ้นวันนั้น) ใช้แสดง "ปิดรับสมัครใน N วัน"
export function daysUntil(value, now = new Date()) {
    const date = toDate(value);
    if (!date) return null;
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return Math.ceil((endOfDay - now) / 86400000) - 1;
}
