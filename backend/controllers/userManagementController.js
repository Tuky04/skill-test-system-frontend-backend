const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { HttpError, validatePassword } = require('../utils/domain');
const { logAdminAction } = require('../utils/adminAudit');

const ROLES = ['admin', 'staff', 'student'];

const parseUserId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'รหัสผู้ใช้ไม่ถูกต้อง');
    return id;
};

function sendError(res, error, fallback) {
    if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    console.error('[User management]', error.message);
    return res.status(500).json({ success: false, message: fallback });
}

exports.getAllUsers = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const where = ['1=1'];
    const params = [];
    if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
    if (['0','1'].includes(String(req.query.is_active))) { where.push('u.is_active = ?'); params.push(Number(req.query.is_active)); }
    if (req.query.search) {
        where.push('(u.username LIKE ? OR u.email LIKE ? OR s.full_name LIKE ? OR s.student_code LIKE ?)');
        const search = `%${String(req.query.search).slice(0, 100)}%`;
        params.push(search, search, search, search);
    }
    try {
        const [rows] = await db.query(
            `SELECT u.user_id, u.username, u.email, u.role, u.is_active, u.last_login, u.created_at,
                    s.student_code, s.full_name, s.phone_number, s.registration_status
             FROM users u LEFT JOIN students s ON u.user_id=s.user_id
             WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC, u.user_id DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const [[count]] = await db.query(
            `SELECT COUNT(*) AS total FROM users u LEFT JOIN students s ON u.user_id=s.user_id WHERE ${where.join(' AND ')}`,
            params
        );
        // สรุปทั้งระบบ (ไม่ขึ้นกับตัวกรอง/หน้าที่เปิดอยู่) เพราะ frontend แสดงผลทีละหน้า การนับจากแถวในหน้าเดียวจะได้ตัวเลขผิด
        const [[summary]] = await db.query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(is_active = 1), 0) AS active, COALESCE(SUM(is_active = 0), 0) AS disabled,
                    COALESCE(SUM(role = 'admin'), 0) AS admin, COALESCE(SUM(role = 'staff'), 0) AS staff,
                    COALESCE(SUM(role = 'student'), 0) AS student
             FROM users`
        );
        const pages = Math.max(1, Math.ceil(Number(count.total) / limit));
        return res.json({
            success: true,
            data: rows,
            total: count.total,
            page,
            per_page: limit,
            pagination: { page, limit, total: Number(count.total), pages },
            summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value)])),
        });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถโหลดผู้ใช้ได้');
    }
};

exports.toggleUserActive = async (req, res) => {
    try {
        const userId = parseUserId(req.params.user_id);
        if (userId === Number(req.user.id)) throw new HttpError(400, 'ไม่สามารถปิดบัญชีตัวเองได้');
        const active = await db.withTransaction(async (conn) => {
            const [[user]] = await conn.query('SELECT user_id, username, is_active, role FROM users WHERE user_id=? FOR UPDATE', [userId]);
            if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
            if (user.role === 'admin') throw new HttpError(403, 'ไม่อนุญาตให้ปิดบัญชีผู้ดูแลผ่านหน้าจอนี้');
            const next = user.is_active ? 0 : 1;
            await conn.query('UPDATE users SET is_active=?, token_version=token_version+1 WHERE user_id=?', [next, userId]);
            await logAdminAction({ actorId: req.user.id, action: next ? 'ENABLE_USER' : 'DISABLE_USER', targetType: 'user', targetId: userId }, conn);
            return next;
        });
        return res.json({ success: true, is_active: active, message: `${active ? 'เปิด' : 'ปิด'}บัญชีสำเร็จ` });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถเปลี่ยนสถานะบัญชีได้');
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const userId = parseUserId(req.params.user_id);
        // การรีเซ็ตรหัสผ่านตัวเองโดยไม่ยืนยันรหัสเดิมข้ามขั้นตอนความปลอดภัย: ให้ใช้หน้าเปลี่ยนรหัสผ่านแทน
        if (userId === Number(req.user.id)) throw new HttpError(400, 'ไม่สามารถรีเซ็ตรหัสผ่านตัวเองผ่านหน้านี้ ให้ใช้เมนูเปลี่ยนรหัสผ่าน');
        const password = validatePassword(req.body.new_password);
        const hash = await bcrypt.hash(password, 12);
        const username = await db.withTransaction(async (conn) => {
            const [[user]] = await conn.query('SELECT user_id, username FROM users WHERE user_id=? FOR UPDATE', [userId]);
            if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
            await conn.query(
                'UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL, token_version=token_version+1 WHERE user_id=?',
                [hash, userId]
            );
            await logAdminAction({ actorId: req.user.id, action: 'RESET_PASSWORD', targetType: 'user', targetId: userId }, conn);
            return user.username;
        });
        return res.json({ success: true, message: `รีเซ็ตรหัสผ่านของ "${username}" สำเร็จ` });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
    }
};

