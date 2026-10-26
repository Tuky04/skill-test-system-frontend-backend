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
        // ตรวจเจ้าของไฟล์จาก 2 แหล่งแยกกัน (UNION) แทน OR ข้ามตาราง เพื่อให้ใช้ index ของแต่ละคอลัมน์ได้
        const [[owner]] = await db.query(
            `SELECT user_id FROM (
                 SELECT s.user_id FROM students s
                 WHERE s.doc_id_card = ? OR s.doc_education = ? OR s.doc_photo = ?
                 UNION
                 SELECT s.user_id FROM student_document_versions v JOIN students s ON s.student_id = v.student_id
                 WHERE v.filename = ?
                 UNION
                 SELECT s.user_id FROM payments p
                 JOIN registrations r ON r.registration_id = p.registration_id
                 JOIN students s ON s.student_id = r.student_id
                 WHERE p.slip_filename = ?
             ) owners LIMIT 1`,
            [filename, filename, filename, filename, filename]
        );
        if (!owner) return res.status(404).json({ success: false, message: 'ไม่พบเอกสาร' });
        if (req.user.role === 'student' && Number(owner.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ดูเอกสารนี้' });
        }
        const target = path.resolve(uploadDir, filename);
        if (!target.startsWith(`${uploadDir}${path.sep}`)) {
            return res.status(404).json({ success: false, message: 'ไม่พบเอกสาร' });
        }
        const stat = await fs.promises.stat(target).catch(() => null);
        if (!stat?.isFile()) return res.status(404).json({ success: false, message: 'ไม่พบเอกสาร' });

        // การเปิดเอกสารส่วนบุคคลโดยเจ้าหน้าที่ต้อง "มีบันทึกก่อน" จึงจะส่งไฟล์ (ถ้าบันทึกไม่ได้ ไม่เปิดให้ดู)
        if (req.user.role !== 'student') {
            await logAdminAction({ actorId: req.user.id, action: 'VIEW_PRIVATE_DOCUMENT', targetType: 'student_user', targetId: owner.user_id, details: { filename } });
        }
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', mimeByExtension[path.extname(filename).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        // ผูกการส่งไฟล์กับโฟลเดอร์ uploads ผ่าน root (ชั้นป้องกัน path traversal เพิ่มจากการตรวจชื่อไฟล์ด้านบน)
        return res.sendFile(filename, { root: uploadDir, dotfiles: 'allow' }, (error) => {
            if (error && !res.headersSent) res.status(error.status || 500).json({ success: false, message: 'ไม่สามารถเปิดเอกสารได้' });
        });
    } catch (error) {
        console.error('[Document download]', error.message);
        return res.status(500).json({ success: false, message: 'ไม่สามารถเปิดเอกสารได้' });
    }
};
