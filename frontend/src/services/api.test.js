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
  localStorage.setItem('role', 'student');
  mockRefreshPost.mockResolvedValue({ data: { token: 'fresh-token', role: 'student' } });

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

