import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const [ok, setOk] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (busy || ok) return;                       // กันกดซ้ำ / กันยิงหลัง token ถูกใช้ไปแล้ว
        if (password.length < 8) { setOk(false); setMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
        if (password !== confirm) { setOk(false); setMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
        setBusy(true); setMessage('');
        try {
            const response = await API.post('/auth/reset-password', { token, new_password: password });
            setOk(true);
            setMessage(response.data?.message || 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว');
            setTimeout(() => navigate('/login'), 2000);
        } catch (error) {
            setOk(false);
            setMessage(
                error.response?.data?.message
                || (!error.response ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง' : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้')
            );
        } finally {
            setBusy(false);
        }
    };

    const input = { width: '100%', padding: 11, margin: '8px 0', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 };

    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f1f5f9', fontFamily: 'sans-serif' }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 420, background: 'white', padding: 30, borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <h1 style={{ color: '#1a2f6e', fontSize: 24, marginTop: 0 }}>ตั้งรหัสผ่านใหม่</h1>
            <input type="password" required autoComplete="new-password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || ok} style={input} />
            <input type="password" required autoComplete="new-password" placeholder="ยืนยันรหัสผ่านใหม่"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy || ok} style={input} />
            {message && <p style={{
                padding: '10px 12px', borderRadius: 6, fontSize: 13.5, lineHeight: 1.6,
                background: ok ? '#EAFAF1' : '#FADBD8', color: ok ? '#1E8449' : '#78281F',
            }}>{ok ? '✅ ' : '⚠️ '}{message}{ok && ' — กำลังพาไปหน้าเข้าสู่ระบบ...'}</p>}
            <button type="submit" disabled={busy || ok} style={{
                padding: '10px 16px', background: (busy || ok) ? '#94a3b8' : '#1a2f6e', color: 'white',
                border: 0, borderRadius: 6, cursor: (busy || ok) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600,
            }}>{busy ? '⏳ กำลังบันทึก...' : 'บันทึกรหัสผ่าน'}</button>
            <div style={{ marginTop: 18 }}><Link to="/login" style={{ color: '#1a2f6e' }}>กลับหน้าเข้าสู่ระบบ</Link></div>
        </form>
    </main>;
}