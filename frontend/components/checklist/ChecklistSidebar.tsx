'use client';

import type { ChecklistItem } from '@/lib/types';

interface Props {
  items: ChecklistItem[];
  checklist: Record<string, string>;
}

export default function ChecklistSidebar({ items, checklist }: Props) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Checklist
      </div>
      {items.map(item => {
        const status = checklist[item.id] ?? 'not_yet';
        return (
          <div className="cl-item" key={item.id}>
            <div className={`cl-dot ${status}`} />
            <span className={`cl-label ${status}`}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
