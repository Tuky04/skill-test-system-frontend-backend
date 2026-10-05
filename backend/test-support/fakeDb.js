// ฐานข้อมูลปลอมสำหรับชุดทดสอบ: จับคู่ SQL ด้วย regex แล้วคืนผลตามที่กำหนด และบันทึกทุกคำสั่งที่ถูกเรียก
// ใช้ติดตั้งแทนโมดูล config/db ก่อน require โค้ดจริง (ดู installFakeDb) จึงไม่ต้องมี MySQL ในการรันเทส
const path = require('path');

const normalize = (sql) => String(sql).replace(/\s+/g, ' ').trim();

function createFakeDb() {
    let routes = [];
    const log = [];

    async function run(sql, params) {
        log.push({ sql: normalize(sql), params });
        for (const [pattern, result] of routes) {
            if (pattern.test(sql)) {
                const value = typeof result === 'function' ? result(sql, params) : result;
                if (value instanceof Error) throw value;
                return value;
            }
        }
        return [[], undefined];
    }

    const connection = {
        query: run,
        beginTransaction: async () => { log.push({ sql: 'BEGIN' }); },
        commit: async () => { log.push({ sql: 'COMMIT' }); },
        rollback: async () => { log.push({ sql: 'ROLLBACK' }); },
        release: () => {},
    };

    const db = {
        query: run,
        getConnection: async () => connection,
        end: async () => {},
        async withTransaction(work) {
            await connection.beginTransaction();
            try {
                const result = await work(connection);
                await connection.commit();
                return result;
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        },
        // ---- helpers สำหรับเทส ----
        setRoutes(next) { routes = next; },
        reset() { routes = []; log.length = 0; },
        log,
        ran: (pattern) => log.some((entry) => pattern.test(entry.sql)),
    };
    return db;
}

// ผลลัพธ์ที่ mysql2 คืน: SELECT => [rows, fields], INSERT/UPDATE => [{ affectedRows, insertId }, undefined]
const rows = (...items) => [items, undefined];
const ok = (extra = {}) => [{ affectedRows: 1, insertId: 1, ...extra }, undefined];

function installFakeDb(db) {
    const target = require.resolve('../config/db');
    require.cache[target] = { id: target, filename: target, loaded: true, exports: db, children: [], paths: [] };
    return db;
}

// แทนที่ emailService ด้วยตัวบันทึกการเรียก (ไม่ต่อ SMTP จริง)
function installFakeEmail() {
    const target = require.resolve('../utils/emailService');
    const calls = [];
    const record = (name) => async (payload) => { calls.push({ name, payload }); };
    const exports = {
        sendDocumentVerificationEmail: record('sendDocumentVerificationEmail'),
        sendScoreResultEmail: record('sendScoreResultEmail'),
        sendNewApplicationAlert: record('sendNewApplicationAlert'),
        sendExamApplicationReceivedEmail: record('sendExamApplicationReceivedEmail'),
        sendExamApplicationStatusEmail: record('sendExamApplicationStatusEmail'),
        sendPasswordResetEmail: record('sendPasswordResetEmail'),
        sendEmailVerification: record('sendEmailVerification'),
        verifySmtpConnection: async () => {},
        sendTestEmail: async () => {},
    };
    require.cache[target] = { id: target, filename: target, loaded: true, exports, children: [], paths: [] };
    return { calls };
}

module.exports = { createFakeDb, installFakeDb, installFakeEmail, rows, ok, root: path.resolve(__dirname, '..') };
