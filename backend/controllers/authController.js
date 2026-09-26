const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

function parseCookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => {
        const index = part.indexOf('=');
        if (index < 0) return ['', ''];
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: REFRESH_TTL_SECONDS * 1000,
    });
}

exports.login = async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    try {
        const [[user]] = await db.query(
            'SELECT user_id, username, password_hash, role, email, is_active, token_version, email_verified_at FROM users WHERE username = ?',
            [username]
        );
        const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
        if (!user || !valid) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        if (!user.is_active) {
            return res.status(401).json({ success: false, code: 'ACCOUNT_DISABLED', message: 'บัญชีนี้ถูกปิดใช้งาน' });
        }
        if (process.env.REQUIRE_EMAIL_VERIFICATION !== 'false' && user.role === 'student' && !user.email_verified_at) {
            return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' });
        }

        let studentInfo = null;
        if (user.role === 'student') {
            [[studentInfo]] = await db.query(
                'SELECT student_id, student_code, full_name, registration_status FROM students WHERE user_id = ?',
                [user.user_id]
            );
        }

        const { token, refreshToken } = createTokens(user);
        setRefreshCookie(res, refreshToken);
        await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
        return res.json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role,
                email: user.email,
                student_id: studentInfo?.student_id || null,
                student_code: studentInfo?.student_code || null,
                full_name: studentInfo?.full_name || null,
                registration_status: studentInfo?.registration_status || null,
            },
        });
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
            'SELECT user_id, role, is_active, token_version FROM users WHERE user_id = ?',
            [decoded.id]
        );
        if (!user || !user.is_active || Number(decoded.ver || 0) !== Number(user.token_version || 0)) {
            throw new Error('Session revoked');
        }
        const tokens = createTokens(user);
        setRefreshCookie(res, tokens.refreshToken);
        return res.json({ success: true, token: tokens.token, role: user.role });
    } catch {
        res.clearCookie('refresh_token', { path: '/api/auth' });
        return res.status(401).json({ success: false, message: 'Refresh token หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ success: true });
};

exports.forgotPassword = async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const generic = { success: true, message: 'หากอีเมลนี้มีในระบบ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(generic);
    try {
        const [[user]] = await db.query('SELECT user_id, email FROM users WHERE email=? AND is_active=1', [email]);
        if (!user) return res.json(generic);
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await db.query(
            'UPDATE users SET reset_token=?, reset_token_expires=DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE user_id=?',
            [tokenHash, user.user_id]
        );
        await emailService.sendPasswordResetEmail({ to: user.email, token });
        return res.json(generic);
    } catch (error) {
        console.error('[Forgot password]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถดำเนินการได้ในขณะนี้' });
    }
};

exports.resetPassword = async (req, res) => {
    const token = String(req.body.token || '');
    const password = String(req.body.new_password || '');
    if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 8) {
        return res.status(400).json({ success: false, message: 'ลิงก์หรือรหัสผ่านใหม่ไม่ถูกต้อง' });
    }
    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [[user]] = await db.query(
            'SELECT user_id FROM users WHERE reset_token=? AND reset_token_expires>NOW() AND is_active=1',
            [tokenHash]
        );
        if (!user) return res.status(400).json({ success: false, message: 'ลิงก์หมดอายุหรือถูกใช้แล้ว' });
        const passwordHash = await bcrypt.hash(password, 12);
        await db.query(
            `UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL,
                    token_version=token_version+1 WHERE user_id=?`,
            [passwordHash, user.user_id]
        );
        res.clearCookie('refresh_token', { path: '/api/auth' });
        return res.json({ success: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถตั้งรหัสผ่านใหม่ได้' });
    }
};

exports.verifyEmail = async (req, res) => {
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ success: false, message: 'ลิงก์ยืนยันไม่ถูกต้อง' });
    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [result] = await db.query(
            `UPDATE users SET email_verified_at=NOW(), email_verification_token=NULL, email_verification_expires=NULL
             WHERE email_verification_token=? AND email_verification_expires>NOW()`,
            [tokenHash]
        );
        if (!result.affectedRows) return res.status(400).json({ success: false, message: 'ลิงก์หมดอายุหรือถูกใช้แล้ว' });
        return res.json({ success: true, message: 'ยืนยันอีเมลสำเร็จ สามารถเข้าสู่ระบบได้แล้ว' });
    } catch {
        return res.status(500).json({ success: false, message: 'ไม่สามารถยืนยันอีเมลได้' });
    }
};

exports.resendVerification = async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const generic = { success: true, message: 'หากบัญชียังไม่ได้ยืนยัน ระบบจะส่งลิงก์ใหม่ให้' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(generic);
    try {
        const [[user]] = await db.query(
            `SELECT user_id, email FROM users
             WHERE email=? AND role='student' AND is_active=1 AND email_verified_at IS NULL`,
            [email]
        );
        if (!user) return res.json(generic);
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await db.query(
            `UPDATE users SET email_verification_token=?,
                    email_verification_expires=DATE_ADD(NOW(), INTERVAL 24 HOUR)
             WHERE user_id=?`,
            [tokenHash, user.user_id]
        );
        await emailService.sendEmailVerification({ to: user.email, token });
        return res.json(generic);
    } catch (error) {
        console.error('[Resend verification]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถส่งอีเมลยืนยันได้ในขณะนี้' });
    }
};
