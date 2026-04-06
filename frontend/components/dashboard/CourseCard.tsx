'use client';

interface Props {
  completed: number;
  total: number;
  onClick: () => void;
}

export default function CourseCard({ completed, total, onClick }: Props) {
  return (
    <div className="course-card" onClick={onClick} style={{ background: '#FFCC4D' }}>
      <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.18)', top: -30, right: -20 }} />
      <div style={{ position: 'absolute', width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,139,148,.25)', top: 40, right: 80 }} />
      <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: 24, background: 'rgba(255,255,255,.12)', bottom: -20, right: 120, transform: 'rotate(35deg)' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#92400e', marginBottom: 4 }}>
          {completed}/{total}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: '#92400e' }}>치매 케어 간호 교육</h3>
        <p style={{ fontSize: 12, color: '#92400e', marginTop: 6, fontWeight: 500, opacity: 0.7 }}>
          10개 카테고리 · {total}개 노드
        </p>
      </div>
    </div>
  );
}
