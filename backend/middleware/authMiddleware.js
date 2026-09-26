const jwt = require('jsonwebtoken');
const db = require('../config/db');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        const [[user]] = await db.query(
            'SELECT user_id, username, role, is_active, token_version FROM users WHERE user_id = ?',
            [decoded.id]
        );
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, code: 'ACCOUNT_DISABLED', message: 'บัญชีนี้ถูกปิดใช้งาน' });
        }
        if (Number(decoded.ver || 0) !== Number(user.token_version || 0)) {
            return res.status(401).json({ success: false, code: 'SESSION_REVOKED', message: 'เซสชันสิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่' });
        }
        req.user = { id: user.user_id, user_id: user.user_id, username: user.username, role: user.role };
        return next();
    } catch (error) {
        const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        return res.status(401).json({ success: false, code, message: 'เซสชันหมดอายุหรือไม่ถูกต้อง' });
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
    }
    return next();
};

module.exports = { verifyToken, requireRole };
