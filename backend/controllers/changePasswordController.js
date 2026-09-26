const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.changePassword = async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password || !confirm_password) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    if (String(new_password).length < 8) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
    if (new_password !== confirm_password) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ไม่ตรงกัน' });
    try {
        const [[user]] = await db.query('SELECT password_hash FROM users WHERE user_id=?', [req.user.id]);
        if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
        }
        if (await bcrypt.compare(new_password, user.password_hash)) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม' });
        const hash = await bcrypt.hash(new_password, 12);
        await db.query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE user_id=?', [hash, req.user.id]);
        return res.json({ success: true, session_revoked: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
    }
};
