import { toDate, formatThaiDate, daysUntil } from './dates';
import { passwordProblem } from './password';
import { getUser, setSession, clearSession, purgeLegacyStorage, getRole, getToken } from '../services/session';

describe('date-only values keep their calendar day regardless of time zone', () => {
  test('toDate builds a local-midnight date for YYYY-MM-DD', () => {
    const date = toDate('2026-07-18');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 6, 18]);
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
  });

  test('toDate passes ISO timestamps through and rejects garbage', () => {
    expect(toDate('2026-07-18T10:30:00.000Z').toISOString()).toBe('2026-07-18T10:30:00.000Z');
    expect(toDate('not a date')).toBeNull();
    expect(toDate(null)).toBeNull();
    expect(toDate('')).toBeNull();
  });

  test('formatThaiDate uses the fallback for empty values and Buddhist-era years', () => {
    expect(formatThaiDate(null, undefined, 'ยังไม่กำหนด')).toBe('ยังไม่กำหนด');
    expect(formatThaiDate('2026-07-18')).toMatch(/2569/);
  });

  test('daysUntil counts through the end of the closing day', () => {
    const closingDayMorning = new Date(2026, 6, 17, 10, 0, 0);
    expect(daysUntil('2026-07-17', closingDayMorning)).toBe(0);
    expect(daysUntil('2026-07-18', closingDayMorning)).toBe(1);
    expect(daysUntil('2026-07-16', closingDayMorning)).toBe(-1);
    expect(daysUntil(null)).toBeNull();
  });
});

describe('password policy mirrors the backend (8 chars, 72 bytes)', () => {
  test.each([
    ['short', /อย่างน้อย 8/],
    ['a'.repeat(73), /72 ไบต์/],
    ['ก'.repeat(25), /72 ไบต์/],
  ])('rejects %s', (value, pattern) => {
    expect(passwordProblem(value)).toMatch(pattern);
  });

  test('accepts a normal and a maximum-length password', () => {
    expect(passwordProblem('Passw0rd!')).toBe('');
    expect(passwordProblem('a'.repeat(72))).toBe('');
  });
});

describe('browser session storage', () => {
  test('stores token, role and user for this tab only, and clears them together', () => {
    setSession({ token: 't1', role: 'Staff', user: { user_id: 3, full_name: 'ทดสอบ' } });
    expect(getToken()).toBe('t1');
    expect(getRole()).toBe('staff');
    expect(getUser()).toEqual({ user_id: 3, full_name: 'ทดสอบ' });
    expect(localStorage.length).toBe(0);
    clearSession();
    expect([getToken(), getRole()]).toEqual(['', '']);
    expect(getUser()).toEqual({});
  });

  test('a corrupted user record does not crash callers', () => {
    sessionStorage.setItem('user', '{not json');
    expect(getUser()).toEqual({});
    sessionStorage.setItem('user', '"a string"');
    expect(getUser()).toEqual({});
  });

  test('purgeLegacyStorage removes personal data left by older versions', () => {
    localStorage.setItem('role', 'student');
    localStorage.setItem('user', JSON.stringify({ email: 'student@example.test' }));
    localStorage.setItem('refreshToken', 'old');
    localStorage.setItem('unrelated-preference', 'keep');
    purgeLegacyStorage();
    expect(localStorage.getItem('role')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('unrelated-preference')).toBe('keep');
  });
});
