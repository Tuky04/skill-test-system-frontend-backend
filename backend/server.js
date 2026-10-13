const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
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

// โหมดโปรเซสเดียว: ถ้าตั้ง FRONTEND_DIR (โฟลเดอร์ build ของ React) backend จะเสิร์ฟหน้าเว็บเองที่พอร์ตเดียวกับ API
// จึงไม่ต้องมี Apache/Nginx ก็ขึ้นระบบได้ (ใช้ proxy หน้าเพื่อ HTTPS ทีหลังได้)
const frontendDir = process.env.FRONTEND_DIR ? path.resolve(process.env.FRONTEND_DIR) : null;
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
// CSP ของหน้าเว็บ: สคริปต์/ฟอนต์/รูปจากตัวเองเท่านั้น (style inline จำเป็นเพราะ React ใช้ style attribute; blob: สำหรับพรีวิวเอกสาร/ใบรับรอง)
const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'self' blob:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

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
    res.setHeader('Content-Security-Policy', req.path.startsWith('/api') || req.path === '/health' ? API_CSP : APP_CSP);
    next();
});

// เบราว์เซอร์ใส่ Origin มาด้วยแม้เป็นคำขอ POST ภายในโดเมนเดียวกัน: ถ้า Origin ตรงกับ Host ที่ถูกเรียกอยู่ ถือว่าเป็นคำขอจากหน้าเว็บของเราเอง
// (ไม่ต้องตั้ง CORS_ORIGINS เมื่อเสิร์ฟหน้าเว็บและ API จากที่เดียวกัน) ส่วน origin อื่นต้องอยู่ใน CORS_ORIGINS
const isSameOrigin = (origin, host) => {
    try { return Boolean(host) && new URL(origin).host === host; } catch { return false; }
};
app.use(cors((req, callback) => {
    const origin = req.get('Origin');
    if (!origin || allowedOrigins.includes(origin) || isSameOrigin(origin, req.get('Host'))) {
        return callback(null, { credentials: true, origin: true });
    }
    // 403 ที่ชัดเจน ไม่ใช่ 500: origin ที่ไม่อนุญาตไม่ใช่ความผิดของเซิร์ฟเวอร์
    const error = new Error('Origin ไม่ได้รับอนุญาต');
    error.status = 403;
    error.code = 'ORIGIN_FORBIDDEN';
    return callback(error);
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// ── Rate limit ───────────────────────────────────────────────────────────
// ปรับจากไฟล์ .env ได้ (ค่า <= 0 = ปิดตัวจำกัดนั้น ใช้เฉพาะตอนพัฒนา/ทดสอบ)
// แยกตัวนับตามฟังก์ชัน: เดิมใช้ instance เดียวกันกับสมัคร/ลืมรหัสผ่าน/ส่งอีเมลยืนยัน
// ทำให้ผู้ใช้สมัครไป 5 ครั้งแล้วขอรีเซ็ตรหัสผ่านไม่ได้ และทุกคนหลัง NAT เดียวกันใช้โควตาร่วมกัน
const envLimit = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
};

function createLimiter({ windowMs, max, message, keyGenerator, skipSuccessfulRequests = false }) {
    return rateLimit({
        windowMs,
        limit: max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => max <= 0,
        skipSuccessfulRequests,
        ...(keyGenerator ? { keyGenerator } : {}),
        message: { success: false, code: 'RATE_LIMITED', message },
    });
}

// เข้าสู่ระบบ: นับเฉพาะครั้งที่ล้มเหลว (ครั้งที่สำเร็จไม่กินโควตา) ทั้งแบบต่อ IP และต่อชื่อบัญชี
// ต่อบัญชีกันการเดารหัสผ่านแบบกระจาย IP (ข้อแลกเปลี่ยน: ผู้ไม่หวังดีทำให้บัญชีนั้นถูกล็อกชั่วคราวได้ จึงตั้งเพดานไม่ต่ำเกินไป)
const loginIpLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: envLimit('RATE_LIMIT_LOGIN_MAX', 20),
    skipSuccessfulRequests: true,
    message: 'พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที',
});
const loginAccountLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: envLimit('RATE_LIMIT_LOGIN_ACCOUNT_MAX', 10),
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `acct:${String(req.body?.username || '').trim().toLowerCase().slice(0, 64) || 'anonymous'}`,
    message: 'บัญชีนี้ถูกพยายามเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่',
});
const registerLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: envLimit('RATE_LIMIT_REGISTER_MAX', 10),
    message: 'ลงทะเบียนบ่อยเกินไป กรุณารอ 1 ชั่วโมง',
});
const forgotPasswordLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: envLimit('RATE_LIMIT_FORGOT_MAX', 5),
    message: 'ขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอ 1 ชั่วโมง',
});
const resendVerificationLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: envLimit('RATE_LIMIT_RESEND_MAX', 5),
    message: 'ขอส่งอีเมลยืนยันบ่อยเกินไป กรุณารอ 1 ชั่วโมง',
});
// เพดานรวมของทั้ง API ต่อ IP กัน flood (ตั้งสูงเพราะผู้ใช้หลาย คนอาจอยู่หลัง NAT เดียวกัน)
const apiLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: envLimit('RATE_LIMIT_API_MAX', 1200),
    message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่',
});

