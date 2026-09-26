import React, { useState, useEffect, useCallback } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';

const BarChart = ({ data }) => {
    const max = Math.max(...data.map(d=>d.value),1);
    return (
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:100, padding:'0 4px' }}>
            {data.map((d,i)=>(
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#1a2f6e' }}>{d.value}</div>
                    <div style={{ width:'100%', background:d.color||'#1a2f6e', borderRadius:'4px 4px 0 0', height:`${(d.value/max)*72}px`, minHeight:d.value>0?4:0, transition:'height 0.4s' }}/>
                    <div style={{ fontSize:10, color:'#64748b', textAlign:'center', lineHeight:1.3 }}>{d.label}</div>
                </div>
            ))}
        </div>
    );
};

const AdminReport = () => {
    const [stats, setStats]     = useState(null);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg]         = useState('');
    const [msgType, setMsgType] = useState('success');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [courseId, setCourseId]   = useState(null);
    const [courseCode, setCourseCode]   = useState('');
    const [courseName, setCourseName]   = useState('');
    const [examDate, setExamDate]       = useState('');
    const [examTime, setExamTime]       = useState('');
    const [examLocation, setExamLocation] = useState('');
    const [isEditing, setIsEditing]     = useState(false);
    const [regOpenDate,  setRegOpenDate]  = useState('');
    const [regCloseDate, setRegCloseDate] = useState('');
    const [maxSeats,     setMaxSeats]     = useState('');
    const [maxAttempts,  setMaxAttempts]  = useState('3');
    const [description,  setDescription] = useState('');

    const showMsg = useCallback((text, type='success') => { setMsg(text); setMsgType(type); setTimeout(()=>setMsg(''),4000); }, []);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [sR, cR] = await Promise.all([
                API.get('/reports/stats').catch(()=>({data:{success:false}})),
                API.get('/courses').catch(()=>({data:{data:[]}})),
            ]);
            if (sR.data.success) setStats(sR.data.data);
            if (cR.data.success) setCourses(cR.data.data);
        } catch { showMsg('ไม่สามารถโหลดข้อมูลได้','error'); }
        finally { setLoading(false); }
    }, [showMsg]);
    useEffect(()=>{ fetchAll(); },[fetchAll]);

    const handleSaveCourse = async (e) => {
        e.preventDefault();
        try {
            const payload = { course_code:courseCode, course_name:courseName, exam_date:examDate||null, exam_time:examTime||null, exam_location:examLocation||null, reg_open_date:regOpenDate||null, reg_close_date:regCloseDate||null, max_seats:maxSeats||null, max_attempts:maxAttempts||3, description:description||null };
            if (isEditing) { await API.put(`/courses/${courseId}`, payload); showMsg('แก้ไขข้อมูลวิชาสอบสำเร็จ'); }
            else { await API.post('/courses', payload); showMsg('เพิ่มวิชาสอบใหม่สำเร็จ'); }
            clearForm(); fetchAll();
        } catch (err) { showMsg(err.response?.data?.message||'เกิดข้อผิดพลาด','error'); }
    };
    const handleEdit = (c) => { setCourseId(c.course_id); setCourseCode(c.course_code||''); setCourseName(c.course_name); setExamDate(c.exam_date?c.exam_date.substring(0,10):''); setExamTime(c.exam_time||''); setExamLocation(c.exam_location||''); setRegOpenDate(c.reg_open_date?c.reg_open_date.substring(0,10):''); setRegCloseDate(c.reg_close_date?c.reg_close_date.substring(0,10):''); setMaxSeats(c.max_seats||''); setMaxAttempts(c.max_attempts||3); setDescription(c.description||''); setIsEditing(true); setActiveTab('courses'); };
    const handleDelete = async (id) => { if (!window.confirm('ยืนยันการลบวิชาสอบนี้?')) return; try { await API.delete(`/courses/${id}`); showMsg('ลบวิชาสอบสำเร็จ'); fetchAll(); } catch (err) { showMsg(err.response?.data?.message||'ไม่สามารถลบได้','error'); } };
    const handleToggle = async (c) => { try { await API.put(`/courses/${c.course_id}/toggle-status`,{current_status:c.course_status}); fetchAll(); } catch { showMsg('เปลี่ยนสถานะไม่สำเร็จ','error'); } };
    const clearStatusOverride = async (c) => { try { await API.delete(`/courses/${c.course_id}/status-override`); fetchAll(); } catch { showMsg('ไม่สามารถกลับไปใช้สถานะอัตโนมัติ','error'); } };
    const clearForm = () => { setCourseId(null); setCourseCode(''); setCourseName(''); setExamDate(''); setExamTime(''); setExamLocation(''); setRegOpenDate(''); setRegCloseDate(''); setMaxSeats(''); setMaxAttempts('3'); setDescription(''); setIsEditing(false); };
    const fmtDate = d => d?new Date(d).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const passRate = stats?(stats.total_scored>0?Math.round((stats.total_passed/stats.total_scored)*100):0):0;

    if (loading) return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--rmuts-bg)' }}>
            <div style={{ textAlign:'center', color:'#1a2f6e' }}><div style={{ fontSize:40 }}>⏳</div><div style={{ marginTop:8 }}>กำลังโหลด...</div></div>
        </div>
    );

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="ระบบบริหารจัดการ" actions={[
                { label:'👥 จัดการผู้ใช้งาน', onClick:()=>goTo('/user-management'), gold:true },
                { label:'🏅 ออกใบรับรอง', onClick:()=>goTo('/certificates') },
                { label:'📋 Audit Log', onClick:()=>goTo('/audit-log') },
            ]}/>
            <div className="rmuts-page__body">

                {msg && <div className={`rmuts-alert rmuts-alert--${msgType}`}>{msgType==='success'?'✅':'❌'} {msg}</div>}

                <div className="rmuts-tabs">
                    {[['dashboard','📊 ภาพรวมและสรุปผล'],['courses','⚙️ จัดการวิชาสอบ']].map(([id,label])=>(
                        <button key={id} className={`rmuts-tab${activeTab===id?' rmuts-tab--active':''}`} onClick={()=>setActiveTab(id)}>{label}</button>
                    ))}
                </div>

                {/* Dashboard */}
                {activeTab==='dashboard' && (
                    <div>
                        <div className="rmuts-stats-grid">
                            {[
                                { icon:'👥', label:'ผู้สมัครทั้งหมด', value:stats?.total_students??'—', sub:'นักศึกษาในระบบ', color:'navy' },
                                { icon:'⏳', label:'รอตรวจสอบเอกสาร', value:stats?.pending_verify??'—', sub:'รายการที่ต้องดำเนินการ', color:'gold' },
                                { icon:'✅', label:'อนุมัติเอกสาร', value:stats?.approved_students??'—', sub:'พร้อมสมัครสอบ', color:'green' },
                                { icon:'📝', label:'ใบสมัครสอบ', value:stats?.total_registrations??'—', sub:'รวมทุกสถานะ', color:'' },
                                { icon:'🏆', label:'อัตราผ่านการทดสอบ', value:`${passRate}%`, sub:`ผ่าน ${stats?.total_passed??0} / ${stats?.total_scored??0} ราย`, color:'green' },
                            ].map((s,i)=>(
                                <div key={i} className={`rmuts-stat-card${s.color?` rmuts-stat-card--${s.color}`:''}`}>
                                    <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
                                    <div className="rmuts-stat-card__value">{s.value}</div>
                                    <div className="rmuts-stat-card__label">{s.label}</div>
                                    <div className="rmuts-stat-card__sub">{s.sub}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
                            <div className="rmuts-card">
                                <div className="rmuts-card__title">📊 สถานะใบสมัครสอบ</div>
                                <BarChart data={[
                                    { label:'รอดำเนินการ', value:stats?.reg_waiting??0, color:'#F5A800' },
                                    { label:'อนุมัติแล้ว',  value:stats?.reg_approved??0, color:'#27AE60' },
                                    { label:'ปฏิเสธ',       value:stats?.reg_rejected??0, color:'#E74C3C' },
                                ]}/>
                            </div>
                            <div className="rmuts-card">
                                <div className="rmuts-card__title">🏅 ผลการประเมิน</div>
                                <BarChart data={[
                                    { label:'ได้รับวุฒิบัตร', value:stats?.total_passed??0, color:'#27AE60' },
                                    { label:'ไม่ผ่าน',        value:stats?.total_failed??0, color:'#E74C3C' },
                                    { label:'รอผล',           value:stats?.total_pending_score??0, color:'#95A5A6' },
                                ]}/>
                            </div>
                        </div>

                        {stats?.by_course?.length>0 && (
                            <div className="rmuts-card">
                                <div className="rmuts-card__title">📚 สรุปผลสอบแยกตามสาขาวิชา</div>
                                <div className="rmuts-table-wrap">
                                    <table className="rmuts-table rmuts-table--striped">
                                        <thead><tr>{['สาขาวิชา','สมัครสอบ','ประเมินแล้ว','ผ่าน','ไม่ผ่าน','อัตราผ่าน'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {stats.by_course.map((c,i)=>{
                                                const rate = c.scored>0?Math.round((c.passed/c.scored)*100):0;
                                                return (
                                                    <tr key={i}>
                                                        <td><strong>{c.course_name}</strong></td>
                                                        <td>{c.total}</td><td>{c.scored}</td>
                                                        <td style={{ color:'#27AE60', fontWeight:600 }}>{c.passed}</td>
                                                        <td style={{ color:'#E74C3C', fontWeight:600 }}>{c.failed}</td>
                                                        <td>
                                                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                                <div style={{ flex:1, background:'#ECF0F1', borderRadius:99, height:8, overflow:'hidden' }}>
                                                                    <div style={{ width:`${rate}%`, background:rate>=70?'#27AE60':'#E74C3C', height:'100%', borderRadius:99 }}/>
                                                                </div>
                                                                <span style={{ fontSize:12, fontWeight:600, color:rate>=70?'#27AE60':'#E74C3C', minWidth:32 }}>{rate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* จัดการวิชา */}
                {activeTab==='courses' && (
                    <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:24, alignItems:'start' }}>
                        <div className="rmuts-card">
                            <div className="rmuts-card__title">{isEditing?'✏️ แก้ไขวิชาสอบ':'➕ เพิ่มวิชาสอบใหม่'}</div>
                            <form onSubmit={handleSaveCourse}>
                                {/* ข้อมูลพื้นฐาน */}
                                <div style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',marginBottom:12,border:'1px solid #E2E8F0'}}>
                                    <div style={{fontSize:11,fontWeight:600,color:'#1a2f6e',marginBottom:8}}>📚 ข้อมูลวิชาสอบ</div>
                                    <div className="rmuts-form-group">
                                        <label className="rmuts-label">รหัสวิชา <span>*</span></label>
                                        <input className="rmuts-input rmuts-input--no-icon" value={courseCode} onChange={e=>setCourseCode(e.target.value)} placeholder="เช่น COMP-01" required/>
                                    </div>
                                    <div className="rmuts-form-group" style={{marginBottom:0}}>
                                        <label className="rmuts-label">ชื่อสาขาวิชา <span>*</span></label>
                                        <input className="rmuts-input rmuts-input--no-icon" value={courseName} onChange={e=>setCourseName(e.target.value)} placeholder="เช่น สาขาพนักงานคอมพิวเตอร์" required/>
                                    </div>
                                </div>
                                {/* ระยะเวลารับสมัคร */}
                                <div style={{background:'#FFFBEB',borderRadius:8,padding:'10px 12px',marginBottom:12,border:'1px solid #FDE68A'}}>
                                    <div style={{fontSize:11,fontWeight:600,color:'#92400E',marginBottom:8}}>⚡ ระยะเวลารับสมัคร (เปิด-ปิดอัตโนมัติ)</div>
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 10px'}}>
                                        <div className="rmuts-form-group">
                                            <label className="rmuts-label" style={{fontSize:11}}>วันเปิดรับสมัคร</label>
                                            <input type="date" required className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={regOpenDate} onChange={e=>setRegOpenDate(e.target.value)}/>
                                        </div>
                                        <div className="rmuts-form-group">
                                            <label className="rmuts-label" style={{fontSize:11}}>วันปิดรับสมัคร</label>
                                            <input type="date" required className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={regCloseDate} onChange={e=>setRegCloseDate(e.target.value)} min={regOpenDate||undefined}/>
                                        </div>
                                    </div>
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 10px'}}>
                                      <div className="rmuts-form-group" style={{marginBottom:0}}>
                                        <label className="rmuts-label" style={{fontSize:11}}>จำนวนที่นั่งสูงสุด</label>
                                        <input type="number" required min="1" className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={maxSeats} onChange={e=>setMaxSeats(e.target.value)} placeholder="เช่น 30"/>
                                      </div>
                                      <div className="rmuts-form-group" style={{marginBottom:0}}>
                                        <label className="rmuts-label" style={{fontSize:11}}>จำนวนครั้งสอบสูงสุด</label>
                                        <input type="number" required min="1" max="10" className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={maxAttempts} onChange={e=>setMaxAttempts(e.target.value)}/>
                                      </div>
                                    </div>
                                    {regOpenDate&&regCloseDate&&(
                                        <div style={{fontSize:10,color:'#92400E',background:'rgba(245,168,0,0.1)',borderRadius:4,padding:'4px 8px',marginTop:6}}>
                                            💡 ระบบจะเปิด-ปิดรับสมัครอัตโนมัติตามวันที่กำหนด
                                        </div>
                                    )}
                                </div>
                                {/* ข้อมูลการสอบ */}
                                <div style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',marginBottom:12,border:'1px solid #E2E8F0'}}>
                                    <div style={{fontSize:11,fontWeight:600,color:'#1a2f6e',marginBottom:8}}>📅 ข้อมูลการสอบ</div>
                                    <div className="rmuts-form-group">
                                        <label className="rmuts-label" style={{fontSize:11}}>วันที่สอบ</label>
                                        <input type="date" className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={examDate} onChange={e=>setExamDate(e.target.value)}/>
                                    </div>
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 10px'}}>
                                        <div className="rmuts-form-group" style={{marginBottom:0}}>
                                            <label className="rmuts-label" style={{fontSize:11}}>เวลาสอบ</label>
                                            <input className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={examTime} onChange={e=>setExamTime(e.target.value)} placeholder="09:00–12:00"/>
                                        </div>
                                        <div className="rmuts-form-group" style={{marginBottom:0}}>
                                            <label className="rmuts-label" style={{fontSize:11}}>สถานที่สอบ</label>
                                            <input className="rmuts-input rmuts-input--no-icon" style={{fontSize:12,padding:'7px 10px'}} value={examLocation} onChange={e=>setExamLocation(e.target.value)} placeholder="ห้อง 302"/>
                                        </div>
                                    </div>
                                </div>
                                <div style={{display:'flex',gap:8}}>
                                    <button type="submit" className="rmuts-btn rmuts-btn--primary" style={{flex:1,fontSize:13}}>{isEditing?'💾 บันทึก':'➕ เพิ่มวิชา'}</button>
                                    {isEditing&&<button type="button" className="rmuts-btn rmuts-btn--outline" style={{fontSize:13}} onClick={clearForm}>ยกเลิก</button>}
                                </div>
                            </form>
                        </div>
                        <div className="rmuts-card">
                            <div className="rmuts-card__title">⚙️ รายการสาขาวิชาทั้งหมด ({courses.length} วิชา)</div>
                            <div className="rmuts-table-wrap">
                                <table className="rmuts-table rmuts-table--striped">
                                    <thead><tr>{['รหัส','ชื่อวิชา','วันสอบ','เวลา','สถานะ','จัดการ'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {courses.length===0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>ยังไม่มีวิชาสอบ</td></tr>
                                        : courses.map(c=>(
                                            <tr key={c.course_id}>
                                                <td><code style={{ fontSize:12, background:'#F4F6F7', padding:'2px 6px', borderRadius:4 }}>{c.course_code}</code></td>
                                                <td style={{ fontWeight:500 }}>{c.course_name}</td>
                                                <td style={{ fontSize:12 }}>{fmtDate(c.exam_date)}</td>
                                                <td style={{ fontSize:12 }}>{c.exam_time||'—'}</td>
                                                <td>
                                                    <button onClick={()=>handleToggle(c)} className="rmuts-btn rmuts-btn--sm" style={{ background:c.course_status==='เปิดรับสมัคร'?'#27AE60':'#95A5A6', color:'white', borderRadius:99 }}>
                                                        {c.course_status==='เปิดรับสมัคร'?'🟢 เปิดรับ':c.course_status==='ยังไม่เปิดรับสมัคร'?'🕒 ยังไม่เปิด':'🔴 ปิดรับ'}
                                                    </button>
                                                    {c.status_override && <button onClick={()=>clearStatusOverride(c)} className="rmuts-btn rmuts-btn--sm" style={{ marginLeft:4 }} title="กลับไปคำนวณสถานะตามวันที่">อัตโนมัติ</button>}
                                                </td>
                                                <td style={{ whiteSpace:'nowrap' }}>
                                                    <button onClick={()=>handleEdit(c)} className="rmuts-btn rmuts-btn--gold rmuts-btn--sm" style={{ marginRight:4 }}>แก้ไข</button>
                                                    <button onClick={()=>handleDelete(c.course_id)} className="rmuts-btn rmuts-btn--danger rmuts-btn--sm">ลบ</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default AdminReport;
