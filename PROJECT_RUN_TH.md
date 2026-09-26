# วิธีเปิดระบบสำหรับนำเสนอโปรเจกต์

1. เปิด XAMPP Control Panel แล้ว Start `Apache` และ `MySQL`
2. ดับเบิลคลิก `START_PROJECT.bat` ที่โฟลเดอร์ `skill-test-system`
3. เปิด `http://localhost/skill-test-system/`

`START_PROJECT.bat` จะเปิด Backend เฉพาะเมื่อพอร์ต 5000 ยังไม่ทำงาน และเปิดหน้าเว็บที่ Build แล้วให้โดยอัตโนมัติ

## จุดตรวจสอบ

- Backend: `http://127.0.0.1:5000/health` ต้องแสดงสถานะ `ok`
- Frontend: `http://localhost/skill-test-system/`
- ไฟล์เอกสารจริงอยู่ที่ `D:/Xampp/skill-test-system-data/private_uploads` ซึ่งอยู่นอก `htdocs`
- Log ของ Backend อยู่ที่ `D:/Xampp/skill-test-system-data/logs`

## ข้อจำกัดของโหมดโปรเจกต์

- ใช้ HTTP และ localhost เท่านั้น ยังไม่ใช่การติดตั้งสำหรับอินเทอร์เน็ตจริง
- Backend รับการเชื่อมต่อเฉพาะ `127.0.0.1`
- หากเปลี่ยน source ของ Frontend ต้องรัน `npm run build` แล้วนำโฟลเดอร์ `build` มาใช้ใหม่
- ไม่ควรใช้ `npm audit fix --force` เพราะอาจทำให้ `react-scripts` เสีย
