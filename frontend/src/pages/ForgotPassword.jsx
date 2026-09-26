import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';

export default function ForgotPassword() {
    const [email,setEmail] = useState('');
    const [message,setMessage] = useState('');
    const [loading,setLoading] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        try {
            setLoading(true);
            const response = await API.post('/auth/forgot-password', { email });
            setMessage(response.data.message);
        } catch (error) { setMessage(error.response?.data?.message || 'ไม่สามารถดำเนินการได้'); }
        finally { setLoading(false); }
    };
    return <main style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'#f1f5f9',fontFamily:'sans-serif' }}>
        <form onSubmit={submit} style={{ width:'100%',maxWidth:420,background:'white',padding:30,borderRadius:14 }}>
            <h1 style={{ color:'#1a2f6e',fontSize:24 }}>ลืมรหัสผ่าน</h1>
            <p>กรอกอีเมลที่ใช้ลงทะเบียน ระบบจะส่งลิงก์ที่ใช้ได้ 30 นาที</p>
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} style={{ width:'100%',padding:11,margin:'12px 0',boxSizing:'border-box' }}/>
            {message && <p style={{ color:'#1e3a8a' }}>{message}</p>}
            <button disabled={loading} style={{ padding:'10px 16px',background:'#1a2f6e',color:'white',border:0,borderRadius:6 }}>{loading?'กำลังส่ง...':'ส่งลิงก์'}</button>
            <div style={{ marginTop:18 }}><Link to="/login">กลับหน้าเข้าสู่ระบบ</Link></div>
        </form>
    </main>;
}
