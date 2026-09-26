import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import GradingPanel from './pages/GradingPanel';
import UserManagement from './pages/UserManagement';
import AdminReport from './pages/AdminReport';
import ProtectedRoute from './components/ProtectedRoute';
import StudentApply from './pages/StudentApply';
import Register from './pages/Register';

// 🌟 อิมพอร์ตไฟล์ตรวจสอบเอกสารเข้ามาให้ระบบรู้จักเรียบร้อย
import StudentVerification from './pages/StudentVerification';
import CertificateManager from './pages/CertificateManager';
// ใน <Routes>
import ChangePassword from './pages/ChangePassword';
import AuditLog from './pages/AuditLog';
import VerifyCertificate from './pages/VerifyCertificate';
import ResubmitDocuments from './pages/ResubmitDocuments';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ResendVerification from './pages/ResendVerification';
import StudentRecords from './pages/StudentRecords';
import StudentDetail from './pages/StudentDetail';
import DataExport from './pages/DataExport';


function App() {
  return (
    <Router basename={process.env.REACT_APP_ROUTER_BASENAME || ''}>
      <Routes>
        {/* 🔓 หน้าเปิดสาธารณะ (ไม่ต้องล็อกอิน) */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="/verify-certificate/:code" element={<VerifyCertificate />} />
        <Route path="/certificates" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CertificateManager />
          </ProtectedRoute>
        } />
        {/* 🎓 หน้าสมัครสอบสำหรับนักศึกษา: สิทธิ์ student เท่านั้น */}
        <Route path="/student-apply" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentApply />
          </ProtectedRoute>
        } />
        <Route path="/change-password" element={
          <ProtectedRoute allowedRoles={['admin','staff','student']}>
            <ChangePassword />
          </ProtectedRoute>
        } />
        <Route path="/resubmit-documents" element={
          <ProtectedRoute allowedRoles={['student']}>
            <ResubmitDocuments />
          </ProtectedRoute>
        } />
        <Route path="/audit-log" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuditLog />
          </ProtectedRoute>
        } />
        {/* 🧑‍🎓 หน้าสำหรับนักศึกษา (ต้องล็อกอินสิทธิ์ student) */}
        <Route path="/student-dashboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />

        {/* 📝 หน้าสำหรับกรรมการ/อาจารย์คีย์คะแนน (สิทธิ์ staff หรือ admin) */}
        <Route path="/grading-panel" element={
          <ProtectedRoute allowedRoles={['staff']}>
            <GradingPanel />
          </ProtectedRoute>
        } />

        {/* 🔍 หน้าสำหรับแอดมิน/เจ้าหน้าที่ ตรวจสอบเอกสารผู้สมัครใหม่ */}
        <Route path="/staff/verify-students" element={
          <ProtectedRoute allowedRoles={['staff']}>
            <StudentVerification />
          </ProtectedRoute>
        } />
        <Route path="/staff/students" element={
          <ProtectedRoute allowedRoles={['staff']}>
            <StudentRecords />
          </ProtectedRoute>
        } />
        <Route path="/staff/students/:studentId" element={
          <ProtectedRoute allowedRoles={['staff']}>
            <StudentDetail />
          </ProtectedRoute>
        } />
        <Route path="/staff/data-export" element={
          <ProtectedRoute allowedRoles={['staff']}>
            <DataExport />
          </ProtectedRoute>
        } />

        {/* 📊 หน้าสำหรับแอดมินพิมพ์รายงานราชการ (ต้องเป็น admin เท่านั้น) */}
        <Route path="/user-management" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin-report" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminReport />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
