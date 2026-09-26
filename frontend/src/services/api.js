import axios from 'axios';
import { currentAppPath, goTo } from '../utils/navigation';

export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export function clearAuth() {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
}

const API = axios.create({ baseURL: API_BASE, withCredentials: true });

API.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

let refreshPromise = null;
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
        const hasAccessToken = Boolean(sessionStorage.getItem('token'));
        if (error.response?.status !== 401 || original._retry || shouldSkipRefresh || !hasAccessToken) {
            return Promise.reject(error);
        }
        original._retry = true;
        try {
            refreshPromise ||= axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
                .finally(() => { refreshPromise = null; });
            const response = await refreshPromise;
            sessionStorage.setItem('token', response.data.token);
            if (response.data.role) localStorage.setItem('role', response.data.role);
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${response.data.token}` };
            return API(original);
        } catch (refreshError) {
            clearAuth();
            const currentPath = currentAppPath();
            if (currentPath !== '/' && currentPath !== '/login') goTo('/login');
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
