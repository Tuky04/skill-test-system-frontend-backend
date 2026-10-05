import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { refreshSession } from '../services/api';
import { getRole, getToken } from '../services/session';

const HOME = { student: '/student-dashboard', staff: '/grading-panel', admin: '/admin-report' };

// ไม่มี token ในแท็บนี้ (เช่น เปิดแท็บใหม่/เปิดเบราว์เซอร์ใหม่) → ลองกู้เซสชันจาก refresh cookie ก่อนส่งไปหน้าล็อกอิน
const ProtectedRoute = ({ children, allowedRoles }) => {
    const [status, setStatus] = useState(() => (getToken() && getRole() ? 'ready' : 'restoring'));

    useEffect(() => {
        if (status !== 'restoring') return undefined;
        let alive = true;
        Promise.resolve()
            .then(() => refreshSession())
            .then(() => { if (alive) setStatus('ready'); })
            .catch(() => { if (alive) setStatus('anonymous'); });
        return () => { alive = false; };
    }, [status]);

    if (status === 'restoring') {
        return <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#1a2f6e', fontFamily: 'sans-serif' }}>กำลังตรวจสอบเซสชัน...</div>;
    }
    const role = getRole();
    if (!role || !getToken()) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to={HOME[role] || '/admin-report'} replace />;
    return children;
};

export default ProtectedRoute;
