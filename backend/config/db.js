const mysql = require('mysql2');
require('dotenv').config();

const toInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

// Connection Pool สำหรับ MySQL/MariaDB
// - dateStrings: คอลัมน์ DATE คืนเป็น 'YYYY-MM-DD' ไม่แปลงเป็น Date ตาม timezone ของ Node
//   (ไม่เช่นนั้น UTC+7 จะเลื่อนวันถอยหลัง 1 วัน และวันเปิด/ปิดรับสมัครเพี้ยน)
// - queueLimit: คิวรอ connection มีเพดาน ดีกว่าคิวไม่จำกัดที่กินหน่วยความจำจนล่มตอนโหลดสูง
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skill_test_system',
    charset: 'utf8mb4',
    dateStrings: ['DATE'],
    waitForConnections: true,
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: toInt(process.env.DB_QUEUE_LIMIT, 200),
    connectTimeout: 10000,
    enableKeepAlive: true,
});

// XAMPP/MariaDB เริ่มต้นไม่เปิด STRICT mode: ข้อมูลยาวเกินคอลัมน์จะถูกตัดเงียบ ๆ และ ENUM ผิดจะกลายเป็นค่าว่าง
// บังคับ strict ต่อ session เพื่อให้ข้อมูลผิดเกิด error แทนที่จะเสียหายโดยไม่รู้ตัว (ปิดได้ด้วย DB_STRICT_MODE=false)
if (process.env.DB_STRICT_MODE !== 'false') {
    pool.on('connection', (connection) => {
        connection.query(
            "SET SESSION sql_mode = CONCAT_WS(',', @@sql_mode, 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO')",
            (error) => { if (error) console.error('[db] ตั้ง sql_mode ไม่สำเร็จ:', error.message); }
        );
    });
}

const promisePool = pool.promise();

// รันงานหลายคำสั่งใน transaction เดียว: commit เมื่อสำเร็จ, rollback เมื่อ throw, และคืน connection เสมอ
promisePool.withTransaction = async function withTransaction(work) {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = promisePool;
