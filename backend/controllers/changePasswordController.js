const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { HttpError, validatePassword } = require('../utils/domain');

exports.changePassword = async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password || !confirm_password) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    if (typeof current_password !== 'string' || Buffer.byteLength(current_password, 'utf8') > 1024) {
        return res.status(401).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }
    try {
        validatePassword(new_password);
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        throw error;
    }
    if (new_password !== confirm_password) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ไม่ตรงกัน' });
    try {
        const [[user]] = await db.query('SELECT password_hash FROM users WHERE user_id=?', [req.user.id]);
        if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
        }
        if (await bcrypt.compare(new_password, user.password_hash)) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม' });
        const hash = await bcrypt.hash(new_password, 12);
        await db.query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE user_id=?', [hash, req.user.id]);
        // ลบ refresh cookie ของเครื่องนี้ด้วย (token_version ที่เพิ่มขึ้นทำให้ token เดิมใช้ไม่ได้อยู่แล้ว)
        res.clearCookie('refresh_token', { path: '/api/auth' });
        return res.json({ success: true, session_revoked: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
    } catch (error) {
        console.error('[Change password]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
    }
};
