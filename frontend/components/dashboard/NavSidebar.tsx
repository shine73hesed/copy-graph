'use client';

interface Props {
  userId: string;
  onLogout: () => void;
}

export default function NavSidebar({ userId, onLogout }: Props) {
  return (
    <nav className="dash-nav" style={{
      width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)', background: 'var(--white)',
    }}>
      <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--primary)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: 20 }}>school</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Agentic-ALE</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Student</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <a href="/dashboard" className="nav-link active">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
          나의 학습
        </a>
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
          <div style={{
            width: 28, height: 28, background: 'var(--bg)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text3)' }}>person</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{userId}</span>
          <span
            onClick={onLogout}
            style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text3)' }}
            className="material-symbols-outlined"
            title="로그아웃"
          >logout</span>
        </div>
      </div>
    </nav>
  );
}
