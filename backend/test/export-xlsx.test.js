const test = require('node:test');
const assert = require('node:assert/strict');
const {
    _buildRegistrationFilters,
    _createRegistrationWorkbook,
} = require('../controllers/exportController');

test('registration export filters validate dates and use SQL parameters', () => {
    const result = _buildRegistrationFilters({
        date_type: 'exam',
        date_from: '2026-06-01',
        date_to: '2026-06-30',
        course_id: '2',
        session_id: '1',
        attempt_no: '2',
        result: 'passed',
        search: 'STD-2569',
    });
    assert.match(result.whereSql, /COALESCE\(es\.exam_date, c\.exam_date\) >= \?/);
    assert.match(result.whereSql, /r\.course_id = \?/);
    assert.match(result.whereSql, /sc\.department_status = 'ได้รับวุฒิบัตร'/);
    assert.deepEqual(result.params.slice(0, 5), ['2026-06-01', '2026-06-30', 2, 1, 2]);
    assert.throws(
        () => _buildRegistrationFilters({ date_from: '2026-07-01', date_to: '2026-06-01' }),
        /วันที่เริ่มต้น/
    );
    assert.throws(() => _buildRegistrationFilters({ course_id: '2 OR 1=1' }), /สาขาวิชาสอบ/);
});

test('XLSX workbook has practical sheets and masks national id by default', async () => {
    const rows = [{
        registration_id: 1,
        application_no: 'APP-0001',
        student_id: 7,
        student_code: 'STD-2569-000007',
        university_student_code: '6500000001',
        title: 'นาย',
        full_name: 'ทดสอบ ระบบ',
        id_card_number: '1100000000001',
        birth_date: '2002-01-01',
        phone_number: '0812345678',
        email: 'student@example.test',
        is_active: 1,
        course_code: 'EX-01',
        course_name: 'ทักษะดิจิทัล',
        session_name: 'รอบที่ 1',
        session_exam_date: '2026-06-20',
        exam_time: '09:00 - 12:00',
        session_location: 'ห้อง 2301',
        attempt_no: 1,
        application_status: 'อนุมัติสิทธิ์สอบ',
        exam_status: 'เข้าสอบ',
        theory_score: 25,
        practical_score: 55,
        deducted_score: 0,
        total_score: 80,
        department_status: 'ได้รับวุฒิบัตร',
        registered_at: '2026-06-01T09:00:00Z',
    }];
    const workbook = _createRegistrationWorkbook(rows, { date_type:'registered' });
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['รายละเอียดการสอบ', 'ข้อมูลนักศึกษา', 'สรุปรายงาน']);
    assert.equal(workbook.getWorksheet('ข้อมูลนักศึกษา').getCell('D2').value, '*********0001');
    assert.equal(workbook.getWorksheet('รายละเอียดการสอบ').autoFilter.from, 'A1');
    const buffer = await workbook.xlsx.writeBuffer();
    assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');

    const sensitive = _createRegistrationWorkbook(rows, { date_type:'registered' }, { includeSensitive:true });
    assert.equal(sensitive.getWorksheet('ข้อมูลนักศึกษา').getCell('D2').value, '1100000000001');
});
