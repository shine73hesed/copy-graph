'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>오류가 발생했습니다</h2>
      <p style={{ fontSize: 14, color: '#666' }}>{error.message}</p>
      <button
        className="btn-primary"
        onClick={reset}
      >
        다시 시도
      </button>
    </div>
  );
}
