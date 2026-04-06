'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api.me()
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--ink3)', fontSize: 14 }}>로딩 중...</div>
    </div>
  );
}
