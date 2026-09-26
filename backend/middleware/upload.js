const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Keep uploaded identity documents outside the Apache web root whenever
// UPLOAD_DIR is configured. The local folder remains a development fallback.
const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '../private_uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = new Map([
    ['.jpg', ['image/jpeg']],
    ['.jpeg', ['image/jpeg']],
    ['.png', ['image/png']],
    ['.pdf', ['application/pdf']],
]);

function cleanupFiles(files) {
    for (const list of Object.values(files || {})) {
        for (const file of list) fs.promises.unlink(file.path).catch(() => {});
    }
}

async function hasValidSignature(file) {
    const handle = await fs.promises.open(file.path, 'r');
    try {
        const buffer = Buffer.alloc(8);
        await handle.read(buffer, 0, buffer.length, 0);
        const ext = path.extname(file.filename).toLowerCase();
        if (ext === '.pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
        if (ext === '.png') return buffer.equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    } finally {
        await handle.close();
    }
}

const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadDir),
    filename: (req, file, callback) => {
        const ext = path.extname(file.originalname).toLowerCase();
        callback(null, `${file.fieldname}-${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 40 },
    fileFilter(req, file, callback) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedTypes.get(ext)?.includes(file.mimetype)) {
            return callback(new Error('รองรับเฉพาะไฟล์ JPG, PNG และ PDF ที่ชนิดไฟล์ถูกต้อง'));
        }
        return callback(null, true);
    },
}).fields([
    { name: 'doc_id_card', maxCount: 1 },
    { name: 'doc_education', maxCount: 1 },
    { name: 'doc_photo', maxCount: 1 },
]);

const handleUpload = (req, res, next) => {
    upload(req, res, async (error) => {
        if (error) {
            cleanupFiles(req.files);
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'ไฟล์มีขนาดเกิน 5 MB'
                : error.message;
            return res.status(400).json({ success: false, message });
        }
        try {
            for (const list of Object.values(req.files || {})) {
                if (!(await hasValidSignature(list[0]))) throw new Error('เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่ระบุ');
            }
            return next();
        } catch (signatureError) {
            cleanupFiles(req.files);
            return res.status(400).json({ success: false, message: signatureError.message });
        }
    });
};

module.exports = { handleUpload, cleanupFiles, uploadDir };
