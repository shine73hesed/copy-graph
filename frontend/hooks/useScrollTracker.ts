'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export function useScrollTracker(sessionId: string, containerRef: React.RefObject<HTMLElement | null>) {
  const [scrollDepth, setScrollDepth] = useState(0);
  const maxDepth = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const depth = (el.scrollTop + el.clientHeight) / el.scrollHeight;
        const clamped = Math.min(1, Math.max(0, depth));
        if (clamped > maxDepth.current) {
          maxDepth.current = clamped;
          setScrollDepth(clamped);
          api.readingLog(sessionId, 'scroll', { depth: clamped }).catch(() => {});
        }
      }, 3000);
    };

    el.addEventListener('scroll', handler, { passive: true });
    return () => {
      el.removeEventListener('scroll', handler);
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, containerRef]);

  return scrollDepth;
}
