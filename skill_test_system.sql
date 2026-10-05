-- Skill Test System: schema เปล่า (ไม่มีข้อมูลบุคคล/บัญชี) สร้างจากฐานข้อมูลที่ใช้งานจริงด้วย SHOW CREATE TABLE
-- รวม ENGINE/CHARSET/COLLATE และ CHECK constraint ครบทุกตาราง (dump เดิมจาก phpMyAdmin ทำสิ่งเหล่านี้หายใน 6 ตาราง)
-- ใช้กับ MariaDB 10.4+ / MySQL 8+  ·  ติดตั้งใหม่: mysql -u root -p < skill_test_system.sql

CREATE DATABASE IF NOT EXISTS `skill_test_system` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `skill_test_system`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `admin_audit_logs`;
CREATE TABLE `admin_audit_logs` (
  `log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `actor_id` int(10) unsigned DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `target_type` varchar(50) NOT NULL,
  `target_id` varchar(64) NOT NULL,
  `details` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_admin_audit_actor` (`actor_id`,`created_at`),
  KEY `idx_admin_audit_target` (`target_type`,`target_id`),
  KEY `idx_admin_audit_created` (`created_at`),
  CONSTRAINT `fk_admin_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `certificates`;
CREATE TABLE `certificates` (
  `certificate_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `registration_id` int(10) unsigned NOT NULL,
  `certificate_no` varchar(64) NOT NULL,
  `verification_code` char(48) NOT NULL,
  `issue_version` int(10) unsigned NOT NULL DEFAULT 1,
  `issued_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_reason` varchar(255) DEFAULT NULL,
  `holder_name` varchar(150) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `total_score` decimal(5,2) NOT NULL,
  PRIMARY KEY (`certificate_id`),
  UNIQUE KEY `uq_certificates_registration` (`registration_id`),
  UNIQUE KEY `uq_certificates_number` (`certificate_no`),
  UNIQUE KEY `uq_certificates_verification` (`verification_code`),
  CONSTRAINT `fk_certificates_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `exam_courses`;
CREATE TABLE `exam_courses` (
  `course_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `course_code` varchar(50) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `exam_date` date DEFAULT NULL,
  `exam_time` varchar(50) DEFAULT NULL,
  `exam_location` varchar(255) DEFAULT NULL,
  `reg_open_date` date NOT NULL,
  `reg_close_date` date NOT NULL,
  `max_seats` int(10) unsigned NOT NULL,
  `max_attempts` tinyint(3) unsigned NOT NULL DEFAULT 3,
  `description` text DEFAULT NULL,
  `course_status` enum('ยังไม่เปิดรับสมัคร','เปิดรับสมัคร','ปิดรับสมัคร') NOT NULL DEFAULT 'ปิดรับสมัคร',
  `status_override` enum('เปิดรับสมัคร','ปิดรับสมัคร') DEFAULT NULL,
  `theory_max_score` decimal(5,2) NOT NULL DEFAULT 30.00,
  `practical_max_score` decimal(5,2) NOT NULL DEFAULT 70.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `uq_exam_courses_code` (`course_code`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`reg_open_date` <= `reg_close_date`),
  CONSTRAINT `CONSTRAINT_2` CHECK (`exam_date` is null or `reg_close_date` <= `exam_date`),
  CONSTRAINT `CONSTRAINT_3` CHECK (`max_seats` > 0),
  CONSTRAINT `CONSTRAINT_4` CHECK (`max_attempts` between 1 and 10),
  CONSTRAINT `CONSTRAINT_5` CHECK (`theory_max_score` > 0 and `practical_max_score` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `exam_sessions`;
CREATE TABLE `exam_sessions` (
  `session_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `session_name` varchar(100) NOT NULL,
  `exam_date` date NOT NULL,
  `location` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `uq_exam_sessions_slot` (`session_name`,`exam_date`,`location`),
  KEY `idx_exam_sessions_date` (`exam_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `notification_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `CONSTRAINT_1` CHECK (`is_read` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `registrations`;
CREATE TABLE `registrations` (
  `registration_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `course_id` int(10) unsigned NOT NULL,
  `session_id` int(10) unsigned DEFAULT NULL,
  `application_no` varchar(64) NOT NULL,
  `application_status` enum('รอดำเนินการ','อนุมัติสิทธิ์สอบ','ปฏิเสธเอกสาร') NOT NULL DEFAULT 'รอดำเนินการ',
  `attempt_no` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `is_retake` tinyint(1) NOT NULL DEFAULT 0,
  `retake_reason` varchar(255) DEFAULT NULL,
  `exam_status` enum('รอสอบ','เข้าสอบ','ขาดสอบ','ยกเลิก','ประกาศผลแล้ว') NOT NULL DEFAULT 'รอสอบ',
  `result_published_at` datetime DEFAULT NULL,
  `registered_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`registration_id`),
  UNIQUE KEY `uq_registrations_application` (`application_no`),
  UNIQUE KEY `uq_registrations_attempt` (`student_id`,`course_id`,`attempt_no`),
  KEY `idx_registrations_course_status` (`course_id`,`application_status`),
  KEY `idx_registrations_session` (`session_id`),
  KEY `idx_registrations_registered` (`registered_at`),
  CONSTRAINT `fk_registrations_course` FOREIGN KEY (`course_id`) REFERENCES `exam_courses` (`course_id`),
  CONSTRAINT `fk_registrations_session` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions` (`session_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_registrations_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `CONSTRAINT_1` CHECK (`attempt_no` >= 1),
  CONSTRAINT `CONSTRAINT_2` CHECK (`is_retake` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `report_logs`;
CREATE TABLE `report_logs` (
  `log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int(10) unsigned NOT NULL,
  `report_type` varchar(50) NOT NULL,
  `exported_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_report_logs_admin` (`admin_id`,`exported_at`),
  CONSTRAINT `fk_report_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `scores`;
CREATE TABLE `scores` (
  `score_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `registration_id` int(10) unsigned NOT NULL,
  `theory_score` decimal(5,2) NOT NULL,
  `practical_score` decimal(5,2) NOT NULL,
  `deducted_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `total_score` decimal(5,2) GENERATED ALWAYS AS (`theory_score` + `practical_score` - `deducted_score`) STORED,
  `university_status` varchar(20) GENERATED ALWAYS AS (case when `theory_score` + `practical_score` - `deducted_score` >= 50 then 'ผ่าน' else 'ไม่ผ่าน' end) STORED,
  `department_status` varchar(30) GENERATED ALWAYS AS (case when `theory_score` + `practical_score` - `deducted_score` >= 70 then 'ได้รับวุฒิบัตร' else 'ไม่ได้รับวุฒิบัตร' end) STORED,
  `examiner_id` int(10) unsigned NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`score_id`),
  UNIQUE KEY `uq_scores_registration` (`registration_id`),
  KEY `idx_scores_examiner` (`examiner_id`),
  CONSTRAINT `fk_scores_examiner` FOREIGN KEY (`examiner_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_scores_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE,
  CONSTRAINT `CONSTRAINT_1` CHECK (`theory_score` >= 0),
  CONSTRAINT `CONSTRAINT_2` CHECK (`practical_score` >= 0),
  CONSTRAINT `CONSTRAINT_3` CHECK (`deducted_score` >= 0 and `deducted_score` <= `theory_score` + `practical_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `score_audit_logs`;
CREATE TABLE `score_audit_logs` (
  `log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `registration_id` int(10) unsigned NOT NULL,
  `examiner_id` int(10) unsigned DEFAULT NULL,
  `action` enum('INSERT','UPDATE') NOT NULL,
  `old_theory` decimal(5,2) DEFAULT NULL,
  `old_practical` decimal(5,2) DEFAULT NULL,
  `old_deducted` decimal(5,2) DEFAULT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_theory` decimal(5,2) DEFAULT NULL,
  `new_practical` decimal(5,2) DEFAULT NULL,
  `new_deducted` decimal(5,2) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_score_audit_registration` (`registration_id`),
  KEY `idx_score_audit_changed` (`changed_at`),
  KEY `fk_score_audit_examiner` (`examiner_id`),
  CONSTRAINT `fk_score_audit_examiner` FOREIGN KEY (`examiner_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_score_audit_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `student_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `student_code` varchar(24) NOT NULL,
  `university_student_code` varchar(30) DEFAULT NULL,
  `title` varchar(20) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `id_card_number` varchar(13) NOT NULL,
  `birth_date` date NOT NULL,
  `gender` varchar(20) NOT NULL,
  `nationality` varchar(50) NOT NULL DEFAULT 'ไทย',
  `phone_number` varchar(15) NOT NULL,
  `avatar_path` varchar(255) DEFAULT NULL,
  `address_text` text NOT NULL,
  `highest_education` varchar(100) NOT NULL,
  `education_major` varchar(150) NOT NULL,
  `employment_status` varchar(50) NOT NULL,
  `applicant_type` varchar(50) DEFAULT NULL,
  `work_status` varchar(50) DEFAULT NULL,
  `current_occupation` varchar(150) DEFAULT NULL,
  `current_position` varchar(150) DEFAULT NULL,
  `work_experience_years` int(10) unsigned NOT NULL DEFAULT 0,
  `average_income` varchar(50) DEFAULT NULL,
  `industry_group` varchar(100) DEFAULT NULL,
  `monthly_income` varchar(20) DEFAULT NULL,
  `unemployed_type` varchar(100) DEFAULT NULL,
  `doc_id_card` varchar(255) NOT NULL,
  `doc_education` varchar(255) DEFAULT NULL,
  `doc_photo` varchar(255) DEFAULT NULL,
  `privacy_consent_at` datetime NOT NULL,
  `privacy_policy_version` varchar(20) NOT NULL DEFAULT '1.0',
  `registration_status` enum('รอตรวจสอบเอกสาร','เอกสารไม่ครบ','อนุมัติ') NOT NULL DEFAULT 'รอตรวจสอบเอกสาร',
  `verify_note` text DEFAULT NULL,
  `verified_by` int(10) unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `uq_students_user` (`user_id`),
  UNIQUE KEY `uq_students_code` (`student_code`),
  UNIQUE KEY `uq_students_id_card` (`id_card_number`),
  UNIQUE KEY `uq_students_university_code` (`university_student_code`),
  KEY `idx_students_status` (`registration_status`),
  KEY `fk_students_verifier` (`verified_by`),
  KEY `idx_students_created` (`created_at`),
  CONSTRAINT `fk_students_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_students_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `student_document_versions`;
CREATE TABLE `student_document_versions` (
  `document_version_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `document_type` enum('doc_id_card','doc_education','doc_photo') NOT NULL,
  `filename` varchar(255) NOT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`document_version_id`),
  UNIQUE KEY `uq_document_versions_filename` (`filename`),
  KEY `idx_document_versions_student` (`student_id`,`document_type`,`created_at`),
  KEY `fk_document_versions_uploader` (`uploaded_by`),
  CONSTRAINT `fk_document_versions_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_document_versions_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`is_current` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `student_verifications`;
CREATE TABLE `student_verifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `action` enum('อนุมัติ','เอกสารไม่ครบ') NOT NULL,
  `note` text DEFAULT NULL,
  `admin_id` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_student_verifications_student` (`student_id`,`created_at`),
  KEY `fk_student_verifications_admin` (`admin_id`),
  CONSTRAINT `fk_student_verifications_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_student_verifications_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('admin','staff','student') NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `token_version` int(10) unsigned NOT NULL DEFAULT 0,
  `email_verified_at` datetime DEFAULT NULL,
  `email_verification_token` char(64) DEFAULT NULL,
  `email_verification_expires` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_email_verification` (`email_verification_token`),
  KEY `idx_users_reset_token` (`reset_token`),
  KEY `idx_users_created` (`created_at`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`is_active` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
