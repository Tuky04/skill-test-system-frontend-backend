import React, { useState, useEffect, useCallback } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';

const StudentVerification = () => {
    const [students, setStudents]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [selected, setSelected]     = useState(null);
    const [action, setAction]         = useState({ status:'', note:'' });
    const [saving, setSaving]         = useState(false);
    const [msg, setMsg]               = useState('');
    const [msgType, setMsgType]       = useState('success');
    const [search, setSearch]         = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('');

    const showMsg = useCallback((text, type='success') => { setMsg(text); setMsgType(type); setTimeout(()=>setMsg(''),4000); }, []);

    const fetchStudents = useCallback(async () => {
        try { setLoading(true); const res = await API.get('/staff/pending-registrations'); setStudents(res.data.data||[]); }
        catch { showMsg('โหลดข้อมูลไม่สำเร็จ','error'); }
        finally { setLoading(false); }
    }, [showMsg]);

    useEffect(()=>{ fetchStudents(); },[fetchStudents]);

    const handleVerify = async () => {
        if (!action.status) { showMsg('กรุณาเลือกผลการตรวจสอบ','error'); return; }
        try {
            setSaving(true);
            await API.put(`/staff/students/${selected.student_id}/verify`, action);
            showMsg(`✅ อัปเดตสถานะ "${action.status}" สำหรับ ${selected.full_name} สำเร็จ`);
            setSelected(null); setAction({ status:'', note:'' }); fetchStudents();
        } catch (err) { showMsg(err.response?.data?.message||'เกิดข้อผิดพลาด','error'); }
        finally { setSaving(false); }
    };

    const openPreview = async (filename, title) => {
        try {
            const response = await API.get(`/documents/${encodeURIComponent(filename)}`, { responseType:'blob' });
            setPreviewUrl((oldUrl) => { if (oldUrl) URL.revokeObjectURL(oldUrl); return URL.createObjectURL(response.data); });
            setPreviewTitle(title);
        } catch (error) {
            showMsg(error.response?.data?.message || 'ไม่สามารถเปิดเอกสารได้', 'error');
        }
    };

    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    const filtered = students.filter(s =>
        !search || `${s.full_name} ${s.student_code} ${s.university_student_code||''} ${s.id_card_number}`.toLowerCase().includes(search.toLowerCase())
    );

    const StatusBadge = ({ s }) => {
        const map = { 'รอตรวจสอบเอกสาร':'warning','เอกสารไม่ครบ':'red','อนุมัติ':'green' };
        return <span className={`rmuts-badge rmuts-badge--${map[s]||'gray'}`}>{s}</span>;
    };

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="ตรวจสอบเอกสารผู้สมัคร" actions={[
                { label:'← แผงควบคุม', onClick:()=>goTo('/grading-panel') }
            ]}/>
            <div className="rmuts-page__body">

                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                    <div>
                        <h2 style={{ color:'#1a2f6e', margin:0, fontSize:20, fontWeight:700 }}>📋 ตรวจสอบเอกสารผู้สมัคร</h2>
                        <p style={{ color:'#64748b', margin:'6px 0 0', fontSize:14 }}>รายการที่รอตรวจสอบ <strong>{students.length}</strong> ราย</p>
                    </div>
                </div>

                {msg && <div className={`rmuts-alert rmuts-alert--${msgType}`}>{msg} <button onClick={()=>setMsg('')} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:16 }}>✕</button></div>}

                <div style={{ marginBottom:16 }}>
                    <input className="rmuts-search" style={{ width:320 }} placeholder="ค้นหาชื่อ, รหัส, เลขบัตร..." value={search} onChange={e=>setSearch(e.target.value)}/>
                </div>

                <div className="rmuts-card" style={{ padding:0, overflow:'hidden' }}>
                    {loading ? (
                        <div style={{ textAlign:'center', color:'#94a3b8', padding:60 }}>⏳ กำลังโหลด...</div>
                    ) : filtered.length===0 ? (
                        <div style={{ textAlign:'center', color:'#94a3b8', padding:60 }}>{search?'ไม่พบข้อมูลที่ค้นหา':'🎉 ไม่มีรายการรอตรวจสอบ'}</div>
                    ) : (
                        <div className="rmuts-table-wrap" style={{ border:'none', borderRadius:0 }}>
                            <table className="rmuts-table rmuts-table--striped">
                                <thead><tr>{['รหัส','ชื่อ-นามสกุล','เลขบัตร','เบอร์โทร','การศึกษา','เอกสารแนบ','สถานะ','วันที่สมัคร','ดำเนินการ'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {filtered.map(s=>(
                                        <tr key={s.student_id}>
                                            <td><code style={{ fontSize:12, background:'#F4F6F7', padding:'2px 6px', borderRadius:4 }}>{s.university_student_code||'—'}</code><div style={{fontSize:10,color:'#94a3b8',marginTop:3}}>{s.student_code}</div></td>
                                            <td><div style={{ fontWeight:500 }}>{s.full_name}</div><div style={{ fontSize:12, color:'#64748b' }}>{s.email}</div></td>
                                            <td style={{ fontSize:12 }}>{s.id_card_number||'—'}</td>
                                            <td>{s.phone_number||'—'}</td>
                                            <td style={{ fontSize:12 }}>{s.highest_education||'—'}</td>
                                            <td style={{ whiteSpace:'nowrap' }}>
                                                {s.doc_id_card && <button className="rmuts-btn rmuts-btn--sm" style={{ background:'#EBF5FB', color:'#1A5276', marginRight:4, marginBottom:4 }} onClick={()=>openPreview(s.doc_id_card,'สำเนาบัตรประชาชน')}>🪪 บัตร</button>}
                                                {s.doc_education && <button className="rmuts-btn rmuts-btn--sm" style={{ background:'#EAFAF1', color:'#1E8449', marginRight:4, marginBottom:4 }} onClick={()=>openPreview(s.doc_education,'วุฒิการศึกษา')}>🎓 วุฒิ</button>}
                                                {s.doc_photo && <button className="rmuts-btn rmuts-btn--sm" style={{ background:'#FEF9E7', color:'#7D6608', marginBottom:4 }} onClick={()=>openPreview(s.doc_photo,'รูปถ่าย')}>📷 รูป</button>}
                                                {!s.doc_id_card && !s.doc_education && !s.doc_photo && <span style={{ fontSize:12, color:'#BDC3C7' }}>ไม่มีไฟล์</span>}
                                            </td>
                                            <td><StatusBadge s={s.registration_status}/></td>
                                            <td style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>
                                                {new Date(s.created_at).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'})}
                                            </td>
                                            <td>
                                                <button className="rmuts-btn rmuts-btn--primary rmuts-btn--sm" onClick={()=>{ setSelected(s); setAction({status:'',note:''}); setMsg(''); }}>ตรวจสอบ</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal ตรวจสอบ */}
                {selected && (
                    <div className="rmuts-overlay" onClick={()=>setSelected(null)}>
                        <div className="rmuts-modal" onClick={e=>e.stopPropagation()}>
                            <div style={{ borderBottom:'3px solid #F5A800', paddingBottom:14, marginBottom:18 }}>
                                <div className="rmuts-modal__title">🔍 ตรวจสอบเอกสาร</div>
                                <div style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{selected.full_name} — รหัสนักศึกษา {selected.university_student_code||'—'} — รหัสผู้สมัคร {selected.student_code}</div>
                            </div>

                            {/* ข้อมูลผู้สมัคร */}
                            <div className="rmuts-section-box">
                                <div className="rmuts-section-box__title">ข้อมูลผู้สมัคร</div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:13 }}>
                                    {[['เลขบัตร', selected.id_card_number],['เบอร์โทร', selected.phone_number],['การศึกษา', selected.highest_education],['สาขา', selected.education_major],['อีเมล', selected.email],['สถานะงาน', selected.employment_status]].map(([k,v])=>(
                                        <div key={k}><span style={{ color:'#64748b' }}>{k}:</span> <strong>{v||'—'}</strong></div>
                                    ))}
                                </div>
                            </div>

                            {/* เอกสาร */}
                            <div style={{ marginBottom:16 }}>
                                <div style={{ fontWeight:500, fontSize:13, color:'#374151', marginBottom:8 }}>เอกสารแนบ — คลิกเพื่อดู</div>
                                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                    {selected.doc_id_card ? <button className="rmuts-btn rmuts-btn--sm" style={{ background:'#EBF5FB', color:'#1A5276' }} onClick={()=>openPreview(selected.doc_id_card,'สำเนาบัตรประชาชน')}>🪪 สำเนาบัตรประชาชน</button> : <span style={{ fontSize:12, color:'#BDC3C7' }}>🪪 ไม่มีสำเนาบัตร</span>}
                                    {selected.doc_education ? <button className="rmuts-btn rmuts-btn--sm" style={{ background:'#EAFAF1', color:'#1E8449' }} onClick={()=>openPreview(selected.doc_education,'วุฒิการศึกษา')}>🎓 วุฒิการศึกษา</button> : <span style={{ fontSize:12, color:'#BDC3C7' }}>🎓 ไม่มีวุฒิ</span>}
                                    {selected.doc_photo ? <button className="rmuts-btn rmuts-btn--sm" style={{ background:'#FEF9E7', color:'#7D6608' }} onClick={()=>openPreview(selected.doc_photo,'รูปถ่าย')}>📷 รูปถ่าย</button> : <span style={{ fontSize:12, color:'#BDC3C7' }}>📷 ไม่มีรูปถ่าย</span>}
                                </div>
                            </div>

                            {selected.verify_note && <div className="rmuts-info-box" style={{ background:'#FEF9E7', color:'#7D6608' }}><strong>หมายเหตุก่อนหน้า:</strong> {selected.verify_note}</div>}

                            <label className="rmuts-label">ผลการตรวจสอบ <span>*</span></label>
                            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                                {['อนุมัติ','เอกสารไม่ครบ'].map(s=>(
                                    <label key={s} style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'10px 14px', border:`2px solid ${action.status===s?(s==='อนุมัติ'?'#27AE60':'#F5A800'):'#E2E8F0'}`, borderRadius:8, cursor:'pointer', background:action.status===s?(s==='อนุมัติ'?'#EAFAF1':'#FEF9E7'):'white' }}>
                                        <input type="radio" name="status" value={s} checked={action.status===s} onChange={()=>setAction(a=>({...a,status:s}))}/>
                                        {s==='อนุมัติ'?'✅ อนุมัติ':'⚠️ เอกสารไม่ครบ'}
                                    </label>
                                ))}
                            </div>

                            <label className="rmuts-label">หมายเหตุ {action.status==='เอกสารไม่ครบ'&&<span>(ระบุเอกสารที่ขาด)</span>}</label>
                            <textarea className="rmuts-input rmuts-input--no-icon" style={{ height:80, resize:'vertical', marginBottom:4 }} placeholder={action.status==='เอกสารไม่ครบ'?'เช่น: ขาดสำเนาวุฒิการศึกษา':'หมายเหตุเพิ่มเติม (ถ้ามี)'} value={action.note} onChange={e=>setAction(a=>({...a,note:e.target.value}))}/>

                            <div style={{ display:'flex', gap:10, marginTop:16 }}>
                                <button className="rmuts-btn rmuts-btn--outline" style={{ flex:1 }} onClick={()=>setSelected(null)}>ยกเลิก</button>
                                <button style={{ flex:2, padding:12, color:'white', border:'none', borderRadius:8, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:600, opacity:saving?0.7:1, background:action.status==='อนุมัติ'?'#27AE60':action.status==='เอกสารไม่ครบ'?'#F5A800':'#95A5A6' }} onClick={handleVerify} disabled={saving}>
                                    {saving?'⏳ กำลังบันทึก...':'ยืนยันการดำเนินการ'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview เอกสาร */}
                {previewUrl && (
                    <div className="rmuts-overlay" onClick={()=>setPreviewUrl(null)}>
                        <div style={{ background:'white', borderRadius:12, padding:20, width:'90%', maxWidth:860, maxHeight:'92vh', overflow:'auto', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                                <strong style={{ color:'#1a2f6e', fontSize:15 }}>📄 {previewTitle}</strong>
                                <div style={{ display:'flex', gap:8 }}>
                                    <a href={previewUrl} target="_blank" rel="noreferrer" className="rmuts-btn rmuts-btn--sm rmuts-btn--outline">🔗 เปิดในแท็บใหม่</a>
                                    <button className="rmuts-btn rmuts-btn--danger rmuts-btn--sm" onClick={()=>setPreviewUrl(null)}>✕ ปิด</button>
                                </div>
                            </div>
                            {previewUrl.toLowerCase().includes('.pdf')
                                ? <iframe src={previewUrl} style={{ width:'100%', height:560, border:'none', borderRadius:8 }} title="document"/>
                                : <img src={previewUrl} alt="document" style={{ maxWidth:'100%', borderRadius:8, display:'block', margin:'0 auto' }}/>
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default StudentVerification;
