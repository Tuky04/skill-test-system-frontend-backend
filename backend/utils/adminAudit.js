const db = require('../config/db');

async function logAdminAction({ actorId, action, targetType, targetId, details = null }) {
    await db.query(
        `INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [actorId, action, targetType, String(targetId), details ? JSON.stringify(details) : null]
    );
}

module.exports = { logAdminAction };
