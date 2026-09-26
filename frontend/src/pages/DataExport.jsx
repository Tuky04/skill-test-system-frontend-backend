import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { downloadAuthenticated } from '../services/api';
import RmutsNavbar from '../components/RmutsNavbar';
import '../styles/theme.css';

const box = { background:'#fff', border:'1px solid #dce3ee', borderRadius:12, boxShadow:'0 2px 10px rgba(20,45,90,.06)' };
const input = { width:'100%', boxSizing:'border-box', padding:'10px 11px', border:'1px solid #cdd8e8', borderRadius:7, background:'#fff' };
const button = { border:0, borderRadius:7, padding:'10px 15px', cursor:'pointer', fontWeight:700 };
const emptyFilters = { date_type:'registered', date_from:'', date_to:'', course_id:'', session_id:'', attempt_no:'', application_status:'', exam_status:'', student_status:'', result:'', search:'', include_sensitive:false };
const fmt = date => date ? new Intl.DateTimeFormat('th-TH',{ dateStyle:'medium' }).format(new Date(date)) : '-';

const DataExport = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || '';
  const [options, setOptions] = useState({ courses:[], sessions:[], range:{} });
  const [filters, setFilters] = useState(emptyFilters);
  const [preview, setPreview] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(()=>{
    API.get('/staff/export/options').then(r=>{
      const result=r.data.data || { courses:[],sessions:[],range:{} }; setOptions(result);
    }).catch(err=>setMessage(err.response?.data?.message || 'ไม่สามารถโหลดตัวเลือกได้'));
  },[]);

  const visibleSessions = useMemo(() => options.sessions.filter(session => {
    if (!filters.course_id || !session.course_ids) return true;
    return String(session.course_ids).split(',').includes(String(filters.course_id));
  }), [options.sessions, filters.course_id]);
  const maxAttempts = Math.max(1, Number(options.range?.max_attempt_no || 1));

  const params = (includeSensitive=false) => {
    const result = new URLSearchParams();
    Object.entries(filters).forEach(([key,item]) => { if (key !== 'include_sensitive' && item) result.set(key,String(item)); });
    if (includeSensitive && role === 'admin' && filters.include_sensitive) result.set('include_sensitive','1');
    return result;
  };
  const search = async (event) => {
    event?.preventDefault(); setLoading(true); setMessage('');
    try {
      const response = await API.get('/staff/export/preview?' + params());
      setPreview(response.data.data || []); setTotal(Number(response.data.total || 0));
    } catch (err) { setMessage(err.response?.data?.message || 'ไม่สามารถแสดงตัวอย่างได้'); }
    finally { setLoading(false); }
  };
  const exportFile = async () => {
    setExporting(true); setMessage('');
    try {
      await downloadAuthenticated('/export/registrations.xlsx?' + params(true),'student_exam_records.xlsx');
      setMessage('ส่งออกไฟล์ Excel สำเร็จ' + (total ? ' จากข้อมูลที่พบ ' + total.toLocaleString('th-TH') + ' รายการ' : ''));
    } catch (err) { setMessage('ไม่สามารถส่งออกไฟล์ได้ กรุณาตรวจตัวกรองและลองใหม่'); }
    finally { setExporting(false); }
  };
  const change = (key,value) => setFilters(old=>({ ...old,[key]:value, ...(key==='course_id'?{session_id:''}:{}) }));
  const reset = () => { setFilters(emptyFilters); setPreview([]); setTotal(0); setMessage(''); };

  return <div style={{ minHeight:'100vh', background:'#f3f6fa' }}>
    <RmutsNavbar title="ส่งออกข้อมูล Excel" actions={[
      { label:'📝 ตรวจและให้คะแนน', onClick:()=>navigate('/grading-panel') },
    ]}/>
    <main style={{ maxWidth:1450, margin:'24px auto', padding:'0 20px 45px' }}>
      <section style={{ ...box, padding:20, marginBottom:16, borderTop:'4px solid #f5a800' }}>
        <h2 style={{ margin:'0 0 6px', color:'#1a2f6e' }}>รายงานข้อมูลนักศึกษาและการสอบ</h2>
        <p style={{ margin:0, color:'#68758a' }}>เลือกได้ทั้งช่วงวันที่สมัครหรือวันที่สอบ สาขาวิชา รอบสอบ ครั้งที่สอบ และสถานะต่าง ๆ ไฟล์มี 3 ชีต: สรุปรายงาน รายละเอียดการสอบ และข้อมูลนักศึกษา</p>
        <div style={{ marginTop:12, padding:11, borderRadius:7, background:'#fff7df', color:'#765500', fontSize:13 }}>
          🔒 เลขบัตรประชาชนจะถูกปิดบังโดยอัตโนมัติ การส่งออกจะบันทึกชื่อผู้ส่งออก เงื่อนไข และจำนวนรายการไว้ใน Audit Log
        </div>
      </section>
      <form onSubmit={search} style={{ ...box, padding:20, marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:14 }}>
          <label><div style={{fontSize:13,marginBottom:5}}>อ้างอิงช่วงเวลาจาก</div><select style={input} value={filters.date_type} onChange={e=>change('date_type',e.target.value)}><option value="registered">วันที่สมัครสอบ</option><option value="exam">วันที่สอบ</option></select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>ตั้งแต่วันที่</div><input type="date" style={input} value={filters.date_from} onChange={e=>change('date_from',e.target.value)}/></label>
          <label><div style={{fontSize:13,marginBottom:5}}>ถึงวันที่</div><input type="date" style={input} value={filters.date_to} onChange={e=>change('date_to',e.target.value)}/></label>
          <label><div style={{fontSize:13,marginBottom:5}}>สาขาวิชาสอบ</div><select style={input} value={filters.course_id} onChange={e=>change('course_id',e.target.value)}><option value="">ทุกสาขาวิชา</option>{options.courses.map(c=><option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>)}</select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>รอบสอบ</div><select style={input} value={filters.session_id} onChange={e=>change('session_id',e.target.value)}><option value="">ทุกรอบ</option>{visibleSessions.map(s=><option key={s.session_id} value={s.session_id}>{s.session_name} · {fmt(s.exam_date)}</option>)}</select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>ครั้งที่สอบ</div><select style={input} value={filters.attempt_no} onChange={e=>change('attempt_no',e.target.value)}><option value="">ทุกครั้ง</option>{Array.from({length:maxAttempts},(_,i)=>i+1).map(n=><option key={n} value={n}>ครั้งที่ {n}</option>)}</select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>สถานะใบสมัครสอบ</div><select style={input} value={filters.application_status} onChange={e=>change('application_status',e.target.value)}><option value="">ทุกสถานะ</option><option>รอดำเนินการ</option><option>อนุมัติสิทธิ์สอบ</option><option>ปฏิเสธเอกสาร</option></select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>สถานะเข้าสอบ</div><select style={input} value={filters.exam_status} onChange={e=>change('exam_status',e.target.value)}><option value="">ทุกสถานะ</option><option>รอสอบ</option><option>เข้าสอบ</option><option>ขาดสอบ</option><option>ยกเลิก</option><option>ประกาศผลแล้ว</option></select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>สถานะเอกสารนักศึกษา</div><select style={input} value={filters.student_status} onChange={e=>change('student_status',e.target.value)}><option value="">ทุกสถานะ</option><option>รอตรวจสอบเอกสาร</option><option>เอกสารไม่ครบ</option><option>อนุมัติ</option></select></label>
          <label><div style={{fontSize:13,marginBottom:5}}>ผลสอบ</div><select style={input} value={filters.result} onChange={e=>change('result',e.target.value)}><option value="">ทุกผล</option><option value="passed">ผ่าน/ได้รับวุฒิบัตร</option><option value="failed">ไม่ผ่าน</option><option value="pending">รอประกาศผล</option></select></label>
          <label style={{gridColumn:'span 2'}}><div style={{fontSize:13,marginBottom:5}}>ค้นหาเฉพาะบุคคลหรือใบสมัคร</div><input style={input} value={filters.search} onChange={e=>change('search',e.target.value)} placeholder="ชื่อ รหัสนักศึกษา เลขใบสมัคร อีเมล หรือโทรศัพท์"/></label>
        </div>
        {role==='admin' && <label style={{ display:'flex', gap:9, alignItems:'flex-start', marginTop:15, color:'#8a3f16' }}>
          <input type="checkbox" checked={filters.include_sensitive} onChange={e=>change('include_sensitive',e.target.checked)} style={{marginTop:3}}/>
          <span><b>ส่งออกเลขบัตรประชาชนเต็ม</b><br/><small>ใช้เฉพาะเมื่อจำเป็นตามหน้าที่และจัดเก็บไฟล์ในพื้นที่ปลอดภัย (staff ไม่มีสิทธิ์นี้)</small></span>
        </label>}
        <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginTop:18, flexWrap:'wrap' }}>
          <div style={{display:'flex',gap:8}}><button type="submit" disabled={loading} style={{...button,background:'#1a2f6e',color:'#fff'}}>{loading?'กำลังค้นหา...':'🔎 แสดงตัวอย่าง'}</button><button type="button" onClick={reset} style={{...button,background:'#e9eef5',color:'#334155'}}>ล้างตัวกรอง</button></div>
          <button type="button" onClick={exportFile} disabled={exporting} style={{...button,background:'#f5a800',color:'#172a5b'}}>{exporting?'กำลังสร้างไฟล์...':'⬇ ส่งออก .xlsx'}</button>
        </div>
      </form>
      {message && <div style={{...box,padding:13,marginBottom:14,color:message.includes('สำเร็จ')?'#16875b':'#b42318'}}>{message}</div>}
      <section style={{...box,overflow:'hidden'}}>
        <div style={{padding:'15px 18px',display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><b style={{color:'#1a2f6e'}}>ตัวอย่างข้อมูล (สูงสุด 100 รายการ)</b><span style={{background:'#eef3ff',padding:'7px 12px',borderRadius:16,color:'#1a2f6e'}}>พบทั้งหมด {total.toLocaleString('th-TH')} รายการ</span></div>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1150}}>
          <thead><tr style={{background:'#1a2f6e',color:'#fff',textAlign:'left'}}>{['เลขใบสมัคร','รหัสนักศึกษา','ชื่อ-นามสกุล','สาขาวิชาสอบ','รอบ/ครั้ง','วัน เวลา ห้องสอบ','สถานะ','คะแนน/ผล'].map(h=><th key={h} style={{padding:'11px 13px'}}>{h}</th>)}</tr></thead>
          <tbody>{loading?<tr><td colSpan="8" style={{padding:28,textAlign:'center'}}>กำลังโหลด...</td></tr>:preview.length?preview.map(r=><tr key={r.registration_id} style={{borderBottom:'1px solid #e8edf4',verticalAlign:'top'}}>
            <td style={{padding:12}}>{r.application_no}</td><td style={{padding:12}}><b>{r.university_student_code||'-'}</b><div style={{fontSize:12,color:'#68758a'}}>{r.student_code}</div></td>
            <td style={{padding:12}}>{r.full_name}</td><td style={{padding:12,maxWidth:260}}>{r.course_name}</td><td style={{padding:12,maxWidth:230}}>{r.session_name||'-'}<div style={{fontSize:12}}>ครั้งที่ {r.attempt_no}</div></td>
            <td style={{padding:12,maxWidth:250}}>{fmt(r.exam_date)} · {r.exam_time||'-'}<div style={{fontSize:12,color:'#68758a'}}>{r.exam_location||'-'}</div></td>
            <td style={{padding:12}}>{r.application_status}<div style={{fontSize:12,color:'#68758a'}}>{r.exam_status}</div></td><td style={{padding:12}}>{r.total_score??'-'}<div style={{fontSize:12,color:'#68758a'}}>{r.department_status}</div></td>
          </tr>):<tr><td colSpan="8" style={{padding:30,textAlign:'center',color:'#68758a'}}>กำหนดตัวกรองแล้วกด “แสดงตัวอย่าง” เพื่อตรวจข้อมูลก่อนส่งออก</td></tr>}</tbody>
        </table></div>
      </section>
    </main>
  </div>;
};

export default DataExport;
