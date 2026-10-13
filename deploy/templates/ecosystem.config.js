// ใช้กับ pm2 (รันเป็นบริการเบื้องหลัง รีสตาร์ตเองเมื่อล่ม และหลังรีบูตเครื่อง)
//   npm i -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup        (Linux: รันคำสั่งที่มันพิมพ์ให้)
//   Windows: ใช้ NSSM แทน (ดู README_TH.md หัวข้อ "รันเป็นบริการ")
module.exports = {
    apps: [{
        name: 'skilltest',
        script: 'server.js',
        cwd: `${__dirname}/app`,
        // ส่งออก Excel ใช้ worker thread แยก แต่ถ้าหน่วยความจำของโปรเซสหลักบวมผิดปกติให้รีสตาร์ต
        max_memory_restart: '1500M',
        env: { NODE_ENV: 'production' },
    }],
};
