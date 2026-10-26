USE skill_test_system;

-- ค่าสมัครสอบ: 1 ใบสมัคร (registrations) มี 1 รายการชำระ (payments)
-- ผู้สมัครแนบสลิป -> เจ้าหน้าที่ตรวจ -> อนุมัติสิทธิ์สอบได้เมื่อสถานะเป็น 'ชำระแล้ว' (ไม่มีการคืนเงิน สอบซ่อมต้องชำระใหม่)
CREATE TABLE IF NOT EXISTS `payments` (
  `payment_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `registration_id` int(10) unsigned NOT NULL,
  `amount` decimal(8,2) NOT NULL,
  `payment_status` enum('รอชำระเงิน','รอตรวจสลิป','ชำระแล้ว','สลิปไม่ผ่าน') NOT NULL DEFAULT 'รอชำระเงิน',
  `slip_filename` varchar(255) DEFAULT NULL,
  `slip_hash` char(64) DEFAULT NULL,
  `transfer_ref` varchar(64) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `verified_by` int(10) unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `verify_note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `uq_payments_registration` (`registration_id`),
  UNIQUE KEY `uq_payments_slip_hash` (`slip_hash`),
  KEY `idx_payments_status` (`payment_status`,`submitted_at`),
  KEY `idx_payments_slip_filename` (`slip_filename`),
  CONSTRAINT `fk_payments_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `CONSTRAINT_1` CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ใบสมัครเดิมที่สมัครไว้ก่อนเริ่มเก็บค่าสมัคร: ถือว่าไม่ต้องชำระ (ยอด 0) เพื่อไม่ให้ใบสมัครที่อนุมัติไปแล้วถูกบล็อก
INSERT INTO payments (registration_id, amount, payment_status, verify_note, verified_at)
SELECT r.registration_id, 0.00, 'ชำระแล้ว', 'ใบสมัครก่อนเริ่มเก็บค่าสมัคร', NOW()
FROM registrations r
LEFT JOIN payments p ON p.registration_id = r.registration_id
WHERE p.registration_id IS NULL;
