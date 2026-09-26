import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import API from '../services/api';
import '../styles/theme.css';

// ✅ แก้ข้อ 1&2: import รูปตราโดยตรงจาก src ไม่ใช้ process.env.PUBLIC_URL
import sealImg from '../assets/rmuts-seal.png';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const fmtDate = d => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return '—'; }
};
const daysLeft = d => {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 86400000);
};

// ── Status Pill ────────────────────────────────────────────────
const StatusPill = ({ status }) => {
    const map = {
        'เปิดรับสมัคร':      { bg:'#27AE60', text:'🟢 เปิดรับสมัคร' },
        'ยังไม่เปิดรับสมัคร': { bg:'#F5A800', text:'🟡 เร็วๆ นี้' },
        'ปิดรับสมัคร':       { bg:'#95A5A6', text:'🔴 ปิดรับสมัคร' },
    };
    const s = map[status] || map['ปิดรับสมัคร'];
    return (
        <span style={{ background:s.bg, color:'white', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600, whiteSpace:'nowrap', display:'inline-block' }}>
            {s.text}
        </span>
    );
};

// ── Course Mini Card (ฝั่งซ้าย dashboard) ────────────────────
const CourseMiniCard = ({ c }) => {
    const isOpen     = c.course_status === 'เปิดรับสมัคร';
    const isUpcoming = c.course_status === 'ยังไม่เปิดรับสมัคร';
    const closeLeft  = daysLeft(c.reg_close_date);

    return (
        <div style={{
            padding:'10px 12px',
            borderRadius:8,
            background: isOpen ? '#F0FDF4' : isUpcoming ? '#FFFBEB' : '#F8FAFC',
            border:`1px solid ${isOpen?'#BBF7D0':isUpcoming?'#FDE68A':'#E2E8F0'}`,
            borderLeft:`3px solid ${isOpen?'#27AE60':isUpcoming?'#F5A800':'#CBD5E1'}`,
            marginBottom:6,
        }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:'#1e293b', lineHeight:1.4, flex:1 }}>
                    {c.course_name}
                </div>
                <StatusPill status={c.course_status}/>
            </div>
            <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px', fontSize:11 }}>
                <div style={{ color:'#64748b' }}>
                    🔒 ปิดรับ: <strong style={{ color: closeLeft!==null&&closeLeft<=7&&isOpen?'#dc2626':'#374151' }}>
                        {fmtDate(c.reg_close_date)}
                    </strong>
                </div>
                <div style={{ color:'#64748b' }}>
                    💺 ที่นั่ง: <strong style={{ color:'#374151' }}>{c.max_seats ? `${c.max_seats} ที่` : '—'}</strong>
                </div>
            </div>
            {isOpen && closeLeft !== null && closeLeft >= 0 && closeLeft <= 14 && (
                <div style={{ marginTop:5, fontSize:10.5, color:'#dc2626', fontWeight:600 }}>
                    ⚠️ ปิดรับสมัครใน {closeLeft} วัน
                </div>
            )}
            {isUpcoming && daysLeft(c.reg_open_date) !== null && daysLeft(c.reg_open_date) >= 0 && (
                <div style={{ marginTop:5, fontSize:10.5, color:'#92400E', fontWeight:600 }}>
                    🔔 เปิดรับสมัครใน {daysLeft(c.reg_open_date)} วัน
                </div>
            )}
        </div>
    );
};

