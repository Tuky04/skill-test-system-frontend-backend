const db = require('../config/db');

const Student = {
    // เพิ่มข้อมูลใบสมัครของนักศึกษาเข้าฐานข้อมูล
    create: async (studentData) => {
        const sql = `INSERT INTO students 
        (student_code, application_no, title, full_name, id_card_number, birth_date, gender, phone_number, avatar_path, address_text, highest_education, education_major, employment_status, current_occupation, current_position, work_experience_years, average_income, industry_group, unemployed_type, application_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')`;
        
        const values = [
            studentData.student_code, studentData.application_no, studentData.title,
            studentData.full_name, studentData.id_card_number, studentData.birth_date,
            studentData.gender, studentData.phone_number, studentData.avatar_path,
            studentData.address_text, studentData.highest_education, studentData.education_major,
            studentData.employment_status, studentData.current_occupation, studentData.current_position,
            studentData.work_experience_years, studentData.average_income, studentData.industry_group,
            studentData.unemployed_type
        ];
        const [result] = await db.query(sql, values);
        return result;
    },

    // ดึงรายชื่อนักศึกษาทั้งหมดที่มีสิทธิ์สอบ (เพื่อเอาไปโชว์ในหน้ากรอกคะแนนของอาจารย์)
    getApprovedStudents: async () => {
        const [rows] = await db.query("SELECT * FROM students WHERE application_status = 'อนุมัติสิทธิ์สอบ'");
        return rows;
    }
};

module.exports = Student;