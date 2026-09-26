USE skill_test_system;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS university_student_code VARCHAR(30) NULL AFTER student_code,
  ADD UNIQUE KEY IF NOT EXISTS uq_students_university_code (university_student_code);

-- ผู้สมัครใหม่ต้องระบุรหัสนักศึกษามหาวิทยาลัยผ่านหน้าลงทะเบียน
-- แถวเดิมที่เป็น NULL ต้องให้ผู้ดูแลเติมข้อมูลจริงก่อนนำไปรายงาน
SELECT student_id, student_code, full_name
FROM students
WHERE university_student_code IS NULL OR university_student_code = '';
