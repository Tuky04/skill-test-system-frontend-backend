const mysql = require('mysql2');
require('dotenv').config();

// สร้าง Connection Pool สำหรับเชื่อมต่อกับ MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skill_test_system',
    waitForConnections: true,
    connectionLimit: 10, // จำกัดการเชื่อมต่อพร้อมกันสูงสุด 10 Connections
    queueLimit: 0
});

// แปลงให้รองรับคำสั่งแบบ Async/Await (Promise)
module.exports = pool.promise();