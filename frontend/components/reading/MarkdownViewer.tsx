// frontend/components/reading/MarkdownViewer.tsx
'use client';

import { useMemo, useState } from 'react';
import { marked } from 'marked';
import MermaidBlock from '@/components/chat/MermaidBlock';

interface Props {
  markdown: string;
  className?: string;
  style?: React.CSSProperties;
}

type Part = { type: 'md' | 'mermaid' | 'rawhtml' | 'video'; value: string };

/**
 * 유튜브 URL에서 video ID 추출
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * 마크다운 원문에서 특수 블록을 먼저 분리:
 * 1. [video:URL] — 유튜브 영상
 * 2. <div...><svg...>...</svg></div> — SVG 블록
 * 3. <svg...>...</svg> — 독립 SVG
 * 4. <!-- 주석 --> — 제거
 */
function splitRaw(md: string): Part[] {
  const parts: Part[] = [];

  const pattern = /(?:\[video:([^\]]+)\])|(?:<div[^>]*>\s*<svg[\s\S]*?<\/svg>\s*<\/div>)|(?:<svg[\s\S]*?<\/svg>)|(?:<!--[\s\S]*?-->)/gi;

  let lastIdx = 0;
  let match;

  while ((match = pattern.exec(md)) !== null) {
    if (match.index > lastIdx) {
      const before = md.slice(lastIdx, match.index).trim();
      if (before) parts.push({ type: 'md', value: before });
    }

    const block = match[0];
    if (block.startsWith('[video:')) {
      // [video:URL] → video 파트
      const url = match[1];
      parts.push({ type: 'video', value: url });
    } else if (block.startsWith('<!--')) {
      // 주석 제거
    } else {
      // SVG
      parts.push({ type: 'rawhtml', value: block });
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < md.length) {
    const remaining = md.slice(lastIdx).trim();
    if (remaining) parts.push({ type: 'md', value: remaining });
  }

  if (parts.length === 0 && md.trim()) {
    parts.push({ type: 'md', value: md });
  }

  return parts;
}

/** 마크다운 → HTML, Mermaid 분리 */
function parseMd(md: string): Part[] {
  if (!md.trim()) return [];
  const preprocessed = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const html = marked.parse(preprocessed, { async: false, breaks: true }) as string;

  const parts: Part[] = [];
  const re = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
  let lastIdx = 0;
  let match;

  while ((match = re.exec(html)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'rawhtml', value: html.slice(lastIdx, match.index) });
    }
    const decoded = match[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    parts.push({ type: 'mermaid', value: decoded });
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < html.length) {
    parts.push({ type: 'rawhtml', value: html.slice(lastIdx) });
  }

  return parts;
}

/** 접기/펼치기 영상 플레이어 — YouTube + 로컬 파일 */
function VideoBlock({ url }: { url: string }) {
  const [open, setOpen] = useState(true);
  const videoId = extractYouTubeId(url);
  const isLocal = !videoId; // YouTube 아니면 로컬 파일

  return (
    <div style={{ margin: '20px 0', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border, #e5e7eb)' }}>
      {/* 토글 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: open ? '#1a1a2e' : 'var(--bg, #fafafc)',
          border: 'none', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: open ? 'rgba(255,255,255,0.15)' : isLocal ? 'var(--primary, #ec5b13)' : '#ff0000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.2s',
        }}>
          {open ? (
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white' }}>close</span>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white' }}>play_arrow</span>
          )}
        </span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: open ? 'white' : 'var(--text, #1a1a2e)' }}>
            {open ? '영상 닫기' : '관련 영상 보기'}
          </div>
          {!open && (
            <div style={{ fontSize: 11, color: 'var(--text3, #94a3b8)', marginTop: 2 }}>
              클릭하여 영상을 재생하세요
            </div>
          )}
        </div>
        <span className="material-symbols-outlined" style={{
          fontSize: 20, color: open ? 'rgba(255,255,255,0.5)' : 'var(--text3, #94a3b8)',
          transform: open ? 'rotate(180deg)' : '',
          transition: 'transform 0.2s',
        }}>expand_more</span>
      </button>

      {/* 영상 플레이어 */}
      {open && (
        <div style={{ background: '#000' }}>
          {videoId ? (
            /* YouTube 임베드 */
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            /* 로컬 파일 */
            <video
              controls
              style={{ width: '100%', maxHeight: '70vh', display: 'block' }}
            >
              <source src={url} type={url.endsWith('.mp4') ? 'video/mp4' : url.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
              브라우저가 동영상을 지원하지 않습니다.
            </video>
          )}
        </div>
      )}
    </div>
  );
}

export default function MarkdownViewer({ markdown, className, style }: Props) {
  const parts = useMemo(() => {
    const rawParts = splitRaw(markdown);
    const final: Part[] = [];
    for (const p of rawParts) {
      if (p.type === 'md') {
        final.push(...parseMd(p.value));
      } else {
        final.push(p);
      }
    }
    return final;
  }, [markdown]);

  return (
    <div className={className || 'prose'} style={style}>
      {parts.map((part, i) => {
        if (part.type === 'mermaid') {
          return <MermaidBlock key={i} code={part.value} />;
        }
        if (part.type === 'video') {
          return <VideoBlock key={i} url={part.value} />;
        }
        return (
          <div
            key={i}
            style={part.value.includes('<svg') ? { display: 'flex', justifyContent: 'center', margin: '24px 0', overflowX: 'auto' } : undefined}
            dangerouslySetInnerHTML={{ __html: part.value }}
          />
        );
      })}
    </div>
  );
}