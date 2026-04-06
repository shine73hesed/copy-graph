'use client';

import { useRef } from 'react';

export function useTimer() {
  const lastMessageTime = useRef<number | null>(null);

  const getElapsed = (): number | null => {
    const now = Date.now();
    const elapsed = lastMessageTime.current
      ? (now - lastMessageTime.current) / 1000
      : null;
    lastMessageTime.current = now;
    return elapsed;
  };

  const reset = () => {
    lastMessageTime.current = null;
  };

  return { getElapsed, reset };
}
