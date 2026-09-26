# คู่มือติดตั้งและเปิดใช้งาน

## ความต้องการขั้นต่ำ

- Node.js LTS และ npm
- MariaDB 10.4+ หรือ MySQL รุ่นที่รองรับ generated columns/check constraints
- HTTPS reverse proxy เช่น Apache/Nginx และ SMTP ขององค์กร
- ผู้ใช้ฐานข้อมูลเฉพาะแอปที่มีสิทธิ์เฉพาะฐาน `skill_test_system`

## ติดตั้งใหม่

1. สำรองระบบเดิมก่อนทุกครั้ง
2. import `skill_test_system.sql`
3. สร้าง DB user เฉพาะแอป ห้ามใช้ `root`
4. Backend: คัดลอก `.env.example` เป็น `.env` และตั้งค่าจริง
5. สร้าง `JWT_SECRET` และ `JWT_REFRESH_SECRET` คนละค่า ยาวอย่างน้อย 32 ตัวอักษรแบบสุ่ม
6. Backend: รัน `npm ci`, `npm test`, `npm run create-admin`, `npm start`
7. Frontend: คัดลอก `.env.example` เป็น `.env`, ตั้ง `REACT_APP_API_URL`, รัน `npm ci` และ `npm run build`
8. ตั้ง reverse proxy ให้ frontend และ API ใช้ origin ที่กำหนดใน `CORS_ORIGINS`
9. ทดสอบ `GET /health` ต้องได้ `{"status":"ok"}`

ห้ามนำค่าใน `.env.example` ไปใช้จริง และหลังสร้าง admin ต้องลบ `ADMIN_INITIAL_PASSWORD` ออกจาก `.env`

## ค่าที่ต้องตรวจใน production

- `NODE_ENV=production`
- `PUBLIC_APP_URL=https://ชื่อโดเมนจริง`
- `CORS_ORIGINS` ระบุ origin จริงเท่านั้น ไม่ใช้ `*`
- `TRUST_PROXY_HOPS` ตรงจำนวน proxy ด้านหน้า เพื่อให้ rate limit ใช้ IP ถูกต้อง
- SMTP ใช้บัญชีส่งอีเมลเฉพาะระบบ
- `private_uploads` อยู่นอก web root, backup แบบเข้ารหัส และให้ process ของแอปอ่านเขียนได้เท่านั้น
- ปิด directory listing และบังคับ HTTPS/HSTS ที่ reverse proxy

## Checklist ก่อนเปิดระบบ

- เปลี่ยน DB/JWT/SMTP credentials ที่เคยอยู่ในไฟล์เดิมทั้งหมด
- ไม่มี `.env`, SQL dump ที่มีข้อมูลจริง, `uploads`, `node_modules` ใน artifact/repository
- ทดสอบทุก role: admin, staff, student และกรณีไม่มีสิทธิ์
- ทดสอบอีเมลยืนยัน/ลืมรหัสผ่านด้วย SMTP จริง
- ทดสอบรับสมัครพร้อมกันจนเต็มจำนวนที่นั่ง
- ทดสอบ backup และ restore ตาม `BACKUP_RESTORE.md`
- ตั้ง log collection/alert สำหรับ HTTP 5xx, health failure, disk usage และการส่งอีเมลล้มเหลว
- ทำ dependency/security scan ใน CI ขององค์กร

## Rollback

ก่อน deploy ให้เก็บ zip source รุ่นก่อน, database dump และสำเนา `private_uploads` ที่เวลาเดียวกัน หากต้อง rollback ให้หยุดรับคำขอใหม่, restore DB+files เป็นคู่, deploy source รุ่นก่อน แล้วตรวจ health/login/เอกสาร/คะแนนก่อนเปิด traffic

