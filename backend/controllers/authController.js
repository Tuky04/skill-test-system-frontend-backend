const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const { HttpError, validatePassword } = require('../utils/domain');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// hash ปลอมสำหรับเทียบเวลา เมื่อไม่พบชื่อผู้ใช้: ให้ใช้เวลาเท่ากับกรณีมีผู้ใช้จริง
// ผู้โจมตีจะแยกไม่ได้ว่าชื่อผู้ใช้ไหนมีอยู่ในระบบจากเวลาตอบสนอง
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

// คุกกี้ที่รูปแบบเสีย (เช่น %) ต้องไม่ทำให้โปรเซสล่ม: decodeURIComponent จะ throw URIError
function safeDecode(value) {
    try { return decodeURIComponent(value); } catch { return value; }
}

function parseCookies(req) {
    return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
        const index = part.indexOf('=');
        if (index < 0) return ['', ''];
        return [part.slice(0, index).trim(), safeDecode(part.slice(index + 1).trim())];
    }).filter(([key]) => key));
}

function tokenPayload(user) {
    return { id: user.user_id, ver: Number(user.token_version || 0) };
}

function createTokens(user) {
    return {
        token: jwt.sign(tokenPayload(user), process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TTL }),
        refreshToken: jwt.sign(tokenPayload(user), process.env.JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: REFRESH_TTL_SECONDS }),
    };
}

function setRefreshCookie(res, refreshToken) {
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        // ค่าเริ่มต้น: เปิด secure เมื่อเป็น production (ต้องเข้าผ่าน HTTPS) ถ้าสถานศึกษาให้ใช้ HTTP ล้วนบนพอร์ตของเขา ให้ตั้ง COOKIE_SECURE=false
        // มิฉะนั้นเบราว์เซอร์จะไม่เก็บคุกกี้ refresh และผู้ใช้ต้องล็อกอินใหม่ทุก 15 นาที
        secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: REFRESH_TTL_SECONDS * 1000,
    });
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ข้อมูลผู้ใช้ที่ส่งกลับให้ frontend (ใช้ร่วมกันระหว่าง login และ refresh)
async function buildSessionUser(user) {
    let studentInfo = null;
    if (user.role === 'student') {
        [[studentInfo]] = await db.query(
            'SELECT student_id, student_code, full_name, registration_status FROM students WHERE user_id = ?',
            [user.user_id]
        );
    }
    return {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        email: user.email,
        student_id: studentInfo?.student_id || null,
        student_code: studentInfo?.student_code || null,
        full_name: studentInfo?.full_name || null,
        registration_status: studentInfo?.registration_status || null,
    };
}

exports.login = async (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    // ค่าที่ยาวผิดปกติไม่มีทางเป็นบัญชีจริง ตัดทิ้งก่อนแตะฐานข้อมูล/bcrypt
    if (username.length > 50 || Buffer.byteLength(password, 'utf8') > 1024) {
        return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    try {
        const [[user]] = await db.query(
            'SELECT user_id, username, password_hash, role, email, is_active, token_version, email_verified_at FROM users WHERE username = ?',
            [username]
        );
        // เทียบ hash เสมอ แม้ไม่พบผู้ใช้ เพื่อให้เวลาตอบสนองเท่ากัน
        const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_PASSWORD_HASH);
        if (!user || !valid) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        if (!user.is_active) {
            return res.status(401).json({ success: false, code: 'ACCOUNT_DISABLED', message: 'บัญชีนี้ถูกปิดใช้งาน' });
        }
        if (process.env.REQUIRE_EMAIL_VERIFICATION !== 'false' && user.role === 'student' && !user.email_verified_at) {
            return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' });
        }

        const sessionUser = await buildSessionUser(user);
        const { token, refreshToken } = createTokens(user);
        setRefreshCookie(res, refreshToken);
        await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
        return res.json({ success: true, token, user: sessionUser });
    } catch (error) {
        console.error('[Auth login]', error.message);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
};

exports.refreshToken = async (req, res) => {
    const refreshToken = parseCookies(req).refresh_token;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'ไม่พบ refresh token' });
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
        const [[user]] = await db.query(
            'SELECT user_id, username, email, role, is_active, token_version FROM users WHERE user_id = ?',
            [decoded.id]
        );
        if (!user || !user.is_active || Number(decoded.ver || 0) !== Number(user.token_version || 0)) {
            throw new HttpError(401, 'Session revoked');
        }
        const sessionUser = await buildSessionUser(user);
        const tokens = createTokens(user);
        setRefreshCookie(res, tokens.refreshToken);
        // ส่ง user กลับด้วย เพื่อให้แท็บใหม่/หลังปิดเบราว์เซอร์กู้เซสชันได้โดยไม่ต้องล็อกอินซ้ำ
        return res.json({ success: true, token: tokens.token, role: user.role, user: sessionUser });
    } catch (error) {
        const tokenProblem = error instanceof HttpError || ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name);
        if (!tokenProblem) {
            // ฐานข้อมูลล่มชั่วคราว ไม่ใช่ความผิดของ token: อย่าลบคุกกี้ ผู้ใช้จะได้ลองใหม่โดยไม่ต้องล็อกอินซ้ำ
            console.error('[Auth refresh]', error.message);
            return res.status(503).json({ success: false, message: 'ระบบไม่พร้อมให้บริการชั่วคราว กรุณาลองใหม่' });
        }
        res.clearCookie('refresh_token', { path: '/api/auth' });
        return res.status(401).json({ success: false, message: 'Refresh token หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ success: true });
};

// ลืมรหัสผ่าน: ตอบทันทีด้วยข้อความเดียวกันเสมอ แล้วค่อยทำงานจริงเบื้องหลัง
// (เดิม await ส่งอีเมลก่อนตอบ ทำให้เวลาตอบต่างกันระหว่าง "มีอีเมลนี้" กับ "ไม่มี" จึงไล่เดาอีเมลในระบบได้)
exports.forgotPassword = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const generic = { success: true, message: 'หากอีเมลนี้มีในระบบ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้' };
    res.json(generic);
    if (!EMAIL_PATTERN.test(email) || email.length > 100) return;
    try {
        const [[user]] = await db.query('SELECT user_id, email FROM users WHERE email=? AND is_active=1', [email]);
        if (!user) return;
        const token = crypto.randomBytes(32).toString('hex');
        // ออกลิงก์ใหม่ได้ไม่เกินนาทีละครั้งต่อบัญชี: ไม่ให้ใครยิงซ้ำเพื่อทำให้ลิงก์ของเหยื่อเสียหรือถล่มกล่องอีเมล
        const [result] = await db.query(
            `UPDATE users SET reset_token=?, reset_token_expires=DATE_ADD(NOW(), INTERVAL 30 MINUTE)
             WHERE user_id=? AND (reset_token_expires IS NULL OR reset_token_expires <= DATE_ADD(NOW(), INTERVAL 29 MINUTE))`,
            [hashToken(token), user.user_id]
        );
        if (!result.affectedRows) return;
        await emailService.sendPasswordResetEmail({ to: user.email, token });
    } catch (error) {
        console.error('[Forgot password]', error.message);
    }
};

