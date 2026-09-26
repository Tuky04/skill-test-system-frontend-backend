import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../services/api';
import RmutsNavbar from '../components/RmutsNavbar';
import '../styles/theme.css';

const card = { background:'#fff', border:'1px solid #dce3ee', borderRadius:12, boxShadow:'0 2px 10px rgba(20,45,90,.06)', padding:20 };
const label = { color:'#6b778c', fontSize:12, marginBottom:3 };
const valueStyle = { color:'#172a5b', fontSize:14, overflowWrap:'anywhere' };
const button = { border:0, borderRadius:7, padding:'9px 14px', cursor:'pointer', fontWeight:700 };
const fmt = (date, withTime=false) => date ? new Intl.DateTimeFormat('th-TH', withTime ? { dateStyle:'medium', timeStyle:'short' } : { dateStyle:'medium' }).format(new Date(date)) : '-';
const shown = value => value === null || value === undefined || value === '' ? '-' : value;

const Fields = ({ items }) => <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'15px 20px' }}>
  {items.map(([name,data])=><div key={name}><div style={label}>{name}</div><div style={valueStyle}>{shown(data)}</div></div>)}
</div>;

const StudentDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showId, setShowId] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    API.get('/staff/students/' + studentId).then(r=>setData(r.data.data)).catch(err=>setError(err.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้'));
  }, [studentId]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };
  const openDocument = async (document) => {
    try {
      closePreview();
      const response = await API.get('/documents/' + encodeURIComponent(document.filename), { responseType:'blob' });
      const url = URL.createObjectURL(response.data);
      setPreview({ url, type:response.headers['content-type'] || response.data.type || '', title:document.document_type });
    } catch (err) { setError(err.response?.data?.message || 'ไม่สามารถเปิดเอกสารได้'); }
  };
  if (error && !data) return <div style={{ minHeight:'100vh', background:'#f3f6fa' }}><RmutsNavbar title="ข้อมูลนักศึกษา"/><div style={{ ...card, maxWidth:900, margin:'30px auto', color:'#b42318' }}>{error}<br/><button style={{...button,marginTop:12}} onClick={()=>navigate(-1)}>ย้อนกลับ</button></div></div>;
  if (!data) return <div style={{ padding:50, textAlign:'center' }}>กำลังโหลดข้อมูล...</div>;

  const { student:s, documents, verifications, registrations } = data;
  const currentDocs = documents.filter(d=>Number(d.is_current)===1);
  const docNames = { doc_id_card:'สำเนาบัตรประชาชน', doc_education:'หลักฐานการศึกษา', doc_photo:'รูปถ่าย' };
  const maskedId = s.id_card_number ? '*********' + String(s.id_card_number).slice(-4) : '-';
  return (
    <div style={{ minHeight:'100vh', background:'#f3f6fa' }}>
      <RmutsNavbar title="รายละเอียดนักศึกษา"/>
      <main style={{ maxWidth:1350, margin:'24px auto', padding:'0 20px 45px', display:'grid', gap:16 }}>
        {error && <div style={{ ...card, borderLeft:'4px solid #b42318', color:'#b42318' }}>{error}</div>}
        <section style={{ ...card, borderTop:'4px solid #f5a800', display:'flex', justifyContent:'space-between', gap:18, flexWrap:'wrap' }}>
          <div><h2 style={{ margin:'0 0 5px', color:'#1a2f6e' }}>{s.title}{s.full_name}</h2>
            <div style={{ color:'#68758a' }}>รหัสนักศึกษา: <b>{shown(s.university_student_code)}</b> · รหัสผู้สมัคร: {s.student_code}</div></div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <span style={{ padding:'8px 12px', borderRadius:20, background:'#edf4ff', color:'#1a2f6e', fontWeight:700 }}>{s.registration_status}</span>
            <span style={{ padding:'8px 12px', borderRadius:20, background:Number(s.is_active)===1?'#eafaf3':'#fdecec', color:Number(s.is_active)===1?'#16875b':'#b42318', fontWeight:700 }}>{Number(s.is_active)===1?'บัญชีใช้งาน':'บัญชีถูกปิด'}</span>
          </div>
        </section>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(310px,1fr))', gap:16 }}>
          <section style={card}><h3 style={{ marginTop:0, color:'#1a2f6e' }}>ข้อมูลส่วนตัวและการติดต่อ</h3>
            <Fields items={[
              ['เลขบัตรประชาชน', <span>{showId?shown(s.id_card_number):maskedId} <button onClick={()=>setShowId(!showId)} style={{border:0,background:'none',color:'#315b9d',cursor:'pointer'}}>{showId?'ปิดบัง':'แสดง'}</button></span>],
              ['วันเกิด',fmt(s.birth_date)],['เพศ',s.gender],['สัญชาติ',s.nationality],['โทรศัพท์',s.phone_number],
              ['ที่อยู่',s.address_text],['สร้างข้อมูลเมื่อ',fmt(s.student_created_at,true)],['ยินยอมข้อมูลส่วนบุคคล',fmt(s.privacy_consent_at,true)],
            ]}/></section>
          <section style={card}><h3 style={{ marginTop:0, color:'#1a2f6e' }}>บัญชีผู้ใช้</h3>
            <Fields items={[
              ['ชื่อผู้ใช้',s.username],['อีเมล',s.email],['ยืนยันอีเมล',s.email_verified_at?'แล้ว (' + fmt(s.email_verified_at,true) + ')':'ยังไม่ยืนยัน'],
              ['บทบาท',s.role],['เข้าสู่ระบบล่าสุด',fmt(s.last_login,true)],['สร้างบัญชีเมื่อ',fmt(s.account_created_at,true)],
            ]}/></section>
        </div>

        <section style={card}><h3 style={{ marginTop:0, color:'#1a2f6e' }}>การศึกษาและการทำงาน</h3>
          <Fields items={[
            ['ระดับการศึกษา',s.highest_education],['สาขาการศึกษา',s.education_major],['สถานภาพการทำงาน',s.employment_status],
            ['ประเภทผู้สมัคร',s.applicant_type],['สถานภาพแรงงาน',s.work_status],['อาชีพปัจจุบัน',s.current_occupation],
            ['ตำแหน่ง',s.current_position],['ประสบการณ์ทำงาน',s.work_experience_years!==null?String(s.work_experience_years) + ' ปี':'-'],
            ['รายได้เฉลี่ย',s.average_income],['รายได้ต่อเดือน',s.monthly_income],['กลุ่มอุตสาหกรรม',s.industry_group],['ประเภทผู้ว่างงาน',s.unemployed_type],
          ]}/></section>

        <section style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}><h3 style={{ margin:0, color:'#1a2f6e' }}>เอกสารและประวัติการตรวจ</h3><span style={{ color:'#68758a', fontSize:13 }}>เอกสารปัจจุบัน {currentDocs.length} รายการ · ทุกเวอร์ชัน {documents.length}</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, marginTop:15 }}>
            {currentDocs.length ? currentDocs.map(doc=><button key={doc.document_version_id} onClick={()=>openDocument(doc)} style={{ ...button, textAlign:'left', background:'#eef3ff', color:'#1a2f6e', padding:14 }}>
              📎 {docNames[doc.document_type] || doc.document_type}<div style={{ fontSize:11, color:'#6b778c', marginTop:4 }}>{fmt(doc.created_at,true)} · เปิดดูเอกสาร</div>
            </button>) : <div style={{ color:'#6b778c' }}>ยังไม่มีเอกสารในระบบ</div>}
          </div>
          {documents.length > currentDocs.length && <details style={{ marginTop:14 }}><summary style={{ cursor:'pointer', color:'#315b9d', fontWeight:700 }}>ดูเอกสารเวอร์ชันเก่า</summary>
            <div style={{ display:'grid', gap:7, marginTop:10 }}>{documents.filter(d=>Number(d.is_current)!==1).map(doc=><div key={doc.document_version_id} style={{ background:'#f7f9fc', padding:10, borderRadius:7 }}>
              {docNames[doc.document_type] || doc.document_type} · {fmt(doc.created_at,true)} · ผู้อัปโหลด {shown(doc.uploaded_by_username)}
              <button onClick={()=>openDocument(doc)} style={{ border:0, background:'none', color:'#315b9d', cursor:'pointer', marginLeft:8 }}>เปิดดู</button>
            </div>)}</div></details>}
          <div style={{ marginTop:18 }}>
            <h4 style={{ color:'#1a2f6e', marginBottom:8 }}>ประวัติการตรวจเอกสาร</h4>
            {verifications.length ? verifications.map(v=><div key={v.id} style={{ borderLeft:'3px solid #f5a800', padding:'7px 12px', marginBottom:8, background:'#fafbfe' }}>
              <b>{v.action}</b> · {fmt(v.created_at,true)} · ผู้ตรวจ {shown(v.reviewer_username)}<div style={{ color:'#68758a' }}>{v.note || 'ไม่มีหมายเหตุ'}</div>
            </div>) : <div style={{ color:'#6b778c' }}>ยังไม่มีประวัติการตรวจ</div>}
          </div>
        </section>

        <section style={{ ...card, padding:0, overflow:'hidden' }}>
          <div style={{ padding:'18px 20px' }}><h3 style={{ margin:0, color:'#1a2f6e' }}>ประวัติการสมัครและการสอบทุกครั้ง ({registrations.length})</h3></div>
          <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', minWidth:1250 }}>
            <thead><tr style={{ background:'#1a2f6e', color:'#fff', textAlign:'left' }}>
              {['ใบสมัคร/ครั้ง','สาขาวิชาสอบ','รอบและกำหนดสอบ','สถานะ','คะแนน','ผลสอบ','ผู้บันทึก','วุฒิบัตร'].map(h=><th key={h} style={{ padding:'12px 14px' }}>{h}</th>)}
            </tr></thead>
            <tbody>{registrations.length ? registrations.map(r=><tr key={r.registration_id} style={{ borderBottom:'1px solid #e8edf4', verticalAlign:'top' }}>
              <td style={{ padding:13 }}><b>{r.application_no}</b><div style={{ color:'#68758a', fontSize:12 }}>ครั้งที่ {r.attempt_no} {r.is_retake?'(สอบซ่อม)':''}</div><div style={{ color:'#68758a', fontSize:12 }}>สมัคร {fmt(r.registered_at,true)}</div></td>
              <td style={{ padding:13, maxWidth:250 }}><b>{r.course_name}</b><div style={{ color:'#68758a', fontSize:12 }}>{r.course_code}</div></td>
              <td style={{ padding:13, maxWidth:280 }}><b>{shown(r.session_name)}</b><div>📅 {fmt(r.session_exam_date || r.course_exam_date)} · {shown(r.exam_time)}</div><div>📍 {shown(r.session_location || r.exam_location)}</div></td>
              <td style={{ padding:13 }}><div>{r.application_status}</div><div style={{ color:'#68758a' }}>{r.exam_status}</div></td>
              <td style={{ padding:13, whiteSpace:'nowrap' }}>{r.total_score===null?'ยังไม่บันทึก':<><b>{r.total_score}</b><div style={{ fontSize:12 }}>ทฤษฎี {r.theory_score}/{r.theory_max_score}</div><div style={{ fontSize:12 }}>ปฏิบัติ {r.practical_score}/{r.practical_max_score}</div><div style={{ fontSize:12 }}>หัก {r.deducted_score}</div></>}</td>
              <td style={{ padding:13 }}><b>{r.result_published_at?shown(r.department_status):'รอประกาศผล'}</b><div style={{ fontSize:12, color:'#68758a' }}>{r.result_published_at?fmt(r.result_published_at,true):''}</div></td>
              <td style={{ padding:13 }}>{shown(r.examiner_username)}</td>
              <td style={{ padding:13 }}>{r.certificate_no?<><b>{r.certificate_no}</b><div style={{fontSize:12,color:r.revoked_at?'#b42318':'#16875b'}}>{r.revoked_at?'ถูกเพิกถอน':'ใช้งานได้'}</div></>:'-'}</td>
            </tr>) : <tr><td colSpan="8" style={{ padding:28, textAlign:'center', color:'#6b778c' }}>ยังไม่มีประวัติการสมัครสอบ</td></tr>}</tbody>
          </table></div>
        </section>
      </main>
      {preview && <div onClick={closePreview} style={{ position:'fixed', inset:0, background:'rgba(8,20,45,.78)', zIndex:999, padding:30, display:'grid', placeItems:'center' }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:12, width:'min(1000px,95vw)', height:'min(780px,90vh)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd' }}><b>{docNames[preview.title] || preview.title}</b><button onClick={closePreview} style={button}>ปิด</button></div>
          {preview.type.includes('pdf') ? <iframe title="document" src={preview.url} style={{ flex:1, border:0 }}/> : <div style={{ flex:1, overflow:'auto', display:'grid', placeItems:'center', background:'#edf1f6' }}><img src={preview.url} alt="เอกสาร" style={{ maxWidth:'100%', maxHeight:'100%' }}/></div>}
        </div>
      </div>}
    </div>
  );
};

export default StudentDetail;
