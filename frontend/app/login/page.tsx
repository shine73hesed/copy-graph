'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.me().then(() => router.push('/dashboard')).catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const uid = userId.trim();
    const p = pin.trim();

    if (!uid || uid.length < 2 || !/^[a-zA-Z0-9_]{2,20}$/.test(uid)) {
      setError('ID는 영문/숫자/밑줄 2~20자');
      return;
    }
    if (!/^[0-9]{4}[A-Za-z]{2}$/.test(p)) {
      setError('PIN: 숫자4자리 + 영문2자리 (예: 1578Rn)');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(uid, p);
      setSuccess(res.is_new ? '계정 생성 완료!' : '환영합니다!');
      setTimeout(() => router.push('/dashboard'), 300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '서버 연결 실패');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--white)',
        borderRadius: 28,
        padding: '48px 40px 40px',
        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.08)',
        animation: 'fadeUp 0.5s ease-out',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            borderRadius: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: 28 }}>school</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>CareExpert ALE</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>치매 케어 간호 교육 플랫폼</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--rose-bg)',
            border: '1px solid #fecdd3',
            color: 'var(--rose)',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            textAlign: 'center',
            animation: 'fadeUp 0.2s ease-out',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, letterSpacing: 0.3 }}>
              학습자 ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="예: user01"
              maxLength={20}
              required
              autoComplete="username"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1.5px solid var(--border)',
                borderRadius: 14,
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
                background: 'var(--bg)',
                transition: 'all 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--white)'; e.target.style.boxShadow = '0 0 0 3px rgba(236,91,19,0.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, letterSpacing: 0.3 }}>
              PIN (6자리)
            </label>
            <input
              type="text"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="예: 1578Rn"
              maxLength={6}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1.5px solid var(--border)',
                borderRadius: 14,
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
                background: 'var(--bg)',
                transition: 'all 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--white)'; e.target.style.boxShadow = '0 0 0 3px rgba(236,91,19,0.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg)'; e.target.style.boxShadow = 'none'; }}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              숫자 4자리 + 영문 2자리 (예: 1578Rn)
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 14,
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {success || (loading ? '로그인 중...' : '로그인 / 시작')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          처음이라면 자동으로 계정이 만들어집니다
        </div>
      </div>
    </div>
  );
}
