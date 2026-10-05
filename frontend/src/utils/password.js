// กติกาเดียวกับ backend (validatePassword): อย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์
// เพราะ bcrypt ตัดรหัสผ่านส่วนที่เกิน 72 ไบต์ทิ้งเงียบ ๆ (ตัวอักษรไทย 1 ตัว = 3 ไบต์)
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

// ความยาวเมื่อเข้ารหัส UTF-8 (ไม่พึ่ง TextEncoder เพื่อให้ทำงานได้ทั้งในเบราว์เซอร์เก่าและสภาพแวดล้อมทดสอบ)
export function utf8Length(text) {
    let bytes = 0;
    for (const character of String(text)) {
        const code = character.codePointAt(0);
        bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    }
    return bytes;
}

export function passwordProblem(password) {
    const value = String(password ?? '');
    if (value.length < PASSWORD_MIN_LENGTH) return `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
    if (utf8Length(value) > PASSWORD_MAX_BYTES) return `รหัสผ่านต้องยาวไม่เกิน ${PASSWORD_MAX_BYTES} ไบต์ (ภาษาไทยนับ 3 ไบต์ต่อตัวอักษร)`;
    return '';
}
