import React, { useState } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import { goTo } from '../utils/navigation';

export default function ResubmitDocuments() {
    const [files, setFiles] = useState({ doc_id_card:null, doc_education:null, doc_photo:null });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        if (!Object.values(files).some(Boolean)) { setMessage('กรุณาเลือกเอกสารอย่างน้อยหนึ่งไฟล์'); return; }
        const data = new FormData();
        Object.entries(files).forEach(([name,file]) => { if (file) data.append(name,file); });
        try {
            setLoading(true); setMessage('');
            const response = await API.post('/student/documents/resubmit', data);
            setMessage(response.data.message);
            setTimeout(() => { goTo('/student-dashboard'); }, 1500);
        } catch (error) {
            setMessage(error.response?.data?.message || 'ไม่สามารถส่งเอกสารได้');
        } finally { setLoading(false); }
    };
    const input = (name,label) => <label style={{ display:'block', marginBottom:18, fontWeight:600 }}>
        {label}<input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e)=>setFiles((old)=>({...old,[name]:e.target.files[0]||null}))} style={{ display:'block', marginTop:8 }}/>
    </label>;
    return <div className="rmuts-page">
        <RmutsNavbar title="ส่งเอกสารเพิ่มเติม"/>
        <main style={{ width:'100%', maxWidth:620, margin:'32px auto', background:'white', padding:28, borderRadius:12 }}>
            <h1 style={{ color:'#1a2f6e', fontSize:24 }}>ส่งเอกสารใหม่</h1>
            <p>เลือกเฉพาะเอกสารที่ต้องการแก้ไข รองรับ JPG, PNG หรือ PDF ไม่เกิน 5 MB</p>
            <form onSubmit={submit}>
                {input('doc_id_card','สำเนาบัตรประชาชน')}
                {input('doc_education','เอกสารการศึกษา')}
                {input('doc_photo','รูปถ่าย')}
                {message && <div style={{ margin:'12px 0', color:'#92400e' }}>{message}</div>}
                <button disabled={loading} style={{ padding:'10px 18px', background:'#1a2f6e', color:'white', border:0, borderRadius:6 }}>{loading?'กำลังส่ง...':'ยืนยันส่งเอกสาร'}</button>
            </form>
        </main>
    </div>;
}
