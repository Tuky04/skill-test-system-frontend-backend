import React, { useState } from 'react';
import '../styles/theme.css';
import NotificationBell from '../pages/NotificationBell';
import API, { clearAuth } from '../services/api';
import SEAL from '../assets/rmuts-seal.png';
import Icon from './Icon';
import { currentAppPath, goTo } from '../utils/navigation';
import { getRole, getUser } from '../services/session';

const ROLE_LABEL = { admin:'ผู้ดูแลระบบ', staff:'เจ้าหน้าที่/อาจารย์', student:'นักศึกษา' };
const ROLE_HOME  = { admin:'/admin-report', staff:'/grading-panel', student:'/student-dashboard' };

// แถบนำทาง: เดสก์ท็อปแสดงปุ่มทั้งหมดในแถวเดียว, มือถือ (<= 768px) พับเป็นปุ่มเมนู ☰
const RmutsNavbar = ({ title, actions = [] }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const role     = getRole();
    const user     = getUser();
    const name     = user.full_name || user.username || '';
    const homeUrl  = ROLE_HOME[role] || '/';
    const pathName = currentAppPath();
    const handleLogout = async () => {
        await API.post('/auth/logout').catch(() => {});
        clearAuth();
        goTo('/login');
    };
    const go = (path) => { setMenuOpen(false); goTo(path); };

    return (
        <>
            <div className="rmuts-topbar">
                <img src={SEAL} alt="" className="rmuts-topbar__seal"/>
                <div>
                    <div className="rmuts-topbar__name">มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ</div>
                    <div className="rmuts-topbar__sub">คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ</div>
                </div>
            </div>
            <header className="rmuts-nav">
                <button type="button" className="rmuts-nav__brand" onClick={() => go(homeUrl)} aria-label="กลับหน้าหลัก">
                    <img src={SEAL} alt="" className="rmuts-nav__seal"/>
                    <span>
                        <span className="rmuts-nav__title">{title || 'ระบบทดสอบมาตรฐานฝีมือแรงงาน'}</span>
                        <span className="rmuts-nav__role">{ROLE_LABEL[role] || ''}</span>
                    </span>
                </button>
                <button type="button" className="rmuts-nav__toggle" aria-expanded={menuOpen} aria-controls="rmuts-nav-actions"
                    aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'} onClick={() => setMenuOpen((open) => !open)}>
                    <Icon name={menuOpen ? 'close' : 'menu'} size={22}/>
                </button>
                <nav id="rmuts-nav-actions" className={`rmuts-nav__actions${menuOpen ? ' is-open' : ''}`} aria-label="เมนูหลัก">
                    {name && <span className="rmuts-nav__user">👤 {name}</span>}
                    {role === 'staff' && !pathName.startsWith('/staff/students') && (
                        <button type="button" className="rmuts-nav__btn" onClick={() => go('/staff/students')}>👥 ข้อมูลนักศึกษา</button>
                    )}
                    {role === 'staff' && pathName !== '/staff/data-export' && (
                        <button type="button" className="rmuts-nav__btn rmuts-nav__btn--gold" onClick={() => go('/staff/data-export')}>📊 ส่งออกข้อมูล</button>
                    )}
                    {actions.map((a, i) => (
                        <button type="button" key={i} onClick={() => { setMenuOpen(false); a.onClick(); }}
                            className={`rmuts-nav__btn${a.danger ? ' rmuts-nav__btn--danger' : a.gold ? ' rmuts-nav__btn--gold' : ''}`}>
                            {a.label}
                        </button>
                    ))}
                    {role === 'student' && <NotificationBell/>}
                    <button type="button" className="rmuts-nav__btn rmuts-nav__btn--soft" onClick={() => go('/change-password')}>🔑 เปลี่ยนรหัสผ่าน</button>
                    <button type="button" className="rmuts-nav__btn rmuts-nav__btn--danger" onClick={handleLogout}>ออกจากระบบ</button>
                </nav>
            </header>
        </>
    );
};
export default RmutsNavbar;
