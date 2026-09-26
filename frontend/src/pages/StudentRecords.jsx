import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import RmutsNavbar from '../components/RmutsNavbar';
import '../styles/theme.css';

const box = { background:'#fff', border:'1px solid #dce3ee', borderRadius:12, boxShadow:'0 2px 10px rgba(20,45,90,.06)' };
const input = { padding:'10px 12px', border:'1px solid #cdd8e8', borderRadius:7, background:'#fff', minWidth:180 };
const button = { border:0, borderRadius:7, padding:'9px 14px', cursor:'pointer', fontWeight:700 };

const StudentRecords = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({ search:'', registration_status:'', account_status:'', course_id:'' });
  const [applied, setApplied] = useState({});
  const [pagination, setPagination] = useState({ page:1, pages:1, total:0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (page = 1, activeFilters = applied) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page:String(page), limit:'25' });
      Object.entries(activeFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const response = await API.get('/staff/students?' + params);
      setRows(response.data.data || []);
      setPagination(response.data.pagination || { page:1, pages:1, total:0 });
    } catch (err) {
      setError(err.response?.data?.message || 'ไม่สามารถโหลดข้อมูลนักศึกษาได้');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    API.get('/staff/export/options').then((response) => setCourses(response.data.data?.courses || [])).catch(() => {});
    load(1, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event) => {
    event.preventDefault();
    setApplied(filters);
    load(1, filters);
  };
  const reset = () => {
    const empty = { search:'', registration_status:'', account_status:'', course_id:'' };
    setFilters(empty); setApplied(empty); load(1, empty);
  };
  const statusColor = (status) => status === 'อนุมัติ' ? '#16875b' : status === 'เอกสารไม่ครบ' ? '#b54708' : '#315b9d';

  return (
    <div style={{ minHeight:'100vh', background:'#f3f6fa' }}>
      <RmutsNavbar title="ข้อมูลนักศึกษา" actions={[
        { label:'📝 ตรวจและให้คะแนน', onClick:()=>navigate('/grading-panel') },
        { label:'📄 ตรวจเอกสาร', onClick:()=>navigate('/staff/verify-students') },
      ]}/>
      <main style={{ maxWidth:1400, margin:'24px auto', padding:'0 20px 40px' }}>
        <section style={{ ...box, padding:20, marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
            <div>
              <h2 style={{ margin:'0 0 6px', color:'#1a2f6e' }}>ข้อมูลนักศึกษาทั้งระบบ</h2>
              <div style={{ color:'#68758a', fontSize:14 }}>ค้นหาและเปิดดูบัญชี เอกสาร ประวัติการตรวจ และรายละเอียดการสอบแบบรายคน</div>
            </div>
            <div style={{ background:'#eef3ff', color:'#1a2f6e', padding:'10px 16px', borderRadius:8, fontWeight:700 }}>
              พบ {Number(pagination.total || 0).toLocaleString('th-TH')} คน
            </div>
          </div>
          <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:10, marginTop:18 }}>
            <input style={input} value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}
              placeholder="ชื่อ รหัสนักศึกษา ผู้ใช้ อีเมล หรือโทรศัพท์"/>
            <select style={input} value={filters.registration_status} onChange={e=>setFilters({...filters,registration_status:e.target.value})}>
              <option value="">สถานะเอกสารทั้งหมด</option><option>รอตรวจสอบเอกสาร</option><option>เอกสารไม่ครบ</option><option>อนุมัติ</option>
            </select>
            <select style={input} value={filters.account_status} onChange={e=>setFilters({...filters,account_status:e.target.value})}>
              <option value="">สถานะบัญชีทั้งหมด</option><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option>
            </select>
            <select style={input} value={filters.course_id} onChange={e=>setFilters({...filters,course_id:e.target.value})}>
              <option value="">ทุกสาขาวิชาสอบ</option>
              {courses.map(c=><option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>)}
            </select>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" style={{ ...button, background:'#1a2f6e', color:'#fff' }}>ค้นหา</button>
              <button type="button" onClick={reset} style={{ ...button, background:'#e9eef5', color:'#334155' }}>ล้าง</button>
            </div>
          </form>
        </section>

        {error && <div style={{ ...box, borderLeft:'4px solid #b42318', padding:14, color:'#b42318', marginBottom:14 }}>{error}</div>}
        <section style={{ ...box, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1050 }}>
              <thead><tr style={{ background:'#1a2f6e', color:'#fff', textAlign:'left' }}>
                {['รหัสนักศึกษา','ชื่อ-นามสกุล','ข้อมูลติดต่อ','บัญชีผู้ใช้','สถานะเอกสาร','การสมัครสอบ','รายการล่าสุด',''].map(h=>
                  <th key={h} style={{ padding:'12px 14px', fontSize:13 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="8" style={{ padding:32, textAlign:'center' }}>กำลังโหลดข้อมูล...</td></tr> :
                 rows.length === 0 ? <tr><td colSpan="8" style={{ padding:32, textAlign:'center', color:'#6b7280' }}>ไม่พบข้อมูลตามเงื่อนไข</td></tr> :
                 rows.map(row => <tr key={row.student_id} style={{ borderBottom:'1px solid #e8edf4' }}>
                   <td style={{ padding:13 }}><b style={{ color:'#1a2f6e' }}>{row.university_student_code || '-'}</b><div style={{ fontSize:12, color:'#7a8799' }}>{row.student_code}</div></td>
                   <td style={{ padding:13 }}><b>{row.title}{row.full_name}</b><div style={{ fontSize:12, color:'#7a8799' }}>{row.masked_id_card}</div></td>
                   <td style={{ padding:13, fontSize:13 }}><div>{row.email || '-'}</div><div>{row.phone_number || '-'}</div></td>
                   <td style={{ padding:13, fontSize:13 }}><div>{row.username || '-'}</div><div style={{ color:Number(row.is_active)===1?'#16875b':'#b42318' }}>{Number(row.is_active)===1?'● ใช้งาน':'● ปิดใช้งาน'}</div></td>
                   <td style={{ padding:13 }}><span style={{ color:statusColor(row.registration_status), background:'#f0f4fa', padding:'5px 8px', borderRadius:12, fontSize:12, fontWeight:700 }}>{row.registration_status}</span></td>
                   <td style={{ padding:13, textAlign:'center', fontWeight:700 }}>{row.registration_count || 0}</td>
                   <td style={{ padding:13, fontSize:13, maxWidth:230 }}><div>{row.latest_course || 'ยังไม่มีการสมัครสอบ'}</div><div style={{ color:'#68758a' }}>{row.latest_application_status || ''}</div></td>
                   <td style={{ padding:13 }}><button onClick={()=>navigate('/staff/students/' + row.student_id)} style={{ ...button, background:'#f5a800', color:'#172a5b', whiteSpace:'nowrap' }}>ดูรายละเอียด</button></td>
                 </tr>)}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, padding:15 }}>
            <button disabled={pagination.page<=1} onClick={()=>load(pagination.page-1)} style={{ ...button, opacity:pagination.page<=1 ? .45 : 1 }}>ก่อนหน้า</button>
            <span>หน้า {pagination.page} / {pagination.pages}</span>
            <button disabled={pagination.page>=pagination.pages} onClick={()=>load(pagination.page+1)} style={{ ...button, opacity:pagination.page>=pagination.pages ? .45 : 1 }}>ถัดไป</button>
          </div>}
        </section>
      </main>
    </div>
  );
};

export default StudentRecords;
