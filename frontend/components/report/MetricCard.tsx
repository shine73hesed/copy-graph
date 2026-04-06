'use client';

interface Props {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  date?: string;
  value?: string | number;
  unit?: string;
  children?: React.ReactNode;
  cardBg?: string;
}

export default function MetricCard({ icon, iconBg, iconColor, title, date, value, unit, children, cardBg }: Props) {
  const dateStr = date || new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="report-section-card" style={cardBg ? { background: cardBg } : undefined}>
      <div className="report-section-icon" style={{ background: iconBg }}>
        <span className="material-symbols-outlined" style={{ color: iconColor, fontSize: 22 }}>{icon}</span>
      </div>
      <div className="report-section-body">
        <div className="report-section-title">{title}</div>
        <div className="report-section-date">{dateStr}</div>
        {children}
      </div>
      {value !== undefined && (
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <span className="report-section-value" style={{ color: iconColor }}>{value}</span>
          {unit && <span className="report-section-unit">{unit}</span>}
        </div>
      )}
    </div>
  );
}
