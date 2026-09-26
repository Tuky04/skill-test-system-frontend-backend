import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import API from '../../services/api';
import StudentApply from '../StudentApply';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

test('an approved student can submit an application for an open course', async () => {
  API.get.mockImplementation((path) => {
    if (path === '/student/courses') {
      return Promise.resolve({ data: { success: true, data: [
        { course_id: 7, course_name: 'Microsoft Excel', course_status: 'เปิดรับสมัคร' },
        { course_id: 8, course_name: 'ช่างไฟฟ้า', course_status: 'ปิดรับสมัคร' },
      ] } });
    }
    return Promise.resolve({ data: { student: { student_code: 'STD-0001', registration_status: 'อนุมัติ' } } });
  });
  API.post.mockResolvedValue({ data: { success: true, message: 'ส่งใบสมัครสำเร็จ' } });
  const user = userEvent.setup();

  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudentApply /></MemoryRouter>);

  const courseSelect = await screen.findByRole('combobox');
  await user.selectOptions(courseSelect, '7');
  await user.click(screen.getByRole('button', { name: 'ยืนยันการส่งใบสมัคร' }));

  await waitFor(() => expect(API.post).toHaveBeenCalledWith('/student/apply', { course_id: '7' }));
  expect(screen.getByText(/ส่งใบสมัครสำเร็จ/)).toBeInTheDocument();
});

test('a student whose documents are not approved cannot submit', async () => {
  API.get.mockImplementation((path) => {
    if (path === '/student/courses') {
      return Promise.resolve({ data: { success: true, data: [
        { course_id: 7, course_name: 'Microsoft Excel', course_status: 'เปิดรับสมัคร' },
      ] } });
    }
    return Promise.resolve({ data: { student: { student_code: 'STD-0002', registration_status: 'รอตรวจสอบเอกสาร' } } });
  });

  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudentApply /></MemoryRouter>);

  expect(await screen.findByText(/เอกสารของคุณยังไม่ได้รับการอนุมัติ/)).toBeInTheDocument();
  const submit = screen.getByRole('button', { name: 'ยืนยันการส่งใบสมัคร' });
  expect(submit).toBeDisabled();
  expect(API.post).not.toHaveBeenCalled();
});
