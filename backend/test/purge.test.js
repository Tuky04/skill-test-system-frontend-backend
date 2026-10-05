// ทดสอบสคริปต์ลบบัญชีที่ไม่ยืนยันอีเมล: dry-run ไม่แก้อะไร, apply ลบถูกลำดับและลบไฟล์หลัง commit เท่านั้น
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-test-'));
process.env.UPLOAD_DIR = uploads;
process.env.JWT_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDb, installFakeDb, rows, ok } = require('../test-support/fakeDb');

const db = installFakeDb(createFakeDb());
const { purge, parseArgs } = require('../scripts/purge-unverified');

test.beforeEach(() => {
    db.reset();
    for (const name of fs.readdirSync(uploads)) fs.unlinkSync(path.join(uploads, name));
});
test.after(() => fs.rmSync(uploads, { recursive: true, force: true }));

const candidateRoutes = () => [
    [/FROM users u\s+JOIN students s/, rows({ user_id: 11, student_id: 21 }, { user_id: 12, student_id: 22 })],
    [/SELECT filename FROM student_document_versions/, rows({ filename: 'doc_id_card-aaa.jpg' }, { filename: 'doc_photo-bbb.png' })],
    [/^\s*(DELETE|INSERT)/i, ok()],
];

test('dry-run reports candidates and changes nothing', async () => {
    db.setRoutes(candidateRoutes());
    const result = await purge({ days: 7, apply: false });
    assert.deepEqual(result, { candidates: 2, deleted: 0, files: 0 });
    assert.equal(db.ran(/DELETE/), false);
    assert.equal(db.ran(/^BEGIN$/), false);
});

test('candidates exclude verified accounts, reviewed students and anyone with an exam application', async () => {
    db.setRoutes(candidateRoutes());
    await purge({ days: 7, apply: false });
    const select = db.log.find((entry) => /FROM users u JOIN students s/.test(entry.sql)).sql;
    assert.match(select, /email_verified_at IS NULL/);
    assert.match(select, /registration_status = \?/);
    assert.match(select, /NOT EXISTS \(SELECT 1 FROM registrations/);
});

test('apply deletes students before users inside one transaction, then removes the uploaded files', async () => {
    fs.writeFileSync(path.join(uploads, 'doc_id_card-aaa.jpg'), 'x');
    fs.writeFileSync(path.join(uploads, 'doc_photo-bbb.png'), 'x');
    fs.writeFileSync(path.join(uploads, 'someone-else.pdf'), 'x');
    db.setRoutes(candidateRoutes());
    const result = await purge({ days: 7, apply: true });
    assert.deepEqual(result, { candidates: 2, deleted: 2, files: 2 });
    const statements = db.log.map((entry) => entry.sql);
    const studentsAt = statements.findIndex((sql) => /^DELETE FROM students/.test(sql));
    const usersAt = statements.findIndex((sql) => /^DELETE FROM users/.test(sql));
    assert.ok(studentsAt > -1 && usersAt > studentsAt, 'students must be deleted before users');
    assert.ok(statements.indexOf('BEGIN') < studentsAt && statements.indexOf('COMMIT') > usersAt);
    assert.ok(db.ran(/PURGE_UNVERIFIED_ACCOUNTS|INSERT INTO admin_audit_logs/));
    assert.deepEqual(fs.readdirSync(uploads), ['someone-else.pdf']);
});

test('files are kept when the database transaction fails', async () => {
    fs.writeFileSync(path.join(uploads, 'doc_id_card-aaa.jpg'), 'x');
    db.setRoutes([
        [/FROM users u\s+JOIN students s/, rows({ user_id: 11, student_id: 21 })],
        [/SELECT filename FROM student_document_versions/, rows({ filename: 'doc_id_card-aaa.jpg' })],
        [/^\s*DELETE FROM users/i, new Error('boom')],
        [/^\s*(DELETE|INSERT)/i, ok()],
    ]);
    await assert.rejects(purge({ days: 7, apply: true }), /boom/);
    assert.deepEqual(fs.readdirSync(uploads), ['doc_id_card-aaa.jpg']);
    assert.ok(db.ran(/^ROLLBACK$/));
});

test('nothing is deleted when there are no candidates, and --days is validated', async () => {
    db.setRoutes([[/FROM users u\s+JOIN students s/, rows()]]);
    assert.deepEqual(await purge({ days: 7, apply: true }), { candidates: 0, deleted: 0, files: 0 });
    assert.equal(parseArgs([]).days, 7);
    assert.equal(parseArgs(['--days=30', '--apply']).apply, true);
    assert.throws(() => parseArgs(['--days=0']));
    assert.throws(() => parseArgs(['--days=abc']));
});
