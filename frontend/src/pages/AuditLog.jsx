import React, { useState, useEffect, useCallback } from 'react';
import API, { downloadAuthenticated } from '../services/api';
import { goTo } from '../utils/navigation';
import { formatThaiDateTime } from '../utils/dates';

const PER_PAGE = 20;
const ADMIN_PER_PAGE = 50;

// ชื่อการกระทำที่แสดงให้ผู้ดูแลอ่านรู้เรื่อง (ค่าจริงในฐานข้อมูลเป็นรหัสภาษาอังกฤษ)
const ACTION_LABEL = {
    VIEW_PRIVATE_DOCUMENT: 'เปิดดูเอกสารส่วนบุคคล',
    VIEW_STUDENT_PROFILE: 'เปิดดูข้อมูลนักศึกษา',
    VERIFY_STUDENT_DOCUMENTS: 'ตรวจเอกสารผู้สมัคร',
    CHANGE_APPLICATION_STATUS: 'เปลี่ยนสถานะใบสมัคร',
    CHANGE_EXAM_STATUS: 'เปลี่ยนสถานะการเข้าสอบ',
    EXPORT_STUDENT_EXAM_DATA: 'ส่งออกข้อมูลนักศึกษา',
    CORRECT_SCORE: 'แก้ไขคะแนนที่ประกาศแล้ว',
    RESET_PASSWORD: 'รีเซ็ตรหัสผ่านผู้ใช้',
    CHANGE_ROLE: 'เปลี่ยนบทบาทผู้ใช้',
    ENABLE_USER: 'เปิดใช้งานบัญชี',
    DISABLE_USER: 'ปิดใช้งานบัญชี',
    REVOKE_CERTIFICATE: 'เพิกถอนใบรับรอง',
    REISSUE_CERTIFICATE: 'ออกใบรับรองใหม่',
    CREATE_COURSE: 'เพิ่มวิชาสอบ',
    UPDATE_COURSE: 'แก้ไขวิชาสอบ',
    DELETE_COURSE: 'ลบวิชาสอบ',
    OVERRIDE_COURSE_STATUS: 'บังคับเปิด/ปิดรับสมัคร',
    CLEAR_COURSE_STATUS_OVERRIDE: 'กลับไปใช้สถานะอัตโนมัติ',
};