// ── Main ───────────────────────────────────────────────────────
const Login = () => {
    const navigate = useNavigate();
    const [username, setUsername]           = useState('');
    const [password, setPassword]           = useState('');
    const [showPass, setShowPass]           = useState(false);
    const [errorMsg, setErrorMsg]           = useState('');
    const [loginLoading, setLoginLoading]   = useState(false);
    const [courses, setCourses]             = useState([]);
    const [coursesLoading, setCoursesLoading] = useState(true);
    const [filterStatus, setFilterStatus]   = useState('all');

    // ✅ ใช้ axios ตรงๆ ไม่ผ่าน interceptor (ป้องกัน redirect loop)
    const fetchPublicCourses = useCallback(async () => {
        try {
            const res = await axios.get(`${BASE_URL}/courses/public`);
            if (res.data?.success) setCourses(res.data.data || []);
        } catch {}
        finally { setCoursesLoading(false); }
    }, []);

    useEffect(() => { fetchPublicCourses(); }, [fetchPublicCourses]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!username || !password) { setErrorMsg('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
        try {
            setLoginLoading(true);
            const res = await API.post('/login', { username, password });
            if (res.data?.success || res.data?.token) {
                const user = res.data.user || {};
                const role = user.role?.toLowerCase() || '';
                sessionStorage.setItem('token',      res.data.token);
                localStorage.setItem('role',         role);
                localStorage.setItem('user',         JSON.stringify(user));
                if      (role === 'admin')   navigate('/admin-report');
                else if (role === 'staff')   navigate('/grading-panel');
                else if (role === 'student') navigate('/student-dashboard');
                else setErrorMsg('บทบาทผู้ใช้งานไม่ถูกต้องในระบบ');
            } else {
                setErrorMsg(res.data?.message || 'ไม่สามารถเข้าสู่ระบบได้');
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        } finally { setLoginLoading(false); }
    };

    const openCount     = courses.filter(c => c.course_status === 'เปิดรับสมัคร').length;
    const upcomingCount = courses.filter(c => c.course_status === 'ยังไม่เปิดรับสมัคร').length;
    const filteredCourses = courses.filter(c => {
        if (filterStatus === 'open')     return c.course_status === 'เปิดรับสมัคร';
        if (filterStatus === 'upcoming') return c.course_status === 'ยังไม่เปิดรับสมัคร';
        if (filterStatus === 'closed')   return c.course_status === 'ปิดรับสมัคร';
        return true;
    });

    return (
        <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Sarabun',sans-serif", background:'#F0F2F5' }}>

            {/* ── Top Bar เหลือง ── */}
            <div style={{ background:'linear-gradient(90deg,#c47f00,#F5A800,#ffd166)', padding:'5px 20px', display:'flex', alignItems:'center', gap:8 }}>
                {/* ✅ ข้อ 1: ใช้ sealImg import แทน PUBLIC_URL */}
                <img src={sealImg} alt="" style={{ width:22, height:22, objectFit:'contain', mixBlendMode:'multiply' }}/>
                <div>
                    <div style={{ fontFamily:"'Noto Serif Thai',serif", fontSize:11.5, fontWeight:700, color:'#1a2f6e' }}>มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ</div>
                    <div style={{ fontSize:9.5, color:'#1a2f6e', opacity:0.65 }}>คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ · Rajamangala University of Technology Suvarnabhumi</div>
                </div>
            </div>

            {/* ── Navbar น้ำเงิน ── */}
            <div style={{ background:'linear-gradient(90deg,#0d1e4a,#1a2f6e)', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #F5A800', boxShadow:'0 2px 12px rgba(13,30,74,0.25)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <img src={sealImg} alt="" style={{ width:30, height:30, objectFit:'contain', mixBlendMode:'screen', filter:'brightness(1.15)' }}/>
                    <div>
                        <div style={{ fontFamily:"'Noto Serif Thai',serif", fontSize:15, fontWeight:700, color:'#F5A800' }}>ระบบทดสอบมาตรฐานฝีมือแรงงาน</div>
                        <div style={{ fontSize:10, color:'rgba(245,168,0,0.55)', letterSpacing:'0.5px' }}>SKILL TEST MANAGEMENT SYSTEM</div>
                    </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                    {openCount > 0 && <span style={{ background:'rgba(39,174,96,0.2)', color:'#6ee7b7', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>🟢 เปิดรับ {openCount} วิชา</span>}
                    {upcomingCount > 0 && <span style={{ background:'rgba(245,168,0,0.15)', color:'#fcd34d', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>🔔 เร็วๆ นี้ {upcomingCount} วิชา</span>}
                </div>
            </div>

            {/* ── Main 2-col layout ── */}
            <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px 20px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20, width:'100%', maxWidth:1100, alignItems:'start' }}>

                    {/* ── ซ้าย: Login Card ── */}
                    <div style={{ background:'white', borderRadius:14, overflow:'hidden', boxShadow:'0 8px 28px rgba(13,30,74,0.1), 0 0 0 1px rgba(26,47,110,0.06)' }}>

                        {/* Card header */}
                        <div style={{ background:'linear-gradient(160deg,#0d1e4a,#1a2f6e)', padding:'20px 24px 16px', textAlign:'center', borderBottom:'3px solid #F5A800', position:'relative', overflow:'hidden' }}>
                            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(245,168,0,0.06)' }}/>
                            {/* ✅ ข้อ 2: โลโก้ตรงกลาง card */}
                            <div style={{ width:72, height:72, margin:'0 auto 10px', borderRadius:'50%', background:'rgba(245,168,0,0.1)', border:'2px solid rgba(245,168,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                                <img src={sealImg} alt="ตรา มทร.สุวรรณภูมิ"
                                    style={{ width:68, height:68, objectFit:'contain', mixBlendMode:'screen', filter:'brightness(1.1)' }}
                                />
                            </div>
                            <div style={{ fontFamily:"'Noto Serif Thai',serif", fontSize:12, fontWeight:700, color:'#F5A800', lineHeight:1.7 }}>
                                คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ<br/>มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ
                            </div>
                            <div style={{ width:44, height:2, background:'linear-gradient(90deg,transparent,#F5A800,transparent)', margin:'8px auto 0' }}/>
                        </div>

                        {/* Form */}
                        <div style={{ padding:'20px 22px 22px' }}>
                            <div style={{ fontSize:17, fontWeight:700, color:'#0d1e4a', marginBottom:2 }}>เข้าสู่ระบบ</div>
                            <div style={{ fontSize:12, color:'#64748b', marginBottom:16, paddingBottom:14, borderBottom:'1px solid #f0f4f8' }}>
                                กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ
                            </div>

                            {errorMsg && (
                                <div className="rmuts-alert rmuts-alert--error" style={{ marginBottom:14, fontSize:12.5 }}>
                                    ⚠️ {errorMsg}
                                </div>
                            )}

                            <form onSubmit={handleLogin}>
                                <div className="rmuts-form-group">
                                    <label className="rmuts-label">ชื่อผู้ใช้งาน <span>*</span></label>
                                    <div className="rmuts-input-wrap">
                                        <i className="ti ti-user rmuts-input-icon" aria-hidden="true"/>
                                        <input className="rmuts-input" type="text" value={username}
                                            onChange={e=>setUsername(e.target.value)}
                                            placeholder="กรอกชื่อผู้ใช้งาน" required autoComplete="username"/>
                                    </div>
                                </div>
                                <div className="rmuts-form-group">
                                    <label className="rmuts-label">รหัสผ่าน <span>*</span></label>
                                    <div className="rmuts-input-wrap">
                                        <i className="ti ti-lock rmuts-input-icon" aria-hidden="true"/>
                                        <input className="rmuts-input" type={showPass?'text':'password'} value={password}
                                            onChange={e=>setPassword(e.target.value)}
                                            placeholder="กรอกรหัสผ่าน" required autoComplete="current-password"/>
                                        <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:13, padding:2 }}>
                                            {showPass ? '🙈' : '👁'}
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" disabled={loginLoading} style={{
                                    width:'100%', padding:11,
                                    background: loginLoading ? '#94a3b8' : 'linear-gradient(135deg,#0d1e4a,#1a2f6e)',
                                    color:'white', border:'none', borderRadius:8,
                                    fontSize:14, fontWeight:700, cursor: loginLoading?'not-allowed':'pointer',
                                    boxShadow:'0 4px 14px rgba(13,30,74,0.25)',
                                    position:'relative', overflow:'hidden',
                                }}>
                                    <span style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#c47f00,#F5A800,#c47f00)' }}/>
                                    {loginLoading ? '⏳ กำลังตรวจสอบ...' : '🔐 เข้าสู่ระบบ'}
                                </button>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))', gap:8, marginTop:10 }}>
                                    <Link to="/forgot-password" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, minHeight:36, padding:'6px 9px', boxSizing:'border-box', color:'#475569', background:'#F8FAFC', border:'1px solid #CBD5E1', borderRadius:7, textDecoration:'none', fontSize:11.5, fontWeight:600, textAlign:'center' }}>
                                        <span aria-hidden="true">🔑</span> ลืมรหัสผ่าน
                                    </Link>
                                    <Link to="/resend-verification" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, minHeight:36, padding:'6px 9px', boxSizing:'border-box', color:'#1a2f6e', background:'#EEF2FF', border:'1px solid #C7D2FE', borderRadius:7, textDecoration:'none', fontSize:11.5, fontWeight:600, textAlign:'center' }}>
                                        <span aria-hidden="true">✉️</span> ส่งอีเมลยืนยันใหม่
                                    </Link>
                                </div>
                            </form>

                            {/* Role badges */}
                            <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:12, flexWrap:'wrap' }}>
                                {[['👨‍💼 ผู้ดูแล','#EEF2FF','#3730A3'],['👩‍🏫 เจ้าหน้าที่','#FEF3C7','#92400E'],['🎓 นักศึกษา','#ECFDF5','#065F46']].map(([l,bg,c])=>(
                                    <span key={l} style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:bg, color:c, fontWeight:600 }}>{l}</span>
                                ))}
                            </div>

                            <div style={{ textAlign:'center', marginTop:12, paddingTop:11, borderTop:'1px solid #f1f5f9', fontSize:12.5, color:'#64748b' }}>
                                ยังไม่มีบัญชี? <Link to="/register" style={{ color:'#1a2f6e', fontWeight:700, textDecoration:'none' }}>สมัครสมาชิก →</Link>
                            </div>
                        </div>

                        <div style={{ background:'#f8fafc', borderTop:'1px solid #e8ecf0', padding:'7px 22px', textAlign:'center', fontSize:10, color:'#94a3b8' }}>
                            🔒 SSL Encrypted &nbsp;·&nbsp; © 2568 มทร.สุวรรณภูมิ
                        </div>
                    </div>

                    {/* ✅ ข้อ 3&4: ขวา: Dashboard วิชาสอบ — compact และทางการ */}
                    <div style={{ background:'white', borderRadius:14, overflow:'hidden', boxShadow:'0 8px 28px rgba(13,30,74,0.08), 0 0 0 1px rgba(26,47,110,0.05)' }}>

                        {/* Header */}
                        <div style={{ background:'linear-gradient(135deg,#0d1e4a,#1a2f6e)', padding:'14px 18px', borderBottom:'3px solid #F5A800', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                                <div style={{ fontFamily:"'Noto Serif Thai',serif", fontSize:14, fontWeight:700, color:'#F5A800' }}>ตารางรับสมัครสอบมาตรฐานฝีมือแรงงาน</div>
                                <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.45)', marginTop:1 }}>
                                    {coursesLoading ? 'กำลังโหลด...' : `ทั้งหมด ${courses.length} สาขาวิชา`}
                                </div>
                            </div>
                            <div style={{ display:'flex', gap:5 }}>
                                {openCount>0 && <span style={{ background:'rgba(39,174,96,0.2)', color:'#6ee7b7', borderRadius:99, padding:'3px 9px', fontSize:11, fontWeight:600 }}>เปิดรับ {openCount}</span>}
                                {upcomingCount>0 && <span style={{ background:'rgba(245,168,0,0.2)', color:'#fcd34d', borderRadius:99, padding:'3px 9px', fontSize:11, fontWeight:600 }}>เร็วๆ นี้ {upcomingCount}</span>}
                            </div>
                        </div>

                        <div style={{ padding:'14px 16px' }}>
                            {/* Filter tabs */}
                            <div style={{ display:'flex', gap:5, marginBottom:12, flexWrap:'wrap' }}>
                                {[['all','ทั้งหมด',courses.length],['open','เปิดรับสมัคร',openCount],['upcoming','เร็วๆ นี้',upcomingCount],['closed','ปิดรับสมัคร',courses.length-openCount-upcomingCount]].map(([val,label,count])=>(
                                    <button key={val} onClick={()=>setFilterStatus(val)} style={{
                                        background: filterStatus===val ? (val==='open'?'#27AE60':val==='upcoming'?'#F5A800':val==='closed'?'#95A5A6':'#1a2f6e') : '#F8FAFC',
                                        color: filterStatus===val ? 'white' : '#64748b',
                                        border:`1px solid ${filterStatus===val?'transparent':'#E2E8F0'}`,
                                        borderRadius:99, padding:'4px 11px', fontSize:11.5, cursor:'pointer', fontWeight: filterStatus===val?600:400,
                                        transition:'all 0.15s',
                                    }}>
                                        {label} <span style={{ opacity:0.8 }}>({count})</span>
                                    </button>
                                ))}
                            </div>

                            {/* Course list */}
                            {coursesLoading ? (
                                <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>⏳ กำลังโหลดข้อมูลวิชาสอบ...</div>
                            ) : filteredCourses.length === 0 ? (
                                <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>
                                    {courses.length === 0 ? '📋 ยังไม่มีวิชาสอบในระบบ' : 'ไม่พบวิชาสอบในหมวดนี้'}
                                </div>
                            ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                                    {filteredCourses.map(c => <CourseMiniCard key={c.course_id} c={c}/>)}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ background:'#F8FAFC', borderTop:'1px solid #E2E8F0', padding:'8px 16px', display:'flex', justifyContent:'space-between', fontSize:10.5, color:'#94a3b8' }}>
                            <span>ข้อมูลอัปเดตอัตโนมัติตามระยะเวลาที่กำหนด</span>
                            <span>ระบบทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
export default Login;
