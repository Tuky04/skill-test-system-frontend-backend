import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API from '../services/api';

export default function VerifyEmail() {
    const { token } = useParams();
    const [message, setMessage] = useState('กำลังยืนยันอีเมล...');
    const [status, setStatus] = useState('loading');   // loading | success | error
    // React 18 StrictMode เรียก useEffect สองรอบตอน dev — รอบแรกใช้ token ไปแล้ว
    // รอบสองจะได้ "ลิงก์หมดอายุหรือถูกใช้แล้ว" ทับผลสำเร็จ จึงต้องกันไว้
    const requested = useRef(false);

    useEffect(() => {
        if (requested.current) return;
        requested.current = true;
        let alive = true;
        API.get(`/auth/verify-email/${token}`)
            .then((response) => {
                if (!alive) return;
                setMessage(response.data?.message || 'ยืนยันอีเมลสำเร็จ');
                setStatus('success');
            })
            .catch((error) => {
                if (!alive) return;
                setMessage(
                    error.response?.data?.message
                    || (!error.response ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง' : 'ไม่สามารถยืนยันอีเมลได้')
                );
                setStatus('error');
            });
        return () => { alive = false; };
    }, [token]);

    const heading = status === 'success' ? '✅ ยืนยันสำเร็จ' : status === 'error' ? '⚠️ ยืนยันไม่สำเร็จ' : 'ยืนยันอีเมล';
    const color = status === 'success' ? '#15803d' : status === 'error' ? '#b91c1c' : '#1a2f6e';

    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f1f5f9', fontFamily: 'sans-serif' }}>
        <section style={{ width: '100%', maxWidth: 460, background: 'white', padding: 32, borderRadius: 14, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <h1 style={{ color, fontSize: 22 }}>{heading}</h1>
            <p style={{ color: '#475569', lineHeight: 1.7 }}>{message}</p>
            {status === 'error' && (
                <p style={{ fontSize: 13.5 }}>
                    <Link to="/resend-verification" style={{ color: '#1a2f6e', fontWeight: 600 }}>ขอลิงก์ยืนยันใหม่</Link>
                </p>
            )}
            <Link to="/login" style={{ color: '#1a2f6e' }}>ไปหน้าเข้าสู่ระบบ</Link>
        </section>
    </main>;
}