const AuditLog = () => {
    const [tab, setTab]         = useState('score');
    const [logs, setLogs]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [page, setPage]       = useState(1);
    // ค่าที่กรอกในช่อง (draft) แยกจากค่าที่ใช้ค้นจริง (applied): เดิมพิมพ์ทีละตัวอักษรก็ยิง API ทุกครั้งและหมายเลขหน้าไม่ถูกรีเซ็ต
    const [draft, setDraft]     = useState({ search: '', fromDate: '', toDate: '' });
    const [applied, setApplied] = useState({ search: '', fromDate: '', toDate: '' });

    const perPage = tab === 'score' ? PER_PAGE : ADMIN_PER_PAGE;

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            if (tab === 'score') {
                const params = new URLSearchParams({ page: String(page) });
                if (applied.search)   params.append('student_code', applied.search);
                if (applied.fromDate) params.append('from_date', applied.fromDate);
                if (applied.toDate)   params.append('to_date', applied.toDate);
                const res = await API.get(`/audit/scores?${params}`);
                if (res.data.success) { setLogs(res.data.data); setTotal(res.data.total); }
            } else {
                const res = await API.get('/audit/admin', { params: { page, limit: ADMIN_PER_PAGE } });
                if (res.data.success) { setLogs(res.data.data); setTotal(res.data.total); }
            }
        } catch (err) {
            setLogs([]);
            setTotal(0);
            setError(err.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้');
        } finally { setLoading(false); }
    }, [tab, page, applied]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const switchTab = (next) => { setTab(next); setPage(1); setLogs([]); setTotal(0); };
    const handleSearch = (event) => { event?.preventDefault(); setPage(1); setApplied(draft); };
    const handleReset = () => { const empty = { search: '', fromDate: '', toDate: '' }; setDraft(empty); setApplied(empty); setPage(1); };
    const handleExport = () => {
        downloadAuthenticated('/export/audit', 'score_audit.csv').catch(() => window.alert('Export ไม่สำเร็จ'));
    };
    const fmtDate = (d) => formatThaiDateTime(d);
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const DiffCell = ({ oldVal, newVal }) => {
        if (oldVal === null || oldVal === undefined) return <span style={{ color: '#27AE60', fontWeight: 600 }}>{newVal ?? '—'}</span>;
        if (String(oldVal) === String(newVal)) return <span>{newVal ?? '—'}</span>;
        return (
            <span>
                <span style={{ color: '#E74C3C', textDecoration: 'line-through', fontSize: 12, marginRight: 4 }}>{oldVal}</span>
                <span style={{ color: '#27AE60', fontWeight: 600 }}>→ {newVal}</span>
            </span>
        );
    };

    // details เป็น JSON ที่ backend เขียนเอง (ไม่มี HTML) แสดงเป็นข้อความธรรมดา React จะ escape ให้
    const formatDetails = (details) => {
        if (!details) return '—';
        try {
            const parsed = typeof details === 'string' ? JSON.parse(details) : details;
            return Object.entries(parsed).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
        } catch { return String(details); }
    };

    const tabButton = (id, label) => (
        <button key={id} onClick={() => switchTab(id)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: tab === id ? 700 : 400, color: tab === id ? '#1F4E6B' : '#7f8c8d',
            borderBottom: tab === id ? '3px solid #F5A800' : '3px solid transparent',
        }}>{label}</button>
    );

    return (
        <div style={{ padding: '28px 32px', fontFamily: 'sans-serif', background: '#F4F6F7', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h2 style={{ color: '#1F4E6B', margin: 0 }}>📋 Audit Log</h2>
                    <p style={{ color: '#7f8c8d', margin: '6px 0 0', fontSize: 14 }}>
                        {tab === 'score' ? 'บันทึกทุกการเปลี่ยนแปลงคะแนนสอบ' : 'บันทึกการดำเนินการของเจ้าหน้าที่/ผู้ดูแล (เปิดเอกสาร ส่งออกข้อมูล แก้ไขสิทธิ์ ฯลฯ)'} รวม <strong>{total}</strong> รายการ
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {tab === 'score' && (
                        <button onClick={handleExport}
                            style={{ background: '#27AE60', color: 'white', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontWeight: 600 }}>
                            📥 Export CSV
                        </button>
                    )}
                    <button onClick={() => goTo('/admin-report')}
                        style={{ background: '#1F4E6B', color: 'white', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontWeight: 600 }}>
                        ← กลับหน้า Admin
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 16 }}>
                {tabButton('score', '📝 การแก้ไขคะแนน')}
                {tabButton('admin', '🛡️ การดำเนินการของเจ้าหน้าที่')}
            </div>

            {/* Filter (เฉพาะแท็บคะแนน) */}
            {tab === 'score' && (
                <form onSubmit={handleSearch} style={{ background: 'white', borderRadius: 10, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#7f8c8d', marginBottom: 4 }}>รหัสนักศึกษา</label>
                        <input style={S.input} placeholder="ค้นหา..." value={draft.search} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#7f8c8d', marginBottom: 4 }}>ตั้งแต่วันที่</label>
                        <input type="date" style={S.input} value={draft.fromDate} onChange={e => setDraft(d => ({ ...d, fromDate: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#7f8c8d', marginBottom: 4 }}>ถึงวันที่</label>
                        <input type="date" style={S.input} value={draft.toDate} onChange={e => setDraft(d => ({ ...d, toDate: e.target.value }))} />
                    </div>
                    <button type="submit"
                        style={{ background: '#1F4E6B', color: 'white', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>
                        🔍 ค้นหา
                    </button>
                    <button type="button" onClick={handleReset}
                        style={{ background: '#ECF0F1', color: '#2C3E50', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer' }}>
                        ล้าง
                    </button>
                </form>
            )}

            {error && <div style={{ background: '#FADBD8', color: '#78281F', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>❌ {error}</div>}

            {/* Table */}
            <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#95A5A6' }}>⏳ กำลังโหลด...</div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#95A5A6' }}>ไม่พบข้อมูล</div>
                ) : tab === 'score' ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#2C3E50', color: 'white' }}>
                                    {['วันเวลา', 'ผู้แก้ไข', 'นักศึกษา', 'สาขา', 'ทฤษฎี', 'ปฏิบัติ', 'ผลประเมิน'].map(h => (
                                        <th key={h} style={{ padding: '11px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={log.log_id} style={{ borderBottom: '1px solid #F2F3F4', background: i % 2 ? '#FDFEFE' : 'white' }}>
                                        <td style={td}>
                                            <div style={{ fontSize: 12, color: '#7f8c8d' }}>{fmtDate(log.changed_at)}</div>
                                            <span style={{ fontSize: 11, background: log.action === 'INSERT' ? '#EAFAF1' : '#EBF5FB', color: log.action === 'INSERT' ? '#1E8449' : '#1A5276', borderRadius: 4, padding: '1px 6px' }}>
                                                {log.action === 'INSERT' ? 'บันทึกใหม่' : 'แก้ไข'}
                                            </span>
                                        </td>
                                        <td style={{ ...td, fontWeight: 500 }}>{log.examiner_name || '—'}</td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 500 }}>{log.full_name}</div>
                                            <div style={{ fontSize: 11, color: '#7f8c8d' }}>{log.student_code}</div>
                                        </td>
                                        <td style={{ ...td, color: '#2980B9' }}>{log.course_name}</td>
                                        <td style={td}><DiffCell oldVal={log.old_theory}    newVal={log.new_theory} /></td>
                                        <td style={td}><DiffCell oldVal={log.old_practical} newVal={log.new_practical} /></td>
                                        <td style={td}><DiffCell oldVal={log.old_status}    newVal={log.new_status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#2C3E50', color: 'white' }}>
                                    {['วันเวลา', 'ผู้ดำเนินการ', 'การกระทำ', 'เป้าหมาย', 'รายละเอียด'].map(h => (
                                        <th key={h} style={{ padding: '11px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={log.log_id} style={{ borderBottom: '1px solid #F2F3F4', background: i % 2 ? '#FDFEFE' : 'white', verticalAlign: 'top' }}>
                                        <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: '#7f8c8d' }}>{fmtDate(log.created_at)}</td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 500 }}>{log.actor_username || '—'}</div>
                                            <div style={{ fontSize: 11, color: '#7f8c8d' }}>{log.actor_role || ''}</div>
                                        </td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 500 }}>{ACTION_LABEL[log.action] || log.action}</div>
                                            <div style={{ fontSize: 11, color: '#95A5A6' }}>{log.action}</div>
                                        </td>
                                        <td style={td}>{log.target_type} #{log.target_id}</td>
                                        <td style={{ ...td, fontSize: 12, color: '#566573', wordBreak: 'break-word', maxWidth: 420 }}>{formatDetails(log.details)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EAECEE' }}>
                        <div style={{ fontSize: 13, color: '#7f8c8d' }}>หน้า {page} จาก {totalPages}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
                                style={{ ...pgBtn, opacity: page === 1 ? 0.4 : 1 }}>←</button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
                                style={{ ...pgBtn, opacity: page === totalPages ? 0.4 : 1 }}>→</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const S = { input: { padding: '8px 12px', border: '1px solid #D5D8DC', borderRadius: 6, fontSize: 13 } };
const td = { padding: '11px 12px', verticalAlign: 'middle' };
const pgBtn = { padding: '6px 12px', border: '1px solid #D5D8DC', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 13 };

export default AuditLog;
