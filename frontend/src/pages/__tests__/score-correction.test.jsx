import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import API from '../../services/api';
import ScoreCorrection from '../ScoreCorrection';

jest.mock('../../components/RmutsNavbar', () => () => <nav data-testid="navbar" />);
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const published = {
  registration_id: 9,
  application_no: 'APP-0009',
  student_code: 'STD-9',
  university_student_code: '660009',
  title: 'นาย',
  full_name: 'ผู้สอบ ทดสอบ',
  course_name: 'Microsoft Excel',
  theory_max_score: 30,
  practical_max_score: 70,
  theory_score: 25,
  practical_score: 55,
  deducted_score: 0,
  total_score: 80,
  department_status: 'ได้รับวุฒิบัตร',
  result_published_at: '2026-07-18T09:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
  API.get.mockResolvedValue({ data: { success: true, data: [published], pagination: { page: 1, pages: 1, total: 1 } } });
});

test('an admin must give a reason before a published score can be corrected', async () => {
  API.post.mockResolvedValue({ data: { success: true, message: 'แก้ไขคะแนนสำเร็จ รวม 40 คะแนน', certificate: 'revoked' } });
  const user = userEvent.setup();
  render(<ScoreCorrection />);

  await user.click(await screen.findByRole('button', { name: 'แก้ไข' }));
  const dialog = screen.getByText('✏️ แก้ไขคะแนน').closest('.rmuts-modal');
  const [theory, practical] = within(dialog).getAllByRole('spinbutton');
  const save = within(dialog).getByRole('button', { name: /บันทึกการแก้ไข/ });

  await user.clear(theory); await user.type(theory, '10');
  await user.clear(practical); await user.type(practical, '30');
  expect(save).toBeDisabled();
  expect(within(dialog).getByText(/ระบุเหตุผล/)).toBeInTheDocument();

  await user.type(within(dialog).getByPlaceholderText(/สลับช่อง/), 'กรอกคะแนนผิดช่อง');
  expect(save).toBeEnabled();
  await user.click(save);

  await waitFor(() => expect(API.post).toHaveBeenCalledWith('/admin/scores/correct', {
    registration_id: 9,
    theory_score: 10,
    practical_score: 30,
    deducted_score: 0,
    reason: 'กรอกคะแนนผิดช่อง',
  }));
  expect(await screen.findByText(/ใบรับรองเดิมถูกเพิกถอน/)).toBeInTheDocument();
});

test('scores above the course maximum are blocked before any request is sent', async () => {
  const user = userEvent.setup();
  render(<ScoreCorrection />);
  await user.click(await screen.findByRole('button', { name: 'แก้ไข' }));
  const dialog = screen.getByText('✏️ แก้ไขคะแนน').closest('.rmuts-modal');
  const [theory] = within(dialog).getAllByRole('spinbutton');
  await user.clear(theory); await user.type(theory, '31');
  await user.type(within(dialog).getByPlaceholderText(/สลับช่อง/), 'ทดสอบ');

  expect(within(dialog).getByRole('button', { name: /บันทึกการแก้ไข/ })).toBeDisabled();
  expect(within(dialog).getByText(/คะแนนทฤษฎีต้องอยู่ระหว่าง 0–30/)).toBeInTheDocument();
  expect(API.post).not.toHaveBeenCalled();
});
