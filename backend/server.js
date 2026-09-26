const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const db = require('./config/db');
const emailService = require('./utils/emailService');

for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!process.env[key] || process.env[key].length < 32) {
        throw new Error(`${key} ต้องกำหนดเป็นค่าสุ่มที่ยาวอย่างน้อย 32 ตัวอักษร`);
    }
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '127.0.0.1';
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
app.use((req, res, next) => {
    req.id = /^[A-Za-z0-9._-]{8,80}$/.test(req.get('X-Request-ID') || '') ? req.get('X-Request-ID') : crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    next();
});
app.use(cors({
    credentials: true,
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin ไม่ได้รับอนุญาต'));
    },
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// ปรับจำนวนครั้งได้จาก .env  (ตอนพัฒนา/ทดสอบให้ตั้งสูง ๆ, ขึ้น production ค่อยลดกลับ)
const LOGIN_MAX = Number(process.env.RATE_LIMIT_LOGIN_MAX || 10);
const REGISTER_MAX = Number(process.env.RATE_LIMIT_REGISTER_MAX || 5);
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: LOGIN_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => LOGIN_MAX <= 0,
    message: { success: false, code: 'RATE_LIMITED', message: 'พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที' },
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: REGISTER_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => REGISTER_MAX <= 0,
    message: { success: false, code: 'RATE_LIMITED', message: 'ลงทะเบียนบ่อยเกินไป กรุณารอ 1 ชั่วโมง' },
});

app.use('/api/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', registerLimiter);
app.use('/api/auth/resend-verification', registerLimiter);
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});
app.get('/', (req, res) => res.type('text/plain').send('Skill Test System API'));
app.use('/api', apiRoutes);
app.use((req, res) => res.status(404).json({ success: false, message: 'ไม่พบ API ที่ร้องขอ' }));
app.use((error, req, res, next) => {
    console.error(JSON.stringify({ level: 'error', request_id: req.id, path: req.path, method: req.method, message: error.message }));
    if (res.headersSent) return next(error);
    return res.status(error.status || 500).json({
        success: false,
        code: error.code || 'INTERNAL_ERROR',
        message: error.status ? error.message : 'เกิดข้อผิดพลาดภายในระบบ',
    });
});

const server = app.listen(PORT, HOST, async () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
    // เตือนตั้งแต่ตอนบูต ดีกว่าไปพังตอนผู้ใช้สมัครจริง
    try {
        await db.query('SELECT 1');
        console.log('[startup] เชื่อมต่อฐานข้อมูลสำเร็จ');
    } catch (error) {
        console.error('[startup] ⛔ เชื่อมต่อฐานข้อมูลไม่ได้:', error.message);
    }
    if (process.env.REQUIRE_EMAIL_VERIFICATION !== 'false') {
        try {
            await emailService.verifySmtpConnection();
            console.log('[startup] เชื่อมต่อ SMTP สำเร็จ');
        } catch (error) {
            console.error('[startup] ⚠️ ส่งอีเมลไม่ได้:', error.message);
            console.error('[startup] ⚠️ REQUIRE_EMAIL_VERIFICATION=true อยู่ — นักศึกษาจะสมัครได้แต่เข้าสู่ระบบไม่ได้');
            console.error('[startup] ⚠️ แก้ SMTP ใน .env หรือตั้ง REQUIRE_EMAIL_VERIFICATION=false ชั่วคราว');
        }
    }
    if (process.env.NODE_ENV === 'production') {
        for (const [key, hint] of [['PUBLIC_APP_URL', 'ลิงก์ในอีเมลจะชี้ผิดที่'], ['CORS_ORIGINS', 'เบราว์เซอร์จะถูกบล็อก']]) {
            if (/localhost|127\.0\.0\.1/.test(process.env[key] || '')) {
                console.warn(`[startup] ⚠️ ${key} ยังชี้ไป localhost อยู่ — ${hint}`);
            }
        }
    }
});

async function shutdown(signal) {
    console.log(`${signal}: shutting down`);
    server.close(async () => {
        await db.end().catch(() => {});
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;