const test = require('node:test');
const assert = require('node:assert/strict');
const { _safeCsvCell } = require('../controllers/exportController');

test('CSV cells quote delimiters and neutralize spreadsheet formulas', () => {
    assert.equal(_safeCsvCell('a,"b"\nnext'), '"a,""b""\nnext"');
    assert.equal(_safeCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
    assert.equal(_safeCsvCell('@SUM(1,2)'), '"\'@SUM(1,2)"');
});
