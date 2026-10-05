const db = require('../config/db');

// บันทึกการกระทำของ staff/admin
// ส่ง executor (connection ที่อยู่ใน transaction) เพื่อให้ audit commit/rollback พร้อมการเปลี่ยนข้อมูลจริง
// ถ้าไม่ส่ง จะเขียนผ่าน pool โดยตรง (best-effort)
async function logAdminAction({ actorId, action, targetType, targetId, details = null }, executor = db) {
    await executor.query(
        `INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [actorId, action, targetType, String(targetId), details ? JSON.stringify(details) : null]
    );
}

module.exports = { logAdminAction };
