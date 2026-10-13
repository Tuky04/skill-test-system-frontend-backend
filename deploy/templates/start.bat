@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [ไม่ผ่าน] ไม่พบ Node.js - ติดตั้ง Node.js 20 LTS ขึ้นไปจาก https://nodejs.org ก่อน
  pause
  exit /b 1
)
if not exist ".env" (
  echo [ไม่ผ่าน] ยังไม่มีไฟล์ app\.env - คัดลอก app\.env.example เป็น app\.env แล้วแก้ค่าให้ครบ
  pause
  exit /b 1
)

echo กำลังตรวจความพร้อมของระบบ...
node scripts\check-config.js
if errorlevel 1 (
  echo.
  echo แก้รายการ [ไม่ผ่าน] ด้านบนใน app\.env แล้วรันไฟล์นี้ใหม่
  pause
  exit /b 1
)

echo.
echo เปิดระบบแล้ว - กด Ctrl+C เพื่อหยุด
node server.js
pause