exports.resetPassword = async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    if (!/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({ success: false, message: 'ลิงก์หรือรหัสผ่านใหม่ไม่ถูกต้อง' });
    }
    let password;
    try {
        password = validatePassword(req.body.new_password);
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        throw error;
    }
    try {
        const tokenHash = hashToken(token);
        const [[user]] = await db.query(
            'SELECT user_id FROM users WHERE reset_token=? AND reset_token_expires>NOW() AND is_active=1',
            [tokenHash]
        );
        if (!user) return res.status(400).json({ success: false, message: 'ลิงก์หมดอายุหรือถูกใช้แล้ว' });
        const passwordHash = await bcrypt.hash(password, 12);
        // เงื่อนไข reset_token=? ซ้ำใน UPDATE: สองคำขอที่ใช้ลิงก์เดียวกันพร้อมกัน ต้องสำเร็จได้เพียงคำขอเดียว
        const [result] = await db.query(
            `UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL,
                    token_version=token_version+1 WHERE user_id=? AND reset_token=?`,
            [passwordHash, user.user_id, tokenHash]
        );
        if (!result.affectedRows) return res.status(400).json({ success: false, message: 'ลิงก์หมดอายุหรือถูกใช้แล้ว' });
        res.clearCookie('refresh_token', { path: '/api/auth' });
        return res.json({ success: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' });
    } catch (error) {
        console.error('[Reset password]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถตั้งรหัสผ่านใหม่ได้' });
    }
};

exports.verifyEmail = async (req, res) => {
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ success: false, message: 'ลิงก์ยืนยันไม่ถูกต้อง' });
    try {
        const [result] = await db.query(
            `UPDATE users SET email_verified_at=NOW(), email_verification_token=NULL, email_verification_expires=NULL
             WHERE email_verification_token=? AND email_verification_expires>NOW()`,
            [hashToken(token)]
        );
        if (!result.affectedRows) return res.status(400).json({ success: false, message: 'ลิงก์หมดอายุหรือถูกใช้แล้ว' });
        return res.json({ success: true, message: 'ยืนยันอีเมลสำเร็จ สามารถเข้าสู่ระบบได้แล้ว' });
    } catch (error) {
        console.error('[Verify email]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถยืนยันอีเมลได้' });
    }
};

exports.resendVerification = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const generic = { success: true, message: 'หากบัญชียังไม่ได้ยืนยัน ระบบจะส่งลิงก์ใหม่ให้' };
    res.json(generic);
    if (!EMAIL_PATTERN.test(email) || email.length > 100) return;
    try {
        const [[user]] = await db.query(
            `SELECT user_id, email FROM users
             WHERE email=? AND role='student' AND is_active=1 AND email_verified_at IS NULL`,
            [email]
        );
        if (!user) return;
        const token = crypto.randomBytes(32).toString('hex');
        // ส่งซ้ำได้ไม่เกินนาทีละครั้งต่อบัญชี
        const [result] = await db.query(
            `UPDATE users SET email_verification_token=?,
                    email_verification_expires=DATE_ADD(NOW(), INTERVAL 24 HOUR)
             WHERE user_id=? AND (email_verification_expires IS NULL
                    OR email_verification_expires <= DATE_ADD(NOW(), INTERVAL 1439 MINUTE))`,
            [hashToken(token), user.user_id]
        );
        if (!result.affectedRows) return;
        await emailService.sendEmailVerification({ to: user.email, token });
    } catch (error) {
        console.error('[Resend verification]', error.message);
    }
};

module.exports._parseCookies = parseCookies;
