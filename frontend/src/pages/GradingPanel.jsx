import React, { useEffect, useState, useMemo, useCallback } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';

const PER_PAGE = 10;
const fmtExamDate = value => value ? new Date(value).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}) : 'ยังไม่กำหนด';
const fmtExamTime = value => {
    if (!value) return 'ยังไม่กำหนด';
    const text=String(value).trim();
    const match=text.match(/^(\d{1,2}):(\d{2})/);
    return match?`${match[1].padStart(2,'0')}:${match[2]} น.`:text;
};

// ── Pagination ────────────────────────────────────────────────
const Pagination = ({ total, page, perPage, onChange }) => {
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i===1||i===totalPages||Math.abs(i-page)<=1) pages.push(i);
        else if (pages[pages.length-1]!=='...') pages.push('...');
    }
    return (
        <div className="rmuts-pagination">
            <div className="rmuts-pagination__info">แสดง {Math.min((page-1)*perPage+1,total)}–{Math.min(page*perPage,total)} จาก {total} รายการ</div>
            <div className="rmuts-pagination__btns">
                <button className="rmuts-pagination__btn" onClick={()=>onChange(page-1)} disabled={page===1}>←</button>
                {pages.map((p,i)=> p==='...' ? <span key={'d'+i} style={{padding:'0 4px',color:'#94a3b8'}}>…</span> :
                    <button key={p} className={`rmuts-pagination__btn${page===p?' rmuts-pagination__btn--active':''}`} onClick={()=>onChange(p)}>{p}</button>
                )}
                <button className="rmuts-pagination__btn" onClick={()=>onChange(page+1)} disabled={page===Math.ceil(total/perPage)}>→</button>
            </div>
        </div>
    );
};

// ── Score Input ───────────────────────────────────────────────
const ScoreInput = ({ value, max, onChange, color, disabled, label }) => (
    <div>
        {label && <label style={{ display:'block', color:'#475569', fontSize:12, fontWeight:700, marginBottom:6 }}>{label}</label>}
        <div style={{ position:'relative' }}>
            <input type="number" min="0" max={max} step="0.01" value={value??0} onChange={onChange} disabled={disabled}
                style={{ width:'100%', boxSizing:'border-box', padding:'12px 48px 12px 12px', border:`2px solid ${color||'#E2E8F0'}`, borderRadius:8, textAlign:'right', fontSize:18, fontWeight:700, outline:'none', color:'#1e293b', background:disabled?'#F1F5F9':'white', cursor:disabled?'not-allowed':'text' }}
            />
            <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:11 }}>/ {max}</span>
        </div>
    </div>
);

