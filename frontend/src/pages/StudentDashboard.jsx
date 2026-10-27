import React, { useState, useEffect, useCallback } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import '../styles/theme.css';
import { goTo } from '../utils/navigation';
import { formatThaiDate } from '../utils/dates';

const fmtDate = d => formatThaiDate(d);
const fmtTime = value => {
    if (!value) return 'ยังไม่กำหนด';
    const text = String(value).trim();
    const match = text.match(/^(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]} น.` : text;
};
const fmtScore = v => v != null ? Number(v).toFixed(0) : '—';

const StatusBadge = ({ s }) => {
    const map = {
        'อนุมัติสิทธิ์สอบ': ['#EAFAF1','#1E8449'],
        'รอดำเนินการ':      ['#FEF9E7','#7D6608'],
        'ปฏิเสธเอกสาร':    ['#FADBD8','#78281F'],
    };
    const [bg, color] = map[s] || ['#F4F6F7','#566573'];
    return <span style={{ background:bg, color, borderRadius:99, padding:'2px 10px', fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>{s || 'รอดำเนินการ'}</span>;
};

const ResultBadge = ({ s }) => {
    if (!s) return <span style={{ color:'#94a3b8', fontStyle:'italic', fontSize:12 }}>รอผลสอบ</span>;
    const passed = s === 'ได้รับวุฒิบัตร';
    return <span style={{ background: passed?'#EAFAF1':'#FADBD8', color: passed?'#1E8449':'#78281F', borderRadius:4, padding:'2px 10px', fontSize:12, fontWeight:600 }}>{passed ? '🏆 ได้รับวุฒิบัตร' : '❌ ไม่ได้รับวุฒิบัตร'}</span>;
};

const AttemptBadge = ({ no, isRetake }) => (
    <span style={{ background: isRetake ? '#FEF3C7':'#EEF2FF', color: isRetake?'#92400E':'#3730A3', borderRadius:99, padding:'1px 8px', fontSize:11, fontWeight:600 }}>
        {isRetake ? `🔄 สอบซ่อมรอบ ${no}` : `📝 สอบครั้งที่ ${no}`}
    </span>
);

// ── ค่าสมัครสอบ: แผงชำระเงินของแต่ละใบสมัคร ──────────────────────
const PAYMENT_BADGE = {
    'รอชำระเงิน': ['#FEF9E7', '#7D6608', '⏳ รอชำระเงิน'],
    'รอตรวจสลิป': ['#EFF6FF', '#1D4ED8', '🔎 ส่งสลิปแล้ว รอตรวจสอบ'],
    'ชำระแล้ว': ['#EAFAF1', '#1E8449', '✅ ชำระเงินแล้ว'],
    'สลิปไม่ผ่าน': ['#FADBD8', '#78281F', '⚠️ สลิปไม่ผ่าน'],
};
const localNow = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const needsPayment = a => ['รอชำระเงิน', 'สลิปไม่ผ่าน'].includes(a.payment_status) && a.application_status !== 'ปฏิเสธเอกสาร' && Number(a.payment_amount) > 0;

const PaymentPanel = ({ attempt, info, onDone, onViewSlip }) => {
    const [file, setFile] = useState(null);
    const [transferRef, setTransferRef] = useState('');
    const [paidAt, setPaidAt] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const status = attempt.payment_status;
    if (!status) return null;
    const [bg, color, label] = PAYMENT_BADGE[status] || PAYMENT_BADGE['รอชำระเงิน'];
    const amount = Number(attempt.payment_amount || 0);
    const id = attempt.registration_id;
    const canPay = needsPayment(attempt);

    const submit = async (event) => {
        event.preventDefault();
        if (!file) { setError('กรุณาแนบไฟล์สลิปการโอนเงิน (JPG, PNG หรือ PDF)'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('ไฟล์มีขนาดเกิน 5 MB'); return; }
        setBusy(true); setError('');
        try {
            const form = new FormData();
            form.append('payment_slip', file);
            if (transferRef.trim()) form.append('transfer_ref', transferRef.trim());
            if (paidAt) form.append('paid_at', paidAt);
            await API.post(`/student/payments/${id}/slip`, form);
            setFile(null); setTransferRef(''); setPaidAt('');
            await onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'ไม่สามารถส่งหลักฐานการชำระเงินได้');
        } finally { setBusy(false); }
    };

    return (
        <div style={{ marginTop:10, background:'white', border:'1px solid #E2E8F0', borderRadius:8, padding:'10px 12px' }} data-testid={`payment-${id}`}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a2f6e' }}>💳 ค่าสมัครสอบ {amount > 0 ? `${amount.toFixed(0)} บาท` : '— ไม่ต้องชำระ'}</div>
                <span style={{ background:bg, color, borderRadius:99, padding:'2px 10px', fontSize:11.5, fontWeight:600 }}>{amount > 0 ? label : 'ไม่ต้องชำระ'}</span>
            </div>
            {amount === 0 && <div style={{ fontSize:11.5, color:'#64748b', marginTop:6 }}>ใบสมัครนี้สมัครไว้ก่อนเริ่มเก็บค่าสมัคร จึงไม่ต้องชำระเงิน</div>}

            {status === 'สลิปไม่ผ่าน' && attempt.payment_note && (
                <div style={{ marginTop:8, fontSize:12, background:'#FEF2F2', color:'#991B1B', borderRadius:6, padding:'6px 10px' }}>เหตุผลที่สลิปไม่ผ่าน: {attempt.payment_note}</div>
            )}

            {canPay && (
                <form onSubmit={submit} style={{ marginTop:10 }}>
                    {info?.configured ? (
                        <div style={{ background:'#F8FAFC', border:'1px dashed #CBD5E1', borderRadius:6, padding:'8px 10px', fontSize:12.5, lineHeight:1.7, marginBottom:10 }}>
                            <div><span style={{ color:'#64748b' }}>โอนเงินไปที่บัญชี:</span> <strong>{info.account_name}</strong></div>
                            {info.bank_name && <div><span style={{ color:'#64748b' }}>ธนาคาร:</span> <strong>{info.bank_name}</strong></div>}
                            {info.account_no && <div><span style={{ color:'#64748b' }}>เลขที่บัญชี:</span> <strong style={{ letterSpacing:1 }}>{info.account_no}</strong></div>}
                            {info.promptpay_id && <div><span style={{ color:'#64748b' }}>พร้อมเพย์:</span> <strong>{info.promptpay_id}</strong></div>}
                            <div><span style={{ color:'#64748b' }}>ยอดที่ต้องโอน:</span> <strong style={{ color:'#B45309' }}>{amount.toFixed(2)} บาท</strong></div>
                            {info.note && <div style={{ color:'#64748b' }}>{info.note}</div>}
                        </div>
                    ) : (
                        <div style={{ background:'#FEF9E7', color:'#7D6608', borderRadius:6, padding:'8px 10px', fontSize:12.5, marginBottom:10 }}>
                            ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามช่องทางการชำระเงิน แล้วกลับมาแนบสลิปที่นี่
                        </div>
                    )}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8 }}>
                        <div>
                            <label htmlFor={`pay-file-${id}`} style={{ display:'block', fontSize:12, color:'#475569', marginBottom:3 }}>แนบสลิปการโอนเงิน (JPG, PNG, PDF ไม่เกิน 5 MB)</label>
                            <input id={`pay-file-${id}`} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ width:'100%', fontSize:12 }}/>
                        </div>
                        <div>
                            <label htmlFor={`pay-ref-${id}`} style={{ display:'block', fontSize:12, color:'#475569', marginBottom:3 }}>เลขอ้างอิงรายการ (ถ้ามี)</label>
                            <input id={`pay-ref-${id}`} type="text" maxLength={64} value={transferRef} onChange={e => setTransferRef(e.target.value)} className="rmuts-input rmuts-input--no-icon" style={{ padding:'7px 10px', fontSize:13 }}/>
                        </div>
                        <div>
                            <label htmlFor={`pay-time-${id}`} style={{ display:'block', fontSize:12, color:'#475569', marginBottom:3 }}>วันเวลาที่โอน (ถ้ามี)</label>
                            <input id={`pay-time-${id}`} type="datetime-local" max={localNow()} value={paidAt} onChange={e => setPaidAt(e.target.value)} className="rmuts-input rmuts-input--no-icon" style={{ padding:'7px 10px', fontSize:13 }}/>
                        </div>
                    </div>
                    {error && <div className="rmuts-alert rmuts-alert--error" style={{ marginTop:8 }} role="alert">{error}</div>}
                    <button type="submit" disabled={busy} style={{ marginTop:10, background:'#1a2f6e', color:'white', border:'none', borderRadius:7, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:busy ? 'not-allowed' : 'pointer', opacity:busy ? 0.7 : 1 }}>
                        {busy ? '⏳ กำลังส่ง...' : '📤 ส่งหลักฐานการชำระเงิน'}
                    </button>
                    <div style={{ marginTop:6, fontSize:11, color:'#94a3b8' }}>ค่าสมัครไม่สามารถขอคืนได้ทุกกรณี การสอบซ่อมต้องชำระค่าสมัครใหม่</div>
                </form>
            )}

            {status === 'รอตรวจสลิป' && (
                <div style={{ marginTop:8, fontSize:12, color:'#1D4ED8' }}>
                    ส่งหลักฐานเมื่อ {fmtDate(attempt.payment_submitted_at)} เจ้าหน้าที่จะตรวจสอบและอนุมัติสิทธิ์สอบให้ภายหลัง
                </div>
            )}
            {attempt.slip_filename && amount > 0 && ['รอตรวจสลิป', 'ชำระแล้ว', 'สลิปไม่ผ่าน'].includes(status) && (
                <button type="button" onClick={() => onViewSlip(attempt.slip_filename)} style={{ marginTop:8, background:'none', border:'1px solid #CBD5E1', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', color:'#334155' }}>
                    🧾 ดูสลิปที่ส่ง
                </button>
            )}
        </div>
    );
};

// ── Course History Card (แสดงประวัติทุกรอบของวิชาเดียว) ────────────
const CourseHistoryCard = ({ group, onApplyRetake, onOpenCertificate, paymentInfo, onPaymentChanged, onViewSlip }) => {
    const [expanded, setExpanded] = useState(true);
    const passed  = group.attempts.some(a => a.department_status === 'ได้รับวุฒิบัตร');
    const passedAttempt = group.attempts.find(a => a.department_status === 'ได้รับวุฒิบัตร');
    // ใบสมัครที่ยังไม่ประกาศผล (รออนุมัติหรืออนุมัติแล้ว) ห้ามสมัครสอบซ่อมซ้อน
    const hasPending = group.attempts.some(a => !a.department_status && a.application_status !== 'ปฏิเสธเอกสาร');

    return (
        <div style={{ border:'1px solid #E2E8F0', borderRadius:10, marginBottom:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
            {/* Header */}
            <div onClick={()=>setExpanded(p=>!p)} style={{ background: passed?'#F0FDF4':'#F8FAFC', padding:'12px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: expanded?'1px solid #E2E8F0':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontSize:20 }}>{passed ? '🏆' : hasPending ? '⏳' : '📚'}</div>
                    <div>
                        <div style={{ fontWeight:600, color:'#1a2f6e', fontSize:14 }}>{group.course_name}</div>
                        <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>
                            รหัส: {group.course_code} &nbsp;·&nbsp; ทำการสอบ {group.attempts.length} รอบ
                        </div>
                    </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {passed && <span style={{ background:'#D1FAE5', color:'#065F46', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>✅ ผ่านแล้ว</span>}
                    <span style={{ color:'#94a3b8', fontSize:14 }}>{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {/* Attempts timeline */}
            {expanded && (
                <div style={{ padding:'12px 16px' }}>
                    <div style={{ position:'relative', paddingLeft:28 }}>
                        {/* Timeline line */}
                        {group.attempts.length > 1 && (
                            <div style={{ position:'absolute', left:10, top:12, bottom:12, width:2, background:'#E2E8F0', borderRadius:99 }}/>
                        )}

                        {group.attempts.map((attempt, idx) => {
                            const isLatest  = idx === group.attempts.length - 1;
                            const attemptPassed = attempt.department_status === 'ได้รับวุฒิบัตร';
                            const dotColor = attemptPassed ? '#27AE60' : attempt.department_status ? '#E74C3C' : attempt.application_status === 'อนุมัติสิทธิ์สอบ' ? '#2980B9' : '#94a3b8';

                            return (
                                <div key={attempt.registration_id} style={{ position:'relative', marginBottom: idx < group.attempts.length-1 ? 16 : 0 }}>
                                    {/* Timeline dot */}
                                    <div style={{ position:'absolute', left:-20, top:10, width:12, height:12, borderRadius:'50%', background:dotColor, border:'2px solid white', boxShadow:`0 0 0 1px ${dotColor}` }}/>

                                    <div style={{ background: isLatest?'#FAFBFC':'#FEFEFE', border:'1px solid #E2E8F0', borderRadius:8, padding:'10px 14px', borderLeft:`3px solid ${dotColor}` }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                <AttemptBadge no={attempt.attempt_no} isRetake={!!attempt.is_retake}/>
                                                {isLatest && <span style={{ background:'#EEF2FF', color:'#3730A3', borderRadius:99, padding:'1px 7px', fontSize:10.5, fontWeight:600 }}>ล่าสุด</span>}
                                            </div>
                                            <StatusBadge s={attempt.application_status}/>
                                        </div>

                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'4px 16px', fontSize:12 }}>
                                            <div><span style={{ color:'#64748b' }}>เลขใบสมัคร:</span> <code style={{ fontSize:11, background:'#F4F6F7', padding:'1px 5px', borderRadius:3 }}>{attempt.application_no}</code></div>
                                            <div><span style={{ color:'#64748b' }}>วันที่สมัคร:</span> <strong>{fmtDate(attempt.registered_at)}</strong></div>
                                            {attempt.exam_date && <div><span style={{ color:'#64748b' }}>วันสอบ:</span> <strong style={{ color:'#1a2f6e' }}>{fmtDate(attempt.exam_date)}</strong></div>}
                                            <div><span style={{ color:'#64748b' }}>เวลาสอบ:</span> <strong style={{ color:'#1a2f6e' }}>{fmtTime(attempt.exam_time)}</strong></div>
                                            <div><span style={{ color:'#64748b' }}>ห้อง/สถานที่สอบ:</span> <strong style={{ color:'#1a2f6e' }}>{attempt.exam_location || 'ยังไม่กำหนด'}</strong></div>
                                            <div><span style={{ color:'#64748b' }}>สถานะเข้าสอบ:</span> <strong>{attempt.exam_status || 'รอสอบ'}</strong></div>
                                        </div>

                                        <PaymentPanel attempt={attempt} info={paymentInfo} onDone={onPaymentChanged} onViewSlip={onViewSlip}/>

                                        {/* ผลคะแนน */}
                                        {(attempt.theory_score != null || attempt.practical_score != null) && (
                                            <div style={{ marginTop:10, background:'white', borderRadius:6, padding:'8px 12px', border:'1px solid #E2E8F0' }}>
                                                <div style={{ fontSize:11, color:'#64748b', marginBottom:6, fontWeight:500 }}>ผลคะแนนสอบ</div>
                                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, alignItems:'center' }}>
                                                    <div style={{ textAlign:'center' }}>
                                                        <div style={{ fontSize:20, fontWeight:700, color:'#2980B9' }}>{fmtScore(attempt.theory_score)}</div>
                                                        <div style={{ fontSize:10, color:'#64748b' }}>ทฤษฎี /30</div>
                                                    </div>
                                                    <div style={{ textAlign:'center' }}>
                                                        <div style={{ fontSize:20, fontWeight:700, color:'#c47f00' }}>{fmtScore(attempt.practical_score)}</div>
                                                        <div style={{ fontSize:10, color:'#64748b' }}>ปฏิบัติ /70</div>
                                                    </div>
                                                    <div style={{ textAlign:'center' }}>
                                                        <div style={{ fontSize:20, fontWeight:700, color:'#1a2f6e' }}>{fmtScore(attempt.total_score)}</div>
                                                        <div style={{ fontSize:10, color:'#64748b' }}>รวม /100</div>
                                                    </div>
                                                    <div>
                                                        <ResultBadge s={attempt.department_status}/>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* เหตุผลสอบซ่อม */}
                                        {Boolean(attempt.is_retake) && attempt.retake_reason && (
                                            <div style={{ marginTop:6, fontSize:11.5, color:'#92400E', background:'#FEF3C7', borderRadius:4, padding:'4px 8px' }}>
                                                📝 เหตุผลสอบซ่อม: {attempt.retake_reason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ปุ่มสอบซ่อม */}
                    {!passed && !hasPending && (
                        <button onClick={() => onApplyRetake(group)} style={{ marginTop:12, background:'linear-gradient(135deg,#92400E,#c47f00)', color:'white', border:'none', borderRadius:8, padding:'9px 20px', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                            🔄 สมัครสอบซ่อม
                        </button>
                    )}
                    {passedAttempt && (
                        <button onClick={() => onOpenCertificate(passedAttempt.registration_id)} style={{ marginTop:12, background:'#15803d', color:'white', border:'none', borderRadius:8, padding:'9px 20px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                            🏆 เปิดใบรับรอง
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main StudentDashboard ──────────────────────────────────────────
const StudentDashboard = () => {
    const [studentInfo, setStudentInfo]   = useState(null);
    const [historyGroups, setHistoryGroups] = useState([]);
    const [currentExam, setCurrentExam]   = useState(null);
    const [paymentInfo, setPaymentInfo]   = useState(null);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState('');

    // retake modal
    const [retakeModal, setRetakeModal]   = useState(null); // { group }
    const [retakeReason, setRetakeReason] = useState('');
    const [retakeLoading, setRetakeLoading] = useState(false);
    const [retakeError, setRetakeError]   = useState('');
    const [retakeSuccess, setRetakeSuccess] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [histRes, meRes, payRes] = await Promise.all([
                API.get('/student/exam-history'),
                API.get('/student/me'),
                Promise.resolve(API.get('/student/payment-info')).catch(() => null),
            ]);
            setPaymentInfo(payRes?.data?.data || null);
            if (histRes.data.success) {
                const groups = histRes.data.data;
                setHistoryGroups(groups);

                const attempts = groups.flatMap(group => group.attempts.map(attempt => ({
                    ...attempt,
                    course_name: group.course_name,
                    course_code: group.course_code,
                })));
                const newestFirst = [...attempts].sort((a, b) =>
                    new Date(b.registered_at || 0) - new Date(a.registered_at || 0)
                );
                const activeExam = newestFirst.find(attempt =>
                    attempt.application_status === 'อนุมัติสิทธิ์สอบ' && !attempt.result_published_at
                );
                setCurrentExam(activeExam || newestFirst[0] || null);
            }

            setStudentInfo(meRes.data.student);
        } catch (e) {
            setError(e.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openCertificate = async (registrationId) => {
        const win = window.open('', '_blank');
        if (!win) { setError('กรุณาอนุญาต popup เพื่อเปิดใบรับรอง'); return; }
        try {
            const response = await API.get(`/certificates/${registrationId}`, { responseType:'blob' });
            const url = URL.createObjectURL(response.data);
            win.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            win.close();
            setError(error.response?.data?.message || 'ไม่สามารถเปิดใบรับรองได้');
        }
    };

    const openSlip = async (filename) => {
        const win = window.open('', '_blank');
        if (!win) { setError('กรุณาอนุญาต popup เพื่อดูสลิป'); return; }
        try {
            const response = await API.get(`/documents/${encodeURIComponent(filename)}`, { responseType:'blob' });
            const url = URL.createObjectURL(response.data);
            win.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            win.close();
            setError(err.response?.data?.message || 'ไม่สามารถเปิดสลิปได้');
        }
    };

    const handleApplyRetake = async () => {
        if (!retakeModal) return;
        setRetakeLoading(true); setRetakeError(''); setRetakeSuccess('');
        try {
            const res = await API.post('/student/apply-retake', {
                course_id:     retakeModal.group.course_id,
                retake_reason: retakeReason,
            });
            if (res.data.success) {
                setRetakeSuccess(res.data.message);
                setTimeout(() => { setRetakeModal(null); setRetakeReason(''); setRetakeSuccess(''); fetchData(); }, 2000);
            }
        } catch (err) {
            setRetakeError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally { setRetakeLoading(false); }
    };

    if (loading) return (
        <div className="rmuts-page" style={{ alignItems:'center', justifyContent:'center' }}>
            <RmutsNavbar title="แดชบอร์ดนักศึกษา"/>
            <div style={{ textAlign:'center', marginTop:120, color:'#1a2f6e' }}>
                <div style={{ fontSize:36 }}>⏳</div>
                <div style={{ marginTop:8 }}>กำลังโหลดข้อมูล...</div>
            </div>
        </div>
    );

    const isApproved = currentExam?.application_status === 'อนุมัติสิทธิ์สอบ' && !currentExam?.result_published_at;
    const unpaidCount = historyGroups.flatMap(g => g.attempts).filter(needsPayment).length;

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="แดชบอร์ดนักศึกษา" actions={[
                { label:'📝 สมัครสอบ (วิชาใหม่)', onClick:()=>goTo('/student-apply'), gold:true },
                ...(studentInfo?.registration_status === 'เอกสารไม่ครบ' ? [{ label:'📎 ส่งเอกสารใหม่', onClick:()=>goTo('/resubmit-documents') }] : [])
            ]}/>
            <div className="rmuts-page__body">

                {error && <div className="rmuts-alert rmuts-alert--error">{error}</div>}

                {unpaidCount > 0 && (
                    <div role="status" style={{ background:'#FEF9E7', border:'1px solid #F9E79F', color:'#7D6608', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13.5 }}>
                        💳 มี {unpaidCount} ใบสมัครที่ยังไม่ได้ชำระค่าสมัครสอบ — โอนเงินแล้วแนบสลิปในการ์ดของใบสมัครด้านล่าง เจ้าหน้าที่จะอนุมัติสิทธิ์สอบหลังตรวจสลิป
                    </div>
                )}

                {/* ข้อมูลนักศึกษา */}
                <div className="rmuts-card" style={{ borderLeft:'4px solid #F5A800', marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                            <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#1a2f6e,#0f1f4a)', display:'flex', alignItems:'center', justifyContent:'center', color:'#F5A800', fontSize:20, fontWeight:700, flexShrink:0 }}>
                                {studentInfo?.full_name?.[0] || '?'}
                            </div>
                            <div>
                                <div style={{ fontSize:17, fontWeight:700, color:'#1a2f6e' }}>{studentInfo?.full_name}</div>
                                <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>
                                    รหัสนักศึกษา: <strong style={{ color:'#1a2f6e', letterSpacing:1 }}>{studentInfo?.university_student_code||'—'}</strong>
                                </div>
                                <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>รหัสผู้สมัคร: {studentInfo?.student_code}</div>
                            </div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                            <div style={{ textAlign:'center', background:'#EEF2FF', borderRadius:8, padding:'6px 14px' }}>
                                <div style={{ fontSize:20, fontWeight:700, color:'#1a2f6e' }}>{historyGroups.length}</div>
                                <div style={{ fontSize:11, color:'#64748b' }}>สาขาที่สมัคร</div>
                            </div>
                            <div style={{ textAlign:'center', background:'#ECFDF5', borderRadius:8, padding:'6px 14px' }}>
                                <div style={{ fontSize:20, fontWeight:700, color:'#27AE60' }}>
                                    {historyGroups.filter(g=>g.attempts.some(a=>a.department_status==='ได้รับวุฒิบัตร')).length}
                                </div>
                                <div style={{ fontSize:11, color:'#64748b' }}>ผ่านแล้ว</div>
                            </div>
                            <div style={{ textAlign:'center', background:'#FEF9E7', borderRadius:8, padding:'6px 14px' }}>
                                <div style={{ fontSize:20, fontWeight:700, color:'#c47f00' }}>
                                    {historyGroups.reduce((sum,g)=>sum+g.attempts.length,0)}
                                </div>
                                <div style={{ fontSize:11, color:'#64748b' }}>ครั้งที่สอบ</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* บัตรเข้าห้องสอบ */}
                {isApproved && currentExam && (
                    <div style={{ background:'linear-gradient(135deg,#1a2f6e,#0f1f4a)', borderRadius:12, padding:'18px 22px', marginBottom:20, border:'3px solid #F5A800' }}>
                        <div style={{ fontWeight:700, color:'#F5A800', marginBottom:12, fontSize:14 }}>
                            📱 บัตรเข้าห้องสอบ Digital — ยื่นแสดงพร้อมบัตรประชาชนก่อนเข้าห้องสอบ
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, fontSize:13 }}>
                            {[
                                ['เลขใบสมัคร', currentExam.application_no, 'white'],
                                ['วิชาที่สอบ', `${currentExam.course_code ? `${currentExam.course_code} · ` : ''}${currentExam.course_name}`, 'white'],
                                ['วันที่สอบ', fmtDate(currentExam.exam_date), '#F5A800'],
                                ['เวลาเข้าสอบ', fmtTime(currentExam.exam_time), '#F5A800'],
                                ['ห้อง/สถานที่สอบ', currentExam.exam_location || 'ยังไม่กำหนด', '#F5A800'],
                                ['รอบการสอบ', `${currentExam.attempt_no} ${currentExam.is_retake ? '(สอบซ่อม)' : '(ครั้งแรก)'}`, 'white'],
                                ['สถานะการสอบ', currentExam.exam_status || 'รอสอบ', 'white'],
                            ].map(([label, value, color]) => (
                                <div key={label} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'9px 11px' }}>
                                    <div style={{ color:'rgba(255,255,255,0.62)', fontSize:11, marginBottom:2 }}>{label}</div>
                                    <strong style={{ color, lineHeight:1.45 }}>{value}</strong>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop:12, color:'rgba(255,255,255,0.72)', fontSize:11.5 }}>
                            กรุณามาถึงก่อนเวลาสอบอย่างน้อย 30 นาที และเตรียมบัตรประชาชนหรือบัตรนักศึกษา
                        </div>
                    </div>
                )}

                {/* ประวัติการสอบแยกวิชา */}
                {historyGroups.length === 0 ? (
                    <div className="rmuts-card" style={{ textAlign:'center', padding:'40px 20px' }}>
                        <div style={{ fontSize:48, marginBottom:12 }}>📝</div>
                        <div style={{ fontSize:16, fontWeight:600, color:'#1a2f6e', marginBottom:8 }}>ยังไม่มีการสมัครสอบ</div>
                        <div style={{ fontSize:14, color:'#64748b', marginBottom:20 }}>กดปุ่มด้านบนเพื่อเลือกสาขาวิชาที่ต้องการสอบ</div>
                        <button onClick={()=>goTo('/student-apply')} className="rmuts-btn rmuts-btn--gold" style={{ padding:'11px 28px', fontSize:15 }}>
                            📝 สมัครสอบตอนนี้
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{ fontSize:15, fontWeight:600, color:'#1a2f6e', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:4, height:18, background:'linear-gradient(#1a2f6e,#F5A800)', borderRadius:99, display:'inline-block' }}/>
                            ประวัติการทดสอบมาตรฐานฝีมือแรงงาน
                        </div>
                        {historyGroups.map(group => (
                            <CourseHistoryCard
                                key={group.course_id}
                                group={group}
                                onApplyRetake={(g) => { setRetakeModal({ group:g }); setRetakeReason(''); setRetakeError(''); }}
                                onOpenCertificate={openCertificate}
                                paymentInfo={paymentInfo}
                                onPaymentChanged={() => fetchData()}
                                onViewSlip={openSlip}
                            />
                        ))}
                    </div>
                )}

                {/* Modal สมัครสอบซ่อม */}
                {retakeModal && (
                    <div className="rmuts-overlay" onClick={()=>setRetakeModal(null)}>
                        <div className="rmuts-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()} style={{ maxWidth:480 }}>
                            <div style={{ borderBottom:'3px solid #F5A800', paddingBottom:14, marginBottom:18 }}>
                                <div style={{ fontSize:16, fontWeight:700, color:'#1a2f6e' }}>🔄 สมัครสอบซ่อม</div>
                                <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>{retakeModal.group.course_name}</div>
                            </div>

                            <div style={{ background:'#FEF3C7', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#92400E', border:'1px solid #FDE68A' }}>
                                <strong>⚠️ ข้อกำหนดการสอบซ่อม</strong><br/>
                                การสอบซ่อมจะนับเป็นรอบใหม่ โดยเก็บประวัติทุกรอบไว้ในระบบ<br/>
                                ค่าสมัครสอบซ่อม {Number(paymentInfo?.amount ?? 100).toFixed(0)} บาท ต้องชำระใหม่ทุกครั้ง ไม่มีการคืนเงิน<br/>
                                ต้องได้รับการอนุมัติจากเจ้าหน้าที่ก่อนเข้าห้องสอบ
                            </div>

                            <div className="rmuts-form-group">
                                <label className="rmuts-label">เหตุผลในการสอบซ่อม (ไม่บังคับ)</label>
                                <textarea className="rmuts-input rmuts-input--no-icon" style={{ height:80, resize:'vertical' }}
                                    placeholder="เช่น ต้องการพัฒนาคะแนนภาคปฏิบัติ"
                                    value={retakeReason} onChange={e=>setRetakeReason(e.target.value)}/>
                            </div>

                            {retakeError && <div className="rmuts-alert rmuts-alert--error" style={{ marginBottom:12 }}>❌ {retakeError}</div>}
                            {retakeSuccess && <div className="rmuts-alert rmuts-alert--success" style={{ marginBottom:12 }}>✅ {retakeSuccess}</div>}

                            <div style={{ display:'flex', gap:10 }}>
                                <button className="rmuts-btn rmuts-btn--outline" style={{ flex:1 }} onClick={()=>setRetakeModal(null)}>ยกเลิก</button>
                                <button disabled={retakeLoading} onClick={handleApplyRetake}
                                    style={{ flex:2, padding:12, background:'linear-gradient(135deg,#92400E,#c47f00)', color:'white', border:'none', borderRadius:8, cursor: retakeLoading?'not-allowed':'pointer', fontSize:14, fontWeight:600, opacity: retakeLoading?0.7:1 }}>
                                    {retakeLoading ? '⏳ กำลังส่ง...' : '🔄 ยืนยันสมัครสอบซ่อม'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default StudentDashboard;
