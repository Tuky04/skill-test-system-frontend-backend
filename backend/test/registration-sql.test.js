const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('student registration INSERT has one value for every column', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'registrationController.js'), 'utf8');
    const match = source.match(/INSERT INTO students \(([\s\S]*?)\) VALUES \(([\s\S]*?)\)`/);
    assert.ok(match, 'registration INSERT was not found');
    const columns = match[1].split(',').map((value) => value.trim()).filter(Boolean);
    const values = match[2].split(',').map((value) => value.trim()).filter(Boolean);
    assert.equal(values.length, columns.length);
    assert.ok(columns.includes('privacy_consent_at'));
    assert.ok(columns.includes('university_student_code'));
});

test('removed application status is not used as a stored state', () => {
    const root = path.join(__dirname, '..');
    const files = [];
    const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') visit(target);
            else if (entry.isFile() && target.endsWith('.js')) files.push(target);
        }
    };
    visit(root);
    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /['"]รอการอนุมัติ['"]/, file);
    }
});
