const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { HttpError } = require('../utils/domain');
const { logAdminAction } = require('../utils/adminAudit');

exports.getAllUsers = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const where = ['1=1'];
    const params = [];
    if (['admin','staff','student'].includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
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
             WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const [[count]] = await db.query(
            `SELECT COUNT(*) AS total FROM users u LEFT JOIN students s ON u.user_id=s.user_id WHERE ${where.join(' AND ')}`,
            params
        );
        return res.json({ success: true, data: rows, total: count.total, page, per_page: limit });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดผู้ใช้ได้' });
    }
};

exports.toggleUserActive = async (req, res) => {
    const userId = Number(req.params.user_id);
    if (userId === Number(req.user.id)) return res.status(400).json({ success: false, message: 'ไม่สามารถปิดบัญชีตัวเองได้' });
    try {
        const [[user]] = await db.query('SELECT user_id, username, is_active, role FROM users WHERE user_id=?', [userId]);
        if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
        if (user.role === 'admin') throw new HttpError(403, 'ไม่อนุญาตให้ปิดบัญชีผู้ดูแลผ่านหน้าจอนี้');
        const active = user.is_active ? 0 : 1;
        await db.query('UPDATE users SET is_active=?, token_version=token_version+1 WHERE user_id=?', [active, userId]);
        await logAdminAction({ actorId: req.user.id, action: active ? 'ENABLE_USER' : 'DISABLE_USER', targetType: 'user', targetId: userId });
        return res.json({ success: true, is_active: active, message: `${active ? 'เปิด' : 'ปิด'}บัญชีสำเร็จ` });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะบัญชีได้' });
    }
};

exports.resetPassword = async (req, res) => {
    const userId = Number(req.params.user_id);
    const password = String(req.body.new_password || '');
    if (password.length < 8) return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    try {
        const [[user]] = await db.query('SELECT user_id, username FROM users WHERE user_id=?', [userId]);
        if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
        const hash = await bcrypt.hash(password, 12);
        await db.query(
            'UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL, token_version=token_version+1 WHERE user_id=?',
            [hash, userId]
        );
        await logAdminAction({ actorId: req.user.id, action: 'RESET_PASSWORD', targetType: 'user', targetId: userId });
        return res.json({ success: true, message: `รีเซ็ตรหัสผ่านของ "${user.username}" สำเร็จ` });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'ไม่สามารถรีเซ็ตรหัสผ่านได้' });
    }
};

exports.changeRole = async (req, res) => {
    const userId = Number(req.params.user_id);
    const newRole = req.body.new_role;
    if (!['admin','staff','student'].includes(newRole)) return res.status(400).json({ success: false, message: 'Role ไม่ถูกต้อง' });
    if (userId === Number(req.user.id)) return res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยน role ตัวเองได้' });
    try {
        const [[user]] = await db.query(
            `SELECT u.user_id, u.username, u.role, s.student_id
             FROM users u LEFT JOIN students s ON u.user_id=s.user_id WHERE u.user_id=?`,
            [userId]
        );
        if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
        if (newRole === 'student' && !user.student_id) throw new HttpError(409, 'บัญชีนี้ไม่มีข้อมูลผู้สมัคร จึงเปลี่ยนเป็น student ไม่ได้');
        if (user.role === 'admin') {
            const [[count]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND is_active=1");
            if (count.total <= 1) throw new HttpError(409, 'ต้องเหลือผู้ดูแลระบบที่ใช้งานได้อย่างน้อยหนึ่งบัญชี');
        }
        await db.query('UPDATE users SET role=?, token_version=token_version+1 WHERE user_id=?', [newRole, userId]);
        await logAdminAction({ actorId: req.user.id, action: 'CHANGE_ROLE', targetType: 'user', targetId: userId, details: { from: user.role, to: newRole } });
        return res.json({ success: true, message: `เปลี่ยน role เป็น "${newRole}" สำเร็จ` });
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยน role ได้' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const [[user]] = await db.query(
            `SELECT u.user_id, u.username, u.email, u.role, u.is_active, u.last_login, u.created_at,
                    s.student_code, s.full_name, s.phone_number, s.id_card_number,
                    s.registration_status, s.highest_education, s.employment_status
             FROM users u LEFT JOIN students s ON u.user_id=s.user_id WHERE u.user_id=?`,
            [Number(req.params.user_id)]
        );
        if (!user) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        return res.json({ success: true, data: user });
    } catch {
        return res.status(500).json({ success: false, message: 'ไม่สามารถโหลดผู้ใช้ได้' });
    }
};
