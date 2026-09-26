const test = require('node:test');
const assert = require('node:assert/strict');
const { _eligibility } = require('../controllers/retakeController');

const openCourse = {
    max_attempts: 3,
    reg_open_date: '2000-01-01',
    reg_close_date: '2999-12-31',
    course_status: 'เปิดรับสมัคร',
};

test('retake requires an officially published failed result', () => {
    assert.equal(_eligibility([], openCourse).can_retake, false);
    assert.equal(_eligibility([{ attempt_no: 1, application_status: 'อนุมัติสิทธิ์สอบ', result_published_at: null }], openCourse).can_retake, false);
    assert.equal(_eligibility([{ attempt_no: 1, application_status: 'อนุมัติสิทธิ์สอบ', result_published_at: new Date(), department_status: 'ไม่ได้รับวุฒิบัตร' }], openCourse).can_retake, true);
    assert.equal(_eligibility([{ attempt_no: 1, application_status: 'อนุมัติสิทธิ์สอบ', result_published_at: new Date(), department_status: 'ได้รับวุฒิบัตร' }], openCourse).can_retake, false);
});

test('rejected applications do not create a passed result or consume a new attempt', () => {
    const history = [
        { attempt_no: 1, application_status: 'อนุมัติสิทธิ์สอบ', result_published_at: new Date(), department_status: 'ไม่ได้รับวุฒิบัตร' },
        { attempt_no: 2, application_status: 'ปฏิเสธเอกสาร', result_published_at: null, department_status: null, is_retake: 1 },
    ];
    const result = _eligibility(history, openCourse);
    assert.equal(result.can_retake, true);
    assert.equal(result.next_attempt, 2);
});