app.use('/api', apiLimiter);
app.use('/api/login', loginIpLimiter, loginAccountLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/auth/resend-verification', resendVerificationLimiter);

if (frontendDir) {
    // ไฟล์ใน /static มีแฮชในชื่อ แคชได้ยาว; ไฟล์อื่น (index.html) ต้องตรวจใหม่ทุกครั้งเพื่อให้ได้เวอร์ชันล่าสุดหลังอัปเดต
    app.use(express.static(frontendDir, {
        index: false,
        setHeaders(res, file) {
            res.setHeader('Cache-Control', /[\\/]static[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
    }));
}
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});
const sendIndex = (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDir, 'index.html'));
};
app.get('/', frontendDir ? sendIndex : (req, res) => res.type('text/plain').send('Skill Test System API'));
app.use('/api', apiRoutes);
if (frontendDir) {
    // เส้นทางของ React Router (เช่น /login, /student-dashboard) ที่ถูกเปิดตรง ๆ หรือรีเฟรช ต้องได้ index.html
    // ยกเว้น /api ที่ไม่พบ ซึ่งต้องตอบ 404 แบบ JSON เหมือนเดิม
    app.get('*', (req, res, next) => (req.path.startsWith('/api/') ? next() : sendIndex(req, res)));
}
app.use((req, res) => res.status(404).json({ success: false, message: 'ไม่พบ API ที่ร้องขอ' }));
app.use((error, req, res, next) => {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    console.error(JSON.stringify({ level: status >= 500 ? 'error' : 'warn', request_id: req.id, path: req.path, method: req.method, status, message: error.message }));
    if (res.headersSent) return next(error);
    return res.status(status).json({
        success: false,
        code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
        message: status < 500 ? error.message : 'เกิดข้อผิดพลาดภายในระบบ',
    });
});

async function runStartupChecks() {
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
    if (frontendDir) {
        console.log(`[startup] เสิร์ฟหน้าเว็บจาก ${frontendDir}`);
        if (!require('fs').existsSync(path.join(frontendDir, 'index.html'))) {
            console.error('[startup] ⛔ ไม่พบ index.html ใน FRONTEND_DIR — ตรวจค่านี้ใน .env');
        }
    }
    if (process.env.NODE_ENV === 'production') {
        for (const [key, hint] of [['PUBLIC_APP_URL', 'ลิงก์ในอีเมลจะชี้ผิดที่'], ['CORS_ORIGINS', 'เบราว์เซอร์จะถูกบล็อก']]) {
            if (/localhost|127\.0\.0\.1/.test(process.env[key] || '')) {
                console.warn(`[startup] ⚠️ ${key} ยังชี้ไป localhost อยู่ — ${hint}`);
            }
        }
        if (Number(process.env.TRUST_PROXY_HOPS || 0) === 0 && !/^(127\.0\.0\.1|localhost|::1)$/.test(HOST)) {
            console.warn('[startup] ⚠️ TRUST_PROXY_HOPS=0: ถ้ามี reverse proxy หน้าระบบ ทุกคำขอจะดูเป็น IP เดียวกัน rate limit จะจำกัดทุกคนรวมกัน');
        }
    }
}

function start() {
    // กัน promise rejection ที่หลุดจากโค้ดนอก Express (เช่น งานเบื้องหลัง) ไม่ให้ทำโปรเซสล่ม
    process.on('unhandledRejection', (reason) => {
        console.error(JSON.stringify({ level: 'error', type: 'unhandledRejection', message: String(reason?.message || reason) }));
    });

    const server = app.listen(PORT, HOST, () => {
        console.log(`Server listening on http://${HOST}:${PORT}`);
        runStartupChecks().catch((error) => console.error('[startup]', error.message));
    });

    let shuttingDown = false;
    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`${signal}: shutting down`);
        server.close(async () => {
            await db.end().catch(() => {});
            process.exit(0);
        });
        server.closeIdleConnections?.();
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    return server;
}

// รันเป็นโปรแกรม (npm start) จะเปิดพอร์ต; ถูก require จากชุดทดสอบจะได้ app โดยไม่เปิดพอร์ตเอง
if (require.main === module) start();

module.exports = app;
module.exports.start = start;
