const mockHandlers = {};
const mockApiInstance = Object.assign(jest.fn(), {
  interceptors: {
    request: { use: jest.fn((handler) => { mockHandlers.request = handler; }) },
    response: { use: jest.fn((success, failure) => { mockHandlers.responseFailure = failure; }) },
  },
});
const mockRefreshPost = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => mockApiInstance),
    post: (...args) => mockRefreshPost(...args),
  },
}));

const API = require('./api').default;

beforeEach(() => {
  jest.clearAllMocks();
  mockApiInstance.mockResolvedValue({ data: { success: true } });
});

test('adds the access token to authenticated requests', () => {
  sessionStorage.setItem('token', 'access-token');
  const config = mockHandlers.request({ headers: {} });
  expect(config.headers.Authorization).toBe('Bearer access-token');
});

test('refreshes an expired access token and retries the original request', async () => {
  sessionStorage.setItem('token', 'expired-token');
  mockRefreshPost.mockResolvedValue({ data: { token: 'fresh-token', role: 'student', user: { user_id: 5, role: 'student' } } });

  const result = await mockHandlers.responseFailure({
    response: { status: 401 },
    config: { url: '/student/me', headers: {} },
  });

  expect(mockRefreshPost).toHaveBeenCalledWith(
    expect.stringMatching(/\/auth\/refresh$/),
    {},
    { withCredentials: true },
  );
  expect(sessionStorage.getItem('token')).toBe('fresh-token');
  expect(sessionStorage.getItem('role')).toBe('student');
  expect(JSON.parse(sessionStorage.getItem('user'))).toEqual({ user_id: 5, role: 'student' });
  expect(API).toHaveBeenCalledWith(expect.objectContaining({
    _retry: true,
    headers: { Authorization: 'Bearer fresh-token' },
  }));
  expect(result).toEqual({ data: { success: true } });
});

test('does not try to refresh a failed login request', async () => {
  sessionStorage.setItem('token', 'existing-token');
  const error = { response: { status: 401 }, config: { url: '/login' } };

  await expect(mockHandlers.responseFailure(error)).rejects.toBe(error);
  expect(mockRefreshPost).not.toHaveBeenCalled();
});


test('keeps the session when the refresh call fails only because the server is unreachable', async () => {
  sessionStorage.setItem('token', 'still-valid');
  sessionStorage.setItem('role', 'staff');
  const failure = { message: 'Network Error' };
  mockRefreshPost.mockRejectedValue(failure);

  await expect(mockHandlers.responseFailure({
    response: { status: 401 },
    config: { url: '/registrations', headers: {} },
  })).rejects.toBe(failure);

  expect(sessionStorage.getItem('token')).toBe('still-valid');
  expect(sessionStorage.getItem('role')).toBe('staff');
});

test('clears the session when the refresh token itself is rejected', async () => {
  sessionStorage.setItem('token', 'revoked');
  sessionStorage.setItem('role', 'staff');
  sessionStorage.setItem('user', JSON.stringify({ full_name: 'x' }));
  localStorage.setItem('role', 'staff'); // ข้อมูลตกค้างจากเวอร์ชันเก่า
  mockRefreshPost.mockRejectedValue({ response: { status: 401 } });

  await expect(mockHandlers.responseFailure({
    response: { status: 401 },
    config: { url: '/registrations', headers: {} },
  })).rejects.toBeDefined();

  expect(sessionStorage.getItem('token')).toBeNull();
  expect(sessionStorage.getItem('role')).toBeNull();
  expect(sessionStorage.getItem('user')).toBeNull();
  expect(localStorage.getItem('role')).toBeNull();
});
