// ALE v8.2 Constants

export const CAT_COLORS: Record<string, string> = {
  질환개요: '#ec5b13',
  병태생리: '#e07830',
  진단평가: '#d4692a',
  정신병증상: '#f43f5e',
  행동증상: '#f59e0b',
  정서증상: '#14b8a6',
  기타증상: '#94a3b8',
  약물치료: '#c0582e',
  비약물치료: '#14b8a6',
  간호실무: '#ec4899',
};

export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: '기억',
  understand: '이해',
  apply: '적용',
  analyze: '분석',
  evaluate: '평가',
  create: '창조',
};

export const BLOOM_COLORS: Record<BloomLevel, { bg: string; text: string }> = {
  remember: { bg: '#e8f5e9', text: '#2e7d32' },
  understand: { bg: '#e3f2fd', text: '#1565c0' },
  apply: { bg: '#fff3e0', text: '#e65100' },
  analyze: { bg: '#f3e5f5', text: '#7b1fa2' },
  evaluate: { bg: '#fce4ec', text: '#c62828' },
  create: { bg: '#e0f2f1', text: '#00695c' },
};

export const API_BASE = '';
