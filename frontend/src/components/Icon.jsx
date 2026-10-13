import React from 'react';

// ไอคอน SVG ฝังในโค้ด: เดิมใช้คลาส Tabler (`ti ti-*`) แต่ไม่เคยโหลดฟอนต์ไอคอน ทำให้ช่องไอคอนว่างเปล่าทุกหน้า
const PATHS = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="M6 6l12 12M18 6L6 18" /></>,
};

export default function Icon({ name, className = '', size = 16 }) {
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {PATHS[name]}
        </svg>
    );
}
