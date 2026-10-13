import React from 'react';
import ReactDOM from 'react-dom/client';
import './fonts';
import App from './App';
import './styles/responsive.css';
import ErrorBoundary from './components/ErrorBoundary';
import { purgeLegacyStorage } from './services/session';

// เวอร์ชันก่อนหน้าเก็บ role/user (ชื่อ อีเมล รหัสผู้สมัคร) ไว้ใน localStorage ถาวร: ล้างทิ้งเมื่อเปิดแอป
purgeLegacyStorage();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

