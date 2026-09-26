import React, { useState, useEffect, useCallback } from 'react';
import API, { downloadAuthenticated } from '../services/api';
import { goTo } from '../utils/navigation';

const PER_PAGE = 20;

const AuditLog = () => {
    const [logs, setLogs]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage]       = useState(1);
    const [search, setSearch]   = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate]     = useState('');

    const fetchLogs = useCallback(async (p = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: p });
            if (search)   params.append('student_code', search);
            if (fromDate) params.append('from_date', fromDate);
            if (toDate)   params.append('to_date', toDate);
            const res = await API.get(`/audit/scores?${params}`);
            if (res.data.success) { setLogs(res.data.data); setTotal(res.data.total); }
        } catch { }
        finally { setLoading(false); }
    }, [search, fromDate, toDate]);

    useEffect(() => { fetchLogs(1); }, [fetchLogs]);

    const handleSearch = () => { setPage(1); fetchLogs(1); };
    const handleExport = () => {
        downloadAuthenticated('/export/audit', 'score_audit.csv').catch(() => window.alert('Export ไม่สำเร็จ'));
    };
    const fmtDate = d => d ? new Date(d).toLocaleString('th-TH', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const totalPages = Math.ceil(total / PER_PAGE);

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

    return (
        <div style={{ padding: '28px 32px', fontFamily: 'sans-serif', background: '#F4F6F7', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ color: '#1F4E6B', margin: 0 }}>📋 Audit Log — ประวัติการแก้ไขคะแนน</h2>
                    <p style={{ color: '#7f8c8d', margin: '6px 0 0', fontSize: 14 }}>บันทึกทุกการเปลี่ยนแปลงคะแนนสอบ รวม <strong>{total}</strong> รายการ</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleExport}
                        style={{ background: '#27AE60', color: 'white', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontWeight: 600 }}>
                        📥 Export CSV
                    </button>
                    <button onClick={() => goTo('/admin-report')}
                        style={{ background: '#1F4E6B', color: 'white', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontWeight: 600 }}>
                        ← กลับหน้า Admin
                    </button>
                </div>
            </div>

            {/* Filter */}
            <div style={{ background: 'white', borderRadius: 10, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#7f8c8d', marginBottom: 4 }}>รหัสนักศึกษา</label>
                    <input style={S.input} placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#7f8c8d', marginBottom: 4 }}>ตั้งแต่วันที่</label>
                    <input type="date" style={S.input} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#7f8c8d', marginBottom: 4 }}>ถึงวันที่</label>
                    <input type="date" style={S.input} value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <button onClick={handleSearch}
                    style={{ background: '#1F4E6B', color: 'white', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>
                    🔍 ค้นหา
                </button>
                <button onClick={() => { setSearch(''); setFromDate(''); setToDate(''); fetchLogs(1); }}
                    style={{ background: '#ECF0F1', color: '#2C3E50', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer' }}>
                    ล้าง
                </button>
            </div>

            {/* Table */}
            <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#95A5A6' }}>⏳ กำลังโหลด...</div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#95A5A6' }}>ไม่พบข้อมูล</div>
                ) : (
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
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EAECEE' }}>
                        <div style={{ fontSize: 13, color: '#7f8c8d' }}>หน้า {page} จาก {totalPages}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setPage(p => p-1); fetchLogs(page-1); }} disabled={page === 1}
                                style={{ ...pgBtn, opacity: page === 1 ? 0.4 : 1 }}>←</button>
                            <button onClick={() => { setPage(p => p+1); fetchLogs(page+1); }} disabled={page === totalPages}
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
