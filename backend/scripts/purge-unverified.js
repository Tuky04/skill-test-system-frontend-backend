// ลบบัญชีนักศึกษาที่สมัครแล้วไม่ยืนยันอีเมลภายใน N วัน (ค่าเริ่มต้น 7 วัน) พร้อมไฟล์เอกสารที่อัปโหลดไว้
//   npm run purge-unverified                 -> dry-run แสดงจำนวนที่จะลบ ไม่แก้ข้อมูล
//   npm run purge-unverified -- --days=14    -> เปลี่ยนจำนวนวัน
//   npm run purge-unverified -- --apply      -> ลบจริง
// ลบเฉพาะบัญชีที่ "ไม่เคยมีใบสมัครสอบ" และยังไม่ถูกเจ้าหน้าที่ตรวจเอกสาร เพื่อไม่ทำลายหลักฐานที่ใช้งานอยู่
// รายงานแสดงเฉพาะรหัสและจำนวน ไม่พิมพ์ชื่อ/อีเมล/เลขบัตรลง log
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { uploadDir } = require('../middleware/upload');
const { logAdminAction } = require('../utils/adminAudit');
const { STUDENT_STATUS } = require('../utils/domain');

function parseArgs(argv) {
    const days = Number((argv.find((arg) => arg.startsWith('--days=')) || '').split('=')[1] || 7);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('--days ต้องเป็นจำนวนเต็ม 1-365');
    return { days, apply: argv.includes('--apply') };
}

async function findCandidates(executor, days) {
    const [rows] = await executor.query(
        `SELECT u.user_id, s.student_id
         FROM users u
         JOIN students s ON s.user_id = u.user_id
         WHERE u.role = 'student' AND u.email_verified_at IS NULL
           AND u.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
           AND s.registration_status = ?
           AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = s.student_id)`,
        [days, STUDENT_STATUS.PENDING]
    );
    return rows;
}

async function purge({ days, apply }, executor = db) {
    const candidates = await findCandidates(executor, days);
    if (!apply || !candidates.length) return { candidates: candidates.length, deleted: 0, files: 0 };

    const studentIds = candidates.map((row) => row.student_id);
    const userIds = candidates.map((row) => row.user_id);
    let filenames = [];
    await executor.withTransaction(async (conn) => {
        const [files] = await conn.query('SELECT filename FROM student_document_versions WHERE student_id IN (?)', [studentIds]);
        filenames = files.map((row) => row.filename);
        // students ก่อน (document versions/verifications ลบตามด้วย CASCADE) แล้วค่อย users (notifications ลบตาม CASCADE)
        await conn.query('DELETE FROM students WHERE student_id IN (?)', [studentIds]);
        await conn.query('DELETE FROM users WHERE user_id IN (?)', [userIds]);
        await logAdminAction({
            actorId: null, action: 'PURGE_UNVERIFIED_ACCOUNTS', targetType: 'system', targetId: 'purge-unverified',
            details: { days, accounts: userIds.length, files: filenames.length },
        }, conn);
    });

    // ลบไฟล์หลัง commit สำเร็จเท่านั้น: ถ้าลบไฟล์ก่อนแล้ว transaction ล้ม จะได้ข้อมูลที่ไฟล์หาย
    let removed = 0;
    for (const filename of filenames) {
        const target = path.resolve(uploadDir, path.basename(filename));
        if (!target.startsWith(`${uploadDir}${path.sep}`)) continue;
        try { await fs.promises.unlink(target); removed += 1; } catch (error) { if (error.code !== 'ENOENT') console.error(`ลบไฟล์ไม่สำเร็จ (${error.code})`); }
    }
    return { candidates: candidates.length, deleted: userIds.length, files: removed };
}

module.exports = { purge, findCandidates, parseArgs };

if (require.main === module) {
    (async () => {
        const options = parseArgs(process.argv.slice(2));
        const result = await purge(options);
        if (!options.apply) {
            console.log(`[dry-run] พบ ${result.candidates} บัญชีที่ไม่ยืนยันอีเมลเกิน ${options.days} วันและไม่มีใบสมัครสอบ (ยังไม่ลบ ใช้ --apply เพื่อลบจริง)`);
        } else {
            console.log(`ลบแล้ว ${result.deleted} บัญชี และไฟล์เอกสาร ${result.files} ไฟล์`);
        }
    })().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    }).finally(() => db.end());
}
