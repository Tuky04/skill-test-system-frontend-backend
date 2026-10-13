# คู่มือติดตั้งระบบทดสอบมาตรฐานฝีมือแรงงาน (แพ็กเกจพร้อมขึ้นเซิร์ฟเวอร์)

แพ็กเกจนี้รันเป็น **โปรเซสเดียว พอร์ตเดียว** — backend (Node.js) เสิร์ฟทั้งหน้าเว็บและ API ไม่ต้องติดตั้ง Apache/Nginx/XAMPP
ติดตั้งบนเครื่องของสถานศึกษาหรือเครื่องส่วนตัวด้วยขั้นตอนเดียวกัน ต่างกันแค่ค่าในไฟล์ `app/.env`

## สิ่งที่ต้องมีบนเครื่องเซิร์ฟเวอร์
| รายการ | รายละเอียด |
|---|---|
| Node.js | เวอร์ชัน **20 LTS ขึ้นไป** (ดาวน์โหลด https://nodejs.org) ตรวจด้วย `node -v` |
| ฐานข้อมูล | **MariaDB 10.4+** หรือ MySQL 8 (ต้องมีผู้ดูแลฐานข้อมูลสร้างผู้ใช้ให้) |
| พอร์ต | พอร์ตว่างที่สถานศึกษากำหนด เช่น 8080 |
| อีเมล (SMTP) | บัญชีส่งอีเมลขององค์กร สำหรับลิงก์ยืนยันอีเมล/ลืมรหัสผ่าน/แจ้งผลสอบ |
| หน่วยความจำ | แนะนำ RAM ว่างอย่างน้อย 2 GB (การส่งออก Excel จำนวนมากใช้หน่วยความจำ) |

## โครงสร้างโฟลเดอร์
```
skill-test-system-deploy/
├─ app/                   โค้ด backend (+ node_modules ครบแล้ว ไม่ต้อง npm install)
│  ├─ .env.example        ตัวอย่างค่าตั้งค่า → คัดลอกเป็น .env
│  └─ scripts/            create-admin, create-staff, check-config, purge-unverified ...
├─ web/                   หน้าเว็บที่ build แล้ว (backend เสิร์ฟให้เอง)
├─ database/
│  ├─ skill_test_system.sql   โครงสร้างฐานข้อมูลเปล่า (ไม่มีข้อมูลบุคคล)
│  └─ migrations/             สคริปต์อัปเกรดฐานข้อมูลเดิม (ติดตั้งใหม่ไม่ต้องรัน)
├─ data/                  (สร้างอัตโนมัติ) ที่เก็บไฟล์เอกสารที่นักศึกษาอัปโหลด
├─ start.bat / start.sh   เปิดระบบ (Windows / Linux)
├─ ecosystem.config.js    ตั้งค่า pm2 (รันเป็นบริการ)
├─ nginx.conf.example     ตัวอย่างใส่ HTTPS ด้วย Nginx
└─ README_TH.md           ไฟล์นี้
```

## ขั้นตอนติดตั้ง

### 1) สร้างฐานข้อมูล (ผู้ดูแลฐานข้อมูลทำ)
เข้า MariaDB/MySQL ด้วยผู้ใช้ที่มีสิทธิ์สูง (เช่น root) แล้วรัน:
```sql
SOURCE /path/to/skill-test-system-deploy/database/skill_test_system.sql;
CREATE USER 'skill_test_app'@'localhost' IDENTIFIED BY 'ตั้งรหัสผ่านยาวและเดายาก';
GRANT SELECT, INSERT, UPDATE, DELETE ON skill_test_system.* TO 'skill_test_app'@'localhost';
FLUSH PRIVILEGES;
```
หรือผ่าน phpMyAdmin: แท็บ Import → เลือกไฟล์ `database/skill_test_system.sql` แล้วสร้างผู้ใช้ตามข้างบน
ผู้ใช้ของแอปไม่ต้องมีสิทธิ์ `DROP/ALTER` (ไม่ควรให้ใช้ `root`)

### 2) ตั้งค่า
1. คัดลอก `app/.env.example` เป็น `app/.env`
2. แก้ค่าอย่างน้อยเหล่านี้ (คำอธิบายอยู่ในไฟล์):
   - `PORT` — พอร์ตที่สถานศึกษากำหนด
   - `PUBLIC_APP_URL` — ที่อยู่ที่ผู้ใช้พิมพ์เข้ามาจริง เช่น `http://10.1.2.3:8080`
   - `COOKIE_SECURE` — `false` ถ้าเข้าผ่าน HTTP, `true` ถ้าเข้าผ่าน HTTPS
   - `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` — ค่าสุ่มคนละค่า สร้างด้วย
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `SMTP_*`, `STAFF_EMAIL`

### 3) ตรวจความพร้อม
```
cd app
npm run check-config
```
ต้องไม่มีรายการ **[ไม่ผ่าน]** (ตรวจ Node, กุญแจลับ, พอร์ต, ฐานข้อมูล/ตาราง, ที่เก็บไฟล์, อีเมล) และจะไม่แสดงรหัสผ่านใดๆ

### 4) สร้างบัญชีผู้ดูแลระบบและเจ้าหน้าที่ (ทำครั้งเดียว)
ใส่ `ADMIN_INITIAL_PASSWORD` (ยาวอย่างน้อย 12 ตัวอักษร) ใน `app/.env` แล้วรัน
```
cd app
npm run create-admin
npm run create-staff      # ตั้ง STAFF_INITIAL_PASSWORD ก่อนเช่นกัน
```
จากนั้น **ลบรหัสผ่านเริ่มต้นออกจาก `app/.env`**

### 5) เปิดระบบ
- Windows: ดับเบิลคลิก `start.bat`
- Linux: `./start.sh`

เปิดเบราว์เซอร์ที่ `http://<ที่อยู่เครื่อง>:<PORT>/` ตรวจว่าระบบทำงาน: `http://<ที่อยู่เครื่อง>:<PORT>/health` ต้องได้ `{"status":"ok"}`

### 6) เปิดพอร์ตให้เครื่องอื่นเข้าได้
ต้องตั้ง `HOST=0.0.0.0` ใน `.env` และเปิดไฟร์วอลล์ (ให้ฝ่ายเครือข่ายตรวจว่าเครือข่ายภายในอนุญาตพอร์ตนี้ด้วย)
```
# Windows (เปิด PowerShell แบบ Administrator)
netsh advfirewall firewall add rule name="SkillTest" dir=in action=allow protocol=TCP localport=8080

# Linux (ufw)
sudo ufw allow 8080/tcp
```
(เปลี่ยน 8080 ให้ตรงกับ `PORT`) ห้ามเปิดพอร์ตฐานข้อมูล (3306) สู่ภายนอก

## รันเป็นบริการ (ไม่ต้องเปิดหน้าต่างค้างไว้ และเปิดเองหลังรีบูต)

**Windows — NSSM** (https://nssm.cc): เปิด Command Prompt แบบ Administrator
```
nssm install SkillTest "C:\Program Files\nodejs\node.exe" server.js
nssm set SkillTest AppDirectory "C:\skill-test-system-deploy\app"
nssm set SkillTest AppStdout "C:\skill-test-system-deploy\data\app.log"
nssm set SkillTest AppStderr "C:\skill-test-system-deploy\data\app.log"
nssm start SkillTest
```
**Linux — pm2:** `npm i -g pm2 && pm2 start ecosystem.config.js && pm2 save && pm2 startup` (รันคำสั่งที่ pm2 พิมพ์ให้ต่อ)

## ใช้ HTTP หรือ HTTPS ดี?
- **ข้อมูลที่ระบบเก็บมีเลขบัตรประชาชนและสำเนาบัตร ควรใช้ HTTPS** ถ้าสถานศึกษามีโดเมนและใบรับรอง ให้ตั้ง Nginx/Apache ด้านหน้า (ดู `nginx.conf.example`) และใน `.env` ตั้ง `HOST=127.0.0.1`, `TRUST_PROXY_HOPS=1`, `COOKIE_SECURE=true`, `PUBLIC_APP_URL=https://...`
- ถ้าให้เปิดแบบ HTTP บนพอร์ตภายในเท่านั้น ให้ตั้ง `COOKIE_SECURE=false` และใช้เฉพาะในเครือข่ายภายในที่เชื่อถือได้ (ไม่ใช่อินเทอร์เน็ตสาธารณะ)

## งานดูแลประจำ
- **สำรองข้อมูลทุกวัน (สำคัญ):** ฐานข้อมูล `mysqldump --single-transaction skill_test_system > backup.sql` และโฟลเดอร์ `data/private_uploads` ให้ **เป็นชุดเวลาเดียวกัน** เก็บอย่างน้อยหนึ่งชุดไว้นอกเครื่อง และลองกู้คืนจริงเป็นระยะ
- ลบบัญชีที่สมัครแล้วไม่ยืนยันอีเมลเกิน 7 วัน (รันทุกสัปดาห์): `npm run purge-unverified` (ดูจำนวนก่อน) แล้ว `npm run purge-unverified -- --apply`
- อัปเดตระบบ: หยุดระบบ → สำรองข้อมูล → แทนที่โฟลเดอร์ `app` และ `web` ด้วยชุดใหม่ (**คงไฟล์ `app/.env` และโฟลเดอร์ `data` ไว้**) → ถ้ามีไฟล์ใหม่ใน `database/migrations` ให้รันตามลำดับเลข → `npm run check-config` → เปิดระบบ
- ติดตามสถานะ: `/health` ใช้ตั้งระบบเฝ้าระวังได้, ข้อผิดพลาดดูจากหน้าต่างที่รันอยู่หรือไฟล์ log ของบริการ

## แก้ปัญหาที่พบบ่อย
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `JWT_SECRET ต้องกำหนดเป็นค่าสุ่ม...` | ยังไม่ได้ตั้ง/ยังเป็นค่าตัวอย่างใน `app/.env` |
| `EADDRINUSE` | พอร์ตถูกใช้อยู่ เปลี่ยน `PORT` หรือปิดโปรแกรมที่ใช้พอร์ตนั้น |
| หน้าเว็บขึ้น "Cannot GET /" หรือข้อความ `Skill Test System API` | `FRONTEND_DIR` ไม่ถูกต้อง (ต้องชี้ไปโฟลเดอร์ `web`) |
| เข้าได้จากเครื่องนี้แต่เครื่องอื่นเข้าไม่ได้ | `HOST` ยังเป็น `127.0.0.1` หรือไฟร์วอลล์ยังไม่เปิดพอร์ต |
| ล็อกอินได้แต่ถูกเด้งออกทุก 15 นาที | เข้าผ่าน HTTP แต่ `COOKIE_SECURE=true` ให้ตั้งเป็น `false` |
| สมัครแล้วเข้าสู่ระบบไม่ได้ ขึ้น "กรุณายืนยันอีเมลก่อน" | อีเมลส่งไม่ออก ตรวจ `SMTP_*` ด้วย `npm run check-config` และ `npm run test-email` |
| ลิงก์ในอีเมลเปิดไม่ได้ | `PUBLIC_APP_URL` ไม่ตรงกับที่อยู่ที่ผู้ใช้เข้าจริง |
| ขึ้น "พยายามเข้าสู่ระบบมากเกินไป" ทั้งที่ล็อกอินครั้งแรก | อยู่หลัง Nginx แต่ `TRUST_PROXY_HOPS=0` (ทุกคนถูกนับเป็น IP เดียวกัน) ให้ตั้งเป็น `1` |
| `ECONNREFUSED` / `Access denied` ของฐานข้อมูล | `DB_*` ผิด หรือผู้ใช้ฐานข้อมูลยังไม่มีสิทธิ์ ดูขั้นตอนที่ 1 |

## ความปลอดภัย (ผู้ดูแลต้องทราบ)
- ไฟล์ใน `data/private_uploads` เป็นเอกสารส่วนบุคคล ตั้งสิทธิ์ให้เฉพาะบัญชีที่รันระบบอ่านเขียนได้ และสำรองแบบเข้ารหัส
- ระบบเก็บข้อมูลส่วนบุคคลตาม PDPA: ต้องมีผู้ควบคุมข้อมูล ประกาศความเป็นส่วนตัว และระยะเวลาเก็บข้อมูลที่ได้รับอนุมัติ ก่อนใช้งานกับข้อมูลจริง
- ใช้ฐานข้อมูลคนละชุดสำหรับทดสอบและใช้งานจริง และอย่านำข้อมูลนักศึกษาจริงไปทดสอบ
