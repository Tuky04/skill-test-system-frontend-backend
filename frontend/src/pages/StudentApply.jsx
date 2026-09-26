import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const StudentApply = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [studentCode, setStudentCode] = useState('');
    const [approved, setApproved] = useState(false);

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const [courseResponse, meResponse] = await Promise.all([
                    API.get('/student/courses'),
                    API.get('/student/me'),
                ]);
                if (courseResponse.data.success) setCourses(courseResponse.data.data);
                const student = meResponse.data.student;
                setStudentCode(student.student_code || '');
                const isApproved = student.registration_status === 'อนุมัติ';
                setApproved(isApproved);
                if (!isApproved) setMessage({ text:'เอกสารของคุณยังไม่ได้รับการอนุมัติ กรุณารอการตรวจสอบหรือส่งเอกสารใหม่', type:'error' });
            } catch (err) {
                setMessage({ text: 'ไม่สามารถโหลดรายการวิชาสอบได้', type: 'error' });
            } finally {
                setFetching(false);
            }
        };
        fetchCourses();
    }, []);

    const openCourses = courses.filter(c => c.course_status === 'เปิดรับสมัคร');
    const closedCourses = courses.filter(c => c.course_status !== 'เปิดรับสมัคร');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCourse) {
            setMessage({ text: 'กรุณาเลือกสาขาที่ต้องการทดสอบ', type: 'error' });
            return;
        }

        try {
            setLoading(true);
            setMessage({ text: '', type: '' });
            const response = await API.post('/student/apply', {
                course_id: selectedCourse,
            });

            if (response.data.success) {
                setMessage({ text: response.data.message, type: 'success' });
                setTimeout(() => navigate('/student-dashboard'), 1500);
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || 'เกิดข้อผิดพลาดในการส่งใบสมัคร';
            setMessage({ text: errMsg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const msgStyle = {
        padding: '12px',
        borderRadius: '4px',
        marginBottom: '20px',
        fontWeight: 'bold',
        backgroundColor: message.type === 'success' ? '#E8F8F5' : '#FADBD8',
        color: message.type === 'success' ? '#117864' : '#78281F',
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '40px auto', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1F4E6B', borderBottom: '2px solid #1F4E6B', paddingBottom: '10px' }}>📝 ยื่นใบสมัครเข้าทดสอบมาตรฐานฝีมือแรงงาน</h2>
            <p style={{ color: '#666' }}>รหัสผู้สมัคร: <strong>{studentCode}</strong></p>

            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>เลือกสาขาการทดสอบมาตรฐาน:</label>

                    {fetching ? (
                        <p style={{ color: '#999' }}>กำลังโหลดรายการวิชา...</p>
                    ) : (
                        <>
                            <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #BDC3C7', fontSize: '15px' }}
                                required
                            >
                                <option value="">-- กรุณาเลือกสาขาวิชา --</option>
                                {openCourses.map(course => (
                                    <option key={course.course_id} value={course.course_id}>
                                        {course.course_name}
                                    </option>
                                ))}
                            </select>

                            {closedCourses.length > 0 && (
                                <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#FEF9E7', borderRadius: '4px', fontSize: '13px', color: '#7D6608' }}>
                                    ⚠️ วิชาที่ปิดรับสมัครแล้ว: {closedCourses.map(c => c.course_name).join(', ')}
                                </div>
                            )}

                            {openCourses.length === 0 && (
                                <p style={{ color: '#E74C3C', marginTop: '8px' }}>ขณะนี้ยังไม่มีวิชาที่เปิดรับสมัคร</p>
                            )}
                        </>
                    )}
                </div>

                {message.text && <div style={msgStyle}>{message.type === 'success' ? '✅' : '❌'} {message.text}</div>}

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        type="submit"
                        disabled={loading || !approved || openCourses.length === 0}
                        style={{ flex: 1, padding: '12px', backgroundColor: (!approved || openCourses.length === 0) ? '#BDC3C7' : '#1F4E6B', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: (!approved || openCourses.length === 0) ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? 'กำลังส่งข้อมูล...' : 'ยืนยันการส่งใบสมัคร'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/student-dashboard')}
                        style={{ padding: '12px 20px', backgroundColor: '#95A5A6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
                    >
                        ยกเลิก
                    </button>
                </div>
            </form>
        </div>
    );
};

export default StudentApply;
