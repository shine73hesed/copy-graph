'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 16,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>오류가 발생했습니다</h2>
          <p style={{ fontSize: 14, color: '#666' }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#c0582e', color: 'white', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
