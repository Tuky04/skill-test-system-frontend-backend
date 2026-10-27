import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import API from '../../services/api';
import StudentDashboard from '../StudentDashboard';

jest.mock('../../components/RmutsNavbar', () => () => <nav data-testid="navbar" />);
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const attempt = (extra = {}) => ({
  registration_id: 5, attempt_no: 1, is_retake: 0, application_no: 'APP-5', application_status: 'รอดำเนินการ', exam_status: 'รอสอบ',
  registered_at: '2026-10-20T08:00:00.000Z', exam_date: '2026-11-20', exam_time: '09:00:00', exam_location: 'ห้อง 1',
  payment_amount: '100.00', payment_status: 'รอชำระเงิน', slip_filename: null, payment_note: null,
  ...extra,
});
const info = { amount: 100, configured: true, account_name: 'มหาวิทยาลัยทดสอบ', bank_name: 'ธนาคารตัวอย่าง', account_no: '123-4-56789-0', promptpay_id: '', note: '' };

function mockApi({ attempts, paymentInfo = info }) {
  API.get.mockImplementation((path) => {
    if (path === '/student/exam-history') return Promise.resolve({ data: { success: true, data: [{ course_id: 1, course_code: 'EXCEL-01', course_name: 'Microsoft Excel', attempts }] } });
    if (path === '/student/me') return Promise.resolve({ data: { success: true, student: { full_name: 'นักศึกษา ทดสอบ', student_code: 'STD-1', registration_status: 'อนุมัติ' } } });
    if (path === '/student/payment-info') return Promise.resolve({ data: { success: true, data: paymentInfo } });
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

beforeEach(() => { jest.clearAllMocks(); });

test('an unpaid application shows the 100 baht fee, the account to pay into and a slip upload form', async () => {
  mockApi({ attempts: [attempt()] });
  render(<StudentDashboard />);

  expect(await screen.findByText(/ค่าสมัครสอบ 100 บาท/)).toBeInTheDocument();
  expect(screen.getByText('มหาวิทยาลัยทดสอบ')).toBeInTheDocument();
  expect(screen.getByText('123-4-56789-0')).toBeInTheDocument();
  expect(screen.getByText(/มี 1 ใบสมัครที่ยังไม่ได้ชำระค่าสมัครสอบ/)).toBeInTheDocument();
  expect(screen.getByLabelText(/แนบสลิปการโอนเงิน/)).toBeInTheDocument();
});

test('the student attaches a slip and it is posted for their own registration', async () => {
  mockApi({ attempts: [attempt()] });
  API.post.mockResolvedValue({ data: { success: true } });
  const user = userEvent.setup();
  render(<StudentDashboard />);

  const file = new File([new Uint8Array([137, 80, 78, 71])], 'slip.png', { type: 'image/png' });
  await user.upload(await screen.findByLabelText(/แนบสลิปการโอนเงิน/), file);
  await user.type(screen.getByLabelText(/เลขอ้างอิงรายการ/), 'REF-1');
  await user.click(screen.getByRole('button', { name: /ส่งหลักฐานการชำระเงิน/ }));

  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
  const [url, form] = API.post.mock.calls[0];
  expect(url).toBe('/student/payments/5/slip');
  expect(form.get('payment_slip').name).toBe('slip.png');
  expect(form.get('transfer_ref')).toBe('REF-1');
});

test('sending without a file, or a file over 5 MB, is stopped before any request', async () => {
  mockApi({ attempts: [attempt()] });
  const user = userEvent.setup();
  render(<StudentDashboard />);

  await user.click(await screen.findByRole('button', { name: /ส่งหลักฐานการชำระเงิน/ }));
  expect(await screen.findByText(/กรุณาแนบไฟล์สลิป/)).toBeInTheDocument();

  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText(/แนบสลิปการโอนเงิน/), big);
  await user.click(screen.getByRole('button', { name: /ส่งหลักฐานการชำระเงิน/ }));
  expect(await screen.findByText(/ไฟล์มีขนาดเกิน 5 MB/)).toBeInTheDocument();
  expect(API.post).not.toHaveBeenCalled();
});

test('a rejected slip shows the staff reason and lets the student send a new one', async () => {
  mockApi({ attempts: [attempt({ payment_status: 'สลิปไม่ผ่าน', payment_note: 'ยอดโอนไม่ครบ', slip_filename: 'payment_slip-aa.png' })] });
  render(<StudentDashboard />);

  expect(await screen.findByText(/ยอดโอนไม่ครบ/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ส่งหลักฐานการชำระเงิน/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ดูสลิปที่ส่ง/ })).toBeInTheDocument();
});

test('paid and waiting-for-review applications do not offer the upload form again', async () => {
  mockApi({ attempts: [attempt({ payment_status: 'ชำระแล้ว', slip_filename: 'payment_slip-aa.png' })] });
  const { unmount } = render(<StudentDashboard />);
  expect(await screen.findByText('✅ ชำระเงินแล้ว')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /ส่งหลักฐานการชำระเงิน/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/ยังไม่ได้ชำระค่าสมัครสอบ/)).not.toBeInTheDocument();
  unmount();

  mockApi({ attempts: [attempt({ payment_status: 'รอตรวจสลิป', slip_filename: 'payment_slip-aa.png', payment_submitted_at: '2026-10-21T08:00:00.000Z' })] });
  render(<StudentDashboard />);
  expect(await screen.findByText(/ส่งสลิปแล้ว รอตรวจสอบ/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /ส่งหลักฐานการชำระเงิน/ })).not.toBeInTheDocument();
});

test('when the receiving account is not configured yet the student is told to contact staff', async () => {
  mockApi({ attempts: [attempt()], paymentInfo: { amount: 100, configured: false } });
  render(<StudentDashboard />);
  expect(await screen.findByText(/ยังไม่ได้ตั้งค่าบัญชีรับเงิน/)).toBeInTheDocument();
});

test('old applications made before the fee existed show no payment due', async () => {
  mockApi({ attempts: [attempt({ payment_amount: '0.00', payment_status: 'ชำระแล้ว' })] });
  render(<StudentDashboard />);
  expect(await screen.findByText(/สมัครไว้ก่อนเริ่มเก็บค่าสมัคร/)).toBeInTheDocument();
});

test('the retake button stays hidden while a retake application is still waiting for approval', async () => {
  mockApi({ attempts: [
    attempt({ registration_id: 5, application_status: 'อนุมัติสิทธิ์สอบ', exam_status: 'ประกาศผลแล้ว', payment_status: 'ชำระแล้ว', department_status: 'ไม่ได้รับวุฒิบัตร', total_score: 55 }),
    attempt({ registration_id: 6, attempt_no: 2, is_retake: 1, application_no: 'APP-6' }),
  ] });

  render(<StudentDashboard />);

  expect(await screen.findByText('APP-6')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /สมัครสอบซ่อม/ })).not.toBeInTheDocument();
});