exports.changeRole = async (req, res) => {
    try {
        const userId = parseUserId(req.params.user_id);
        const newRole = req.body.new_role;
        if (!ROLES.includes(newRole)) throw new HttpError(400, 'Role ไม่ถูกต้อง');
        if (userId === Number(req.user.id)) throw new HttpError(400, 'ไม่สามารถเปลี่ยน role ตัวเองได้');
        await db.withTransaction(async (conn) => {
            const [[user]] = await conn.query(
                `SELECT u.user_id, u.username, u.role, u.is_active, s.student_id
                 FROM users u LEFT JOIN students s ON u.user_id=s.user_id WHERE u.user_id=? FOR UPDATE`,
                [userId]
            );
            if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
            if (user.role === newRole) throw new HttpError(409, `ผู้ใช้นี้เป็น "${newRole}" อยู่แล้ว`);
            if (newRole === 'student' && !user.student_id) throw new HttpError(409, 'บัญชีนี้ไม่มีข้อมูลผู้สมัคร จึงเปลี่ยนเป็น student ไม่ได้');
            if (user.role === 'admin' && user.is_active) {
                // ล็อกแถวผู้ดูแลที่ใช้งานอยู่ก่อนนับ: สองคำขอที่ลดสิทธิ์ admin คนละคนพร้อมกันจะเหลือ admin เป็นศูนย์ไม่ได้
                const [others] = await conn.query("SELECT user_id FROM users WHERE role='admin' AND is_active=1 AND user_id<>? FOR UPDATE", [userId]);
                if (others.length < 1) throw new HttpError(409, 'ต้องเหลือผู้ดูแลระบบที่ใช้งานได้อย่างน้อยหนึ่งบัญชี');
            }
            await conn.query('UPDATE users SET role=?, token_version=token_version+1 WHERE user_id=?', [newRole, userId]);
            await logAdminAction({ actorId: req.user.id, action: 'CHANGE_ROLE', targetType: 'user', targetId: userId, details: { from: user.role, to: newRole } }, conn);
        });
        return res.json({ success: true, message: `เปลี่ยน role เป็น "${newRole}" สำเร็จ` });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถเปลี่ยน role ได้');
    }
};

exports.getUserById = async (req, res) => {
    try {
        const userId = parseUserId(req.params.user_id);
        const [[user]] = await db.query(
            `SELECT u.user_id, u.username, u.email, u.role, u.is_active, u.last_login, u.created_at,
                    s.student_code, s.full_name, s.phone_number,
                    CONCAT('*********', RIGHT(s.id_card_number, 4)) AS masked_id_card,
                    s.registration_status, s.highest_education, s.employment_status
             FROM users u LEFT JOIN students s ON u.user_id=s.user_id WHERE u.user_id=?`,
            [userId]
        );
        if (!user) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        return res.json({ success: true, data: user });
    } catch (error) {
        return sendError(res, error, 'ไม่สามารถโหลดผู้ใช้ได้');
    }
};
