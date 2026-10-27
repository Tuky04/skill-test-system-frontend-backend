const ExcelJS = require('exceljs');

// สร้างสมุดงาน Excel ของรายงานนักศึกษา/การสอบ (ฟังก์ชันล้วน ไม่แตะฐานข้อมูล)
// แยกเป็นไฟล์ของตัวเองเพื่อให้รันใน worker thread ได้: การสร้างไฟล์หลายหมื่นแถวกิน CPU หลายวินาที
// ถ้าทำบน main thread จะทำให้ API ของผู้ใช้ทุกคนค้างตลอดเวลานั้น

function asExcelDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date;
}

function maskedId(value) {
    const text = String(value || '');
    return text ? `*********${text.slice(-4)}` : '';
}

function styleWorksheet(sheet) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}1` };
    const header = sheet.getRow(1);
    header.height = 26;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2F6E' } };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFF5A800' } } }; });
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber % 2 === 0) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FA' } };
        }
        row.alignment = { vertical: 'top', wrapText: true };
    });
}

function createRegistrationWorkbook(rows, filters, options = {}) {
    const includeSensitive = Boolean(options.includeSensitive);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Skill Test System';
    workbook.created = new Date();
    workbook.subject = 'รายงานข้อมูลนักศึกษาและการสอบ';

    const examSheet = workbook.addWorksheet('รายละเอียดการสอบ', { properties: { tabColor: { argb: 'FFF5A800' } } });
    examSheet.columns = [
        { header: 'เลขใบสมัคร', key: 'application_no', width: 20 },
        { header: 'รหัสผู้สมัคร', key: 'student_code', width: 19 },
        { header: 'รหัสนักศึกษา', key: 'university_student_code', width: 18 },
        { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 28 },
        { header: 'อีเมล', key: 'email', width: 28 },
        { header: 'โทรศัพท์', key: 'phone_number', width: 16 },
        { header: 'รหัสวิชา', key: 'course_code', width: 14 },
        { header: 'สาขาวิชาสอบ', key: 'course_name', width: 38 },
        { header: 'รอบสอบ', key: 'session_name', width: 35 },
        { header: 'ครั้งที่สอบ', key: 'attempt_no', width: 12 },
        { header: 'ประเภทการสอบ', key: 'retake_label', width: 16 },
        { header: 'วันที่สอบ', key: 'exam_date', width: 15 },
        { header: 'เวลาสอบ', key: 'exam_time', width: 16 },
        { header: 'ห้องสอบ/สถานที่', key: 'exam_location', width: 35 },
        { header: 'สถานะใบสมัคร', key: 'application_status', width: 20 },
        { header: 'สถานะเข้าสอบ', key: 'exam_status', width: 18 },
        { header: 'คะแนนทฤษฎี', key: 'theory_score', width: 14 },
        { header: 'คะแนนปฏิบัติ', key: 'practical_score', width: 15 },
        { header: 'คะแนนหัก', key: 'deducted_score', width: 12 },
        { header: 'คะแนนรวม', key: 'total_score', width: 13 },
        { header: 'ผลมหาวิทยาลัย', key: 'university_status', width: 18 },
        { header: 'ผลกรมพัฒนาฝีมือแรงงาน', key: 'department_status', width: 24 },
        { header: 'ผู้บันทึกคะแนน', key: 'examiner_username', width: 18 },
        { header: 'เลขวุฒิบัตร', key: 'certificate_no', width: 22 },
        { header: 'วันที่สมัคร', key: 'registered_at', width: 20 },
        { header: 'วันที่ประกาศผล', key: 'result_published_at', width: 20 },
        { header: 'ค่าสมัครสอบ (บาท)', key: 'payment_amount', width: 16 },
        { header: 'สถานะการชำระ', key: 'payment_status', width: 16 },
        { header: 'เลขอ้างอิงการโอน', key: 'transfer_ref', width: 20 },
        { header: 'วันที่ยืนยันการชำระ', key: 'payment_verified_at', width: 20 },
    ];
    rows.forEach((row) => examSheet.addRow({
        ...row,
        full_name: `${row.title || ''}${row.full_name || ''}`,
        retake_label: row.is_retake ? 'สอบซ่อม' : 'สอบครั้งแรก',
        exam_date: asExcelDate(row.session_exam_date || row.course_exam_date),
        exam_location: row.session_location || row.exam_location || '',
        registered_at: asExcelDate(row.registered_at),
        result_published_at: asExcelDate(row.result_published_at),
        payment_amount: row.payment_amount == null ? null : Number(row.payment_amount),
        payment_status: row.payment_status || '',
        transfer_ref: row.transfer_ref || '',
        payment_verified_at: asExcelDate(row.payment_verified_at),
    }));
    ['K'].forEach(() => {});
    ['L'].forEach((letter) => { examSheet.getColumn(letter).numFmt = 'dd/mm/yyyy'; });
    ['Y', 'Z', 'AD'].forEach((letter) => { examSheet.getColumn(letter).numFmt = 'dd/mm/yyyy hh:mm'; });
    examSheet.getColumn('AA').numFmt = '0.00';
    ['Q', 'R', 'S', 'T'].forEach((letter) => { examSheet.getColumn(letter).numFmt = '0.00'; });
    styleWorksheet(examSheet);

    const studentSheet = workbook.addWorksheet('ข้อมูลนักศึกษา');
    studentSheet.columns = [
        { header: 'รหัสผู้สมัคร', key: 'student_code', width: 19 },
        { header: 'รหัสนักศึกษา', key: 'university_student_code', width: 18 },
        { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 28 },
        { header: includeSensitive ? 'เลขบัตรประชาชน (เต็ม)' : 'เลขบัตรประชาชน (ปิดบัง)', key: 'id_card', width: 24 },
        { header: 'วันเกิด', key: 'birth_date', width: 14 },
        { header: 'เพศ', key: 'gender', width: 10 },
        { header: 'สัญชาติ', key: 'nationality', width: 12 },
        { header: 'โทรศัพท์', key: 'phone_number', width: 16 },
        { header: 'อีเมล', key: 'email', width: 28 },
        { header: 'ที่อยู่', key: 'address_text', width: 42 },
        { header: 'ระดับการศึกษา', key: 'highest_education', width: 20 },
        { header: 'สาขาการศึกษา', key: 'education_major', width: 25 },
        { header: 'สถานภาพการทำงาน', key: 'employment_status', width: 22 },
        { header: 'อาชีพปัจจุบัน', key: 'current_occupation', width: 24 },
        { header: 'ตำแหน่ง', key: 'current_position', width: 22 },
        { header: 'ประสบการณ์ (ปี)', key: 'work_experience_years', width: 17 },
        { header: 'รายได้เฉลี่ย', key: 'average_income', width: 18 },
        { header: 'กลุ่มอุตสาหกรรม', key: 'industry_group', width: 22 },
        { header: 'สถานะเอกสาร', key: 'student_status', width: 20 },
        { header: 'สถานะบัญชี', key: 'account_status', width: 15 },
        { header: 'ยืนยันอีเมลเมื่อ', key: 'email_verified_at', width: 20 },
        { header: 'เข้าสู่ระบบล่าสุด', key: 'last_login', width: 20 },
    ];
    const uniqueStudents = new Map();
    rows.forEach((row) => { if (!uniqueStudents.has(row.student_id)) uniqueStudents.set(row.student_id, row); });
    uniqueStudents.forEach((row) => studentSheet.addRow({
        ...row,
        full_name: `${row.title || ''}${row.full_name || ''}`,
        id_card: includeSensitive ? String(row.id_card_number || '') : maskedId(row.id_card_number),
        birth_date: asExcelDate(row.birth_date),
        account_status: Number(row.is_active) === 1 ? 'ใช้งาน' : 'ปิดใช้งาน',
        email_verified_at: asExcelDate(row.email_verified_at),
        last_login: asExcelDate(row.last_login),
    }));
    studentSheet.getColumn('E').numFmt = 'dd/mm/yyyy';
    ['U', 'V'].forEach((letter) => { studentSheet.getColumn(letter).numFmt = 'dd/mm/yyyy hh:mm'; });
    styleWorksheet(studentSheet);

    const summary = workbook.addWorksheet('สรุปรายงาน', { properties: { tabColor: { argb: 'FF1A2F6E' } } });
    summary.columns = [{ width: 28 }, { width: 55 }];
    summary.addRows([
        ['รายงาน', 'ข้อมูลนักศึกษาและรายละเอียดการสอบ'],
        ['สร้างเมื่อ', new Date()],
        ['จำนวนรายการสอบ', rows.length],
        ['จำนวนนักศึกษา', uniqueStudents.size],
        ['ประเภทวันที่', filters.date_type === 'exam' ? 'วันที่สอบ' : 'วันที่สมัคร'],
        ['ตั้งแต่วันที่', filters.date_from || 'ไม่จำกัด'],
        ['ถึงวันที่', filters.date_to || 'ไม่จำกัด'],
        ['รหัสสาขาวิชาสอบ', filters.course_id || 'ทุกสาขา'],
        ['รหัสรอบสอบ', filters.session_id || 'ทุกรอบ'],
        ['ครั้งที่สอบ', filters.attempt_no || 'ทุกครั้ง'],
        ['สถานะใบสมัคร', filters.application_status || 'ทุกสถานะ'],
        ['สถานะเข้าสอบ', filters.exam_status || 'ทุกสถานะ'],
        ['สถานะเอกสาร', filters.student_status || 'ทุกสถานะ'],
        ['ผลสอบ', filters.result || 'ทุกผล'],
        ['คำค้นหา', filters.search || '-'],
        ['ข้อมูลอ่อนไหว', includeSensitive ? 'มีเลขบัตรประชาชนเต็ม (admin เลือกส่งออก)' : 'ปิดบังเลขบัตรประชาชน'],
    ]);
    summary.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1A2F6E' } };
    summary.getRow(2).getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
    summary.eachRow((row, index) => {
        row.alignment = { vertical: 'top', wrapText: true };
        if (index > 1 && index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FA' } };
    });
    summary.getColumn(1).font = { bold: true };
    return workbook;
}

module.exports = { createRegistrationWorkbook };
