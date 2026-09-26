USE skill_test_system;

-- ผลลัพธ์ทุกชุดควรเป็นศูนย์ก่อนเพิ่ม UNIQUE/FK
SELECT email, COUNT(*) AS duplicate_count FROM users
WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;

SELECT n.notification_id FROM notifications n
LEFT JOIN users u ON u.user_id = n.user_id WHERE u.user_id IS NULL;

SELECT al.log_id FROM score_audit_logs al
LEFT JOIN registrations r ON r.registration_id = al.registration_id
WHERE r.registration_id IS NULL;

-- คะแนนศูนย์ที่ไม่มีหลักฐานว่าเข้าสอบ ต้องตรวจด้วยคนก่อน migration
SELECT r.registration_id, s.student_code, c.course_name
FROM registrations r
JOIN students s ON s.student_id = r.student_id
JOIN exam_courses c ON c.course_id = r.course_id
JOIN scores sc ON sc.registration_id = r.registration_id
WHERE sc.theory_score = 0 AND sc.practical_score = 0 AND sc.deducted_score = 0;
