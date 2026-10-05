USE skill_test_system;

-- ดัชนีสำหรับคำสั่งที่ระบบใช้บ่อยและจะช้าลงเมื่อข้อมูลโตขึ้น (ปลอดภัย รันซ้ำได้)
-- ตรวจสอบก่อนรันกับฐานจริง: SHOW INDEX FROM <table>;

-- ลืมรหัสผ่าน/ตั้งรหัสใหม่ค้นด้วย reset_token ซึ่งเดิมไม่มีดัชนี (สแกนทั้งตาราง users ทุกคำขอ)
ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_users_reset_token (reset_token),
  ADD INDEX IF NOT EXISTS idx_users_created (created_at);

-- รายการใบสมัครของเจ้าหน้าที่ เรียงตามวันที่สมัครล่าสุด
ALTER TABLE registrations
  ADD INDEX IF NOT EXISTS idx_registrations_registered (registered_at);

-- รายการนักศึกษาเรียงตามวันที่สร้าง
ALTER TABLE students
  ADD INDEX IF NOT EXISTS idx_students_created (created_at);

-- หน้า Audit Log เรียงตามเวลาล่าสุดทั้งระบบ (ดัชนีเดิมเริ่มด้วย actor_id จึงใช้เรียงรวมไม่ได้)
ALTER TABLE admin_audit_logs
  ADD INDEX IF NOT EXISTS idx_admin_audit_created (created_at);
