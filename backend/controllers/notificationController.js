const db = require('../config/db');

// ── Helper: สร้าง notification ────────────────────────────────
async function createNotification({ user_id, type, title, message, link = null }) {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [user_id, type, title, message, link]
        );
    } catch (err) {
        console.error('❌ [Notification Error]:', err.message);
    }
}

// ── Notification Templates ────────────────────────────────────
const templates = {
    // เอกสารได้รับการอนุมัติ
    doc_approved: (student_code) => ({
        type:    'doc_approved',
        title:   '✅ เอกสารได้รับการอนุมัติ',
        message: `เอกสารของรหัส ${student_code} ผ่านการตรวจสอบแล้ว คุณสามารถสมัครสอบได้ทันที`,
        link:    '/student-dashboard',
    }),
    // เอกสารไม่ครบ/ถูกปฏิเสธ
    doc_rejected: (note) => ({
        type:    'doc_rejected',
        title:   '⚠️ เอกสารไม่ครบถ้วน',
        message: `กรุณาส่งเอกสารเพิ่มเติม${note ? `: ${note}` : ''} ภายใน 7 วัน`,
        link:    '/student-dashboard',
    }),
    // ใบสมัครสอบได้รับการอนุมัติ
    exam_approved: (course_name) => ({
        type:    'exam_approved',
        title:   '🎯 อนุมัติสิทธิ์เข้าสอบแล้ว',
        message: `ใบสมัครสอบสาขา "${course_name}" ได้รับการอนุมัติ กรุณาตรวจสอบบัตรเข้าห้องสอบ`,
        link:    '/student-dashboard',
    }),
    // ใบสมัครสอบถูกปฏิเสธ
    exam_rejected: (course_name) => ({
        type:    'exam_rejected',
        title:   '❌ ใบสมัครถูกปฏิเสธ',
        message: `ใบสมัครสอบสาขา "${course_name}" ถูกปฏิเสธ กรุณาติดต่อเจ้าหน้าที่`,
        link:    '/student-dashboard',
    }),
    // ผลคะแนนสอบออกแล้ว
    score_released: (course_name, status) => ({
        type:    'score_released',
        title:   status === 'ได้รับวุฒิบัตร' ? '🏆 ผลสอบ: ผ่านการประเมิน!' : '📋 ผลสอบออกแล้ว',
        message: status === 'ได้รับวุฒิบัตร'
            ? `ยินดีด้วย! คุณผ่านการทดสอบมาตรฐานสาขา "${course_name}" สามารถดาวน์โหลดวุฒิบัตรได้แล้ว`
            : `ผลการทดสอบสาขา "${course_name}" ออกแล้ว กรุณาตรวจสอบคะแนนของคุณ`,
        link:    '/student-dashboard',
    }),
};

// ── GET /api/notifications — ดึง notification ของตัวเอง ──────
exports.getMyNotifications = async (req, res) => {
    const user_id = req.user?.id || req.user?.user_id;
    try {
        const [rows] = await db.query(
            `SELECT * FROM notifications WHERE user_id = ?
             ORDER BY created_at DESC LIMIT 30`,
            [user_id]
        );
        const [[count]] = await db.query(
            'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
            [user_id]
        );
        res.json({ success: true, data: rows, unread: Number(count.total || 0) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'ไม่สามารถโหลดการแจ้งเตือนได้' });
    }
};

// ── PUT /api/notifications/:id/read — mark as read ──────────
exports.markAsRead = async (req, res) => {
    const user_id = req.user?.id || req.user?.user_id;
    const { id }  = req.params;
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
            [id, user_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/notifications/read-all — mark all as read ──────
exports.markAllAsRead = async (req, res) => {
    const user_id = req.user?.id || req.user?.user_id;
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [user_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /api/notifications/:id — ลบ notification ─────────
exports.deleteNotification = async (req, res) => {
    const user_id = req.user?.id || req.user?.user_id;
    const { id }  = req.params;
    try {
        await db.query(
            'DELETE FROM notifications WHERE notification_id = ? AND user_id = ?',
            [id, user_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { ...exports, createNotification, templates };
