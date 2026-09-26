import React, { useState, useEffect, useCallback } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';

const ROLE_LABEL = { admin:'ผู้ดูแลระบบ', staff:'เจ้าหน้าที่/อาจารย์', student:'นักศึกษา' };
const ROLE_COLOR = { admin:'#3730A3', staff:'#92400E', student:'#065F46' };
const ROLE_BG    = { admin:'#EEF2FF',  staff:'#FEF3C7',  student:'#ECFDF5' };

const fmtDate = d => d ? new Date(d).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

const UserManagement = () => {
    const [users, setUsers]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [msg, setMsg]             = useState('');
    const [msgType, setMsgType]     = useState('success');

    // Modal reset password
    const [resetModal, setResetModal] = useState(null);
    const [newPass, setNewPass]       = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    const showMsg = (text, type='success') => {
        setMsg(text); setMsgType(type);
        setTimeout(() => setMsg(''), 4000);
    };

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (search)       params.append('search',    search);
            if (roleFilter)   params.append('role',      roleFilter);
            if (activeFilter !== '') params.append('is_active', activeFilter);
            const res = await API.get(`/admin/users?${params}`);
            if (res.data.success) setUsers(res.data.data);
        } catch { showMsg('โหลดข้อมูลไม่สำเร็จ','error'); }
        finally { setLoading(false); }
    }, [search, roleFilter, activeFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleToggle = async (user) => {
        const action = user.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
        if (!window.confirm(`ยืนยันการ${action}บัญชี "${user.username}" ?`)) return;
        try {
            const res = await API.put(`/admin/users/${user.user_id}/toggle-active`);
            if (res.data.success) { showMsg(res.data.message); fetchUsers(); }
        } catch (err) { showMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด','error'); }
    };

    const handleResetPass = async () => {
        if (!newPass || newPass.length < 8) { showMsg('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร','error'); return; }
        if (newPass !== confirmPass) { showMsg('รหัสผ่านไม่ตรงกัน','error'); return; }
        try {
            setModalLoading(true);
            const res = await API.put(`/admin/users/${resetModal.user_id}/reset-password`, { new_password: newPass });
            if (res.data.success) {
                showMsg(res.data.message);
                setResetModal(null); setNewPass(''); setConfirmPass('');
            }
        } catch (err) { showMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด','error'); }
        finally { setModalLoading(false); }
    };

    const handleChangeRole = async (user, new_role) => {
        if (!window.confirm(`เปลี่ยน role ของ "${user.username}" เป็น "${ROLE_LABEL[new_role]}" ?`)) return;
        try {
            const res = await API.put(`/admin/users/${user.user_id}/change-role`, { new_role });
            if (res.data.success) { showMsg(res.data.message); fetchUsers(); }
        } catch (err) { showMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด','error'); }
    };

    const stats = {
        total:   users.length,
        active:  users.filter(u => u.is_active).length,
        disabled:users.filter(u => !u.is_active).length,
        admin:   users.filter(u => u.role==='admin').length,
        staff:   users.filter(u => u.role==='staff').length,
        student: users.filter(u => u.role==='student').length,
    };

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="จัดการผู้ใช้งาน" actions={[
                { label:'← กลับหน้า Admin', onClick:()=>goTo('/admin-report') }
            ]}/>
            <div className="rmuts-page__body">

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:24 }}>
                    {[
                        { label:'ทั้งหมด',      value:stats.total,    color:'#1a2f6e' },
                        { label:'ใช้งานได้',    value:stats.active,   color:'#27AE60' },
                        { label:'ปิดใช้งาน',   value:stats.disabled, color:'#E74C3C' },
                        { label:'ผู้ดูแลระบบ', value:stats.admin,    color:'#3730A3' },
                        { label:'เจ้าหน้าที่', value:stats.staff,    color:'#92400E' },
                        { label:'นักศึกษา',    value:stats.student,  color:'#065F46' },
                    ].map((s,i) => (
                        <div key={i} style={{ background:'white', borderRadius:10, padding:'12px 14px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #E2E8F0', borderTop:`3px solid ${s.color}`, textAlign:'center' }}>
                            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
                            <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {msg && (
                    <div className={`rmuts-alert rmuts-alert--${msgType==='success'?'success':'error'}`}>
                        {msg}
                        <button onClick={()=>setMsg('')} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:'inherit' }}>✕</button>
                    </div>
                )}

                {/* Filters */}
                <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
                    <input className="rmuts-search" style={{ flex:1, minWidth:200 }}
                        placeholder="🔍 ค้นหาชื่อ, username, email, รหัสนักศึกษา..."
                        value={search} onChange={e=>setSearch(e.target.value)}/>
                    <select className="rmuts-select" style={{ width:160 }} value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
                        <option value="">ทุก Role</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                        <option value="staff">เจ้าหน้าที่</option>
                        <option value="student">นักศึกษา</option>
                    </select>
                    <select className="rmuts-select" style={{ width:150 }} value={activeFilter} onChange={e=>setActiveFilter(e.target.value)}>
                        <option value="">ทุกสถานะ</option>
                        <option value="1">ใช้งานได้</option>
                        <option value="0">ปิดใช้งาน</option>
                    </select>
                    {(search||roleFilter||activeFilter!=='') && (
                        <button onClick={()=>{setSearch('');setRoleFilter('');setActiveFilter('');}} style={{ padding:'7px 12px', background:'#FADBD8', color:'#78281F', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>✕ ล้าง</button>
                    )}
                </div>

                {/* Table */}
                <div className="rmuts-card" style={{ padding:0, overflow:'hidden' }}>
                    {loading ? (
                        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>⏳ กำลังโหลด...</div>
                    ) : (
                        <div className="rmuts-table-wrap" style={{ border:'none', borderRadius:0 }}>
                            <table className="rmuts-table rmuts-table--striped">
                                <thead>
                                    <tr>
                                        {['Username','ชื่อ-นามสกุล','Email','Role','รหัสนักศึกษา','เข้าใช้ล่าสุด','สถานะ','จัดการ'].map(h=>(
                                            <th key={h}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 ? (
                                        <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>ไม่พบข้อมูล</td></tr>
                                    ) : users.map(u => (
                                        <tr key={u.user_id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                                            <td>
                                                <div style={{ fontWeight:600, color:'#1a2f6e' }}>{u.username}</div>
                                                <div style={{ fontSize:11, color:'#94a3b8' }}>ID: {u.user_id}</div>
                                            </td>
                                            <td style={{ fontWeight:500 }}>{u.full_name || '—'}</td>
                                            <td style={{ fontSize:12.5, color:'#64748b' }}>{u.email || '—'}</td>
                                            <td>
                                                <select value={u.role}
                                                    onChange={e=>handleChangeRole(u, e.target.value)}
                                                    disabled={u.role==='admin'}
                                                    style={{ fontSize:11.5, padding:'3px 8px', border:'1px solid #E2E8F0', borderRadius:6, background:ROLE_BG[u.role], color:ROLE_COLOR[u.role], fontWeight:600, cursor: u.role==='admin'?'not-allowed':'pointer' }}>
                                                    <option value="admin">ผู้ดูแลระบบ</option>
                                                    <option value="staff">เจ้าหน้าที่</option>
                                                    <option value="student">นักศึกษา</option>
                                                </select>
                                            </td>
                                            <td style={{ fontSize:12.5 }}>{u.student_code || '—'}</td>
                                            <td style={{ fontSize:11.5, color:'#64748b' }}>{fmtDate(u.last_login)}</td>
                                            <td>
                                                {u.is_active
                                                    ? <span style={{ background:'#EAFAF1', color:'#1E8449', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>🟢 ใช้งานได้</span>
                                                    : <span style={{ background:'#FADBD8', color:'#78281F', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>🔴 ปิดแล้ว</span>
                                                }
                                            </td>
                                            <td style={{ whiteSpace:'nowrap' }}>
                                                {/* Reset Password */}
                                                <button onClick={()=>{ setResetModal(u); setNewPass(''); setConfirmPass(''); }}
                                                    style={{ background:'#EEF2FF', color:'#3730A3', border:'none', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:11.5, fontWeight:600, marginRight:4 }}>
                                                    🔑 Reset
                                                </button>
                                                {/* Toggle Active */}
                                                {u.role !== 'admin' && (
                                                    <button onClick={()=>handleToggle(u)}
                                                        style={{ background: u.is_active?'#FADBD8':'#EAFAF1', color: u.is_active?'#78281F':'#1E8449', border:'none', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:11.5, fontWeight:600 }}>
                                                        {u.is_active ? '🔒 ปิด' : '🔓 เปิด'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal Reset Password */}
                {resetModal && (
                    <div className="rmuts-overlay" onClick={()=>setResetModal(null)}>
                        <div className="rmuts-modal" style={{ maxWidth:420 }} onClick={e=>e.stopPropagation()}>
                            <div style={{ borderBottom:'3px solid #F5A800', paddingBottom:14, marginBottom:18 }}>
                                <div style={{ fontSize:16, fontWeight:700, color:'#1a2f6e' }}>🔑 รีเซ็ตรหัสผ่าน</div>
                                <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
                                    ผู้ใช้: <strong>{resetModal.username}</strong>
                                    {resetModal.full_name && ` — ${resetModal.full_name}`}
                                </div>
                            </div>

                            <div style={{ background:'#FEF3C7', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12.5, color:'#92400E', border:'1px solid #FDE68A' }}>
                                ⚠️ รหัสผ่านใหม่จะมีผลทันที ผู้ใช้จะถูก logout และต้องล็อกอินใหม่
                            </div>

                            <div className="rmuts-form-group">
                                <label className="rmuts-label">รหัสผ่านใหม่ <span>*</span></label>
                                <div className="rmuts-input-wrap">
                                    <i className="ti ti-lock rmuts-input-icon"/>
                                    <input className="rmuts-input" type="password" value={newPass}
                                        onChange={e=>setNewPass(e.target.value)}
                                        placeholder="อย่างน้อย 8 ตัวอักษร"/>
                                </div>
                            </div>
                            <div className="rmuts-form-group">
                                <label className="rmuts-label">ยืนยันรหัสผ่านใหม่ <span>*</span></label>
                                <div className="rmuts-input-wrap">
                                    <i className="ti ti-lock rmuts-input-icon"/>
                                    <input className="rmuts-input" type="password" value={confirmPass}
                                        onChange={e=>setConfirmPass(e.target.value)}
                                        placeholder="กรอกซ้ำอีกครั้ง"
                                        style={{ borderColor: confirmPass && confirmPass !== newPass ? '#E74C3C' : undefined }}/>
                                </div>
                                {confirmPass && confirmPass !== newPass && (
                                    <div style={{ fontSize:11.5, color:'#E74C3C', marginTop:4 }}>รหัสผ่านไม่ตรงกัน</div>
                                )}
                            </div>

                            {/* Strength bar */}
                            {newPass && (
                                <div style={{ marginBottom:16 }}>
                                    <div style={{ background:'#ECF0F1', borderRadius:99, height:5, overflow:'hidden' }}>
                                        <div style={{ width: newPass.length>=10?'100%':newPass.length>=8?'66%':'33%', background: newPass.length>=10?'#27AE60':newPass.length>=8?'#F5A800':'#E74C3C', height:'100%', borderRadius:99, transition:'width 0.3s' }}/>
                                    </div>
                                    <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
                                        ความแข็งแกร่ง: {newPass.length>=10?'แข็งแกร่ง':newPass.length>=8?'พอใช้':'อ่อน'}
                                    </div>
                                </div>
                            )}

                            <div style={{ display:'flex', gap:10 }}>
                                <button className="rmuts-btn rmuts-btn--outline" style={{ flex:1 }} onClick={()=>setResetModal(null)}>ยกเลิก</button>
                                <button disabled={modalLoading || newPass !== confirmPass || newPass.length < 8}
                                    onClick={handleResetPass}
                                    style={{ flex:2, padding:12, background: modalLoading||newPass!==confirmPass||newPass.length<8 ? '#94a3b8' : 'linear-gradient(135deg,#0d1e4a,#1a2f6e)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>
                                    {modalLoading ? '⏳ กำลังรีเซ็ต...' : '🔑 ยืนยันรีเซ็ตรหัสผ่าน'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