// ── Status Badge ─────────────────────────────────────────────
const StatusBadge = ({ s }) => {
    const map = { 'อนุมัติสิทธิ์สอบ':['#EAFAF1','#1E8449'], 'ปฏิเสธเอกสาร':['#FADBD8','#78281F'], 'รอดำเนินการ':['#FEF9E7','#7D6608'] };
    const [bg,color] = map[s]||['#F4F6F7','#566573'];
    return <span style={{ background:bg, color, borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>{s||'—'}</span>;
};

// ── Main ──────────────────────────────────────────────────────
const GradingPanel = () => {
    const [allApps, setAllApps]     = useState([]);
    const [approved, setApproved]   = useState([]);
    const [scoreForm, setScoreForm] = useState({});
    const [loading, setLoading]     = useState(true);
    const [msg, setMsg]             = useState('');
    const [msgType, setMsgType]     = useState('success');
    const [activeTab, setActiveTab] = useState('applications');
    const [busyId, setBusyId]       = useState(null);
    const [scoreModalId, setScoreModalId] = useState(null);
    const [pendingDocumentCount, setPendingDocumentCount] = useState(0);
    const [newApplicantPopup, setNewApplicantPopup] = useState(null);

    // ── ตัวกรอง Tab 1: ใบสมัคร ──
    const [appSearch, setAppSearch]   = useState('');
    const [appStatus, setAppStatus]   = useState('รอดำเนินการ');
    const [appMonth, setAppMonth]     = useState('');
    const [appCourse, setAppCourse]   = useState('');
    const [appPage, setAppPage]       = useState(1);

    // ── ตัวกรอง Tab 2: คะแนน ──
    const [gradeSearch, setGradeSearch] = useState('');
    const [gradeMonth, setGradeMonth]   = useState('');
    const [gradeCourse, setGradeCourse] = useState('');
    const [gradeStage, setGradeStage]   = useState('pending');
    const [gradePage, setGradePage]     = useState(1);

    const showMsg = useCallback((t,type='success')=>{ setMsg(t); setMsgType(type); setTimeout(()=>setMsg(''),4000); }, []);

    const fetchData = useCallback(async (silent=false) => {
        try {
            if (!silent) setLoading(true);
            const res = await API.get('/registrations?limit=100');
            if (res.data.success) {
                const data = res.data.data;
                setAllApps(data);
                const app = data.filter(a=>a.application_status==='อนุมัติสิทธิ์สอบ');
                setApproved(app);
                setScoreForm(previous => {
                    const form={};
                    app.forEach(s=>{ form[s.registration_id]= previous[s.registration_id] || { theory:s.theory_score??0, practical:s.practical_score??0, deducted:s.deducted_score??0 }; });
                    return form;
                });
            }
        } catch (error) { showMsg(error.response?.data?.message||'ไม่สามารถดึงข้อมูลได้','error'); }
        finally { if (!silent) setLoading(false); }
    }, [showMsg]);
    useEffect(()=>{ fetchData(); },[fetchData]);

    const fetchPendingDocuments = useCallback(async () => {
        try {
            const response = await API.get('/staff/pending-registrations');
            if (!response.data?.success) return;
            const pending = (response.data.data || []).filter((item) => item.registration_status === 'รอตรวจสอบเอกสาร');
            setPendingDocumentCount(pending.length);

            let currentUserId = 'staff';
            try { currentUserId = JSON.parse(localStorage.getItem('user') || '{}').user_id || 'staff'; } catch {}
            const storageKey = `known_pending_documents_${currentUserId}`;
            let knownIds = [];
            try { knownIds = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
            const currentIds = pending.map((item) => Number(item.student_id));
            const newApplicants = pending.filter((item) => !knownIds.includes(Number(item.student_id)));

            if (newApplicants.length > 0) {
                setNewApplicantPopup({
                    count: newApplicants.length,
                    names: newApplicants.slice(0, 3).map((item) => item.full_name),
                });
            }
            localStorage.setItem(storageKey, JSON.stringify(currentIds));
        } catch (error) {
            if (error.response?.status !== 401) console.error('[Pending document notification]', error.message);
        }
    }, []);

    useEffect(() => {
        fetchPendingDocuments();
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') fetchPendingDocuments();
        }, 30000);
        return () => window.clearInterval(intervalId);
    }, [fetchPendingDocuments]);

    // unique values สำหรับ dropdown
    const courseOptions = useMemo(()=>[...new Set(allApps.map(a=>a.course_name).filter(Boolean))],[allApps]);
    const monthOptions  = useMemo(()=>{
        const ms = allApps.map(a=>{ const d=new Date(a.registered_at); return isNaN(d)?null:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }).filter(Boolean);
        return [...new Set(ms)].sort().reverse();
    },[allApps]);
    const gradeMonthOptions = useMemo(()=>{
        const ms = approved.map(a=>{ const d=new Date(a.registered_at); return isNaN(d)?null:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }).filter(Boolean);
        return [...new Set(ms)].sort().reverse();
    },[approved]);
    const gradeCourseOptions = useMemo(()=>[...new Set(approved.map(a=>a.course_name).filter(Boolean))],[approved]);

    const fmtMonthLabel = m => { if(!m) return ''; const [y,mo]=m.split('-'); const d=new Date(y,mo-1); return d.toLocaleDateString('th-TH',{month:'long',year:'numeric'}); };

    const filterApps = useMemo(()=> allApps.filter(a=>{
        const mS  = !appSearch  || `${a.full_name||''} ${a.student_code||''} ${a.university_student_code||''} ${a.application_no||''}`.toLowerCase().includes(appSearch.toLowerCase());
        const mSt = !appStatus  || a.application_status===appStatus;
        const mC  = !appCourse  || a.course_name===appCourse;
        const mM  = !appMonth   || (()=>{ const d=new Date(a.registered_at); return !isNaN(d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===appMonth; })();
        return mS&&mSt&&mC&&mM;
    }),[allApps,appSearch,appStatus,appCourse,appMonth]);

    const filterGrade = useMemo(()=> approved.filter(s=>{
        const mS = !gradeSearch || `${s.full_name||''} ${s.student_code||''} ${s.university_student_code||''} ${s.course_name||''}`.toLowerCase().includes(gradeSearch.toLowerCase());
        const mC = !gradeCourse || s.course_name===gradeCourse;
        const mM = !gradeMonth  || (()=>{ const d=new Date(s.registered_at); return !isNaN(d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===gradeMonth; })();
        const mStage = !gradeStage ||
            (gradeStage==='pending' && !s.result_published_at) ||
            (gradeStage==='waiting' && !s.result_published_at && (s.exam_status||'รอสอบ')==='รอสอบ') ||
            (gradeStage==='ready' && !s.result_published_at && s.exam_status==='เข้าสอบ') ||
            (gradeStage==='absent' && !s.result_published_at && ['ขาดสอบ','ยกเลิก'].includes(s.exam_status)) ||
            (gradeStage==='published' && !!s.result_published_at);
        return mS&&mC&&mM&&mStage;
    }),[approved,gradeSearch,gradeCourse,gradeMonth,gradeStage]);

    const pagedApps  = filterApps.slice((appPage-1)*PER_PAGE, appPage*PER_PAGE);
    const pagedGrade = filterGrade.slice((gradePage-1)*PER_PAGE, gradePage*PER_PAGE);
    const scoreModalRegistration = approved.find(item=>item.registration_id===scoreModalId);
    const scoreModalForm = scoreModalRegistration ? (scoreForm[scoreModalRegistration.registration_id]||{theory:0,practical:0,deducted:0}) : null;
    const scorePreview = scoreModalForm ? Math.max(0, Number(scoreModalForm.theory||0)+Number(scoreModalForm.practical||0)-Number(scoreModalForm.deducted||0)) : 0;

    const handleStatus = async (regId, status) => {
        if (!window.confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${status}" ?`)) return;
        setBusyId(regId);
        try {
            const res=await API.put(`/registrations/${regId}/status`,{status});
            if(res.data.success){
                setAllApps(previous=>previous.map(item=>item.registration_id===regId?{...item,application_status:status}:item));
                showMsg(res.data.message);
                await fetchData(true);
            }
        } catch (error) { showMsg(error.response?.data?.message||'ไม่สามารถเปลี่ยนสถานะใบสมัครได้','error'); }
        finally { setBusyId(null); }
    };
    const handleExamStatus = async (regId, status) => {
        if (!status || !window.confirm(`ยืนยันสถานะการสอบเป็น "${status}" ?`)) return;
        setBusyId(regId);
        try {
            const res=await API.put(`/registrations/${regId}/exam-status`,{status});
            if(res.data.success){
                const update = item=>item.registration_id===regId?{...item,exam_status:status}:item;
                setAllApps(previous=>previous.map(update));
                setApproved(previous=>previous.map(update));
                showMsg(res.data.message);
            }
        }
        catch (error) { showMsg(error.response?.data?.message||'ไม่สามารถเปลี่ยนสถานะการสอบได้','error'); }
        finally { setBusyId(null); }
    };
    const handleScore = async (regId) => {
        const s=scoreForm[regId]; if(!s) return;
        const registration=approved.find(item=>item.registration_id===regId);
        if(registration?.result_published_at){showMsg('รายการนี้ประกาศผลแล้ว ไม่สามารถบันทึกซ้ำจากหน้านี้ได้','error');return;}
        if(registration?.exam_status!=='เข้าสอบ'&&!registration?.result_published_at){showMsg('กรุณายืนยันสถานะว่าเข้าสอบก่อน','error');return;}
        const theoryMax=Number(registration?.theory_max_score||30), practicalMax=Number(registration?.practical_max_score||70);
        const theory=Number(s.theory), practical=Number(s.practical), deducted=Number(s.deducted);
        if(!Number.isFinite(theory)||theory<0||theory>theoryMax){showMsg(`คะแนนทฤษฎีต้องอยู่ระหว่าง 0–${theoryMax}`,'error');return;}
        if(!Number.isFinite(practical)||practical<0||practical>practicalMax){showMsg(`คะแนนปฏิบัติต้องอยู่ระหว่าง 0–${practicalMax}`,'error');return;}
        if(!Number.isFinite(deducted)||deducted<0||deducted>theory+practical){showMsg('คะแนนหักต้องไม่ติดลบหรือมากกว่าคะแนนที่ได้','error');return;}
        if(!window.confirm(`ยืนยันบันทึกและประกาศผล ${Math.max(0,theory+practical-deducted)} คะแนน? ระบบจะแจ้งผลให้นักศึกษาทันที`)) return;
        setBusyId(regId);
        try {
            const res=await API.post('/scores/submit',{registration_id:regId,theory_score:theory,practical_score:practical,deducted_score:deducted});
            if(res.data.success){showMsg(res.data.message);setScoreModalId(null);await fetchData(true);}
        }
        catch (error) { showMsg(error.response?.data?.message||'เกิดข้อผิดพลาดในการบันทึกคะแนน','error'); }
        finally { setBusyId(null); }
    };

    const FilterBar = ({ children }) => (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'12px 16px', background:'#F8FAFC', borderRadius:8, border:'1px solid #E2E8F0', marginBottom:16 }}>
            {children}
        </div>
    );
    const FilterSelect = ({ value, onChange, options, placeholder }) => (
        <select value={value} onChange={e=>onChange(e.target.value)} style={{ padding:'7px 10px', border:'1.5px solid #E2E8F0', borderRadius:6, fontSize:12.5, color:'#374151', outline:'none', background:'white', cursor:'pointer' }}>
            <option value="">{placeholder}</option>
            {options.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
    );

    if (loading) return (
        <div className="rmuts-page" style={{ alignItems:'center', justifyContent:'center' }}>
            <RmutsNavbar title="แผงควบคุมเจ้าหน้าที่"/>
            <div style={{ textAlign:'center', marginTop:120, color:'#1a2f6e' }}><div style={{ fontSize:36 }}>🔄</div><div style={{ marginTop:8 }}>กำลังโหลด...</div></div>
        </div>
    );

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="แผงควบคุมเจ้าหน้าที่" actions={[
                { label:`📋 ตรวจสอบเอกสาร${pendingDocumentCount ? ` (${pendingDocumentCount})` : ''}`, onClick:()=>goTo('/staff/verify-students'), gold:true }
            ]}/>
            {newApplicantPopup && (
                <aside role="alertdialog" aria-live="assertive" style={{ position:'fixed', top:78, right:20, zIndex:3000, width:'min(380px,calc(100vw - 32px))', background:'white', borderRadius:12, boxShadow:'0 16px 42px rgba(15,23,42,0.28)', border:'1px solid #F5A800', overflow:'hidden' }}>
                    <div style={{ background:'linear-gradient(90deg,#0d1e4a,#1a2f6e)', color:'white', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <strong>🔔 มีผู้สมัครรายใหม่</strong>
                        <button aria-label="ปิดแจ้งเตือน" onClick={()=>setNewApplicantPopup(null)} style={{background:'none',border:0,color:'white',cursor:'pointer',fontSize:18}}>×</button>
                    </div>
                    <div style={{ padding:'14px 16px' }}>
                        <div style={{ color:'#334155', marginBottom:8 }}>มีผู้สมัครใหม่รอตรวจเอกสาร <strong style={{color:'#c47f00'}}>{newApplicantPopup.count} ราย</strong></div>
                        {newApplicantPopup.names.map((name)=><div key={name} style={{fontSize:12,color:'#64748b',marginTop:3}}>• {name}</div>)}
                        {newApplicantPopup.count > 3 && <div style={{fontSize:12,color:'#64748b',marginTop:3}}>• และอีก {newApplicantPopup.count-3} ราย</div>}
                        <div style={{ display:'flex', gap:8, marginTop:14 }}>
                            <button onClick={()=>goTo('/staff/verify-students')} style={{flex:1,padding:'9px 12px',background:'#F5A800',color:'#1a2f6e',border:0,borderRadius:7,fontWeight:700,cursor:'pointer'}}>ไปตรวจสอบตอนนี้</button>
                            <button onClick={()=>setNewApplicantPopup(null)} style={{padding:'9px 12px',background:'#E2E8F0',color:'#475569',border:0,borderRadius:7,cursor:'pointer'}}>ภายหลัง</button>
                        </div>
                    </div>
                </aside>
            )}
            <div className="rmuts-page__body">

                {/* Summary */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
                    {[
                        { icon:'📋', label:'ใบสมัครทั้งหมด', value:allApps.length, color:'--rmuts-navy' },
                        { icon:'⏳', label:'รอดำเนินการ', value:allApps.filter(a=>a.application_status==='รอดำเนินการ').length, color:'warning' },
                        { icon:'✅', label:'อนุมัติสิทธิ์สอบ', value:approved.length, color:'green' },
                        { icon:'📝', label:'ประกาศผลแล้ว', value:approved.filter(a=>a.result_published_at).length, color:'info' },
                    ].map((s,i)=>(
                        <div key={i} style={{ background:'white', borderRadius:10, padding:'14px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #E2E8F0', borderTop:`3px solid ${i===0?'#1a2f6e':i===1?'#F5A800':i===2?'#27AE60':'#2980B9'}`, display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ fontSize:28 }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize:22, fontWeight:700, color: i===0?'#1a2f6e':i===1?'#c47f00':i===2?'#27AE60':'#2980B9' }}>{s.value}</div>
                                <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {msg && <div className={`rmuts-alert rmuts-alert--${msgType}`}>{msgType==='success'?'✅':'❌'} {msg}</div>}

                {/* Tabs */}
                <div style={{ display:'flex', borderBottom:'2px solid #E2E8F0', marginBottom:0, background:'white', borderRadius:'10px 10px 0 0', padding:'0 16px', boxShadow:'0 -2px 8px rgba(0,0,0,0.03)' }}>
                    {[['applications','📋 คัดกรองใบสมัคร',allApps.filter(a=>a.application_status==='รอดำเนินการ').length],['grading','✍️ บันทึกคะแนนสอบ',approved.length]].map(([id,label,count])=>(
                        <button key={id} onClick={()=>setActiveTab(id)} style={{
                            padding:'14px 20px', border:'none', background:'none', cursor:'pointer',
                            fontSize:13.5, fontWeight: activeTab===id?700:400,
                            color: activeTab===id?'#1a2f6e':'#64748b',
                            borderBottom: activeTab===id?'3px solid #F5A800':'3px solid transparent',
                            marginBottom:-2, display:'flex', alignItems:'center', gap:8,
                            transition:'all 0.15s',
                        }}>
                            {label}
                            <span style={{ background: activeTab===id?'#F5A800':'#E2E8F0', color: activeTab===id?'#1a2f6e':'#64748b', borderRadius:99, padding:'1px 7px', fontSize:11, fontWeight:600 }}>{count}</span>
                        </button>
                    ))}
                </div>

                {/* ══ Tab 1: ใบสมัคร ══ */}
                {activeTab==='applications' && (
                    <div style={{ background:'white', borderRadius:'0 0 10px 10px', padding:'20px', boxShadow:'0 4px 12px rgba(0,0,0,0.06)', marginBottom:24 }}>
                        <FilterBar>
                            <input className="rmuts-search" style={{ flex:1, minWidth:200 }} placeholder="🔍 ค้นหาชื่อ, รหัส, เลขใบสมัคร..." value={appSearch} onChange={e=>{setAppSearch(e.target.value);setAppPage(1);}}/>
                            <FilterSelect value={appMonth} onChange={v=>{setAppMonth(v);setAppPage(1);}} options={monthOptions.map(m=>({val:m,label:fmtMonthLabel(m)}))} placeholder="📅 ทุกเดือน"/>
                            <FilterSelect value={appCourse} onChange={v=>{setAppCourse(v);setAppPage(1);}} options={courseOptions.map(c=>({val:c,label:c}))} placeholder="📚 ทุกสาขา"/>
                            <FilterSelect value={appStatus} onChange={v=>{setAppStatus(v);setAppPage(1);}} options={['รอดำเนินการ','อนุมัติสิทธิ์สอบ','ปฏิเสธเอกสาร'].map(s=>({val:s,label:s}))} placeholder="🏷 ทุกสถานะ"/>
                            {(appSearch||appMonth||appCourse||appStatus) && (
                                <button onClick={()=>{setAppSearch('');setAppMonth('');setAppCourse('');setAppStatus('');setAppPage(1);}} style={{ padding:'7px 12px', background:'#FADBD8', color:'#78281F', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>✕ ล้าง</button>
                            )}
                            <div style={{ marginLeft:'auto', fontSize:12, color:'#64748b', fontWeight:500 }}>พบ {filterApps.length} รายการ</div>
                        </FilterBar>

                        <div className="rmuts-table-wrap">
                            <table className="rmuts-table">
                                <thead><tr>{['เลขใบสมัคร','รหัสนักศึกษา','ชื่อ-นามสกุล','สาขาวิชา','รอบที่','วันที่สมัคร','สถานะใบสมัคร','สถานะการสอบ','จัดการ'].map((h,i)=><th key={`${h}-${i}`}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {pagedApps.length===0 ? <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>ไม่พบข้อมูล</td></tr>
                                    : pagedApps.map(a=>(
                                        <tr key={a.registration_id}>
                                            <td><code style={{ fontSize:11.5, background:'#F4F6F7', padding:'2px 7px', borderRadius:4, letterSpacing:'0.5px' }}>{a.application_no}</code></td>
                                            <td style={{ fontSize:13, color:'#1a2f6e', fontWeight:500 }}>{a.university_student_code||'—'}<div style={{fontSize:10,color:'#94a3b8',fontWeight:400}}>{a.student_code}</div></td>
                                            <td style={{ fontWeight:500 }}>{a.title}{a.full_name}</td>
                                            <td style={{ color:'#1a2f6e', fontSize:13 }}>{a.course_name}</td>
                                            
                                            <td style={{textAlign:'center'}}>
                                                {a.is_retake
                                                    ? <span style={{background:'#FEF3C7',color:'#92400E',borderRadius:99,padding:'2px 8px',fontSize:11,fontWeight:600}}>🔄 ซ่อมรอบ {a.attempt_no}</span>
                                                    : <span style={{background:'#EEF2FF',color:'#3730A3',borderRadius:99,padding:'2px 8px',fontSize:11,fontWeight:600}}>📝 รอบ {a.attempt_no||1}</span>
                                                }
                                            </td><td style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{a.registered_at?new Date(a.registered_at).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}):'—'}</td>
                                            <td><StatusBadge s={a.application_status}/></td>
                                            <td style={{ fontSize:12 }}>{a.exam_status||'รอสอบ'}</td>
                                            <td style={{ whiteSpace:'nowrap' }}>
                                                {a.application_status==='รอดำเนินการ' ? <>
                                                    <button disabled={busyId===a.registration_id} onClick={()=>handleStatus(a.registration_id,'อนุมัติสิทธิ์สอบ')} style={{ background:'#27AE60', color:'white', border:'none', borderRadius:5, padding:'6px 11px', cursor:'pointer', fontSize:11.5, fontWeight:600, marginRight:4, opacity:busyId===a.registration_id?0.6:1 }}>✓ อนุมัติ</button>
                                                    <button disabled={busyId===a.registration_id} onClick={()=>handleStatus(a.registration_id,'ปฏิเสธเอกสาร')} style={{ background:'#E74C3C', color:'white', border:'none', borderRadius:5, padding:'6px 11px', cursor:'pointer', fontSize:11.5, fontWeight:600, opacity:busyId===a.registration_id?0.6:1 }}>✗ ปฏิเสธ</button>
                                                </> :
                                                    <button disabled={busyId===a.registration_id||!!a.result_published_at} onClick={()=>handleStatus(a.registration_id,'รอดำเนินการ')} style={{ background:'#64748B', color:'white', border:'none', borderRadius:5, padding:'6px 10px', cursor:a.result_published_at?'not-allowed':'pointer', fontSize:11.5, opacity:(busyId===a.registration_id||a.result_published_at)?0.5:1 }}>↺ ส่งกลับรอตรวจ</button>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination total={filterApps.length} page={appPage} perPage={PER_PAGE} onChange={p=>{setAppPage(p);window.scrollTo(0,160);}}/>
                    </div>
                )}

                {/* ══ Tab 2: บันทึกคะแนน ══ */}
                {activeTab==='grading' && (
                    <div style={{ background:'white', borderRadius:'0 0 10px 10px', padding:'20px', boxShadow:'0 4px 12px rgba(0,0,0,0.06)', marginBottom:24 }}>
                        <div style={{ background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)', borderRadius:10, padding:'12px 16px', marginBottom:16, border:'1px solid #C7D2FE', display:'flex', gap:20, fontSize:12, flexWrap:'wrap' }}>
                            <span>1️⃣ <strong>ยืนยันการเข้าสอบ</strong></span>
                            <span>2️⃣ <strong>กรอกคะแนนในหน้าต่าง</strong></span>
                            <span>3️⃣ <strong>ตรวจคะแนนและประกาศผล</strong></span>
                            <span style={{marginLeft:'auto'}}>เกณฑ์ผ่าน: คะแนนสุทธิ ≥ 70</span>
                        </div>

                        <FilterBar>
                            <input className="rmuts-search" style={{ flex:1, minWidth:200 }} placeholder="🔍 ค้นหาชื่อ, รหัส, สาขา..." value={gradeSearch} onChange={e=>{setGradeSearch(e.target.value);setGradePage(1);}}/>
                            <FilterSelect value={gradeStage} onChange={v=>{setGradeStage(v);setGradePage(1);}} options={[
                                {val:'pending',label:'งานที่ยังไม่ประกาศผล'},
                                {val:'waiting',label:'รอยืนยันเข้าสอบ'},
                                {val:'ready',label:'พร้อมกรอกคะแนน'},
                                {val:'absent',label:'ขาดสอบ/ยกเลิก'},
                                {val:'published',label:'ประกาศผลแล้ว'},
                            ]} placeholder="ทุกขั้นตอน"/>
                            <FilterSelect value={gradeMonth} onChange={v=>{setGradeMonth(v);setGradePage(1);}} options={gradeMonthOptions.map(m=>({val:m,label:fmtMonthLabel(m)}))} placeholder="📅 ทุกเดือน"/>
                            <FilterSelect value={gradeCourse} onChange={v=>{setGradeCourse(v);setGradePage(1);}} options={gradeCourseOptions.map(c=>({val:c,label:c}))} placeholder="📚 ทุกสาขา"/>
                            {(gradeSearch||gradeMonth||gradeCourse||gradeStage!=='pending') && (
                                <button onClick={()=>{setGradeSearch('');setGradeMonth('');setGradeCourse('');setGradeStage('pending');setGradePage(1);}} style={{ padding:'7px 12px', background:'#FADBD8', color:'#78281F', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>✕ ล้าง</button>
                            )}
                            <div style={{ marginLeft:'auto', fontSize:12, color:'#64748b', fontWeight:500 }}>พบ {filterGrade.length} รายการ</div>
                        </FilterBar>

                        {pagedGrade.length===0 ? (
                            <div style={{ textAlign:'center', padding:'46px 20px', color:'#94a3b8', border:'1px dashed #CBD5E1', borderRadius:10 }}>
                                <div style={{fontSize:36,marginBottom:8}}>📭</div>
                                {approved.length===0?'ยังไม่มีนักศึกษาที่อนุมัติสิทธิ์สอบ':'ไม่มีรายการในขั้นตอนที่เลือก'}
                            </div>
                        ) : (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(330px,1fr))', gap:14 }}>
                                {pagedGrade.map(s=>{
                                    const status=s.result_published_at?'ประกาศผลแล้ว':(s.exam_status||'รอสอบ');
                                    const statusStyle=status==='เข้าสอบ'?['#DCFCE7','#166534']:status==='รอสอบ'?['#FEF3C7','#92400E']:status==='ประกาศผลแล้ว'?['#DBEAFE','#1E40AF']:['#FEE2E2','#991B1B'];
                                    return (
                                        <article key={s.registration_id} style={{ border:'1px solid #E2E8F0', borderTop:`4px solid ${status==='เข้าสอบ'?'#22C55E':status==='รอสอบ'?'#F5A800':status==='ประกาศผลแล้ว'?'#2563EB':'#EF4444'}`, borderRadius:10, padding:16, boxShadow:'0 2px 8px rgba(15,23,42,0.06)', background:'white' }}>
                                            <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:12 }}>
                                                <div>
                                                    <div style={{fontSize:15,fontWeight:700,color:'#0F1F4A'}}>{s.title}{s.full_name}</div>
                                                    <div style={{fontSize:11.5,color:'#64748B',marginTop:2}}>รหัสนักศึกษา {s.university_student_code||'—'} · {s.student_code}</div>
                                                </div>
                                                <span style={{alignSelf:'flex-start',background:statusStyle[0],color:statusStyle[1],borderRadius:99,padding:'4px 10px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{status}</span>
                                            </div>
                                            <div style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',fontSize:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px',marginBottom:12}}>
                                                <div style={{gridColumn:'1 / -1'}}><span style={{color:'#64748B'}}>วิชา:</span> <strong style={{color:'#1A2F6E'}}>{s.course_code?`${s.course_code} · `:''}{s.course_name}</strong></div>
                                                <div><span style={{color:'#64748B'}}>วันสอบ:</span> <strong>{fmtExamDate(s.exam_date)}</strong></div>
                                                <div><span style={{color:'#64748B'}}>เวลา:</span> <strong>{fmtExamTime(s.exam_time)}</strong></div>
                                                <div style={{gridColumn:'1 / -1'}}><span style={{color:'#64748B'}}>ห้องสอบ:</span> <strong>{s.exam_location||'ยังไม่กำหนด'}</strong></div>
                                                <div><span style={{color:'#64748B'}}>เลขใบสมัคร:</span> <strong>{s.application_no}</strong></div>
                                                <div><span style={{color:'#64748B'}}>รอบ:</span> <strong>{s.is_retake?`สอบซ่อม ${s.attempt_no}`:`ครั้งที่ ${s.attempt_no||1}`}</strong></div>
                                            </div>

                                            {s.result_published_at ? (
                                                <div style={{background:s.department_status==='ได้รับวุฒิบัตร'?'#F0FDF4':'#FEF2F2',borderRadius:8,padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                                                    <div><div style={{fontSize:11,color:'#64748B'}}>คะแนนสุทธิ</div><strong style={{fontSize:22,color:'#1A2F6E'}}>{Number(s.total_score||0).toFixed(2)}</strong></div>
                                                    <strong style={{color:s.department_status==='ได้รับวุฒิบัตร'?'#15803D':'#B91C1C'}}>{s.department_status==='ได้รับวุฒิบัตร'?'🏆 ผ่าน':'❌ ไม่ผ่าน'}</strong>
                                                </div>
                                            ) : status==='รอสอบ' ? (
                                                <div>
                                                    <div style={{fontSize:11.5,color:'#92400E',marginBottom:8}}>ขั้นที่ 1: ตรวจบัตรและยืนยันว่าผู้สมัครเข้าสอบแล้ว</div>
                                                    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                                                        <button disabled={busyId===s.registration_id} onClick={()=>handleExamStatus(s.registration_id,'เข้าสอบ')} style={{flex:2,minWidth:150,padding:'9px 12px',border:0,borderRadius:7,background:'#16A34A',color:'white',fontWeight:700,cursor:'pointer'}}>✓ ยืนยันเข้าสอบ</button>
                                                        <button disabled={busyId===s.registration_id} onClick={()=>handleExamStatus(s.registration_id,'ขาดสอบ')} style={{padding:'9px 10px',border:'1px solid #FCA5A5',borderRadius:7,background:'#FEF2F2',color:'#B91C1C',cursor:'pointer'}}>ขาดสอบ</button>
                                                        <button disabled={busyId===s.registration_id} onClick={()=>handleExamStatus(s.registration_id,'ยกเลิก')} style={{padding:'9px 10px',border:'1px solid #CBD5E1',borderRadius:7,background:'#F8FAFC',color:'#475569',cursor:'pointer'}}>ยกเลิก</button>
                                                    </div>
                                                </div>
                                            ) : status==='เข้าสอบ' ? (
                                                <div style={{display:'flex',gap:8,alignItems:'stretch',flexWrap:'wrap'}}>
                                                    <button onClick={()=>setScoreModalId(s.registration_id)} style={{flex:2,minWidth:200,padding:'10px 14px',border:0,borderRadius:8,background:'linear-gradient(135deg,#0D1E4A,#1A2F6E)',color:'white',fontWeight:700,cursor:'pointer'}}>✍️ ขั้นที่ 2: เปิดหน้าต่างกรอกคะแนน</button>
                                                    <button disabled={busyId===s.registration_id} onClick={()=>handleExamStatus(s.registration_id,'รอสอบ')} style={{padding:'9px 11px',border:'1px solid #CBD5E1',borderRadius:8,background:'white',color:'#475569',cursor:'pointer'}}>แก้สถานะ</button>
                                                </div>
                                            ) : (
                                                <div style={{background:'#FEF2F2',borderRadius:8,padding:'9px 11px',fontSize:12,color:'#991B1B',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                                                    <span>รายการนี้ถูกระบุว่า “{status}” จึงยังบันทึกคะแนนไม่ได้</span>
                                                    <button disabled={busyId===s.registration_id} onClick={()=>handleExamStatus(s.registration_id,'รอสอบ')} style={{padding:'6px 9px',border:'1px solid #FCA5A5',borderRadius:6,background:'white',color:'#991B1B',cursor:'pointer',whiteSpace:'nowrap'}}>แก้เป็นรอสอบ</button>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                        <Pagination total={filterGrade.length} page={gradePage} perPage={PER_PAGE} onChange={p=>{setGradePage(p);window.scrollTo(0,160);}}/>

                        {scoreModalRegistration && scoreModalForm && (
                            <div className="rmuts-overlay" onClick={()=>busyId!==scoreModalRegistration.registration_id&&setScoreModalId(null)}>
                                <div className="rmuts-modal" onClick={event=>event.stopPropagation()} style={{maxWidth:720,width:'calc(100vw - 32px)',padding:0,overflow:'hidden'}}>
                                    <div style={{background:'linear-gradient(135deg,#0D1E4A,#1A2F6E)',color:'white',padding:'16px 20px',display:'flex',justifyContent:'space-between',gap:12}}>
                                        <div><div style={{fontSize:17,fontWeight:700}}>✍️ บันทึกและประกาศผลสอบ</div><div style={{fontSize:12,opacity:0.75,marginTop:3}}>{scoreModalRegistration.course_name}</div></div>
                                        <button onClick={()=>setScoreModalId(null)} disabled={busyId===scoreModalRegistration.registration_id} style={{background:'none',border:0,color:'white',fontSize:22,cursor:'pointer'}}>×</button>
                                    </div>
                                    <div style={{padding:20}}>
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:9,padding:'11px 13px',marginBottom:16,fontSize:12}}>
                                            <div><span style={{color:'#64748B'}}>นักศึกษา</span><br/><strong>{scoreModalRegistration.title}{scoreModalRegistration.full_name}</strong></div>
                                            <div><span style={{color:'#64748B'}}>รหัสนักศึกษา</span><br/><strong>{scoreModalRegistration.university_student_code||'—'}</strong></div>
                                            <div><span style={{color:'#64748B'}}>กำหนดสอบ</span><br/><strong>{fmtExamDate(scoreModalRegistration.exam_date)} · {fmtExamTime(scoreModalRegistration.exam_time)}</strong></div>
                                            <div><span style={{color:'#64748B'}}>ห้องสอบ</span><br/><strong>{scoreModalRegistration.exam_location||'ยังไม่กำหนด'}</strong></div>
                                        </div>
                                        <div style={{background:'#ECFDF5',color:'#166534',border:'1px solid #BBF7D0',borderRadius:8,padding:'9px 12px',fontSize:12,marginBottom:16}}>✅ ขั้นที่ 1 ยืนยันการเข้าสอบแล้ว — กรุณากรอกคะแนนและตรวจสอบก่อนประกาศผล</div>
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
                                            <ScoreInput label="คะแนนทฤษฎี" value={scoreModalForm.theory} max={Number(scoreModalRegistration.theory_max_score||30)} color="#60A5FA" disabled={busyId===scoreModalRegistration.registration_id} onChange={e=>setScoreForm(p=>({...p,[scoreModalRegistration.registration_id]:{...p[scoreModalRegistration.registration_id],theory:e.target.value}}))}/>
                                            <ScoreInput label="คะแนนปฏิบัติ" value={scoreModalForm.practical} max={Number(scoreModalRegistration.practical_max_score||70)} color="#F5A800" disabled={busyId===scoreModalRegistration.registration_id} onChange={e=>setScoreForm(p=>({...p,[scoreModalRegistration.registration_id]:{...p[scoreModalRegistration.registration_id],practical:e.target.value}}))}/>
                                            <ScoreInput label="คะแนนที่หัก" value={scoreModalForm.deducted} max={Number(scoreModalForm.theory||0)+Number(scoreModalForm.practical||0)} color="#FCA5A5" disabled={busyId===scoreModalRegistration.registration_id} onChange={e=>setScoreForm(p=>({...p,[scoreModalRegistration.registration_id]:{...p[scoreModalRegistration.registration_id],deducted:e.target.value}}))}/>
                                        </div>
                                        <div style={{marginTop:16,borderRadius:10,padding:'13px 16px',background:scorePreview>=70?'#F0FDF4':'#FFF7ED',border:`2px solid ${scorePreview>=70?'#86EFAC':'#FED7AA'}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                                            <div><div style={{fontSize:11.5,color:'#64748B'}}>คะแนนสุทธิ = ทฤษฎี + ปฏิบัติ − คะแนนหัก</div><strong style={{fontSize:25,color:'#1A2F6E'}}>{scorePreview.toFixed(2)} คะแนน</strong></div>
                                            <strong style={{fontSize:16,color:scorePreview>=70?'#15803D':'#C2410C'}}>{scorePreview>=70?'🏆 ผ่านเกณฑ์':'ยังไม่ผ่านเกณฑ์'}</strong>
                                        </div>
                                        <div style={{marginTop:10,fontSize:11.5,color:'#B45309'}}>⚠️ เมื่อยืนยัน ระบบจะประกาศผลและส่งอีเมลให้นักศึกษาทันที</div>
                                        <div style={{display:'flex',gap:10,marginTop:18}}>
                                            <button disabled={busyId===scoreModalRegistration.registration_id} onClick={()=>setScoreModalId(null)} className="rmuts-btn rmuts-btn--outline" style={{flex:1}}>ยกเลิก</button>
                                            <button disabled={busyId===scoreModalRegistration.registration_id} onClick={()=>handleScore(scoreModalRegistration.registration_id)} style={{flex:2,padding:12,border:0,borderRadius:8,background:'linear-gradient(135deg,#15803D,#16A34A)',color:'white',fontWeight:700,cursor:'pointer',opacity:busyId===scoreModalRegistration.registration_id?0.6:1}}>{busyId===scoreModalRegistration.registration_id?'กำลังบันทึก...':'💾 ตรวจสอบแล้ว บันทึกและประกาศผล'}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default GradingPanel;
