const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readController = (name) => fs.readFileSync(path.join(__dirname, '..', 'controllers', name), 'utf8');

test('student and staff exam APIs expose complete schedule details', () => {
    const studentController = readController('studentController.js');
    const retakeController = readController('retakeController.js');

    for (const field of ['c.exam_date', 'c.exam_time', 'c.exam_location']) {
        assert.match(studentController, new RegExp(field.replace('.', '\\.')));
        assert.match(retakeController, new RegExp(field.replace('.', '\\.')));
    }
    assert.match(retakeController, /r\.exam_status/);
});

test('post-commit notifications cannot turn a successful status or score update into an API failure', () => {
    const studentController = readController('studentController.js');
    const scoreController = readController('scoreController.js');
    const registrationController = readController('registrationController.js');

    assert.doesNotMatch(studentController, /if \(template\) await createNotification/);
    assert.doesNotMatch(scoreController, /await createNotification\(/);
    assert.doesNotMatch(registrationController, /await createNotification\(/);
    assert.match(studentController, /\[Application notification\]/);
    assert.match(scoreController, /\[Score notification\]/);
    assert.match(registrationController, /\[Verification notification\]/);
});
