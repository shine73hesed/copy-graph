import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>페이지를 찾을 수 없습니다</h2>
      <Link href="/dashboard" style={{
        padding: '8px 20px', borderRadius: 8, textDecoration: 'none',
        background: '#c0582e', color: 'white', fontSize: 14, fontWeight: 600,
      }}>
        대시보드로
      </Link>
    </div>
  );
}
