const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/upload');

const auth = require('../controllers/authController');
const student = require('../controllers/studentController');
const score = require('../controllers/scoreController');
const report = require('../controllers/reportController');
const course = require('../controllers/courseController');
const notification = require('../controllers/notificationController');
const retake = require('../controllers/retakeController');
const userManagement = require('../controllers/userManagementController');
const registration = require('../controllers/registrationController');
const audit = require('../controllers/auditController');
const exportController = require('../controllers/exportController');
const changePassword = require('../controllers/changePasswordController');
const certificate = require('../utils/pdfGenerator');
const documentController = require('../controllers/documentController');
const studentRecords = require('../controllers/studentRecordsController');

router.post('/login', auth.login);
router.post('/auth/register', handleUpload, registration.register);
router.post('/auth/refresh', auth.refreshToken);
router.post('/auth/logout', auth.logout);
router.post('/auth/forgot-password', auth.forgotPassword);
router.post('/auth/reset-password', auth.resetPassword);
router.get('/auth/verify-email/:token', auth.verifyEmail);
router.post('/auth/resend-verification', auth.resendVerification);
router.put('/auth/change-password', verifyToken, changePassword.changePassword);

router.get('/courses/public', course.getPublicCourses);
router.get('/courses', verifyToken, requireRole('admin'), course.getAllCourses);
router.post('/courses', verifyToken, requireRole('admin'), course.createCourse);
router.put('/courses/:course_id', verifyToken, requireRole('admin'), course.updateCourse);
router.delete('/courses/:course_id', verifyToken, requireRole('admin'), course.deleteCourse);
router.put('/courses/:course_id/toggle-status', verifyToken, requireRole('admin'), course.toggleCourseStatus);
router.delete('/courses/:course_id/status-override', verifyToken, requireRole('admin'), course.clearCourseStatusOverride);

router.get('/student/me', verifyToken, requireRole('student'), student.getStudentMe);
router.get('/student/courses', verifyToken, requireRole('student'), student.getAvailableCourses);
router.post('/student/apply', verifyToken, requireRole('student'), student.applyExam);
router.post('/student/documents/resubmit', verifyToken, requireRole('student'), handleUpload, registration.resubmitDocuments);
router.get('/student/exam-history', verifyToken, requireRole('student'), retake.getExamHistory);
router.get('/student/retake-eligibility/:course_id', verifyToken, requireRole('student'), retake.checkRetakeEligibility);
router.post('/student/apply-retake', verifyToken, requireRole('student'), retake.applyRetake);

router.get('/registrations', verifyToken, requireRole('staff'), student.getAllRegistrations);
router.put('/registrations/:registration_id/status', verifyToken, requireRole('staff'), student.updateRegistrationStatus);
router.put('/registrations/:registration_id/exam-status', verifyToken, requireRole('staff'), student.updateExamStatus);
router.post('/scores/submit', verifyToken, requireRole('staff'), score.submitScores);

router.get('/staff/pending-registrations', verifyToken, requireRole('staff'), registration.getPendingRegistrations);
router.put('/staff/students/:id/verify', verifyToken, requireRole('staff'), registration.verifyStudent);
router.get('/admin/users', verifyToken, requireRole('admin'), userManagement.getAllUsers);
router.get('/admin/users/:user_id', verifyToken, requireRole('admin'), userManagement.getUserById);
router.put('/admin/users/:user_id/toggle-active', verifyToken, requireRole('admin'), userManagement.toggleUserActive);
router.put('/admin/users/:user_id/reset-password', verifyToken, requireRole('admin'), userManagement.resetPassword);
router.put('/admin/users/:user_id/change-role', verifyToken, requireRole('admin'), userManagement.changeRole);

router.get('/staff/students', verifyToken, requireRole('staff'), studentRecords.listStudents);
router.get('/staff/students/:student_id', verifyToken, requireRole('staff'), studentRecords.getStudentDetail);
router.get('/staff/export/options', verifyToken, requireRole('staff'), exportController.getExportOptions);
router.get('/staff/export/preview', verifyToken, requireRole('staff'), exportController.previewRegistrations);

router.get('/documents/:filename', verifyToken, requireRole('student', 'staff'), documentController.downloadDocument);
router.get('/certificates/passed', verifyToken, requireRole('admin'), certificate.getPassedList);
router.get('/certificates/:registration_id', verifyToken, certificate.generateCertificate);
router.post('/certificates/:registration_id/revoke', verifyToken, requireRole('admin'), certificate.revokeCertificate);
router.post('/certificates/:registration_id/reissue', verifyToken, requireRole('admin'), certificate.reissueCertificate);
router.get('/certificates/verify/:verification_code', certificate.verifyCertificate);

router.get('/reports/stats', verifyToken, requireRole('admin'), report.getStats);
router.get('/export/registrations', verifyToken, requireRole('staff'), exportController.exportRegistrations);
router.get('/export/registrations.xlsx', verifyToken, requireRole('staff'), exportController.exportRegistrations);
router.get('/export/audit', verifyToken, requireRole('admin'), exportController.exportAuditLog);
router.get('/audit/scores', verifyToken, requireRole('admin'), audit.getScoreAuditLogs);
router.get('/audit/admin', verifyToken, requireRole('admin'), audit.getAdminAuditLogs);

router.get('/notifications', verifyToken, notification.getMyNotifications);
router.put('/notifications/read-all', verifyToken, notification.markAllAsRead);
router.put('/notifications/:id/read', verifyToken, notification.markAsRead);
router.delete('/notifications/:id', verifyToken, notification.deleteNotification);

module.exports = router;
