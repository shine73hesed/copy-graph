'use client';

import { useRef, useCallback, KeyboardEvent } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function InputBar({ onSend, disabled, placeholder = '답변을 입력하세요...' }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const value = el.value.trim();
    if (!value || disabled) return;
    onSend(value);
    el.value = '';
    el.style.height = 'auto';
  }, [onSend, disabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="input-area">
      <div className="input-wrap">
        <textarea
          ref={textareaRef}
          placeholder={placeholder}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button className="send-btn" onClick={handleSend} disabled={disabled}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
