# แผนสำรองและกู้คืน

DB และ `backend/private_uploads` ต้องสำรองเป็นชุดเวลาเดียวกันและเข้ารหัส ห้ามเก็บรหัสผ่านไว้ในคำสั่งหรือชื่อไฟล์ ให้ใช้ protected option file/secret manager ของระบบปฏิบัติการ

## นโยบายตัวอย่าง

- DB incremental/binlog ต่อเนื่อง และ full backup รายวัน
- private uploads สำรองรายวันแบบ versioned
- เก็บอย่างน้อย 3 สำเนา บนสื่อ 2 ชนิด และ 1 สำเนาอยู่นอกสถานที่/immutable
- จำกัดสิทธิ์ backup ตาม least privilege และทดสอบเปิดไฟล์จริงเป็นระยะ
- กำหนด RPO/RTO โดยเจ้าของระบบ เช่น RPO 24 ชั่วโมง และ RTO 4 ชั่วโมง

## Restore drill รายไตรมาส

1. เลือก backup แบบสุ่มและกู้เข้าเครือข่ายทดสอบที่แยกจาก production
2. ตรวจ checksum/decryption แล้ว import DB
3. restore private uploads และตรวจชื่อไฟล์ที่ DB อ้างถึงแบบสุ่ม
4. deploy source รุ่นเดียวกับ backup
5. ทดสอบ login, เอกสาร, สมัครสอบ, คะแนน, รายงาน และใบรับรอง
6. บันทึกเวลาที่ใช้ ข้อมูลสูญหาย ปัญหาที่พบ และผู้อนุมัติผล
7. ทำลายข้อมูลทดสอบอย่างปลอดภัยเมื่อ drill เสร็จ

Backup ที่ไม่เคย restore สำเร็จยังไม่ถือว่าเป็น backup ที่เชื่อถือได้

