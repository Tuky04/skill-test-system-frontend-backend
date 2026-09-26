const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { uploadDir } = require('../middleware/upload');
const { logAdminAction } = require('../utils/adminAudit');

const mimeByExtension = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };

exports.downloadDocument = async (req, res) => {
    const filename = req.params.filename;
    if (!filename || path.basename(filename) !== filename || !/^[A-Za-z0-9._-]{1,255}\.(jpg|jpeg|png|pdf)$/i.test(filename)) {
        return res.status(400).json({ success: false, message: 'ชื่อไฟล์ไม่ถูกต้อง' });
    }
    try {
        const [[owner]] = await db.query(
            `SELECT s.user_id FROM students s
             LEFT JOIN student_document_versions v ON v.student_id = s.student_id
             WHERE s.doc_id_card = ? OR s.doc_education = ? OR s.doc_photo = ? OR v.filename = ? LIMIT 1`,
            [filename, filename, filename, filename]
        );
        if (!owner) return res.status(404).json({ success: false, message: 'ไม่พบเอกสาร' });
        if (req.user.role === 'student' && Number(owner.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ดูเอกสารนี้' });
        }
        const target = path.resolve(uploadDir, filename);
        if (!target.startsWith(`${uploadDir}${path.sep}`) || !fs.existsSync(target)) {
            return res.status(404).json({ success: false, message: 'ไม่พบเอกสาร' });
        }
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', mimeByExtension[path.extname(filename).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        if (req.user.role !== 'student') {
            logAdminAction({ actorId: req.user.id, action: 'VIEW_PRIVATE_DOCUMENT', targetType: 'student_user', targetId: owner.user_id, details: { filename } })
                .catch((error) => console.error('[Document audit]', error.message));
        }
        return res.sendFile(target);
    } catch (error) {
        console.error('[Document download]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปิดเอกสารได้' });
    }
};
