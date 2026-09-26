import React from 'react';
import '../styles/theme.css';
import NotificationBell from '../pages/NotificationBell';
import API, { clearAuth } from '../services/api';
import SEAL from '../assets/rmuts-seal.png';
import { currentAppPath, goTo } from '../utils/navigation';

const ROLE_LABEL = { admin:'ผู้ดูแลระบบ', staff:'เจ้าหน้าที่/อาจารย์', student:'นักศึกษา' };
const ROLE_HOME  = { admin:'/admin-report', staff:'/grading-panel', student:'/student-dashboard' };

const RmutsNavbar = ({ title, actions = [] }) => {
    const role     = localStorage.getItem('role') || '';
    const userStr  = localStorage.getItem('user') || '{}';
    const user     = JSON.parse(userStr);
    const name     = user.full_name || user.username || '';
    const homeUrl  = ROLE_HOME[role] || '/';
    const pathName = currentAppPath();
    const handleLogout = async () => {
        await API.post('/auth/logout').catch(() => {});
        clearAuth();
        goTo('/login');
    };

    return (
        <>
            {/* Top bar เหลือง */}
            <div style={{ background:'#F5A800', padding:'0 24px', height:38, display:'flex', alignItems:'center', gap:10 }}>
                <img src={SEAL} alt="" style={{ width:26, height:26, objectFit:'contain', mixBlendMode:'multiply' }}/>
                <div>
                    <div style={{ fontFamily:"'Noto Serif Thai',serif", fontSize:12, fontWeight:700, color:'#1a2f6e' }}>มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ</div>
                    <div style={{ fontSize:10, color:'#1a2f6e', opacity:0.7 }}>คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ</div>
                </div>
            </div>
            {/* Navbar น้ำเงิน */}
            <div style={{ background:'#1a2f6e', height:60, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'3px solid #F5A800', boxShadow:'0 2px 12px rgba(0,0,0,0.15)', position:'sticky', top:38, zIndex:99 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={()=>goTo(homeUrl)}>
                    <img src={SEAL} alt="" style={{ width:32, height:32, objectFit:'contain', mixBlendMode:'screen', filter:'brightness(1.2)' }}/>
                    <div>
                        <div style={{ fontFamily:"'Noto Serif Thai',serif", fontSize:14, fontWeight:600, color:'#F5A800', lineHeight:1.3 }}>
                            {title || 'ระบบทดสอบมาตรฐานฝีมือแรงงาน'}
                        </div>
                        <div style={{ fontSize:11, color:'rgba(245,168,0,0.6)' }}>{ROLE_LABEL[role] || ''}</div>
                    </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {name && <span style={{ fontSize:13, color:'rgba(255,255,255,0.75)', marginRight:4 }}>👤 {name}</span>}
                    {role === 'staff' && !pathName.startsWith('/staff/students') && (
                        <button onClick={() => goTo('/staff/students')}
                            style={{ background:'rgba(255,255,255,0.12)', color:'white', border:'none', borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                            👥 ข้อมูลนักศึกษา
                        </button>
                    )}
                    {role === 'staff' && pathName !== '/staff/data-export' && (
                        <button onClick={() => goTo('/staff/data-export')}
                            style={{ background:'#F5A800', color:'#1a2f6e', border:'none', borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                            📊 ส่งออกข้อมูล
                        </button>
                    )}
                    {actions.map((a, i) => (
                        <button key={i} onClick={a.onClick}
                            style={{ background: a.danger ? '#E74C3C' : a.gold ? '#F5A800' : 'rgba(255,255,255,0.12)', color: a.gold ? '#1a2f6e' : 'white', border:'none', borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                            {a.label}
                        </button>
                    ))}
                    {role === 'student' && <NotificationBell/>}
                    <button onClick={() => goTo('/change-password')}
                        style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'none', borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                        🔑 เปลี่ยนรหัสผ่าน
                    </button>
                    <button onClick={handleLogout}
                        style={{ background:'#E74C3C', color:'white', border:'none', borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        </>
    );
};
export default RmutsNavbar;
