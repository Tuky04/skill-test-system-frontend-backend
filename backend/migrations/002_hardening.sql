USE skill_test_system;
START TRANSACTION;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL AFTER token_version,
  ADD COLUMN IF NOT EXISTS email_verification_token CHAR(64) NULL AFTER email_verified_at,
  ADD COLUMN IF NOT EXISTS email_verification_expires DATETIME NULL AFTER email_verification_token;

-- บัญชีเดิมถือว่ายืนยันแล้ว เพื่อไม่ล็อกผู้ใช้เดิมหลัง migration
UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at);

ALTER TABLE exam_courses
  ADD COLUMN IF NOT EXISTS status_override ENUM('เปิดรับสมัคร','ปิดรับสมัคร') NULL AFTER course_status;

ALTER TABLE exam_sessions
  ADD UNIQUE KEY IF NOT EXISTS uq_exam_sessions_slot (session_name, exam_date, location);

ALTER TABLE registrations
  MODIFY application_status ENUM('รอดำเนินการ','อนุมัติสิทธิ์สอบ','ปฏิเสธเอกสาร') NOT NULL DEFAULT 'รอดำเนินการ',
  ADD COLUMN IF NOT EXISTS exam_status ENUM('รอสอบ','เข้าสอบ','ขาดสอบ','ยกเลิก','ประกาศผลแล้ว') NOT NULL DEFAULT 'รอสอบ' AFTER retake_reason,
  ADD COLUMN IF NOT EXISTS result_published_at DATETIME NULL AFTER exam_status;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS privacy_consent_at DATETIME NULL AFTER doc_photo,
  ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(20) NULL AFTER privacy_consent_at;

-- ถือว่า score ที่มีค่ามากกว่าศูนย์เป็นผลเดิมที่เคยประกาศ ส่วน score 0/0/0 ต้องตรวจจาก preflight
UPDATE registrations r JOIN scores sc ON sc.registration_id = r.registration_id
SET r.result_published_at = COALESCE(r.result_published_at, sc.updated_at),
    r.exam_status = 'ประกาศผลแล้ว'
WHERE sc.theory_score <> 0 OR sc.practical_score <> 0 OR sc.deducted_score <> 0;

ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS uq_users_email (email);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL, action VARCHAR(80) NOT NULL, target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(64) NOT NULL, details LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_audit_actor (actor_id, created_at),
  KEY idx_admin_audit_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_document_versions (
  document_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  document_type ENUM('doc_id_card','doc_education','doc_photo') NOT NULL,
  filename VARCHAR(255) NOT NULL,
  uploaded_by INT NOT NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_versions_filename (filename),
  KEY idx_document_versions_student (student_id, document_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO student_document_versions (student_id, document_type, filename, uploaded_by, is_current)
SELECT student_id, 'doc_id_card', doc_id_card, user_id, 1 FROM students WHERE doc_id_card IS NOT NULL;
INSERT IGNORE INTO student_document_versions (student_id, document_type, filename, uploaded_by, is_current)
SELECT student_id, 'doc_education', doc_education, user_id, 1 FROM students WHERE doc_education IS NOT NULL;
INSERT IGNORE INTO student_document_versions (student_id, document_type, filename, uploaded_by, is_current)
SELECT student_id, 'doc_photo', doc_photo, user_id, 1 FROM students WHERE doc_photo IS NOT NULL;

CREATE TABLE IF NOT EXISTS certificates (
  certificate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registration_id INT NOT NULL, certificate_no VARCHAR(64) NOT NULL,
  verification_code CHAR(48) NOT NULL, issued_at DATETIME NOT NULL,
  issue_version INT UNSIGNED NOT NULL DEFAULT 1,
  revoked_at DATETIME NULL, revoked_reason VARCHAR(255) NULL,
  holder_name VARCHAR(150) NOT NULL, course_name VARCHAR(255) NOT NULL,
  total_score DECIMAL(5,2) NOT NULL,
  UNIQUE KEY uq_certificates_registration (registration_id),
  UNIQUE KEY uq_certificates_number (certificate_no),
  UNIQUE KEY uq_certificates_verification (verification_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

-- หลัง migration ให้ย้ายไฟล์จาก backend/uploads ไป backend/private_uploads
-- และเปลี่ยน DB/JWT/SMTP credentials เดิมทั้งหมดก่อนเปิดระบบ
