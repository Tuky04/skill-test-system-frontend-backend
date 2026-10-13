#!/usr/bin/env bash
# เปิดระบบ (Linux/macOS):  ./start.sh
set -e
cd "$(dirname "$0")/app"

command -v node >/dev/null 2>&1 || { echo "[ไม่ผ่าน] ไม่พบ Node.js (ต้องใช้ v20 ขึ้นไป)"; exit 1; }
[ -f .env ] || { echo "[ไม่ผ่าน] ยังไม่มีไฟล์ app/.env — คัดลอก app/.env.example เป็น app/.env แล้วแก้ค่าให้ครบ"; exit 1; }

echo "กำลังตรวจความพร้อมของระบบ..."
node scripts/check-config.js || { echo; echo "แก้รายการ [ไม่ผ่าน] ด้านบนใน app/.env แล้วรันใหม่"; exit 1; }

echo
echo "เปิดระบบแล้ว — กด Ctrl+C เพื่อหยุด"
exec node server.js
