import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import API from '../../services/api';
import StudentVerification from '../StudentVerification';
import GradingPanel from '../GradingPanel';

jest.mock('../../components/RmutsNavbar', () => () => <nav data-testid="navbar" />);
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const pendingStudent = {
  student_id: 21,
  student_code: 'STD-00021',
  university_student_code: '3663452210001',
  full_name: 'นักศึกษา ทดสอบ',
  email: 'student@example.test',
  id_card_number: '1101700000000',
  phone_number: '0812345678',
  registration_status: 'รอตรวจสอบเอกสาร',
  created_at: '2026-08-01T08:00:00.000Z',
};

const examRegistration = {
  registration_id: 91,
  student_code: 'STD-00021',
  university_student_code: '3663452210001',
  full_name: 'นักศึกษา ทดสอบ',
  application_no: 'APP-2026-00091',
  application_status: 'อนุมัติสิทธิ์สอบ',
  exam_status: 'เข้าสอบ',
  course_name: 'Microsoft Excel',
  course_code: 'EXCEL-01',
  registered_at: '2026-08-01T08:00:00.000Z',
  exam_date: '2026-08-20',
  exam_time: '09:00:00',
  exam_location: 'ห้อง LAB 1',
  attempt_no: 1,
  theory_max_score: 30,
  practical_max_score: 70,
  theory_score: 0,
  practical_score: 0,
  deducted_score: 0,
  result_published_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
  window.scrollTo = jest.fn();
});

test('staff approval removes the student from the pending document list', async () => {
  API.get
    .mockResolvedValueOnce({ data: { success: true, data: [pendingStudent] } })
    .mockResolvedValueOnce({ data: { success: true, data: [] } });
  API.put.mockResolvedValue({ data: { success: true, message: 'อนุมัติเรียบร้อย' } });
  const user = userEvent.setup();

  render(<StudentVerification />);

  expect(await screen.findByText('นักศึกษา ทดสอบ')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'ตรวจสอบ' }));
  await user.click(screen.getByRole('radio', { name: /อนุมัติ/ }));
  await user.click(screen.getByRole('button', { name: 'ยืนยันการดำเนินการ' }));

  await waitFor(() => expect(API.put).toHaveBeenCalledWith('/staff/students/21/verify', {
    status: 'อนุมัติ',
    note: '',
  }));
  expect(await screen.findByText(/ไม่มีรายการรอตรวจสอบ/)).toBeInTheDocument();
});

test('staff can approve an exam application and it leaves the pending filter', async () => {
  const pendingApplication = { ...examRegistration, application_status: 'รอดำเนินการ', exam_status: 'รอสอบ' };
  API.get.mockImplementation((path) => {
    if (path === '/staff/pending-registrations') return Promise.resolve({ data: { success: true, data: [] } });
    const registrations = API.put.mock.calls.length ? [{ ...pendingApplication, application_status: 'อนุมัติสิทธิ์สอบ' }] : [pendingApplication];
    return Promise.resolve({ data: { success: true, data: registrations } });
  });
  API.put.mockResolvedValue({ data: { success: true, message: 'อนุมัติสิทธิ์สอบแล้ว' } });
  const user = userEvent.setup();

  render(<GradingPanel />);

  expect(await screen.findByText('APP-2026-00091')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /อนุมัติ/ }));

  await waitFor(() => expect(API.put).toHaveBeenCalledWith('/registrations/91/status', { status: 'อนุมัติสิทธิ์สอบ' }));
  await waitFor(() => expect(screen.queryByText('APP-2026-00091')).not.toBeInTheDocument());
});

test('staff can enter valid scores and publish the result', async () => {
  API.get.mockImplementation((path) => {
    if (path === '/staff/pending-registrations') return Promise.resolve({ data: { success: true, data: [] } });
    return Promise.resolve({ data: { success: true, data: [examRegistration] } });
  });
  API.post.mockResolvedValue({ data: { success: true, message: 'บันทึกคะแนนสำเร็จ' } });
  const user = userEvent.setup();

  render(<GradingPanel />);

  await user.click(await screen.findByRole('button', { name: /บันทึกคะแนนสอบ/ }));
  await user.click(screen.getByRole('button', { name: /เปิดหน้าต่างกรอกคะแนน/ }));
  const scoreInputs = screen.getAllByRole('spinbutton');
  expect(scoreInputs).toHaveLength(3);
  await user.clear(scoreInputs[0]);
  await user.type(scoreInputs[0], '25');
  await user.clear(scoreInputs[1]);
  await user.type(scoreInputs[1], '60');
  await user.clear(scoreInputs[2]);
  await user.type(scoreInputs[2], '5');
  await user.click(screen.getByRole('button', { name: /บันทึกและประกาศผล/ }));

  await waitFor(() => expect(API.post).toHaveBeenCalledWith('/scores/submit', {
    registration_id: 91,
    theory_score: 25,
    practical_score: 60,
    deducted_score: 5,
  }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('80 คะแนน'));
  await waitFor(() => expect(screen.queryByRole('button', { name: /บันทึกและประกาศผล/ })).not.toBeInTheDocument());
});
