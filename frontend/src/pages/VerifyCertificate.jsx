import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API from '../services/api';

export default function VerifyCertificate() {
    const { code } = useParams();
    const [state, setState] = useState({ loading:true, data:null, error:'' });
    useEffect(() => {
        API.get(`/certificates/verify/${code}`)
            .then((response) => setState({ loading:false, data:response.data, error:'' }))
            .catch((error) => setState({ loading:false, data:null, error:error.response?.data?.message || 'ไม่สามารถตรวจสอบได้' }));
    }, [code]);
    return <main style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#f1f5f9', padding:20, fontFamily:'sans-serif' }}>
        <section style={{ width:'100%', maxWidth:560, background:'white', padding:32, borderRadius:16, boxShadow:'0 10px 30px #0002' }}>
            <h1 style={{ color:'#1a2f6e' }}>ตรวจสอบใบรับรอง</h1>
            {state.loading && <p>กำลังตรวจสอบ...</p>}
            {state.error && <p style={{ color:'#b91c1c' }}>❌ {state.error}</p>}
            {state.data && <>
                <h2 style={{ color:state.data.valid?'#15803d':'#b91c1c' }}>{state.data.valid ? '✅ ใบรับรองถูกต้อง' : '❌ ใบรับรองถูกเพิกถอน'}</h2>
                <p>เลขที่: <strong>{state.data.data.certificate_no}</strong></p>
                <p>ชื่อ: {state.data.data.holder_name}</p>
                <p>สาขา: {state.data.data.course_name}</p>
                <p>คะแนนรวม: {state.data.data.total_score}</p>
            </>}
            <Link to="/login">กลับหน้าหลัก</Link>
        </section>
    </main>;
}
