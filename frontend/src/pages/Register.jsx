import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const EDUCATION_LEVELS = [
    'ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย / ปวช.',
    'อนุปริญญา / ปวส.', 'ปริญญาตรี', 'สูงกว่าปริญญาตรี',
];

const EMPLOYMENT_STATUSES = [
    'ผู้มีงานทำ', 'ผู้ที่ไม่มีงานทำ', 'นักเรียน/นักศึกษา', 'อื่นๆ',
];

// ตรวจเลขบัตรประชาชนไทยด้วย checksum (ต้องตรงกับ isValidThaiNationalId ฝั่ง backend)
const isValidThaiNationalId = (value) => {
    const raw = String(value || '').trim();
    if (!/^\d{13}$/.test(raw)) return false;
    const digits = raw.split('').map(Number);
    const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
    return (11 - (sum % 11)) % 10 === digits[12];
};

// ── DocUpload Component ──────────────────────────────────────────────────────
const DocUpload = ({ label, name, required, file, onChange }) => {
    const [drag, setDrag] = useState(false);
    const handleDrop = (e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onChange(name, f);
    };
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={S.label}>
                {label} {required && <span style={{ color: '#c0392b' }}>*</span>}
            </label>
            <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById(`file-${name}`).click()}
                style={{
                    ...S.dropzone,
                    borderColor: drag ? '#1F4E6B' : file ? '#27ae60' : '#BDC3C7',
                    background: drag ? '#EBF5FB' : file ? '#EAFAF1' : '#FAFAFA',
                    cursor: 'pointer',
                }}
            >
                <input id={`file-${name}`} type="file" accept=".jpg,.jpeg,.png,.pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => onChange(name, e.target.files[0])} />
                {file ? (
                    <div>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
                        <div style={{ fontSize: 13, color: '#27ae60', fontWeight: 500 }}>{file.name}</div>
                        <div style={{ fontSize: 11, color: '#7f8c8d', marginTop: 2 }}>
                            {(file.size / 1024).toFixed(0)} KB — คลิกเพื่อเปลี่ยน
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>📎</div>
                        <div style={{ fontSize: 13, color: '#7f8c8d' }}>ลากไฟล์มาวางหรือคลิกเพื่อเลือก</div>
                        <div style={{ fontSize: 11, color: '#BDC3C7', marginTop: 2 }}>JPG, PNG, PDF — สูงสุด 5 MB</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Register = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [studentCode, setStudentCode] = useState('');

    const [form, setForm] = useState({
        // ข้อมูลส่วนตัว
        title: '',
        full_name: '',
        university_student_code: '',
        id_card: '',
        birth_date: '',
        gender: '',
        nationality: 'ไทย',
        phone: '',
        address: '',
        // การศึกษา
        education_level: '',
        education_major: '',
        // การทำงาน
        employment_status: '',
        applicant_type: '',
        work_status: '',
        industry_group: '',
        monthly_income: '',
        current_occupation: '',
        current_position: '',
        work_experience_years: '0',
        average_income: '',
        // บัญชี
        username: '',
        email: '',
        password: '',
        confirm_password: '',
        privacy_consent: false,
    });

    const [files, setFiles] = useState({
        doc_id_card: null,
        doc_education: null,
        doc_photo: null,
    });

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleFileChange = (name, file) => {
        setFiles(prev => ({ ...prev, [name]: file }));
        setError('');
    };

    // ── Validate Step 1 ──
    const validateStep1 = () => {
        if (!form.title) return 'กรุณาเลือกคำนำหน้าชื่อ';
        if (!form.full_name.trim()) return 'กรุณากรอกชื่อ-นามสกุล';
        if (!/^[A-Za-z0-9-]{4,30}$/.test(form.university_student_code)) return 'รหัสนักศึกษามหาวิทยาลัยต้องยาว 4-30 ตัว ใช้ตัวเลข ตัวอักษรภาษาอังกฤษ หรือขีดกลาง';
        if (!/^\d{13}$/.test(form.id_card)) return 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก';
        if (!isValidThaiNationalId(form.id_card)) return 'เลขบัตรประชาชนไม่ผ่านการตรวจสอบ กรุณาตรวจทานตัวเลขอีกครั้ง';
        if (!form.birth_date) return 'กรุณาระบุวันเกิด';
        if (!form.gender) return 'กรุณาเลือกเพศ';
        if (!/^0\d{9}$/.test(form.phone)) return 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก เริ่มด้วย 0';
        if (!form.address.trim()) return 'กรุณากรอกที่อยู่';
        return null;
    };

    // ── Validate Step 2 ──
    const validateStep2 = () => {
        if (!form.education_level) return 'กรุณาเลือกระดับการศึกษา';
        if (!form.education_major.trim()) return 'กรุณากรอกสาขา/วิชาเอก';
        if (!form.employment_status) return 'กรุณาเลือกสถานะการทำงาน';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'รูปแบบอีเมลไม่ถูกต้อง';
        if (!/^[A-Za-z0-9._-]{4,50}$/.test(form.username)) return 'ชื่อผู้ใช้ต้องยาว 4-50 ตัว และใช้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง';
        if (form.password.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
        if (form.password !== form.confirm_password) return 'รหัสผ่านไม่ตรงกัน';
        return null;
    };

    // ── Validate Step 3 ──
    const validateStep3 = () => {
        if (!files.doc_id_card) return 'กรุณาแนบสำเนาบัตรประชาชน (บังคับ)';
        if (!form.privacy_consent) return 'กรุณายินยอมการเก็บและใช้ข้อมูลส่วนบุคคล';
        return null;
    };

    const goStep2 = () => {
        const err = validateStep1();
        if (err) { setError(err); return; }
        setError(''); setStep(2);
    };

    const goStep3 = () => {
        const err = validateStep2();
        if (err) { setError(err); return; }
        setError(''); setStep(3);
    };

    const handleSubmit = async () => {
        if (loading) return;                       // กันกดซ้ำระหว่างกำลังส่ง
        const err = validateStep3();
        if (err) { setError(err); return; }
        setLoading(true); setError('');
        try {
            const formData = new FormData();
            // ส่งทุก field ยกเว้น confirm_password
            const fieldMap = {
                title: form.title,
                full_name: form.full_name.trim(),
                university_student_code: form.university_student_code.trim().toUpperCase(),
                id_card: form.id_card.trim(),
                birth_date: form.birth_date,
                gender: form.gender,
                nationality: form.nationality,
                phone: form.phone.trim(),
                address: form.address.trim(),
                education_level: form.education_level,
                education_major: form.education_major.trim(),
                employment_status: form.employment_status,
                applicant_type: form.applicant_type,
                work_status: form.work_status,
                industry_group: form.industry_group,
                monthly_income: form.monthly_income,
                current_occupation: form.current_occupation,
                current_position: form.current_position,
                work_experience_years: form.work_experience_years || '0',
                average_income: form.average_income,
                username: form.username.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                privacy_consent: form.privacy_consent ? 'true' : 'false',
            };
            // ข้าม field ที่ว่าง แทนการส่งคำว่า "null" ไปให้ backend
            Object.entries(fieldMap).forEach(([k, v]) => {
                if (v === null || v === undefined || v === '') return;
                formData.append(k, v);
            });
            Object.entries(files).forEach(([k, v]) => { if (v) formData.append(k, v); });

            const res = await axios.post(`${API_BASE}/auth/register`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            });
            if (res.data?.success) {
                setStudentCode(res.data.student_code);
                setStep(4);
            } else {
                setError(res.data?.message || 'ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่');
            }
        } catch (err) {
            const status = err.response?.status;
            let errMsg = err.response?.data?.message;
            if (!errMsg) {
                if (err.code === 'ECONNABORTED') errMsg = 'ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง';
                else if (!err.response) errMsg = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่';
                else if (status === 429) errMsg = 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
                else errMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
            }
            setError(errMsg);

            // ข้อมูลซ้ำ / ข้อมูลส่วนตัวไม่ผ่าน → พากลับไปแก้ที่ขั้นตอนที่เกี่ยวข้อง
            const code = err.response?.data?.code;
            const backToStep1 = ['DUPLICATE_ID_CARD', 'DUPLICATE_UNIVERSITY_STUDENT_CODE'].includes(code)
                || /บัตรประชาชน|รหัสนักศึกษา|วันเกิด|เบอร์โทร/.test(errMsg);
            const backToStep2 = ['DUPLICATE_USERNAME', 'DUPLICATE_EMAIL'].includes(code)
                || /ชื่อผู้ใช้|อีเมล|รหัสผ่าน/.test(errMsg);
            if (backToStep1) setTimeout(() => setStep(1), 1500);
            else if (backToStep2) setTimeout(() => setStep(2), 1500);
        } finally {
            setLoading(false);                     // ✅ สำคัญ: ปลดล็อกปุ่มเสมอ ไม่ว่าจะสำเร็จหรือ error
        }
    };

    // ── Progress Bar (4 steps) ──
    const stepLabels = ['ข้อมูลส่วนตัว', 'การศึกษา/งาน', 'แนบเอกสาร', 'เสร็จสิ้น'];
    const Progress = () => (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
            {[1, 2, 3, 4].map((s, i) => (
                <React.Fragment key={s}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: 13, flexShrink: 0,
                            background: step > s ? '#27ae60' : step === s ? '#1F4E6B' : '#ECF0F1',
                            color: step >= s ? 'white' : '#95A5A6',
                            transition: 'all 0.3s',
                        }}>{step > s ? '✓' : s}</div>
                        <div style={{ fontSize: 10, color: step >= s ? '#1F4E6B' : '#95A5A6', whiteSpace: 'nowrap' }}>
                            {stepLabels[i]}
                        </div>
                    </div>
                    {i < 3 && (
                        <div style={{
                            flex: 1, height: 3, marginBottom: 16,
                            background: step > s ? '#27ae60' : '#ECF0F1',
                            transition: 'background 0.3s',
                        }} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    const isWorking = form.employment_status === 'ผู้มีงานทำ';

    return (
        <div style={S.page}>
            <div style={S.card}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🏛️</div>
                    <h1 style={S.h1}>ลงทะเบียนเข้าระบบ</h1>
                    <p style={S.sub}>ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ</p>
                </div>

                {step < 4 && <Progress />}

                {/* ══════════════════════════════════════════
                    Step 1: ข้อมูลส่วนตัว
                ══════════════════════════════════════════ */}
                {step === 1 && (
                    <div>
                        <h2 style={S.h2}>ขั้นตอนที่ 1 — ข้อมูลส่วนตัว</h2>

                        <div style={{ marginBottom: 14, padding:12, background:'#eff6ff', borderRadius:8, color:'#1e3a8a', fontSize:13 }}>
                            กรุณากรอกรหัสนักศึกษาของมหาวิทยาลัย และระบบจะสร้างรหัสผู้สมัครภายในให้อัตโนมัติ
                        </div>

                        <div>
                            <label style={S.label}>รหัสนักศึกษามหาวิทยาลัย <span style={S.req}>*</span></label>
                            <input style={S.input} name="university_student_code" value={form.university_student_code}
                                onChange={e=>setForm(prev=>({...prev, university_student_code:e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'')}))}
                                placeholder="เช่น 1664041234567" maxLength={30} autoComplete="off" />
                        </div>

                        {/* คำนำหน้า + ชื่อ */}
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 12px' }}>
                            <div>
                                <label style={S.label}>คำนำหน้า <span style={S.req}>*</span></label>
                                <select style={S.input} name="title" value={form.title} onChange={handleChange}>
                                    <option value="">-- เลือก --</option>
                                    <option>นาย</option>
                                    <option>นาง</option>
                                    <option>นางสาว</option>
                                </select>
                            </div>
                            <div>
                                <label style={S.label}>ชื่อ-นามสกุล <span style={S.req}>*</span></label>
                                <input style={S.input} name="full_name" value={form.full_name}
                                    onChange={handleChange} placeholder="สมชาย ใจดี" />
                            </div>
                        </div>

                        {/* เลขบัตร + วันเกิด */}
                        <div style={S.grid2}>
                            <div>
                                <label style={S.label}>เลขบัตรประชาชน 13 หลัก <span style={S.req}>*</span></label>
                                <input style={S.input} name="id_card" value={form.id_card}
                                    onChange={handleChange} placeholder="1234567890123" maxLength={13} />
                            </div>
                            <div>
                                <label style={S.label}>วันเกิด <span style={S.req}>*</span></label>
                                <input style={S.input} name="birth_date" type="date"
                                    value={form.birth_date} onChange={handleChange} />
                            </div>
                        </div>

                        {/* เพศ + สัญชาติ */}
                        <div style={S.grid2}>
                            <div>
                                <label style={S.label}>เพศ <span style={S.req}>*</span></label>
                                <select style={S.input} name="gender" value={form.gender} onChange={handleChange}>
                                    <option value="">-- เลือกเพศ --</option>
                                    <option>ชาย</option>
                                    <option>หญิง</option>
                                    <option>อื่นๆ</option>
                                </select>
                            </div>
                            <div>
                                <label style={S.label}>สัญชาติ</label>
                                <input style={S.input} name="nationality" value={form.nationality}
                                    onChange={handleChange} placeholder="ไทย" />
                            </div>
                        </div>

                        {/* เบอร์โทร */}
                        <div>
                            <label style={S.label}>เบอร์โทรศัพท์ <span style={S.req}>*</span></label>
                            <input style={S.input} name="phone" value={form.phone}
                                onChange={handleChange} placeholder="0812345678" maxLength={10} />
                        </div>

                        {/* ที่อยู่ */}
                        <div>
                            <label style={S.label}>ที่อยู่ปัจจุบัน <span style={S.req}>*</span></label>
                            <textarea style={{ ...S.input, height: 80, resize: 'vertical' }}
                                name="address" value={form.address} onChange={handleChange}
                                placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />
                        </div>

                        {error && <div style={S.errorBox}>{error}</div>}

                        <button style={S.btnPrimary} onClick={goStep2}>
                            ถัดไป — ข้อมูลการศึกษา →
                        </button>
                    </div>
                )}

                {/* ══════════════════════════════════════════
                    Step 2: การศึกษา / การทำงาน / บัญชี
                ══════════════════════════════════════════ */}
                {step === 2 && (
                    <div>
                        <h2 style={S.h2}>ขั้นตอนที่ 2 — การศึกษา, การทำงาน และบัญชีผู้ใช้</h2>

                        {/* การศึกษา */}
                        <div style={S.sectionBox}>
                            <div style={S.sectionTitle}>🎓 ข้อมูลการศึกษา</div>
                            <div style={S.grid2}>
                                <div>
                                    <label style={S.label}>ระดับการศึกษาสูงสุด <span style={S.req}>*</span></label>
                                    <select style={S.input} name="education_level"
                                        value={form.education_level} onChange={handleChange}>
                                        <option value="">-- เลือกระดับการศึกษา --</option>
                                        {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={S.label}>สาขา / วิชาเอก <span style={S.req}>*</span></label>
                                    <input style={S.input} name="education_major"
                                        value={form.education_major} onChange={handleChange}
                                        placeholder="วิทยาการคอมพิวเตอร์" />
                                </div>
                            </div>
                        </div>

                        {/* การทำงาน */}
                        <div style={S.sectionBox}>
                            <div style={S.sectionTitle}>💼 สถานะการทำงาน</div>
                            <div>
                                <label style={S.label}>สถานะการทำงาน <span style={S.req}>*</span></label>
                                <select style={S.input} name="employment_status"
                                    value={form.employment_status} onChange={handleChange}>
                                    <option value="">-- เลือกสถานะ --</option>
                                    {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {isWorking && (
                                <div>
                                    <div style={S.grid2}>
                                        <div>
                                            <label style={S.label}>อาชีพ/ตำแหน่ง</label>
                                            <input style={S.input} name="current_occupation"
                                                value={form.current_occupation} onChange={handleChange}
                                                placeholder="นักพัฒนาซอฟต์แวร์" />
                                        </div>
                                        <div>
                                            <label style={S.label}>ประสบการณ์ทำงาน (ปี)</label>
                                            <input style={S.input} name="work_experience_years"
                                                type="number" min="0" max="50"
                                                value={form.work_experience_years} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={S.label}>รายได้เฉลี่ยต่อเดือน</label>
                                        <select style={S.input} name="average_income"
                                            value={form.average_income} onChange={handleChange}>
                                            <option value="">-- เลือกช่วงรายได้ --</option>
                                            <option>ต่ำกว่า 10,000</option>
                                            <option>10,001-15,000</option>
                                            <option>15,001-20,000</option>
                                            <option>20,001-30,000</option>
                                            <option>30,001-50,000</option>
                                            <option>มากกว่า 50,000</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── ประเภทผู้สมัคร + สถานภาพแรงงาน (ตามใบสมัคร กพร.) ── */}
                        <div style={S.sectionBox}>
                            <div style={S.sectionTitle}>📋 ข้อมูลการสมัครสอบ (ตามใบสมัคร กพร.)</div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={S.label}>ประเภทผู้สมัคร <span style={S.req}>*</span></label>
                                <select style={S.input} name="applicant_type" value={form.applicant_type} onChange={handleChange}>
                                    <option value="">-- เลือกประเภทผู้สมัคร --</option>
                                    <option value="รับฝึกจาก กพร.">รับฝึกจาก กพร.</option>
                                    <option value="จากสถานศึกษา">จากสถานศึกษา</option>
                                    <option value="จากราชการ">จากราชการ</option>
                                    <option value="จากภาคเอกชน">จากภาคเอกชน</option>
                                    <option value="บุคคลทั่วไป">บุคคลทั่วไป</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={S.label}>สถานภาพแรงงาน</label>
                                <select style={S.input} name="work_status" value={form.work_status} onChange={handleChange}>
                                    <option value="">-- เลือกสถานภาพ --</option>
                                    <option value="ทำงาน">ทำงาน (มีงานทำ)</option>
                                    <option value="ไม่ทำงาน">ไม่ทำงาน / ว่างงาน</option>
                                    <option value="นักเรียน/นักศึกษา">นักเรียน/นักศึกษา</option>
                                    <option value="ผู้ประกันตนที่ถูกเลิกจ้าง">ผู้ประกันตนที่ถูกเลิกจ้าง</option>
                                    <option value="ผู้ต้องขัง">ผู้ต้องขัง</option>
                                    <option value="ทหารก่อนปลด">ทหารก่อนปลด</option>
                                </select>
                            </div>
                            {form.work_status === 'ทำงาน' && (<>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={S.label}>กลุ่มอุตสาหกรรมที่ทำงาน</label>
                                    <select style={S.input} name="industry_group" value={form.industry_group} onChange={handleChange}>
                                        <option value="">-- เลือกกลุ่มอุตสาหกรรม --</option>
                                        <option value="การปรุงอาหาร">การปรุงอาหาร</option>
                                        <option value="เกษตรกรรมและเทคโนโลยีชีวภาพ">เกษตรกรรมและเทคโนโลยีชีวภาพ</option>
                                        <option value="ท่องเที่ยวกลุ่มรายได้ดีและเที่ยวเชิงสุขภาพ">ท่องเที่ยวกลุ่มรายได้ดีและเที่ยวเชิงสุขภาพ</option>
                                        <option value="อิเล็กทรอนิกส์อัจฉริยะ">อิเล็กทรอนิกส์อัจฉริยะ</option>
                                        <option value="ยานยนต์สมัยใหม่">ยานยนต์สมัยใหม่</option>
                                        <option value="ดิจิทัล">ดิจิทัล</option>
                                        <option value="เชื้อเพลิง/เคมีชีวภาพ">เชื้อเพลิง/เคมีชีวภาพ</option>
                                        <option value="ขนส่งและการบิน">ขนส่งและการบิน</option>
                                        <option value="แพทย์ครบวงจร">แพทย์ครบวงจร</option>
                                        <option value="หุ่นยนต์เพื่ออุตสาหกรรม">หุ่นยนต์เพื่ออุตสาหกรรม</option>
                                        <option value="อื่น ๆ">อื่น ๆ</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: 0 }}>
                                    <label style={S.label}>รายได้ต่อเดือน (บาท)</label>
                                    <select style={S.input} name="monthly_income" value={form.monthly_income} onChange={handleChange}>
                                        <option value="">-- เลือกช่วงรายได้ --</option>
                                        <option value="1-5000">1 – 5,000 บาท</option>
                                        <option value="5001-9000">5,001 – 9,000 บาท</option>
                                        <option value="9001-15000">9,001 – 15,000 บาท</option>
                                        <option value="15001-20000">15,001 – 20,000 บาท</option>
                                        <option value="20001-30000">20,001 – 30,000 บาท</option>
                                        <option value="30001-40000">30,001 – 40,000 บาท</option>
                                        <option value="40001+">40,001 บาทขึ้นไป</option>
                                    </select>
                                </div>
                            </>)}
                        </div>

                        {/* บัญชีผู้ใช้ */}
                        <div style={S.sectionBox}>
                            <div style={S.sectionTitle}>🔑 ข้อมูลสำหรับเข้าสู่ระบบ</div>
                            <div style={S.grid2}>
                                <div>
                                    <label style={S.label}>ชื่อผู้ใช้ <span style={S.req}>*</span></label>
                                    <input style={S.input} name="username" value={form.username}
                                        onChange={handleChange} placeholder="somchai_d (ขั้นต่ำ 4 ตัว)" />
                                </div>
                                <div>
                                    <label style={S.label}>อีเมล <span style={S.req}>*</span></label>
                                    <input style={S.input} name="email" type="email"
                                        value={form.email} onChange={handleChange}
                                        placeholder="somchai@email.com" />
                                </div>
                            </div>
                            <div style={S.grid2}>
                                <div>
                                    <label style={S.label}>รหัสผ่าน <span style={S.req}>*</span></label>
                                    <input style={S.input} name="password" type="password"
                                        value={form.password} onChange={handleChange}
                                        placeholder="อย่างน้อย 8 ตัวอักษร" />
                                </div>
                                <div>
                                    <label style={S.label}>ยืนยันรหัสผ่าน <span style={S.req}>*</span></label>
                                    <input
                                        style={{
                                            ...S.input,
                                            borderColor: form.confirm_password && form.confirm_password !== form.password
                                                ? '#e74c3c' : '',
                                        }}
                                        name="confirm_password" type="password"
                                        value={form.confirm_password} onChange={handleChange}
                                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                                    />
                                    {form.confirm_password && form.confirm_password !== form.password && (
                                        <div style={{ fontSize: 12, color: '#e74c3c', marginTop: -12, marginBottom: 8 }}>
                                            รหัสผ่านไม่ตรงกัน
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {error && <div style={S.errorBox}>{error}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button style={S.btnSecondary} onClick={() => { setStep(1); setError(''); }}>
                                ← ย้อนกลับ
                            </button>
                            <button style={{ ...S.btnPrimary, flex: 1 }} onClick={goStep3}>
                                ถัดไป — แนบเอกสาร →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════
                    Step 3: แนบเอกสาร
                ══════════════════════════════════════════ */}
                {step === 3 && (
                    <div>
                        <h2 style={S.h2}>ขั้นตอนที่ 3 — แนบเอกสารประกอบการสมัคร</h2>
                        <div style={{ ...S.infoBox, marginBottom: 20 }}>
                            <strong>ℹ️ เอกสารที่ต้องใช้</strong><br />
                            ไฟล์ JPG, PNG หรือ PDF ขนาดไม่เกิน 5 MB ต่อไฟล์
                        </div>

                        <DocUpload label="สำเนาบัตรประชาชน (หน้า-หลัง)" name="doc_id_card"
                            required file={files.doc_id_card} onChange={handleFileChange} />
                        <DocUpload label="วุฒิการศึกษา / ใบรับรองการศึกษา" name="doc_education"
                            file={files.doc_education} onChange={handleFileChange} />
                        <DocUpload label="รูปถ่ายหน้าตรง (พื้นหลังขาว)" name="doc_photo"
                            file={files.doc_photo} onChange={handleFileChange} />

                        <label style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', marginBottom:16, border:'1px solid #CBD5E1', borderRadius:8, background:'#F8FAFC', fontSize:13, lineHeight:1.6, cursor:'pointer' }}>
                            <input type="checkbox" checked={form.privacy_consent}
                                onChange={e=>setForm(prev=>({...prev, privacy_consent:e.target.checked}))}
                                style={{ marginTop:3 }} />
                            <span>ข้าพเจ้ายินยอมให้ระบบเก็บ ใช้ และเปิดเผยข้อมูลส่วนบุคคลเท่าที่จำเป็นต่อการสมัคร การจัดสอบ และการออกวุฒิบัตร ตามประกาศความเป็นส่วนตัวของหน่วยงาน <strong style={{color:'#c0392b'}}>(จำเป็น)</strong></span>
                        </label>

                        {error && <div style={S.errorBox}>{error}</div>}
                        {/* ✅ เพิ่ม: สรุปข้อมูลก่อน submit */}
                        <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #C7D2FE', fontSize: 13 }}>
                            <div style={{ fontWeight: 600, color: '#1a2f6e', marginBottom: 8 }}>📋 ตรวจสอบข้อมูลก่อนยืนยัน</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', color: '#374151' }}>
                                <div>👤 ชื่อ: <strong>{form.full_name}</strong></div>
                                <div>🎓 รหัสนักศึกษา: <strong>{form.university_student_code}</strong></div>
                                <div>🪪 เลขบัตร: <strong>{form.id_card}</strong></div>
                                <div>📧 อีเมล: <strong>{form.email}</strong></div>
                                <div>👤 Username: <strong>{form.username}</strong></div>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, color: '#6366F1' }}>
                                ⚠️ หากเคยลงทะเบียนด้วยเลขบัตรประชาชนนี้แล้ว กรุณาเข้าสู่ระบบแทน
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                            <button style={S.btnSecondary} onClick={() => { setStep(2); setError(''); }}>
                                ← ย้อนกลับ
                            </button>
                            <button
                                style={{ ...S.btnPrimary, flex: 1, opacity: loading ? 0.7 : 1 }}
                                onClick={handleSubmit} disabled={loading}>
                                {loading ? '⏳ กำลังส่งข้อมูล...' : '✅ ยืนยันการลงทะเบียน'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════
                    Step 4: สำเร็จ
                ══════════════════════════════════════════ */}
                {step === 4 && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                        <h2 style={{ ...S.h2, color: '#27ae60', fontSize: 22, textAlign: 'center' }}>
                            ลงทะเบียนสำเร็จ!
                        </h2>
                        <div style={{ ...S.infoBox, margin: '20px auto', maxWidth: 400, textAlign: 'left' }}>
                            <div style={{ marginBottom: 6, fontSize: 13 }}>รหัสนักศึกษามหาวิทยาลัย: <strong>{form.university_student_code}</strong></div>
                            <div style={{ marginBottom: 6, fontSize: 13 }}>รหัสผู้สมัครของคุณ:</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#1F4E6B', letterSpacing: 2 }}>
                                {studentCode}
                            </div>
                            <div style={{ fontSize: 12, color: '#7f8c8d', marginTop: 8 }}>
                                กรุณาจดรหัสนี้ไว้ — ใช้ติดตามสถานะและอ้างอิงในวันสอบ
                            </div>
                        </div>
                        <div style={{ ...S.successBox, margin: '0 auto 24px', maxWidth: 400, textAlign: 'left' }}>
                            <strong>ขั้นตอนถัดไป</strong><br />
                            เจ้าหน้าที่จะตรวจสอบเอกสารภายใน <strong>1-3 วันทำการ</strong><br />
                            เมื่อผ่านการตรวจสอบ คุณจะสามารถเข้าสู่ระบบและสมัครสอบได้ทันที
                        </div>
                        <button style={S.btnPrimary} onClick={() => navigate('/login')}>
                            ไปหน้าเข้าสู่ระบบ →
                        </button>
                    </div>
                )}

                {step < 4 && (
                    <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#7f8c8d' }}>
                        มีบัญชีอยู่แล้ว?{' '}
                        <Link to="/" style={{ color: '#1F4E6B', fontWeight: 600 }}>เข้าสู่ระบบ</Link>
                    </p>
                )}
            </div>
        </div>
    );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
    page: {
        minHeight: '100vh', background: '#F4F6F7',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px',
    },
    card: {
        background: 'white', borderRadius: 12, padding: '36px 40px',
        width: '100%', maxWidth: 700,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    },
    h1: { fontSize: 22, fontWeight: 700, color: '#1F4E6B', margin: 0 },
    h2: { fontSize: 16, fontWeight: 600, color: '#1F4E6B', marginBottom: 20, marginTop: 0 },
    sub: { fontSize: 14, color: '#7f8c8d', margin: '4px 0 0' },
    label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 5 },
    req: { color: '#c0392b' },
    input: {
        width: '100%', padding: '10px 12px', borderRadius: 6,
        border: '1px solid #D5D8DC', fontSize: 14,
        boxSizing: 'border-box', marginBottom: 16, outline: 'none',
        fontFamily: 'inherit',
    },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
    dropzone: {
        border: '2px dashed', borderRadius: 8, padding: '24px 16px',
        textAlign: 'center', transition: 'all 0.2s',
    },
    btnPrimary: {
        width: '100%', padding: '13px', background: '#1F4E6B', color: 'white',
        border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
        cursor: 'pointer', marginTop: 4,
    },
    btnSecondary: {
        padding: '13px 20px', background: '#ECF0F1', color: '#2C3E50',
        border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer',
    },
    errorBox: {
        background: '#FADBD8', color: '#78281F', border: '1px solid #F1948A',
        borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13,
    },
    infoBox: {
        background: '#EBF5FB', color: '#1A5276', borderRadius: 8,
        padding: '12px 16px', fontSize: 13, lineHeight: 1.6,
    },
    successBox: {
        background: '#EAFAF1', color: '#1E8449', borderRadius: 8,
        padding: '14px 18px', fontSize: 13, lineHeight: 1.7,
    },
    sectionBox: {
        background: '#FAFAFA', border: '1px solid #EAECEE',
        borderRadius: 8, padding: '16px 20px', marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14, fontWeight: 600, color: '#2C3E50',
        marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #EAECEE',
    },
};

export default Register;