// worker thread: สร้างไฟล์ .xlsx จากแถวข้อมูลแล้วส่ง buffer กลับ main thread
const { parentPort, workerData } = require('worker_threads');
const { createRegistrationWorkbook } = require('./registrationWorkbook');

(async () => {
    const { rows, filters, options } = workerData;
    const workbook = createRegistrationWorkbook(rows, filters, options);
    const buffer = await workbook.xlsx.writeBuffer();
    // คัดลอกเป็น Uint8Array ของตัวเองแล้วโอนความเป็นเจ้าของ (ไม่ copy ซ้ำตอนส่ง)
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    parentPort.postMessage(copy, [copy.buffer]);
})().catch((error) => {
    parentPort.postMessage({ error: error.message });
});
