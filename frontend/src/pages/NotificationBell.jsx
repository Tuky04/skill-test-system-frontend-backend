import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const TYPE_ICON = {
    doc_approved:   '✅',
    doc_rejected:   '⚠️',
    exam_approved:  '🎯',
    exam_rejected:  '❌',
    score_released: '📊',
    system:         '📢',
};
const TYPE_COLOR = {
    doc_approved:   '#27AE60',
    doc_rejected:   '#F5A800',
    exam_approved:  '#2980B9',
    exam_rejected:  '#E74C3C',
    score_released: '#8E44AD',
    system:         '#1a2f6e',
};

const fmtTime = d => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60)   return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff/3600)} ชั่วโมงที่แล้ว`;
    return new Date(d).toLocaleDateString('th-TH', { day:'2-digit', month:'short' });
};

const NotificationBell = () => {
    const navigate = useNavigate();
    const [open, setOpen]       = useState(false);
    const [notifs, setNotifs]   = useState([]);
    const [unread, setUnread]   = useState(0);
    const [loading, setLoading] = useState(false);
    const dropRef = useRef(null);

    const fetchNotifs = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get('/notifications');
            if (res.data.success) {
                setNotifs(res.data.data || []);
                setUnread(res.data.unread || 0);
            }
        } catch {}
        finally { setLoading(false); }
    }, []);

    // โหลดครั้งแรกและ polling ทุก 60 วินาที
    useEffect(() => {
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifs]);

    // ปิด dropdown เมื่อคลิกนอก
    useEffect(() => {
        const handler = e => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => { setOpen(p => !p); if (!open) fetchNotifs(); };

    const handleClick = async (n) => {
        if (!n.is_read) {
            await API.put(`/notifications/${n.notification_id}/read`).catch(() => {});
            setNotifs(prev => prev.map(x => x.notification_id === n.notification_id ? {...x, is_read:1} : x));
            setUnread(p => Math.max(0, p - 1));
        }
        setOpen(false);
        if (n.link) navigate(n.link);
    };

    const handleMarkAll = async () => {
        await API.put('/notifications/read-all').catch(() => {});
        setNotifs(prev => prev.map(x => ({...x, is_read:1})));
        setUnread(0);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        await API.delete(`/notifications/${id}`).catch(() => {});
        setNotifs(prev => prev.filter(x => x.notification_id !== id));
    };

    return (
        <div ref={dropRef} style={{ position:'relative' }}>
            {/* ── Bell Button ── */}
            <button onClick={handleOpen} style={{
                position:'relative',
                background: open ? 'rgba(245,168,0,0.15)' : 'rgba(255,255,255,0.08)',
                border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:8, width:38, height:38,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, transition:'all 0.2s',
            }}>
                🔔
                {unread > 0 && (
                    <span style={{
                        position:'absolute', top:-4, right:-4,
                        background:'#E74C3C', color:'white',
                        borderRadius:99, minWidth:17, height:17,
                        fontSize:10, fontWeight:700,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        padding:'0 4px', border:'2px solid #1a2f6e',
                        lineHeight:1,
                    }}>
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {/* ── Dropdown ── */}
            {open && (
                <div style={{
                    position:'absolute', top:'calc(100% + 10px)', right:0,
                    width:340, maxHeight:460,
                    background:'white', borderRadius:12,
                    boxShadow:'0 16px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)',
                    overflow:'hidden', zIndex:9999,
                    display:'flex', flexDirection:'column',
                    fontFamily:"'Sarabun',sans-serif",
                }}>
                    {/* Header */}
                    <div style={{ background:'linear-gradient(135deg,#0d1e4a,#1a2f6e)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #F5A800', flexShrink:0 }}>
                        <div>
                            <div style={{ fontSize:14, fontWeight:700, color:'#F5A800' }}>🔔 การแจ้งเตือน</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1 }}>
                                {unread > 0 ? `ยังไม่ได้อ่าน ${unread} รายการ` : 'อ่านทั้งหมดแล้ว'}
                            </div>
                        </div>
                        {unread > 0 && (
                            <button onClick={handleMarkAll} style={{ fontSize:11, color:'#F5A800', background:'rgba(245,168,0,0.15)', border:'1px solid rgba(245,168,0,0.3)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:500 }}>
                                อ่านทั้งหมด
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div style={{ overflowY:'auto', flex:1 }}>
                        {loading && notifs.length === 0 ? (
                            <div style={{ textAlign:'center', padding:'28px 0', color:'#94a3b8', fontSize:13 }}>⏳ กำลังโหลด...</div>
                        ) : notifs.length === 0 ? (
                            <div style={{ textAlign:'center', padding:'32px 16px', color:'#94a3b8' }}>
                                <div style={{ fontSize:32, marginBottom:8 }}>🔕</div>
                                <div style={{ fontSize:13 }}>ยังไม่มีการแจ้งเตือน</div>
                            </div>
                        ) : notifs.map(n => (
                            <div key={n.notification_id}
                                onClick={() => handleClick(n)}
                                style={{
                                    padding:'11px 14px',
                                    borderBottom:'1px solid #F1F5F9',
                                    cursor:'pointer',
                                    background: n.is_read ? 'white' : '#F0F4FF',
                                    display:'flex', gap:10, alignItems:'flex-start',
                                    transition:'background 0.15s',
                                    position:'relative',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = n.is_read ? '#F8FAFC' : '#E8EEFF'}
                                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'white' : '#F0F4FF'}
                            >
                                {/* Icon */}
                                <div style={{
                                    width:34, height:34, borderRadius:8, flexShrink:0,
                                    background: `${TYPE_COLOR[n.type] || '#1a2f6e'}18`,
                                    border: `1px solid ${TYPE_COLOR[n.type] || '#1a2f6e'}30`,
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    fontSize:16,
                                }}>
                                    {TYPE_ICON[n.type] || '📢'}
                                </div>

                                {/* Content */}
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:12.5, fontWeight: n.is_read ? 500 : 700, color:'#1e293b', lineHeight:1.4 }}>
                                        {n.title}
                                    </div>
                                    <div style={{ fontSize:11.5, color:'#64748b', marginTop:2, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                                        {n.message}
                                    </div>
                                    <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:4 }}>
                                        {fmtTime(n.created_at)}
                                    </div>
                                </div>

                                {/* Unread dot + delete */}
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flexShrink:0 }}>
                                    {!n.is_read && (
                                        <div style={{ width:7, height:7, borderRadius:'50%', background:'#3B82F6', marginTop:2 }}/>
                                    )}
                                    <button onClick={e => handleDelete(e, n.notification_id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CBD5E1', fontSize:13, padding:0, lineHeight:1, transition:'color 0.15s' }}
                                        onMouseEnter={e => e.target.style.color='#E74C3C'}
                                        onMouseLeave={e => e.target.style.color='#CBD5E1'}>
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    {notifs.length > 0 && (
                        <div style={{ padding:'8px 14px', background:'#F8FAFC', borderTop:'1px solid #E2E8F0', textAlign:'center', fontSize:11.5, color:'#64748b', flexShrink:0 }}>
                            แสดง {notifs.length} รายการล่าสุด
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;