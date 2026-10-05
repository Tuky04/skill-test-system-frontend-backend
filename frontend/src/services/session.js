// เก็บเซสชันฝั่งเบราว์เซอร์ไว้ที่เดียว
// - ทั้ง token, role และข้อมูลผู้ใช้อยู่ใน sessionStorage (หายเมื่อปิดแท็บ)
//   เดิม role/user อยู่ใน localStorage: ค้างอยู่บนเครื่องส่วนกลาง (ห้องแล็บ) หลังปิดเบราว์เซอร์ โดยมีชื่อ อีเมล รหัสผู้สมัคร
//   และทำให้แท็บที่ล็อกอินต่างบทบาทกันเห็น role ปนกัน
// - การเข้าแท็บใหม่/เปิดเบราว์เซอร์ใหม่ กู้เซสชันจาก refresh cookie (ดู refreshSession ใน api.js)
const TOKEN_KEY = 'token';
const ROLE_KEY = 'role';
const USER_KEY = 'user';
const LEGACY_KEYS = ['token', 'refreshToken', 'role', 'user'];

function read(key) {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch { /* โหมดส่วนตัว/ถูกบล็อก: ใช้งานต่อโดยไม่จำเซสชัน */ }
}

function remove(key) {
    try { window.sessionStorage.removeItem(key); } catch { /* ไม่มีอะไรต้องลบ */ }
}

export const getToken = () => read(TOKEN_KEY) || '';
export const getRole = () => read(ROLE_KEY) || '';

// JSON.parse ที่ค่าเสียไม่ทำให้หน้าจอขาวทั้งหน้า
export function getUser() {
    try {
        const parsed = JSON.parse(read(USER_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function setSession({ token, role, user }) {
    if (token) write(TOKEN_KEY, token);
    if (role) write(ROLE_KEY, String(role).toLowerCase());
    if (user && typeof user === 'object') write(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
    [TOKEN_KEY, ROLE_KEY, USER_KEY].forEach(remove);
    purgeLegacyStorage();
}

// ล้างข้อมูลเซสชันที่เวอร์ชันก่อนหน้าเคยเก็บไว้ใน localStorage (มีข้อมูลส่วนบุคคลตกค้างบนเครื่อง)
export function purgeLegacyStorage() {
    try { LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key)); } catch { /* ไม่มี localStorage */ }
}
