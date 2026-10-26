// ค่าสมัครสอบและข้อมูลบัญชีรับเงิน อ่านจากตัวแปรสภาพแวดล้อม (ปล่อยว่างได้: ระบบจะแจ้งผู้สมัครว่ายังไม่ได้ตั้งค่าบัญชี)
function feeAmount() {
    const value = Number(process.env.PAYMENT_AMOUNT ?? 100);
    // จำกัดช่วงค่าเพื่อกันตั้งค่าผิด (เช่น ติดลบหรือใส่เลขบัตรลงไป)
    if (!Number.isFinite(value) || value < 0 || value > 100000) return 100;
    return Math.round(value * 100) / 100;
}

function text(name) {
    return String(process.env[name] || '').trim().slice(0, 120);
}

function paymentInfo() {
    const info = {
        amount: feeAmount(),
        account_name: text('PAYMENT_ACCOUNT_NAME'),
        bank_name: text('PAYMENT_BANK_NAME'),
        account_no: text('PAYMENT_ACCOUNT_NO'),
        promptpay_id: text('PAYMENT_PROMPTPAY_ID'),
        note: text('PAYMENT_NOTE'),
    };
    info.configured = Boolean(info.account_name && (info.account_no || info.promptpay_id));
    return info;
}

module.exports = { feeAmount, paymentInfo };
