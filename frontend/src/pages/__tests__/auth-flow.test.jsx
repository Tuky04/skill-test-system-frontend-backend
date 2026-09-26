import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import API from '../../services/api';
import Login from '../Login';
import ProtectedRoute from '../../components/ProtectedRoute';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const destinations = {
  admin: '/admin-report',
  staff: '/grading-panel',
  student: '/student-dashboard',
};

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {Object.entries(destinations).map(([role, path]) => (
          <Route key={role} path={path} element={<div>{role} home</div>} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

describe('login and role routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { success: true, data: [] } });
  });

  test.each(['student', 'staff', 'admin'])('logs %s in and sends them to the correct home', async (role) => {
    API.post.mockResolvedValue({
      data: { success: true, token: `${role}-access-token`, user: { user_id: 10, role } },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText('กรอกชื่อผู้ใช้งาน'), `${role}01`);
    await user.type(screen.getByPlaceholderText('กรอกรหัสผ่าน'), 'safe-password');
    await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }));

    expect(API.post).toHaveBeenCalledWith('/login', {
      username: `${role}01`,
      password: 'safe-password',
    });
    expect(sessionStorage.getItem('token')).toBe(`${role}-access-token`);
    expect(localStorage.getItem('role')).toBe(role);
    expect(await screen.findByText(`${role} home`)).toBeInTheDocument();
  });
});

describe('ProtectedRoute role separation', () => {
  test('allows the configured role', () => {
    sessionStorage.setItem('token', 'valid-token');
    localStorage.setItem('role', 'staff');

    render(
      <MemoryRouter initialEntries={['/staff-only']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/staff-only" element={<ProtectedRoute allowedRoles={['staff']}><div>staff content</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('staff content')).toBeInTheDocument();
  });

  test.each([
    ['student', '/student-dashboard', 'student home'],
    ['staff', '/grading-panel', 'staff home'],
    ['admin', '/admin-report', 'admin home'],
  ])('redirects unauthorized %s users to their own home', (role, home, marker) => {
    sessionStorage.setItem('token', 'valid-token');
    localStorage.setItem('role', role);

    render(
      <MemoryRouter initialEntries={['/admin-only']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/admin-only" element={<ProtectedRoute allowedRoles={['never-this-role']}><div>secret</div></ProtectedRoute>} />
          <Route path={home} element={<div>{marker}</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(marker)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  test('redirects a visitor without an access token to login', () => {
    render(
      <MemoryRouter initialEntries={['/staff-only']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/staff-only" element={<ProtectedRoute allowedRoles={['staff']}><div>secret</div></ProtectedRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
