// frontend/components/chat/MessageBubble.tsx
"use client";

import { useMemo } from "react";
import { marked } from "marked";
import MermaidBlock from "./MermaidBlock";
import DiagramBlock from "./DiagramBlock";

interface Props {
  role: "user" | "assistant";
  content: string;
}

type ContentPart = { type: "html" | "mermaid" | "diagram"; value: string };

function splitContent(html: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const diagramRegex = /\[DIAGRAM:([\w가-힣_]+)\]/g;
  const mermaidRegex =
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

  type Match = {
    start: number;
    end: number;
    type: "mermaid" | "diagram";
    value: string;
  };
  const matches: Match[] = [];

  let m;
  while ((m = diagramRegex.exec(html)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      type: "diagram",
      value: m[1],
    });
  }
  while ((m = mermaidRegex.exec(html)) !== null) {
    const decoded = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      type: "mermaid",
      value: decoded,
    });
  }

  matches.sort((a, b) => a.start - b.start);

  let lastIdx = 0;
  for (const match of matches) {
    if (match.start > lastIdx) {
      parts.push({ type: "html", value: html.slice(lastIdx, match.start) });
    }
    parts.push({ type: match.type, value: match.value });
    lastIdx = match.end;
  }
  if (lastIdx < html.length) {
    parts.push({ type: "html", value: html.slice(lastIdx) });
  }

  return parts.length === 0 ? [{ type: "html", value: html }] : parts;
}

/**
 * student.html addT() 로직 이식:
 * 1. [SCORE:...], [BRIEF:...], [TOPIC_COMPLETE], [CHECKLIST:...] 태그 제거
 * 2. ```clinical```, ```tip```, ```ref``` → info-card 변환
 * 3. [Q] 질문? → .t-question div 변환 (마지막 [Q]만 Q 스타일, 나머지는 태그 제거)
 * 4. 첫 <p> 앞에 t-dot span 삽입
 * 5. [DIAGRAM:id] 태그는 marked 파싱 전에 보존
 */
function processContent(raw: string): string {
  let content = raw
    .replace(/\[SCORE:.*?\]/g, "")
    .replace(/\[BRIEF:.*?\]/g, "")
    .replace(/\[TOPIC_COMPLETE\]/g, "")
    .replace(/\[CHECKLIST:.*?\]/g, "")
    .trim();

  if (!content) return "";

  // [DIAGRAM:id] 태그를 임시 플레이스홀더로 교체 (marked가 건드리지 않도록)
  const diagramMap: Record<string, string> = {};
  let diagramIdx = 0;
  content = content.replace(/\[DIAGRAM:([\w가-힣_]+)\]/g, (_match, id) => {
    const placeholder = `__DIAGRAM_${diagramIdx}__`;
    diagramMap[placeholder] = `[DIAGRAM:${id}]`;
    diagramIdx++;
    return placeholder;
  });

  // info-card 변환 (마크다운 파싱 전)
  content = content
    .replace(
      /```clinical\n([\s\S]*?)```/g,
      '<div class="info-card clinical"><div class="info-card-body">$1</div></div>',
    )
    .replace(
      /```tip\n([\s\S]*?)```/g,
      '<div class="info-card tip"><div class="info-card-body">$1</div></div>',
    )
    .replace(
      /```ref\n([\s\S]*?)```/g,
      '<div class="info-card ref"><div class="info-card-body">$1</div></div>',
    );

  // marked 파싱
  let html = marked.parse(content, { async: false }) as string;

  // 플레이스홀더를 원래 [DIAGRAM:id] 태그로 복원
  for (const [placeholder, original] of Object.entries(diagramMap)) {
    // marked가 <p>로 감쌌을 수 있으므로 제거
    html = html.replace(new RegExp(`<p>${placeholder}</p>`, "g"), original);
    html = html.replace(new RegExp(placeholder, "g"), original);
  }

  // [Q] 처리 — 마지막 [Q]만 t-question, 나머지는 태그 제거
  const qParts = html.split(/(<p>\[Q\][\s\S]*?<\/p>)/g);
  let lastQIdx = -1;
  for (let qi = qParts.length - 1; qi >= 0; qi--) {
    if (qParts[qi].match(/^<p>\[Q\]/)) {
      lastQIdx = qi;
      break;
    }
  }
  if (lastQIdx >= 0) {
    for (let qi = 0; qi < qParts.length; qi++) {
      if (qParts[qi].match(/^<p>\[Q\]/)) {
        if (qi === lastQIdx) {
          qParts[qi] = qParts[qi].replace(
            /<p>\[Q\]\s*([\s\S]*?)<\/p>/,
            '<div class="t-question">$1</div>',
          );
        } else {
          qParts[qi] = qParts[qi].replace(/\[Q\]\s*/g, "");
        }
      }
    }
    html = qParts.join("");
  } else {
    html = html.replace(
      /<p>([\s\S]*?\?)\s*<\/p>\s*$/,
      '<div class="t-question">$1</div>',
    );
  }

  // 첫 <p> 앞에 t-dot 삽입
  html = html.replace(/^<p>/, '<p><span class="t-dot"></span>');

  return html;
}

export default function MessageBubble({ role, content }: Props) {
  const processedHtml = useMemo(() => {
    if (role === "user") return null;
    return processContent(content);
  }, [role, content]);

  const contentParts = useMemo(() => {
    if (role === "user" || !processedHtml) return null;
    return splitContent(processedHtml);
  }, [role, processedHtml]);

  if (role === "user") {
    const cleaned = content
      .replace(/\[SCORE:.*?\]/g, "")
      .replace(/\[BRIEF:.*?\]/g, "")
      .replace(/\[TOPIC_COMPLETE\]/g, "")
      .replace(/\[CHECKLIST:.*?\]/g, "")
      .trim();

    if (!cleaned) return null;

    return (
      <div className="s-msg">
        <div className="s-bubble">{cleaned}</div>
      </div>
    );
  }

  if (!processedHtml) return null;

  return (
    <div className="t-msg">
      {contentParts!.map((part, i) =>
        part.type === "mermaid" ? (
          <MermaidBlock key={i} code={part.value} />
        ) : part.type === "diagram" ? (
          <DiagramBlock key={i} diagramId={part.value} />
        ) : (
          <div
            key={i}
            className="prose"
            dangerouslySetInnerHTML={{ __html: part.value }}
          />
        ),
      )}
    </div>
  );
}
