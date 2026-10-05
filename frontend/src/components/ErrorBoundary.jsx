import React from 'react';

// ข้อผิดพลาดตอน render ในหน้าใดหน้าหนึ่งต้องไม่ทำให้ทั้งแอปกลายเป็นหน้าขาว
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error, info) {
        console.error('[UI error]', error, info?.componentStack);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'sans-serif', background: '#f1f5f9' }}>
                <section style={{ maxWidth: 440, background: 'white', padding: 32, borderRadius: 14, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                    <h1 style={{ color: '#b91c1c', fontSize: 22 }}>เกิดข้อผิดพลาดในการแสดงหน้านี้</h1>
                    <p style={{ color: '#475569', lineHeight: 1.7 }}>ข้อมูลของท่านไม่ได้รับผลกระทบ กรุณาโหลดหน้าใหม่ หากยังพบปัญหาให้แจ้งเจ้าหน้าที่</p>
                    <button onClick={() => window.location.reload()} style={{ padding: '10px 18px', background: '#1a2f6e', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>โหลดหน้าใหม่</button>
                </section>
            </main>
        );
    }
}
