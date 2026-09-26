require('dotenv').config();

const { verifySmtpConnection, sendTestEmail } = require('../utils/emailService');

async function main() {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter((name) => !String(process.env[name] || '').trim());
    if (missing.length) {
        throw new Error(`กรุณากำหนดค่าใน .env ให้ครบ: ${missing.join(', ')}`);
    }

    const recipient = String(process.env.TEST_EMAIL_TO || process.env.SMTP_USER).trim();
    console.log(`กำลังตรวจสอบการเชื่อมต่อ SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})...`);
    await verifySmtpConnection();
    console.log('เชื่อมต่อ SMTP สำเร็จ กำลังส่งอีเมลทดสอบ...');
    const result = await sendTestEmail(recipient);
    console.log(`ส่งอีเมลทดสอบสำเร็จไปที่ ${recipient}`);
    if (result.messageId) console.log(`Message ID: ${result.messageId}`);
}

main().catch((error) => {
    console.error(`ทดสอบอีเมลไม่สำเร็จ: ${error.message}`);
    process.exitCode = 1;
});
