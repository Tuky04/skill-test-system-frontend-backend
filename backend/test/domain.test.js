const test = require('node:test');
const assert = require('node:assert/strict');
const {
    COURSE_STATUS,
    computeCourseStatus,
    isValidThaiNationalId,
    escapeHtml,
    parseRequiredNumber,
} = require('../utils/domain');

test('computeCourseStatus respects dates and manual override', () => {
    const course = { reg_open_date: '2026-07-01', reg_close_date: '2026-07-31', course_status: COURSE_STATUS.CLOSED };
    assert.equal(computeCourseStatus(course, '2026-06-30'), COURSE_STATUS.UPCOMING);
    assert.equal(computeCourseStatus(course, '2026-07-01'), COURSE_STATUS.OPEN);
    assert.equal(computeCourseStatus(course, '2026-08-01'), COURSE_STATUS.CLOSED);
    assert.equal(computeCourseStatus({ ...course, status_override: COURSE_STATUS.CLOSED }, '2026-07-10'), COURSE_STATUS.CLOSED);
});

test('Thai national id checksum is validated', () => {
    const base = '110170020703';
    const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
    const valid = `${base}${(11 - (sum % 11)) % 10}`;
    assert.equal(isValidThaiNationalId(valid), true);
    assert.equal(isValidThaiNationalId(`${base}${(Number(valid[12]) + 1) % 10}`), false);
});

test('HTML is escaped and required numbers reject invalid values', () => {
    assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
    assert.equal(parseRequiredNumber('0', 'คะแนน'), 0);
    assert.throws(() => parseRequiredNumber('abc', 'คะแนน'));
    assert.throws(() => parseRequiredNumber('', 'คะแนน'));
});
