import axios from 'axios';
import { currentAppPath, goTo } from '../utils/navigation';
import { getToken, setSession, clearSession } from './session';

export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export function clearAuth() {
    clearSession();
}

const API = axios.create({ baseURL: API_BASE, withCredentials: true });

API.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ขอ access token ใหม่จาก refresh cookie (ใช้ร่วมกันระหว่าง interceptor และการกู้เซสชันของ ProtectedRoute)
// คำขอที่เกิดพร้อมกันใช้ promise เดียวกัน เพื่อไม่ให้ยิง refresh ซ้ำ
let refreshPromise = null;
export function refreshSession() {
    refreshPromise ||= axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
        .then((response) => {
            setSession({ token: response.data.token, role: response.data.role, user: response.data.user });
            return response.data;
        })
        .finally(() => { refreshPromise = null; });
    return refreshPromise;
}

// refresh ล้มเหลวเพราะ "เซสชันใช้ไม่ได้แล้ว" (401/403) ต่างจาก "เครือข่าย/เซิร์ฟเวอร์ล่มชั่วคราว" (ไม่มี response หรือ 5xx)
// กรณีหลังต้องไม่เด้งผู้ใช้ออก เพราะเซสชันยังดีอยู่
const isSessionRejected = (error) => [401, 403].includes(error?.response?.status);

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config || {};
        const requestUrl = String(original.url || '');
        const publicAuthPaths = [
            '/login',
            '/auth/register',
            '/auth/forgot-password',
            '/auth/reset-password',
            '/auth/resend-verification',
            '/auth/verify-email',
            '/auth/refresh',
        ];
        const shouldSkipRefresh = publicAuthPaths.some((path) => requestUrl.includes(path));
        const hasAccessToken = Boolean(getToken());
        if (error.response?.status !== 401 || original._retry || shouldSkipRefresh || !hasAccessToken) {
            return Promise.reject(error);
        }
        original._retry = true;
        try {
            const refreshed = await refreshSession();
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${refreshed.token}` };
            return API(original);
        } catch (refreshError) {
            if (isSessionRejected(refreshError)) {
                clearAuth();
                const currentPath = currentAppPath();
                if (currentPath !== '/' && currentPath !== '/login') goTo('/login');
            }
            return Promise.reject(refreshError);
        }
    }
);

export async function downloadAuthenticated(path, fallbackFilename) {
    const response = await API.get(path, { responseType: 'blob' });
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || fallbackFilename;
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default API;
