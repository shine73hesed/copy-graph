'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { NoteResponse } from '@/lib/types';

interface Props {
  nodeId: string;
  onClose: () => void;
}

export default function NoteModal({ nodeId, onClose }: Props) {
  const [note, setNote] = useState<NoteResponse | null>(null);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.note(nodeId).then(res => {
      setNote(res);
      setMemo(res.personal_memo ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [nodeId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMemo(nodeId, memo);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>학습 노트</h2>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink3)' }}>불러오는 중...</div>
        ) : note ? (
          <>
            {/* Weak points */}
            {note.weak_points.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  보완할 부분
                </h3>
                {note.weak_points.map((wp, i) => (
                  <div key={i} style={{
                    padding: '12px 16px', background: 'var(--paper2)', borderRadius: 10, marginBottom: 8,
                    fontSize: 13, lineHeight: 1.7,
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>{wp.concept}</div>
                    <div style={{ color: 'var(--ink2)' }}>{wp.tip}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Vocabulary */}
            {note.vocabulary.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  주요 용어
                </h3>
                {note.vocabulary.map((v, i) => (
                  <div key={i} style={{
                    padding: '10px 16px', background: 'var(--teal-bg)', borderRadius: 10, marginBottom: 6,
                    fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--teal)' }}>{v.term}</span>
                    <span style={{ color: 'var(--ink2)', marginLeft: 8 }}>{v.definition}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Strengths / Next focus */}
            {note.strengths && (
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--ink2)' }}>
                <strong>강점:</strong> {note.strengths}
              </div>
            )}
            {note.next_focus && (
              <div style={{ marginBottom: 24, fontSize: 13, color: 'var(--ink2)' }}>
                <strong>다음 학습 포인트:</strong> {note.next_focus}
              </div>
            )}

            {/* Personal memo */}
            <div style={{ borderTop: '1px solid var(--cream)', paddingTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                개인 메모
              </h3>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="자유롭게 메모하세요..."
                style={{
                  width: '100%', minHeight: 100, padding: '12px 16px',
                  border: '1.5px solid var(--cream)', borderRadius: 12,
                  fontFamily: 'var(--sans)', fontSize: 13, outline: 'none',
                  resize: 'vertical', background: 'var(--paper)',
                }}
              />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }} onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--ink3)', fontSize: 13 }}>아직 학습 노트가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
