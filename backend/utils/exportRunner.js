const path = require('path');
const { Worker } = require('worker_threads');
const { HttpError } = require('./domain');

// สร้างไฟล์ส่งออกใน worker thread และจำกัดจำนวนงานที่ทำพร้อมกัน
// วัดจริงที่ 50,000 แถว: main thread ค้าง ~7 วินาที ใช้ heap +650 MB — ผู้ใช้ทุกคนจะได้รับผลกระทบถ้าทำบน main thread
const MAX_CONCURRENT = Math.max(1, Number(process.env.EXPORT_MAX_CONCURRENT) || 2);
const WORKER_MEMORY_MB = Math.max(256, Number(process.env.EXPORT_WORKER_MEMORY_MB) || 1536);
const TIMEOUT_MS = Math.max(10000, Number(process.env.EXPORT_TIMEOUT_MS) || 120000);

let running = 0;

function buildWorkbookBuffer(rows, filters, options = {}) {
    if (running >= MAX_CONCURRENT) {
        return Promise.reject(new HttpError(429, 'ระบบกำลังสร้างไฟล์ส่งออกของผู้ใช้อื่นอยู่ กรุณารอสักครู่แล้วลองใหม่', 'EXPORT_BUSY'));
    }
    running += 1;
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'xlsxWorker.js'), {
            workerData: { rows, filters, options },
            resourceLimits: { maxOldGenerationSizeMb: WORKER_MEMORY_MB },
        });
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            running -= 1;
            clearTimeout(timer);
            worker.terminate().catch(() => {});
            callback(value);
        };
        const timer = setTimeout(() => finish(reject, new HttpError(504, 'สร้างไฟล์ส่งออกนานเกินกำหนด กรุณาจำกัดช่วงข้อมูลให้แคบลง', 'EXPORT_TIMEOUT')), TIMEOUT_MS);
        worker.once('message', (message) => {
            if (message?.error) finish(reject, new Error(message.error));
            else finish(resolve, Buffer.from(message.buffer, message.byteOffset, message.byteLength));
        });
        worker.once('error', (error) => finish(reject, error));
        worker.once('exit', (code) => {
            if (code !== 0) finish(reject, new Error(`export worker exited with code ${code}`));
        });
    });
}

module.exports = { buildWorkbookBuffer };
