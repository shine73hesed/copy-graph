'use client';

import { BLOOM_LABELS, BLOOM_COLORS, type BloomLevel } from '@/lib/constants';

interface Props {
  level: string;
}

export default function BloomBadge({ level }: Props) {
  const bloom = (level || 'remember') as BloomLevel;
  const label = BLOOM_LABELS[bloom] || level;
  const colors = BLOOM_COLORS[bloom] || { bg: '#f5f5f5', text: '#666' };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 12px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      background: colors.bg,
      color: colors.text,
    }}>
      {label}
    </span>
  );
}
