import React, { useState } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API, { clearAuth } from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';

const ChangePassword = () => {
    const [form, setForm] = useState({ current_password:'', new_password:'', confirm_password:'' });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg]   = useState('');
    const [type, setType] = useState('');
    const role = localStorage.getItem('role');
    const home = role==='admin'?'/admin-report':role==='staff'?'/grading-panel':'/student-dashboard';

    const handleChange = e => setForm(p=>({...p,[e.target.name]:e.target.value}));

    const handleSubmit = async e => {
        e.preventDefault();
        if (form.new_password!==form.confirm_password) { setMsg('รหัสผ่านใหม่ไม่ตรงกัน'); setType('error'); return; }
        if (form.new_password.length<8) { setMsg('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'); setType('error'); return; }
        try {
            setLoading(true);
            const res = await API.put('/auth/change-password', form);
            if (res.data.success) {
                setMsg('✅ เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่'); setType('success');
                setForm({ current_password:'', new_password:'', confirm_password:'' });
                setTimeout(() => { clearAuth(); goTo('/login'); }, 1500);
            }
        } catch (err) { setMsg(err.response?.data?.message||'เกิดข้อผิดพลาด'); setType('error'); }
        finally { setLoading(false); }
    };

    const strength = p => {
        if (!p) return null;
        if (p.length<8) return { label:'อ่อนมาก', color:'#E74C3C', width:'25%' };
        if (p.length<10) return { label:'พอใช้', color:'#F5A800', width:'50%' };
        if (!/[A-Z]/.test(p)||!/[0-9]/.test(p)) return { label:'ดี', color:'#2980B9', width:'75%' };
        return { label:'แข็งแกร่ง', color:'#27AE60', width:'100%' };
    };
    const s = strength(form.new_password);

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="เปลี่ยนรหัสผ่าน"/>
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
                <div style={{ background:'white', borderRadius:16, padding:'36px 40px', width:'100%', maxWidth:440, boxShadow:'var(--rmuts-shadow-lg)', border:'1px solid var(--rmuts-border)' }}>
                    <div style={{ textAlign:'center', marginBottom:28 }}>
                        <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#1a2f6e,#0f1f4a)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:24, color:'#F5A800' }}>🔑</div>
                        <h2 style={{ color:'#1a2f6e', margin:0, fontSize:20 }}>เปลี่ยนรหัสผ่าน</h2>
                        <div style={{ width:40, height:3, background:'linear-gradient(90deg,transparent,#F5A800,transparent)', margin:'10px auto 0' }}/>
                    </div>

                    {msg && <div className={`rmuts-alert rmuts-alert--${type}`}>{msg}</div>}

                    <form onSubmit={handleSubmit}>
                        {[{name:'current_password',label:'รหัสผ่านเดิม'},{name:'new_password',label:'รหัสผ่านใหม่'},{name:'confirm_password',label:'ยืนยันรหัสผ่านใหม่'}].map(f=>(
                            <div key={f.name} className="rmuts-form-group">
                                <label className="rmuts-label">{f.label} <span>*</span></label>
                                <div className="rmuts-input-wrap">
                                    <i className="ti ti-lock rmuts-input-icon" aria-hidden="true"/>
                                    <input type="password" name={f.name} value={form[f.name]} onChange={handleChange} required className="rmuts-input"/>
                                </div>
                            </div>
                        ))}

                        {s && (
                            <div style={{ marginBottom:20 }}>
                                <div style={{ background:'#ECF0F1', borderRadius:99, height:6, overflow:'hidden' }}>
                                    <div style={{ width:s.width, background:s.color, height:'100%', borderRadius:99, transition:'width 0.3s' }}/>
                                </div>
                                <div style={{ fontSize:11, color:s.color, marginTop:4, fontWeight:600 }}>ความแข็งแกร่ง: {s.label}</div>
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="rmuts-btn rmuts-btn--primary rmuts-btn--lg">
                            {loading?'⏳ กำลังบันทึก...':'เปลี่ยนรหัสผ่าน'}
                        </button>
                        <button type="button" onClick={()=>goTo(home)} className="rmuts-btn rmuts-btn--outline rmuts-btn--lg" style={{ marginTop:10 }}>
                            ← กลับหน้าหลัก
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
export default ChangePassword;
