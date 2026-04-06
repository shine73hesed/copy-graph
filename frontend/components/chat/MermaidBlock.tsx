'use client';

import { useEffect, useRef, useState } from 'react';

let mermaidPromise: Promise<typeof import('mermaid')> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(m => {
      m.default.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'var(--sans)' });
      return m;
    });
  }
  return mermaidPromise;
}

let idCounter = 0;

export default function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = `mmd-${++idCounter}`;

    getMermaid().then(async (m) => {
      if (cancelled || !ref.current) return;
      try {
        const { svg } = await m.default.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setError(true);
      }
    });

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="mmd-wrap">
        <pre style={{ fontSize: 12, color: 'var(--ink3)' }}>{code}</pre>
      </div>
    );
  }

  return <div className="mmd-wrap" ref={ref} />;
}
