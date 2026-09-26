require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function main() {
    const username = String(process.env.ADMIN_INITIAL_USERNAME || '').trim();
    const email = String(process.env.ADMIN_INITIAL_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.ADMIN_INITIAL_PASSWORD || '');
    if (!/^[A-Za-z0-9._-]{4,50}$/.test(username)) throw new Error('ADMIN_INITIAL_USERNAME ไม่ถูกต้อง');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_INITIAL_EMAIL ไม่ถูกต้อง');
    if (password.length < 12) throw new Error('ADMIN_INITIAL_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร');
    const hash = await bcrypt.hash(password, 12);
    await db.query(
        `INSERT INTO users (username, password_hash, email, role, email_verified_at)
         VALUES (?, ?, ?, 'admin', NOW())`,
        [username, hash, email]
    );
    console.log('สร้างบัญชีผู้ดูแลระบบสำเร็จ กรุณาลบ ADMIN_INITIAL_PASSWORD ออกจาก .env');
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => db.end());
