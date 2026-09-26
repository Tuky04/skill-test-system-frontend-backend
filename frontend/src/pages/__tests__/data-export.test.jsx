import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import API, { downloadAuthenticated } from '../../services/api';
import DataExport from '../DataExport';

jest.mock('../../components/RmutsNavbar', () => () => <nav data-testid="navbar" />);
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  downloadAuthenticated: jest.fn(),
}));

const options = {
  courses: [{ course_id: 7, course_code: 'EXCEL-01', course_name: 'Microsoft Excel' }],
  sessions: [{ session_id: 12, session_name: 'รอบเช้า', exam_date: '2026-08-20', course_ids: '7' }],
  range: { max_attempt_no: 2 },
};

const previewRow = {
  registration_id: 91,
  application_no: 'APP-2026-00091',
  university_student_code: '3663452210001',
  student_code: 'STD-00021',
  full_name: 'นักศึกษา ทดสอบ',
  course_name: 'Microsoft Excel',
  session_name: 'รอบเช้า',
  attempt_no: 1,
  exam_date: '2026-08-20',
  exam_time: '09:00',
  exam_location: 'ห้อง LAB 1',
  application_status: 'อนุมัติสิทธิ์สอบ',
  exam_status: 'เข้าสอบ',
  total_score: 80,
  department_status: 'ได้รับวุฒิบัตร',
};

test('filters preview data and exports Excel with the same parameters', async () => {
  localStorage.setItem('role', 'staff');
  API.get.mockImplementation((path) => {
    if (path === '/staff/export/options') return Promise.resolve({ data: { data: options } });
    return Promise.resolve({ data: { data: [previewRow], total: 1 } });
  });
  downloadAuthenticated.mockResolvedValue();
  const user = userEvent.setup();

  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DataExport /></MemoryRouter>);

  await user.selectOptions(await screen.findByLabelText('สาขาวิชาสอบ'), '7');
  await user.selectOptions(screen.getByLabelText('รอบสอบ'), '12');
  await user.type(screen.getByLabelText('ตั้งแต่วันที่'), '2026-08-01');
  await user.type(screen.getByLabelText('ถึงวันที่'), '2026-08-31');
  await user.selectOptions(screen.getByLabelText('สถานะใบสมัครสอบ'), 'อนุมัติสิทธิ์สอบ');
  await user.click(screen.getByRole('button', { name: /แสดงตัวอย่าง/ }));

  await waitFor(() => expect(API.get).toHaveBeenCalledWith(expect.stringMatching(/^\/staff\/export\/preview\?/)));
  const previewUrl = API.get.mock.calls.find(([path]) => path.startsWith('/staff/export/preview?'))[0];
  expect(previewUrl).toContain('date_from=2026-08-01');
  expect(previewUrl).toContain('date_to=2026-08-31');
  expect(previewUrl).toContain('course_id=7');
  expect(previewUrl).toContain('session_id=12');
  expect(previewUrl).toContain(encodeURIComponent('อนุมัติสิทธิ์สอบ'));
  expect(await screen.findByText('นักศึกษา ทดสอบ')).toBeInTheDocument();
  expect(screen.getByText(/พบทั้งหมด 1 รายการ/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /ส่งออก \.xlsx/ }));
  await waitFor(() => expect(downloadAuthenticated).toHaveBeenCalledTimes(1));
  const [exportUrl, filename] = downloadAuthenticated.mock.calls[0];
  expect(exportUrl).toContain('/export/registrations.xlsx?');
  expect(exportUrl).toContain('course_id=7');
  expect(exportUrl).toContain('session_id=12');
  expect(filename).toBe('student_exam_records.xlsx');
});
