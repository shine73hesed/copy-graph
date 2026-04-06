'use client';

interface Props {
  nodeLabel: string;
  confirmedCount: number;
  totalItems: number;
  onWiki?: () => void;
  onNotes?: () => void;
  onBack?: () => void;
  onReport?: () => void;
  hasReport?: boolean;
}

export default function Header({ nodeLabel, confirmedCount, totalItems, onWiki, onNotes, onBack, onReport, hasReport }: Props) {
  const pct = totalItems > 0 ? Math.round((confirmedCount / totalItems) * 100) : 0;

  return (
    <div className="ale-header">
      {onBack && (
        <button className="menu-btn" onClick={onBack}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        </button>
      )}

      <div className="h-topic">
        <span className="h-subject">{nodeLabel}</span>
        {totalItems > 0 && (
          <>
            <div className="h-progress-bar">
              <div className="h-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="h-progress-label">{confirmedCount}/{totalItems}</span>
          </>
        )}
      </div>

      <div className="h-right">
        {onWiki && (
          <button className="icon-btn" onClick={onWiki} title="교재">
            <span className="material-symbols-outlined">menu_book</span>
          </button>
        )}
        {onNotes && (
          <button className="icon-btn" onClick={onNotes} title="노트">
            <span className="material-symbols-outlined">note_alt</span>
          </button>
        )}
        {hasReport && onReport && (
          <button className="icon-btn" onClick={onReport} title="보고서" style={{ color: 'var(--teal)' }}>
            <span className="material-symbols-outlined">assessment</span>
          </button>
        )}
      </div>
    </div>
  );
}
