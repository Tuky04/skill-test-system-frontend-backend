-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 15, 2026 at 08:35 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `skill_test_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_audit_logs`
--

CREATE TABLE `admin_audit_logs` (
  `log_id` bigint(20) UNSIGNED NOT NULL,
  `actor_id` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `target_type` varchar(50) NOT NULL,
  `target_id` varchar(64) NOT NULL,
  `details` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin_audit_logs`
--

INSERT INTO `admin_audit_logs` (`log_id`, `actor_id`, `action`, `target_type`, `target_id`, `details`, `created_at`) VALUES
(1, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_photo-4075c8491bc869e79e272f5b2f2c9ae3.jpg\"}', '2026-07-18 15:40:59'),
(2, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_id_card-11c9b82abc92214d7b6bbb55cdc3854e.jpg\"}', '2026-07-18 15:41:01'),
(3, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_education-a3df0072bc7514a3774dd45d2c0bb4f7.pdf\"}', '2026-07-18 15:41:03'),
(4, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_photo-4075c8491bc869e79e272f5b2f2c9ae3.jpg\"}', '2026-07-18 15:41:11'),
(5, 2, 'VERIFY_STUDENT_DOCUMENTS', 'student', '1', '{\"from\":\"รอตรวจสอบเอกสาร\",\"to\":\"อนุมัติ\"}', '2026-07-18 15:42:20'),
(6, 2, 'CHANGE_APPLICATION_STATUS', 'registration', '1', '{\"from\":\"รอดำเนินการ\",\"to\":\"อนุมัติสิทธิ์สอบ\"}', '2026-07-18 16:29:05'),
(7, 2, 'CHANGE_APPLICATION_STATUS', 'registration', '1', '{\"from\":\"อนุมัติสิทธิ์สอบ\",\"to\":\"อนุมัติสิทธิ์สอบ\"}', '2026-07-18 16:29:16'),
(8, 2, 'CHANGE_APPLICATION_STATUS', 'registration', '1', '{\"from\":\"อนุมัติสิทธิ์สอบ\",\"to\":\"อนุมัติสิทธิ์สอบ\"}', '2026-07-18 16:31:57'),
(9, 2, 'CHANGE_APPLICATION_STATUS', 'registration', '1', '{\"from\":\"อนุมัติสิทธิ์สอบ\",\"to\":\"รอดำเนินการ\"}', '2026-07-18 16:31:59'),
(10, 2, 'CHANGE_APPLICATION_STATUS', 'registration', '1', '{\"from\":\"รอดำเนินการ\",\"to\":\"อนุมัติสิทธิ์สอบ\"}', '2026-07-18 16:32:01'),
(11, 2, 'CHANGE_EXAM_STATUS', 'registration', '1', '{\"from\":\"รอสอบ\",\"to\":\"เข้าสอบ\"}', '2026-07-18 16:55:02'),
(12, 2, 'EXPORT_STUDENT_EXAM_DATA', 'report', 'registrations-2026-07-22', '{\"filters\":{\"date_type\":\"registered\",\"date_from\":\"\",\"date_to\":\"\",\"course_id\":null,\"session_id\":null,\"attempt_no\":null,\"application_status\":\"\",\"exam_status\":\"\",\"student_status\":\"\",\"result\":\"\",\"search\":\"\"},\"row_count\":1,\"include_sensitive\":false}', '2026-07-22 22:51:49'),
(13, 1, 'RESET_PASSWORD', 'user', '2', NULL, '2026-08-17 15:28:10'),
(14, 2, 'VIEW_STUDENT_PROFILE', 'student', '1', '{\"documents\":3,\"registrations\":1}', '2026-08-17 17:27:30'),
(15, 2, 'VIEW_STUDENT_PROFILE', 'student', '1', '{\"documents\":3,\"registrations\":1}', '2026-08-17 17:27:31'),
(16, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_id_card-11c9b82abc92214d7b6bbb55cdc3854e.jpg\"}', '2026-08-17 17:27:40'),
(17, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_education-a3df0072bc7514a3774dd45d2c0bb4f7.pdf\"}', '2026-08-17 17:27:45'),
(18, 2, 'VIEW_PRIVATE_DOCUMENT', 'student_user', '3', '{\"filename\":\"doc_photo-4075c8491bc869e79e272f5b2f2c9ae3.jpg\"}', '2026-08-17 17:27:50'),
(19, 2, 'VIEW_STUDENT_PROFILE', 'student', '1', '{\"documents\":3,\"registrations\":1}', '2026-08-17 17:28:28'),
(20, 2, 'VIEW_STUDENT_PROFILE', 'student', '1', '{\"documents\":3,\"registrations\":1}', '2026-08-17 17:28:29'),
(21, 2, 'VIEW_STUDENT_PROFILE', 'student', '1', '{\"documents\":3,\"registrations\":1}', '2026-08-17 17:49:41'),
(22, 2, 'VIEW_STUDENT_PROFILE', 'student', '1', '{\"documents\":3,\"registrations\":1}', '2026-08-17 17:49:41');

-- --------------------------------------------------------

--
-- Table structure for table `certificates`
--

CREATE TABLE `certificates` (
  `certificate_id` bigint(20) UNSIGNED NOT NULL,
  `registration_id` int(10) UNSIGNED NOT NULL,
  `certificate_no` varchar(64) NOT NULL,
  `verification_code` char(48) NOT NULL,
  `issue_version` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `issued_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_reason` varchar(255) DEFAULT NULL,
  `holder_name` varchar(150) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `total_score` decimal(5,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `certificates`
--

INSERT INTO `certificates` (`certificate_id`, `registration_id`, `certificate_no`, `verification_code`, `issue_version`, `issued_at`, `revoked_at`, `revoked_reason`, `holder_name`, `course_name`, `total_score`) VALUES
(1, 1, 'CERT-2569-00000001', '0e52cdf975b0ba7f1720e6de6a44ceb93c9c75025939a17f', 1, '2026-07-18 16:56:02', NULL, NULL, 'กฤติธี แท่นรัตน์', 'excel', 90.00);

-- --------------------------------------------------------

--
-- Table structure for table `exam_courses`
--

CREATE TABLE `exam_courses` (
  `course_id` int(10) UNSIGNED NOT NULL,
  `course_code` varchar(50) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `exam_date` date DEFAULT NULL,
  `exam_time` varchar(50) DEFAULT NULL,
  `exam_location` varchar(255) DEFAULT NULL,
  `reg_open_date` date NOT NULL,
  `reg_close_date` date NOT NULL,
  `max_seats` int(10) UNSIGNED NOT NULL,
  `max_attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 3,
  `description` text DEFAULT NULL,
  `course_status` enum('ยังไม่เปิดรับสมัคร','เปิดรับสมัคร','ปิดรับสมัคร') NOT NULL DEFAULT 'ปิดรับสมัคร',
  `status_override` enum('เปิดรับสมัคร','ปิดรับสมัคร') DEFAULT NULL,
  `theory_max_score` decimal(5,2) NOT NULL DEFAULT 30.00,
  `practical_max_score` decimal(5,2) NOT NULL DEFAULT 70.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `exam_courses`
--

INSERT INTO `exam_courses` (`course_id`, `course_code`, `course_name`, `exam_date`, `exam_time`, `exam_location`, `reg_open_date`, `reg_close_date`, `max_seats`, `max_attempts`, `description`, `course_status`, `status_override`, `theory_max_score`, `practical_max_score`, `created_at`) VALUES
(1, 'excel01', 'excel', '2026-07-18', '10.00 - 12.00', '2201', '2026-07-16', '2026-07-17', 30, 1, NULL, 'ปิดรับสมัคร', 'เปิดรับสมัคร', 30.00, 70.00, '2026-07-18 08:28:12');

-- --------------------------------------------------------

--
-- Table structure for table `exam_sessions`
--

CREATE TABLE `exam_sessions` (
  `session_id` int(10) UNSIGNED NOT NULL,
  `session_name` varchar(100) NOT NULL,
  `exam_date` date NOT NULL,
  `location` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `exam_sessions`
--

INSERT INTO `exam_sessions` (`session_id`, `session_name`, `exam_date`, `location`, `created_at`) VALUES
(1, 'excel01 10.00 - 12.00', '2026-07-22', '2201', '2026-07-18 09:25:27');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `notification_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`notification_id`, `user_id`, `type`, `title`, `message`, `is_read`, `link`, `created_at`) VALUES
(1, 3, 'doc_approved', '✅ เอกสารได้รับการอนุมัติ', 'เอกสารของรหัส STD-2569-000003 ผ่านการตรวจสอบแล้ว คุณสามารถสมัครสอบได้ทันที', 1, '/student-dashboard', '2026-07-18 15:42:20'),
(2, 3, 'exam_approved', '🎯 อนุมัติสิทธิ์เข้าสอบแล้ว', 'ใบสมัครสอบสาขา \"excel\" ได้รับการอนุมัติ กรุณาตรวจสอบบัตรเข้าห้องสอบ', 1, '/student-dashboard', '2026-07-18 16:29:05'),
(3, 3, 'exam_approved', '🎯 อนุมัติสิทธิ์เข้าสอบแล้ว', 'ใบสมัครสอบสาขา \"excel\" ได้รับการอนุมัติ กรุณาตรวจสอบบัตรเข้าห้องสอบ', 1, '/student-dashboard', '2026-07-18 16:29:16'),
(4, 3, 'exam_approved', '🎯 อนุมัติสิทธิ์เข้าสอบแล้ว', 'ใบสมัครสอบสาขา \"excel\" ได้รับการอนุมัติ กรุณาตรวจสอบบัตรเข้าห้องสอบ', 1, '/student-dashboard', '2026-07-18 16:31:57'),
(5, 3, 'exam_approved', '🎯 อนุมัติสิทธิ์เข้าสอบแล้ว', 'ใบสมัครสอบสาขา \"excel\" ได้รับการอนุมัติ กรุณาตรวจสอบบัตรเข้าห้องสอบ', 1, '/student-dashboard', '2026-07-18 16:32:01'),
(6, 3, 'score_released', '🏆 ผลสอบ: ผ่านการประเมิน!', 'ยินดีด้วย! คุณผ่านการทดสอบมาตรฐานสาขา \"excel\" สามารถดาวน์โหลดวุฒิบัตรได้แล้ว', 1, '/student-dashboard', '2026-07-18 16:55:16');

-- --------------------------------------------------------

--
-- Table structure for table `registrations`
--

CREATE TABLE `registrations` (
  `registration_id` int(10) UNSIGNED NOT NULL,
  `student_id` int(10) UNSIGNED NOT NULL,
  `course_id` int(10) UNSIGNED NOT NULL,
  `session_id` int(10) UNSIGNED DEFAULT NULL,
  `application_no` varchar(64) NOT NULL,
  `application_status` enum('รอดำเนินการ','อนุมัติสิทธิ์สอบ','ปฏิเสธเอกสาร') NOT NULL DEFAULT 'รอดำเนินการ',
  `attempt_no` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `is_retake` tinyint(1) NOT NULL DEFAULT 0,
  `retake_reason` varchar(255) DEFAULT NULL,
  `exam_status` enum('รอสอบ','เข้าสอบ','ขาดสอบ','ยกเลิก','ประกาศผลแล้ว') NOT NULL DEFAULT 'รอสอบ',
  `result_published_at` datetime DEFAULT NULL,
  `registered_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `registrations`
--

INSERT INTO `registrations` (`registration_id`, `student_id`, `course_id`, `session_id`, `application_no`, `application_status`, `attempt_no`, `is_retake`, `retake_reason`, `exam_status`, `result_published_at`, `registered_at`) VALUES
(1, 1, 1, 1, 'APP-8215AE62835531B9', 'อนุมัติสิทธิ์สอบ', 1, 0, NULL, 'ประกาศผลแล้ว', '2026-07-18 16:55:16', '2026-07-18 09:25:28');

-- --------------------------------------------------------

--
-- Table structure for table `report_logs`
--

CREATE TABLE `report_logs` (
  `log_id` bigint(20) UNSIGNED NOT NULL,
  `admin_id` int(10) UNSIGNED NOT NULL,
  `report_type` varchar(50) NOT NULL,
  `exported_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `report_logs`
--

INSERT INTO `report_logs` (`log_id`, `admin_id`, `report_type`, `exported_at`) VALUES
(1, 1, 'registrations', '2026-07-18 08:26:34'),
(2, 1, 'registrations', '2026-07-22 14:14:10'),
(3, 1, 'registrations', '2026-07-22 14:19:17'),
(4, 2, 'registrations_xlsx', '2026-07-22 15:51:49');

-- --------------------------------------------------------

--
-- Table structure for table `scores`
--

CREATE TABLE `scores` (
  `score_id` int(10) UNSIGNED NOT NULL,
  `registration_id` int(10) UNSIGNED NOT NULL,
  `theory_score` decimal(5,2) NOT NULL,
  `practical_score` decimal(5,2) NOT NULL,
  `deducted_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `total_score` decimal(5,2) GENERATED ALWAYS AS (`theory_score` + `practical_score` - `deducted_score`) STORED,
  `university_status` varchar(20) GENERATED ALWAYS AS (case when `theory_score` + `practical_score` - `deducted_score` >= 50 then 'ผ่าน' else 'ไม่ผ่าน' end) STORED,
  `department_status` varchar(30) GENERATED ALWAYS AS (case when `theory_score` + `practical_score` - `deducted_score` >= 70 then 'ได้รับวุฒิบัตร' else 'ไม่ได้รับวุฒิบัตร' end) STORED,
  `examiner_id` int(10) UNSIGNED NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

--
-- Dumping data for table `scores`
--

INSERT INTO `scores` (`score_id`, `registration_id`, `theory_score`, `practical_score`, `deducted_score`, `examiner_id`, `updated_at`) VALUES
(1, 1, 30.00, 60.00, 0.00, 2, '2026-07-18 09:55:16');

-- --------------------------------------------------------

--
-- Table structure for table `score_audit_logs`
--

CREATE TABLE `score_audit_logs` (
  `log_id` bigint(20) UNSIGNED NOT NULL,
  `registration_id` int(10) UNSIGNED NOT NULL,
  `examiner_id` int(10) UNSIGNED DEFAULT NULL,
  `action` enum('INSERT','UPDATE') NOT NULL,
  `old_theory` decimal(5,2) DEFAULT NULL,
  `old_practical` decimal(5,2) DEFAULT NULL,
  `old_deducted` decimal(5,2) DEFAULT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_theory` decimal(5,2) DEFAULT NULL,
  `new_practical` decimal(5,2) DEFAULT NULL,
  `new_deducted` decimal(5,2) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `score_audit_logs`
--

INSERT INTO `score_audit_logs` (`log_id`, `registration_id`, `examiner_id`, `action`, `old_theory`, `old_practical`, `old_deducted`, `old_status`, `new_theory`, `new_practical`, `new_deducted`, `new_status`, `changed_at`) VALUES
(1, 1, 2, 'INSERT', NULL, NULL, NULL, NULL, 30.00, 60.00, 0.00, 'ได้รับวุฒิบัตร', '2026-07-18 16:55:16');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `student_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
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
  `work_experience_years` int(10) UNSIGNED NOT NULL DEFAULT 0,
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
  `verified_by` int(10) UNSIGNED DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`student_id`, `user_id`, `student_code`, `university_student_code`, `title`, `full_name`, `id_card_number`, `birth_date`, `gender`, `nationality`, `phone_number`, `avatar_path`, `address_text`, `highest_education`, `education_major`, `employment_status`, `applicant_type`, `work_status`, `current_occupation`, `current_position`, `work_experience_years`, `average_income`, `industry_group`, `monthly_income`, `unemployed_type`, `doc_id_card`, `doc_education`, `doc_photo`, `privacy_consent_at`, `privacy_policy_version`, `registration_status`, `verify_note`, `verified_by`, `verified_at`, `created_at`) VALUES
(1, 3, 'STD-2569-000003', '368345221003', 'นาย', 'กฤติธี แท่นรัตน์', '1729900675110', '2004-12-18', 'ชาย', 'ไทย', '0935685772', NULL, '181/1 ต.ไผ่ขวาง อ.เมือง จ.สุพรรณบุรี', 'อนุปริญญา / ปวส.', 'คอมพิวเตอร์ธุรกิจ', 'นักเรียน/นักศึกษา', 'จากสถานศึกษา', 'นักเรียน/นักศึกษา', NULL, NULL, 0, NULL, NULL, NULL, NULL, 'doc_id_card-11c9b82abc92214d7b6bbb55cdc3854e.jpg', 'doc_education-a3df0072bc7514a3774dd45d2c0bb4f7.pdf', 'doc_photo-4075c8491bc869e79e272f5b2f2c9ae3.jpg', '2026-07-18 15:40:27', '1.0', 'อนุมัติ', NULL, 2, '2026-07-18 15:42:20', '2026-07-18 08:40:27');

-- --------------------------------------------------------

--
-- Table structure for table `student_document_versions`
--

CREATE TABLE `student_document_versions` (
  `document_version_id` bigint(20) UNSIGNED NOT NULL,
  `student_id` int(10) UNSIGNED NOT NULL,
  `document_type` enum('doc_id_card','doc_education','doc_photo') NOT NULL,
  `filename` varchar(255) NOT NULL,
  `uploaded_by` int(10) UNSIGNED NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `student_document_versions`
--

INSERT INTO `student_document_versions` (`document_version_id`, `student_id`, `document_type`, `filename`, `uploaded_by`, `is_current`, `created_at`) VALUES
(1, 1, 'doc_id_card', 'doc_id_card-11c9b82abc92214d7b6bbb55cdc3854e.jpg', 3, 1, '2026-07-18 15:40:27'),
(2, 1, 'doc_education', 'doc_education-a3df0072bc7514a3774dd45d2c0bb4f7.pdf', 3, 1, '2026-07-18 15:40:28'),
(3, 1, 'doc_photo', 'doc_photo-4075c8491bc869e79e272f5b2f2c9ae3.jpg', 3, 1, '2026-07-18 15:40:28');

-- --------------------------------------------------------

--
-- Table structure for table `student_verifications`
--

CREATE TABLE `student_verifications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` int(10) UNSIGNED NOT NULL,
  `action` enum('อนุมัติ','เอกสารไม่ครบ') NOT NULL,
  `note` text DEFAULT NULL,
  `admin_id` int(10) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `student_verifications`
--

INSERT INTO `student_verifications` (`id`, `student_id`, `action`, `note`, `admin_id`, `created_at`) VALUES
(1, 1, 'อนุมัติ', NULL, 2, '2026-07-18 15:42:20');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('admin','staff','student') NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `token_version` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `email_verified_at` datetime DEFAULT NULL,
  `email_verification_token` char(64) DEFAULT NULL,
  `email_verification_expires` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `password_hash`, `email`, `role`, `is_active`, `token_version`, `email_verified_at`, `email_verification_token`, `email_verification_expires`, `last_login`, `reset_token`, `reset_token_expires`, `created_at`) VALUES
(1, 'admin', '$2b$12$rnZy.saNAnFbROTMzwrYOeIFtbyRBKurbTopLxFgYjX7Ts.aVZiym', 'admin@example.com', 'admin', 1, 0, '2026-07-18 15:12:34', NULL, NULL, '2026-08-17 18:03:51', NULL, NULL, '2026-07-18 08:12:34'),
(2, 'staff01', '$2b$12$tK7P3gAi1MdCCi.Qwhjb4equgKGKVoyeA7zcoHyCbvPXJKVotY3LS', 'staff01@example.com', 'staff', 1, 2, '2026-07-18 15:24:42', NULL, NULL, '2026-08-17 17:49:10', NULL, NULL, '2026-07-18 08:24:42'),
(3, 'kittithee', '$2b$12$0lowy.s78s9AuxipVM1D9.d.iyvsoEV5836ux1aWk6fXyQs9VnzWG', 'kittithee07@gmail.com', 'student', 1, 0, '2026-07-18 16:24:52', NULL, NULL, '2026-08-17 17:50:27', NULL, NULL, '2026-07-18 08:40:27');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_audit_logs`
--
ALTER TABLE `admin_audit_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_admin_audit_actor` (`actor_id`,`created_at`),
  ADD KEY `idx_admin_audit_target` (`target_type`,`target_id`);

--
-- Indexes for table `certificates`
--
ALTER TABLE `certificates`
  ADD PRIMARY KEY (`certificate_id`),
  ADD UNIQUE KEY `uq_certificates_registration` (`registration_id`),
  ADD UNIQUE KEY `uq_certificates_number` (`certificate_no`),
  ADD UNIQUE KEY `uq_certificates_verification` (`verification_code`);

--
-- Indexes for table `exam_courses`
--
ALTER TABLE `exam_courses`
  ADD PRIMARY KEY (`course_id`),
  ADD UNIQUE KEY `uq_exam_courses_code` (`course_code`);

--
-- Indexes for table `exam_sessions`
--
ALTER TABLE `exam_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD UNIQUE KEY `uq_exam_sessions_slot` (`session_name`,`exam_date`,`location`),
  ADD KEY `idx_exam_sessions_date` (`exam_date`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `idx_notifications_user_read` (`user_id`,`is_read`,`created_at`);

--
-- Indexes for table `registrations`
--
ALTER TABLE `registrations`
  ADD PRIMARY KEY (`registration_id`),
  ADD UNIQUE KEY `uq_registrations_application` (`application_no`),
  ADD UNIQUE KEY `uq_registrations_attempt` (`student_id`,`course_id`,`attempt_no`),
  ADD KEY `idx_registrations_course_status` (`course_id`,`application_status`),
  ADD KEY `idx_registrations_session` (`session_id`);

--
-- Indexes for table `report_logs`
--
ALTER TABLE `report_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_report_logs_admin` (`admin_id`,`exported_at`);

--
-- Indexes for table `scores`
--
ALTER TABLE `scores`
  ADD PRIMARY KEY (`score_id`),
  ADD UNIQUE KEY `uq_scores_registration` (`registration_id`),
  ADD KEY `idx_scores_examiner` (`examiner_id`);

--
-- Indexes for table `score_audit_logs`
--
ALTER TABLE `score_audit_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_score_audit_registration` (`registration_id`),
  ADD KEY `idx_score_audit_changed` (`changed_at`),
  ADD KEY `fk_score_audit_examiner` (`examiner_id`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `uq_students_user` (`user_id`),
  ADD UNIQUE KEY `uq_students_code` (`student_code`),
  ADD UNIQUE KEY `uq_students_id_card` (`id_card_number`),
  ADD UNIQUE KEY `uq_students_university_code` (`university_student_code`),
  ADD KEY `idx_students_status` (`registration_status`),
  ADD KEY `fk_students_verifier` (`verified_by`);

--
-- Indexes for table `student_document_versions`
--
ALTER TABLE `student_document_versions`
  ADD PRIMARY KEY (`document_version_id`),
  ADD UNIQUE KEY `uq_document_versions_filename` (`filename`),
  ADD KEY `idx_document_versions_student` (`student_id`,`document_type`,`created_at`),
  ADD KEY `fk_document_versions_uploader` (`uploaded_by`);

--
-- Indexes for table `student_verifications`
--
ALTER TABLE `student_verifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_verifications_student` (`student_id`,`created_at`),
  ADD KEY `fk_student_verifications_admin` (`admin_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `uq_users_username` (`username`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD KEY `idx_users_email_verification` (`email_verification_token`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_audit_logs`
--
ALTER TABLE `admin_audit_logs`
  MODIFY `log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `certificates`
--
ALTER TABLE `certificates`
  MODIFY `certificate_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `exam_courses`
--
ALTER TABLE `exam_courses`
  MODIFY `course_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `exam_sessions`
--
ALTER TABLE `exam_sessions`
  MODIFY `session_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `notification_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `registrations`
--
ALTER TABLE `registrations`
  MODIFY `registration_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `report_logs`
--
ALTER TABLE `report_logs`
  MODIFY `log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `scores`
--
ALTER TABLE `scores`
  MODIFY `score_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `score_audit_logs`
--
ALTER TABLE `score_audit_logs`
  MODIFY `log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `student_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `student_document_versions`
--
ALTER TABLE `student_document_versions`
  MODIFY `document_version_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_verifications`
--
ALTER TABLE `student_verifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_audit_logs`
--
ALTER TABLE `admin_audit_logs`
  ADD CONSTRAINT `fk_admin_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `certificates`
--
ALTER TABLE `certificates`
  ADD CONSTRAINT `fk_certificates_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `registrations`
--
ALTER TABLE `registrations`
  ADD CONSTRAINT `fk_registrations_course` FOREIGN KEY (`course_id`) REFERENCES `exam_courses` (`course_id`),
  ADD CONSTRAINT `fk_registrations_session` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions` (`session_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_registrations_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE;

--
-- Constraints for table `report_logs`
--
ALTER TABLE `report_logs`
  ADD CONSTRAINT `fk_report_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `scores`
--
ALTER TABLE `scores`
  ADD CONSTRAINT `fk_scores_examiner` FOREIGN KEY (`examiner_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_scores_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE;

--
-- Constraints for table `score_audit_logs`
--
ALTER TABLE `score_audit_logs`
  ADD CONSTRAINT `fk_score_audit_examiner` FOREIGN KEY (`examiner_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_score_audit_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE;

--
-- Constraints for table `students`
--
ALTER TABLE `students`
  ADD CONSTRAINT `fk_students_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_students_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_document_versions`
--
ALTER TABLE `student_document_versions`
  ADD CONSTRAINT `fk_document_versions_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_document_versions_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `student_verifications`
--
ALTER TABLE `student_verifications`
  ADD CONSTRAINT `fk_student_verifications_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_student_verifications_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
