import React, { useCallback, useEffect, useState } from 'react';
import RmutsNavbar from '../components/RmutsNavbar';
import API from '../services/api';
import { goTo } from '../utils/navigation';
import { formatThaiDateTime } from '../utils/dates';
import '../styles/theme.css';

const PAGE_SIZE = 20;
const PASS = 'ได้รับวุฒิบัตร';

// หน้าแก้ไขคะแนนที่ "ประกาศผลแล้ว" (เฉพาะผู้ดูแลระบบ): ต้องระบุเหตุผลทุกครั้ง และระบบบันทึก audit/แจ้งนักศึกษาให้
const ScoreCorrection = () => {
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: 'success' });
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ theory: '', practical: '', deducted: '', reason: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const response = await API.get('/admin/scores/published', { params: { page, limit: PAGE_SIZE, search: applied || undefined } });
            if (response.data.success) {
                setRows(response.data.data || []);
                setPagination(response.data.pagination || { page, pages: 1, total: (response.data.data || []).length });
            }
        } catch (error) {
            setMessage({ text: error.response?.data?.message || 'ไม่สามารถโหลดผลสอบได้', type: 'error' });
        } finally { setLoading(false); }
    }, [page, applied]);

    useEffect(() => { load(); }, [load]);

    const open = (row) => {
        setEditing(row);
        setForm({ theory: String(row.theory_score ?? 0), practical: String(row.practical_score ?? 0), deducted: String(row.deducted_score ?? 0), reason: '' });
        setMessage({ text: '', type: 'success' });
    };

    const theoryMax = Number(editing?.theory_max_score || 30);
    const practicalMax = Number(editing?.practical_max_score || 70);
    const theory = Number(form.theory);
    const practical = Number(form.practical);
    const deducted = Number(form.deducted);
    const preview = Math.max(0, theory + practical - deducted);
    const maxTotal = theoryMax + practicalMax;
    const validationError = !editing ? '' :
        [form.theory, form.practical, form.deducted].some((value) => value === '' || !Number.isFinite(Number(value))) ? 'กรอกคะแนนเป็นตัวเลขให้ครบทุกช่อง'
            : theory < 0 || theory > theoryMax ? `คะแนนทฤษฎีต้องอยู่ระหว่าง 0–${theoryMax}`
                : practical < 0 || practical > practicalMax ? `คะแนนปฏิบัติต้องอยู่ระหว่าง 0–${practicalMax}`
                    : deducted < 0 || deducted > theory + practical ? 'คะแนนหักต้องไม่ติดลบหรือมากกว่าคะแนนที่ได้'
                        : form.reason.trim().length < 3 ? 'กรุณาระบุเหตุผลการแก้ไขอย่างน้อย 3 ตัวอักษร' : '';

    const submit = async () => {
        if (validationError || saving) return;
        if (!window.confirm(`ยืนยันแก้ไขคะแนนของ ${editing.title || ''}${editing.full_name} เป็น ${preview.toFixed(2)} คะแนน? ระบบจะบันทึกประวัติและแจ้งนักศึกษา`)) return;
        try {
            setSaving(true);
            const response = await API.post('/admin/scores/correct', {
                registration_id: editing.registration_id,
                theory_score: theory,
                practical_score: practical,
                deducted_score: deducted,
                reason: form.reason.trim(),
            });
            const certificateNote = response.data.certificate === 'revoked' ? ' — ใบรับรองเดิมถูกเพิกถอนเพราะผลใหม่ไม่ผ่านเกณฑ์'
                : response.data.certificate === 'updated' ? ' — ปรับคะแนนในใบรับรองให้ตรงกับผลใหม่แล้ว' : '';
            setMessage({ text: `${response.data.message}${certificateNote}`, type: 'success' });
            setEditing(null);
            load();
        } catch (error) {
            setMessage({ text: error.response?.data?.message || 'ไม่สามารถแก้ไขคะแนนได้', type: 'error' });
        } finally { setSaving(false); }
    };

    const field = (key, label, max) => (
        <div>
            <label className="rmuts-label">{label} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(0–{max})</span></label>
            <input className="rmuts-input rmuts-input--no-icon" type="number" step="0.01" min="0" value={form[key]}
                onChange={(event) => setForm((old) => ({ ...old, [key]: event.target.value }))} disabled={saving} />
        </div>
    );

    return (
        <div className="rmuts-page">
            <RmutsNavbar title="แก้ไขคะแนนที่ประกาศแล้ว" actions={[{ label: '← กลับหน้า Admin', onClick: () => goTo('/admin-report') }]} />
            <div className="rmuts-page__body">
                <div className="rmuts-alert rmuts-alert--error" style={{ marginBottom: 16 }}>
                    ⚠️ ใช้เฉพาะกรณีคะแนนที่ประกาศไปแล้วผิดพลาด ทุกการแก้ไขต้องระบุเหตุผล ถูกบันทึกใน Audit Log และแจ้งนักศึกษาทางอีเมล
                    ถ้าผลใหม่ไม่ผ่านเกณฑ์ ใบรับรองเดิมจะถูกเพิกถอนอัตโนมัติ
                </div>
                {message.text && <div className={`rmuts-alert rmuts-alert--${message.type}`}>{message.type === 'success' ? '✅' : '❌'} {message.text}</div>}

                <form onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(search.trim()); }} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <input className="rmuts-search" style={{ flex: 1, minWidth: 220 }} placeholder="🔍 ชื่อ, รหัสนักศึกษา, เลขใบสมัคร..." value={search} onChange={(event) => setSearch(event.target.value)} />
                    <button type="submit" className="rmuts-btn rmuts-btn--primary">ค้นหา</button>
                </form>

                <div className="rmuts-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>⏳ กำลังโหลด...</div> : (
                        <div className="rmuts-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                            <table className="rmuts-table rmuts-table--striped">
                                <thead><tr>{['เลขใบสมัคร', 'ผู้สอบ', 'สาขาวิชา', 'ทฤษฎี', 'ปฏิบัติ', 'หัก', 'รวม', 'ผล', 'ประกาศเมื่อ', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {rows.length === 0 ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>ไม่พบผลสอบที่ประกาศแล้ว</td></tr> : rows.map((row) => (
                                        <tr key={row.registration_id}>
                                            <td><code style={{ fontSize: 11.5 }}>{row.application_no}</code></td>
                                            <td><div style={{ fontWeight: 500 }}>{row.title}{row.full_name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{row.university_student_code || row.student_code}</div></td>
                                            <td style={{ fontSize: 13 }}>{row.course_name}</td>
                                            <td>{Number(row.theory_score).toFixed(2)}</td>
                                            <td>{Number(row.practical_score).toFixed(2)}</td>
                                            <td>{Number(row.deducted_score).toFixed(2)}</td>
                                            <td style={{ fontWeight: 700 }}>{Number(row.total_score).toFixed(2)}</td>
                                            <td>{row.department_status === PASS ? '🏆 ผ่าน' : '❌ ไม่ผ่าน'}</td>
                                            <td style={{ fontSize: 12, color: '#64748b' }}>{formatThaiDateTime(row.result_published_at)}</td>
                                            <td><button className="rmuts-btn rmuts-btn--gold rmuts-btn--sm" onClick={() => open(row)}>แก้ไข</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {pagination.pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
                        <button className="rmuts-btn rmuts-btn--outline rmuts-btn--sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>← ก่อนหน้า</button>
                        <span style={{ fontSize: 13, color: '#64748b' }}>หน้า {pagination.page} / {pagination.pages}</span>
                        <button className="rmuts-btn rmuts-btn--outline rmuts-btn--sm" disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)}>ถัดไป →</button>
                    </div>
                )}

                {editing && (
                    <div className="rmuts-overlay" onClick={() => !saving && setEditing(null)}>
                        <div className="rmuts-modal" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
                            <div style={{ borderBottom: '3px solid #F5A800', paddingBottom: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2f6e' }}>✏️ แก้ไขคะแนน</div>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{editing.title}{editing.full_name} — {editing.course_name}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
                                {field('theory', 'คะแนนทฤษฎี', theoryMax)}
                                {field('practical', 'คะแนนปฏิบัติ', practicalMax)}
                                {field('deducted', 'คะแนนหัก', '≤ ผลรวม')}
                            </div>
                            <div style={{ background: preview >= 70 ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${preview >= 70 ? '#86EFAC' : '#FED7AA'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                                คะแนนสุทธิใหม่ <strong style={{ fontSize: 20 }}>{Number.isFinite(preview) ? preview.toFixed(2) : '—'}</strong> / {maxTotal} · {preview >= 70 ? '🏆 ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>ผลเดิม: {Number(editing.total_score).toFixed(2)} ({editing.department_status})</div>
                            </div>
                            <label className="rmuts-label">เหตุผลการแก้ไข <span style={{ color: '#c0392b' }}>*</span></label>
                            <textarea className="rmuts-input rmuts-input--no-icon" style={{ height: 80, resize: 'vertical' }} maxLength={255}
                                placeholder="เช่น กรอกคะแนนสลับช่องทฤษฎี/ปฏิบัติ" value={form.reason}
                                onChange={(event) => setForm((old) => ({ ...old, reason: event.target.value }))} disabled={saving} />
                            {validationError && <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 8 }}>⚠️ {validationError}</div>}
                            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                <button className="rmuts-btn rmuts-btn--outline" style={{ flex: 1 }} disabled={saving} onClick={() => setEditing(null)}>ยกเลิก</button>
                                <button onClick={submit} disabled={Boolean(validationError) || saving}
                                    style={{ flex: 2, padding: 12, border: 0, borderRadius: 8, color: 'white', fontWeight: 700, cursor: validationError || saving ? 'not-allowed' : 'pointer', background: validationError || saving ? '#94a3b8' : 'linear-gradient(135deg,#15803D,#16A34A)' }}>
                                    {saving ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScoreCorrection;
