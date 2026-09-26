import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const role = localStorage.getItem('role');
    const token = sessionStorage.getItem('token');
    if (!role || !token) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(role)) {
        const home = role === 'student' ? '/student-dashboard' : role === 'staff' ? '/grading-panel' : '/admin-report';
        return <Navigate to={home} replace />;
    }
    return children;
};

export default ProtectedRoute;
