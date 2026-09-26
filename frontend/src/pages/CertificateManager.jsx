import React, { useState, useEffect, useCallback } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';

const CertificateManager = () => {
    const [students, setStudents]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [msg, setMsg]                   = useState('');
    const [msgType, setMsgType]           = useState('success');
    const [generating, setGenerating]     = useState(null);

    const loadStudents = useCallback(() => {
        setLoading(true);
        API.get('/certificates/passed')
            .then(res => { if (res.data.success) setStudents(res.data.data); })
            .catch(() => { setMsg('❌ ไม่สามารถโหลดข้อมูลได้'); setMsgType('error'); })
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { loadStudents(); }, [loadStudents]);

    const handlePrint = async (regId, name) => {
        const win = window.open('', '_blank', 'width=960,height=780,scrollbars=yes');
        if (!win) { setMsg('❌ กรุณาอนุญาต popup สำหรับหน้านี้'); setMsgType('error'); return; }
        try {
            setGenerating(regId);
            const res = await API.get(`/certificates/${regId}`, { responseType:'blob' });
            const url = URL.createObjectURL(res.data);
            win.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            setMsg(`✅ เปิดใบรับรองของ ${name} สำเร็จ — ใช้คำสั่งพิมพ์ของเบราว์เซอร์เพื่อบันทึกเป็น PDF`);
            setMsgType('success');
        } catch (err) {
            win.close();
            setMsg('❌ เกิดข้อผิดพลาดในการสร้างใบรับรอง');
            setMsgType('error');
        } finally { setGenerating(null); }
    };

    const handleRevoke = async (registrationId) => {
        const reason = window.prompt('ระบุเหตุผลการเพิกถอนใบรับรอง');
        if (!reason) return;
        try {
            const response = await API.post(`/certificates/${registrationId}/revoke`, { reason });
            setMsg(`✅ ${response.data.message}`); setMsgType('success'); loadStudents();
        } catch (error) { setMsg(`❌ ${error.response?.data?.message||'เพิกถอนไม่สำเร็จ'}`); setMsgType('error'); }
    };

    const handleReissue = async (registrationId) => {
        if (!window.confirm('ยืนยันออกใบรับรองใหม่และเปลี่ยนรหัสตรวจสอบ?')) return;
        try {
            const response = await API.post(`/certificates/${registrationId}/reissue`);
            setMsg(`✅ ${response.data.message}`); setMsgType('success'); loadStudents();
        } catch (error) { setMsg(`❌ ${error.response?.data?.message||'ออกใหม่ไม่สำเร็จ'}`); setMsgType('error'); }
    };

    const filtered = students.filter(s =>
        !search || `${s.full_name} ${s.student_code} ${s.university_student_code||''} ${s.course_name}`.toLowerCase().includes(search.toLowerCase())
    );

    const fmtScore = (v) => v != null ? Number(v).toFixed(0) : '—';

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="ออกใบรับรองวุฒิบัตร" actions={[
                { label:'← กลับหน้า Admin', onClick:()=>goTo('/admin-report') }
            ]}/>
            <div className="rmuts-page__body">

                {/* Header stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
                    <div className="rmuts-stat-card rmuts-stat-card--green">
                        <div style={{ fontSize:24, marginBottom:4 }}>🏆</div>
                        <div className="rmuts-stat-card__value">{students.length}</div>
                        <div className="rmuts-stat-card__label">ผู้ผ่านเกณฑ์ทั้งหมด</div>
                    </div>
                    <div className="rmuts-stat-card rmuts-stat-card--gold">
                        <div style={{ fontSize:24, marginBottom:4 }}>📋</div>
                        <div className="rmuts-stat-card__value">{filtered.length}</div>
                        <div className="rmuts-stat-card__label">ผลการค้นหา</div>
                    </div>
                    <div className="rmuts-stat-card">
                        <div style={{ fontSize:24, marginBottom:4 }}>🖨️</div>
                        <div className="rmuts-stat-card__value" style={{ fontSize:14, color:'#64748b' }}>
                            กดปุ่ม "พิมพ์ใบรับรอง"<br/>เพื่อออกใบสำหรับแต่ละราย
                        </div>
                    </div>
                </div>

                {msg && (
                    <div className={`rmuts-alert rmuts-alert--${msgType==='success'?'success':'error'}`} style={{ marginBottom:16 }}>
                        {msg}
                        <button onClick={()=>setMsg('')} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:16 }}>✕</button>
                    </div>
                )}

                <div className="rmuts-card">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                        <div className="rmuts-card__title" style={{ margin:0, border:'none', padding:0 }}>
                            📋 รายชื่อผู้ผ่านการทดสอบมาตรฐานฝีมือแรงงาน
                        </div>
                        <input className="rmuts-search" style={{ width:280 }}
                            placeholder="ค้นหาชื่อ, รหัส, สาขา..."
                            value={search} onChange={e=>setSearch(e.target.value)}/>
                    </div>

                    {loading ? (
                        <div style={{ textAlign:'center', color:'#94a3b8', padding:60, fontSize:14 }}>⏳ กำลังโหลด...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign:'center', color:'#94a3b8', padding:60, fontSize:14 }}>
                            {students.length===0 ? '🎯 ยังไม่มีผู้ผ่านเกณฑ์การทดสอบ' : 'ไม่พบข้อมูลที่ค้นหา'}
                        </div>
                    ) : (
                        <div className="rmuts-table-wrap">
                            <table className="rmuts-table rmuts-table--striped">
                                <thead>
                                    <tr>
                                        {['รหัสนักศึกษา','ชื่อ-นามสกุล','สาขาวิชา','ทฤษฎี','ปฏิบัติ','รวม','ผลประเมิน','ใบรับรอง'].map(h=>(
                                            <th key={h} style={{ textAlign: ['ทฤษฎี','ปฏิบัติ','รวม'].includes(h)?'center':'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(s=>(
                                        <tr key={s.registration_id}>
                                            <td>
                                                <code style={{ fontSize:12, background:'#F4F6F7', padding:'2px 6px', borderRadius:4, letterSpacing:'0.5px' }}>
                                                    {s.university_student_code||'—'}
                                                </code>
                                                <div style={{fontSize:10,color:'#94a3b8',marginTop:3}}>{s.student_code}</div>
                                            </td>
                                            <td style={{ fontWeight:500 }}>{s.title}{s.full_name}</td>
                                            <td style={{ color:'#1a2f6e', fontSize:13 }}>{s.course_name}</td>
                                            <td style={{ textAlign:'center', fontWeight:600, color:'#2980B9' }}>
                                                {fmtScore(s.theory_score)}
                                                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>/{fmtScore(s.theory_max_score)}</div>
                                            </td>
                                            <td style={{ textAlign:'center', fontWeight:600, color:'#c47f00' }}>
                                                {fmtScore(s.practical_score)}
                                                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>/{fmtScore(s.practical_max_score)}</div>
                                            </td>
                                            <td style={{ textAlign:'center', fontWeight:700, color:'#27AE60', fontSize:15 }}>
                                                {fmtScore(s.total_score)}
                                                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>/100</div>
                                            </td>
                                            <td>
                                                <span className="rmuts-badge rmuts-badge--green">{s.department_status}</span>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={()=>handlePrint(s.registration_id, `${s.title||''}${s.full_name}`)}
                                                    disabled={generating===s.registration_id}
                                                    className="rmuts-btn rmuts-btn--gold rmuts-btn--sm"
                                                    style={{ opacity: generating===s.registration_id ? 0.6 : 1 }}>
                                                    {generating===s.registration_id ? '⏳ สร้าง...' : '🖨️ พิมพ์ใบรับรอง'}
                                                </button>
                                                {s.certificate_no && !s.revoked_at && <button onClick={()=>handleRevoke(s.registration_id)} className="rmuts-btn rmuts-btn--sm" style={{marginLeft:5,background:'#fee2e2',color:'#991b1b'}}>เพิกถอน</button>}
                                                {s.revoked_at && <button onClick={()=>handleReissue(s.registration_id)} className="rmuts-btn rmuts-btn--sm" style={{marginLeft:5,background:'#fef3c7',color:'#92400e'}}>ออกใหม่</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* คำแนะนำการพิมพ์ */}
                    {students.length > 0 && (
                        <div style={{ marginTop:16, background:'#EEF2FF', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#3730A3', border:'1px solid #C7D2FE' }}>
                            💡 <strong>วิธีพิมพ์:</strong> กดปุ่ม "พิมพ์ใบรับรอง" → หน้าต่างใบรับรองจะเปิดขึ้น → กด Ctrl+P หรือกด Print → เลือก "Save as PDF" หรือส่งไปเครื่องพิมพ์ได้เลย
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CertificateManager;
