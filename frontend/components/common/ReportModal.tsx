// frontend/components/common/ReportModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ConceptResult { [key: string]: string | boolean; }
interface RubricData {
  key_concepts?: string[];
  criteria?: Array<{ key: string; concept: string; weight?: number }>;
  scoring?: Record<string, string>;
}
interface ItemDetail {
  item_id: string; question: string; item_type: string; bloom_level: string;
  response: string; auto_score: number; elapsed_sec?: number;
  matched_count?: number; total_count?: number;
  concept_results?: ConceptResult | null; rubric?: RubricData | null;
}
interface ReportData {
  session_id: string; node_id: string; mode: string;
  pre_score: number | null; post_score: number | null; gain: number | null;
  pre_bloom: string | null; post_bloom: string | null;
  learning_duration_sec: number | null;
  pre_items: ItemDetail[]; post_items: ItemDetail[];
  bloom_distribution: { pre: Record<string, number>; post: Record<string, number> };
  bloom_scores: { pre: Record<string, number>; post: Record<string, number> };
  bloom_weights?: Record<string, number>;
  report?: { summary?: string; strengths?: string[]; weaknesses?: string[]; recommendations?: string[] } | null;
}
interface Props { sessionId: string; preScore?: number | null; postScore?: number | null; onClose: () => void; }

const BKR: Record<string, string> = { remember:'기억', understand:'이해', apply:'적용', analyze:'분석', evaluate:'평가', create:'창조' };
const BW: Record<string, number> = { remember:1.0, understand:1.2, apply:1.4, analyze:1.6, evaluate:1.8, create:2.0 };

export default function ReportModal({ sessionId, preScore, postScore, onClose }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.sessionReport(sessionId).then((r: unknown) => setData(r as ReportData)).catch(() => {}).finally(() => setLoading(false));
  }, [sessionId]);

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pre = data?.pre_score ?? preScore ?? null;
  const post = data?.post_score ?? postScore ?? null;
  const gain = data?.gain ?? (pre != null && post != null ? post - pre : null);
  const weights = data?.bloom_weights ?? BW;

  const calcDetail = (items: ItemDetail[]) => {
    let tW = 0, eW = 0;
    const rows = items.map(it => { const w = weights[it.bloom_level] ?? 1.0; tW += w; eW += it.auto_score * w; return { ...it, weight: w, weighted: it.auto_score * w }; });
    return { rows, tW, eW, score: tW > 0 ? eW / tW : 0 };
  };
  const preC = data ? calcDetail(data.pre_items) : null;
  const postC = data ? calcDetail(data.post_items) : null;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width:'95%', maxWidth:800, maxHeight:'92vh', background:'var(--white,#fff)', borderRadius:20, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="material-symbols-outlined" style={{ color:'var(--teal)', fontSize:22 }}>assessment</span>
            <div><div style={{ fontSize:16, fontWeight:800 }}>학습 디버깅 보고서</div>
            {data?.node_id && <div style={{ fontSize:11, color:'var(--text3)' }}>{data.node_id} · {data.mode === 'reading' ? '읽기' : '대화'}</div>}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, border:'none', background:'var(--bg)', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize:18 }}>close</span>
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {loading ? <div style={{ padding:60, textAlign:'center', color:'var(--text3)' }}>불러오는 중...</div>
          : !data ? <div style={{ padding:60, textAlign:'center', color:'var(--text3)' }}>데이터 없음</div>
          : <>
            {/* 점수 요약 */}
            <Sec title="점수 요약" icon="analytics">
              <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                <SBox label="사전" value={pre} color="#f59e0b" />
                <SBox label="사후" value={post} color="var(--teal)" />
                <SBox label="성장" value={gain} color={gain && gain > 0 ? '#22c55e' : '#ef4444'} suffix="p" />
              </div>
              <CB><div>phase_score = Σ(item_score × bloom_weight) / Σ(bloom_weight)</div>
              <div>gain = {post?.toFixed(4)} - {pre?.toFixed(4)} = <M>{gain?.toFixed(4)}</M></div></CB>
            </Sec>

            {/* Bloom 가중치 */}
            <Sec title="Bloom 가중치" icon="tune">
              <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'2px solid var(--border)' }}>
                  <TH>레벨</TH><TH>가중치</TH><TH>사전 문항</TH><TH>사후 문항</TH><TH>사전 평균</TH><TH>사후 평균</TH>
                </tr></thead>
                <tbody>{Object.entries(weights).map(([b, w]) => (
                  <tr key={b} style={{ borderBottom:'1px solid var(--border)' }}>
                    <TD b>{BKR[b]||b}</TD><TD m>{w.toFixed(1)}</TD>
                    <TD m>{data.bloom_distribution.pre[b]??0}</TD><TD m>{data.bloom_distribution.post[b]??0}</TD>
                    <TD m>{data.bloom_scores.pre[b]?.toFixed(3)??'—'}</TD><TD m>{data.bloom_scores.post[b]?.toFixed(3)??'—'}</TD>
                  </tr>
                ))}</tbody>
              </table>
            </Sec>

            {/* 사전 문항별 */}
            {preC && preC.rows.length > 0 && (
              <Sec title={`사전 평가 (${preC.rows.length}문항)`} icon="edit_note">
                <CB><div>pre_score = {preC.eW.toFixed(4)} / {preC.tW.toFixed(1)} = <M>{preC.score.toFixed(4)}</M></div></CB>
                {preC.rows.map((it, i) => <IC key={it.item_id} item={it} index={i} phase="pre" open={expanded.has(`p${it.item_id}`)} onToggle={() => toggle(`p${it.item_id}`)} />)}
              </Sec>
            )}

            {/* 사후 문항별 */}
            {postC && postC.rows.length > 0 && (
              <Sec title={`사후 평가 (${postC.rows.length}문항)`} icon="quiz">
                <CB><div>post_score = {postC.eW.toFixed(4)} / {postC.tW.toFixed(1)} = <M>{postC.score.toFixed(4)}</M></div></CB>
                {postC.rows.map((it, i) => <IC key={it.item_id} item={it} index={i} phase="post" open={expanded.has(`q${it.item_id}`)} onToggle={() => toggle(`q${it.item_id}`)} />)}
              </Sec>
            )}

            {/* 사전↔사후 비교 */}
            {data.pre_items.length > 0 && data.post_items.length > 0 && (
              <Sec title="사전↔사후 비교" icon="compare_arrows">
                <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                  <thead><tr style={{ borderBottom:'2px solid var(--border)' }}><TH>#</TH><TH>Bloom</TH><TH>사전</TH><TH>사후</TH><TH>변화</TH></tr></thead>
                  <tbody>{data.post_items.map((pi, i) => {
                    const ps = data.pre_items[i]?.auto_score ?? 0; const d = pi.auto_score - ps;
                    return <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                      <TD m>{i+1}</TD><TD><BP b={pi.bloom_level}/></TD><TD m>{(ps*100).toFixed(0)}%</TD><TD m>{(pi.auto_score*100).toFixed(0)}%</TD>
                      <TD m style={{ color: d>0?'#22c55e':d<0?'#ef4444':'var(--text3)' }}>{d>0?'+':''}{(d*100).toFixed(0)}%p</TD>
                    </tr>;
                  })}</tbody>
                </table>
              </Sec>
            )}

            {/* 메타 */}
            <Sec title="메타데이터" icon="info">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                <MR k="session_id" v={data.session_id}/><MR k="node_id" v={data.node_id}/>
                <MR k="mode" v={data.mode}/><MR k="pre_bloom" v={data.pre_bloom??'—'}/>
                <MR k="post_bloom" v={data.post_bloom??'—'}/><MR k="duration" v={data.learning_duration_sec?`${data.learning_duration_sec}초`:'—'}/>
                <MR k="pre_elapsed" v={data.pre_items.reduce((s,it)=>s+(it.elapsed_sec??0),0)>0?`${data.pre_items.reduce((s,it)=>s+(it.elapsed_sec??0),0).toFixed(1)}초`:'—'}/>
                <MR k="post_elapsed" v={data.post_items.reduce((s,it)=>s+(it.elapsed_sec??0),0)>0?`${data.post_items.reduce((s,it)=>s+(it.elapsed_sec??0),0).toFixed(1)}초`:'—'}/>
              </div>
            </Sec>

            {data.report?.summary && (
              <Sec title="AI 종합 평가" icon="psychology">
                <div style={{ fontSize:13, lineHeight:1.8, color:'var(--text2)' }}>{data.report.summary}</div>
              </Sec>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

/* ── 하위 컴포넌트 ── */

function Sec({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return <div style={{ marginBottom:20, border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
    <div style={{ padding:'12px 16px', background:'var(--bg)', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)' }}>
      <span className="material-symbols-outlined" style={{ fontSize:18, color:'var(--primary)' }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:700 }}>{title}</span>
    </div>
    <div style={{ padding:16 }}>{children}</div>
  </div>;
}

function SBox({ label, value, color, suffix='' }: { label:string; value:number|null|undefined; color:string; suffix?:string }) {
  const pct = value!=null?(Math.abs(value)*100).toFixed(1):'—';
  return <div style={{ flex:1, padding:16, borderRadius:12, background:'var(--bg)', textAlign:'center' }}>
    <div style={{ fontSize:24, fontWeight:800, fontFamily:'var(--mono)', color }}>{value!=null&&value>0&&suffix?'+':''}{pct}{suffix?`%${suffix}`:'%'}</div>
    <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginTop:4 }}>{label}</div>
    {value!=null&&<div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>raw: {value.toFixed(4)}</div>}
  </div>;
}

function CB({ children }: { children: React.ReactNode }) {
  return <div style={{ padding:'10px 14px', background:'#f8f7f4', border:'1px dashed var(--border)', borderRadius:8, fontFamily:'var(--mono)', fontSize:11, lineHeight:1.8, color:'var(--text2)', marginBottom:12 }}>{children}</div>;
}
function M({ children }: { children: React.ReactNode }) { return <span style={{ fontWeight:700, color:'var(--primary)' }}>{children}</span>; }

function IC({ item, index, phase, open, onToggle }: {
  item: ItemDetail & { weight:number; weighted:number }; index:number; phase:string; open:boolean; onToggle:()=>void;
}) {
  const pct = (item.auto_score*100).toFixed(0);
  const sc = item.auto_score>=0.7?'#22c55e':item.auto_score>=0.4?'#f59e0b':'#ef4444';

  // rubric에서 개념 목록 추출 (key_concepts 또는 criteria)
  const concepts: Array<{ key:string; label:string; weight?:number }> = [];
  if (item.rubric?.key_concepts) {
    (item.rubric.key_concepts as string[]).forEach((c, i) => concepts.push({ key:`K${i+1}`, label:c }));
  } else if (item.rubric?.criteria) {
    (item.rubric.criteria as Array<{ key:string; concept:string; weight?:number }>).forEach(c => concepts.push({ key:c.key, label:c.concept, weight:c.weight }));
  }

  return <div style={{ border:'1px solid var(--border)', borderRadius:10, marginBottom:8, overflow:'hidden' }}>
    <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', cursor:'pointer', background:open?'var(--bg)':'transparent' }}>
      <div style={{ minWidth:24, height:24, borderRadius:'50%', background:sc, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{index+1}</div>
      <BP b={item.bloom_level}/>
      <div style={{ flex:1, fontSize:12, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.question}</div>
      <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:13, color:sc }}>{pct}%</span>
      {item.matched_count!=null&&<span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{item.matched_count}/{item.total_count}</span>}
      <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--text3)', transform:open?'rotate(180deg)':'', transition:'transform 0.2s' }}>expand_more</span>
    </div>

    {open && <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border)' }}>
      <DR l="문항" v={item.question}/>
      <DR l="유형" v={`${item.item_type} · ${BKR[item.bloom_level]} (${item.bloom_level})`}/>
      {item.elapsed_sec!=null&&<DR l="응답 시간" v={`${item.elapsed_sec.toFixed(1)}초`}/>}

      <div style={{ marginTop:8 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:4 }}>학습자 응답</div>
        <div style={{ padding:'10px 12px', background:'#1a1a1a', color:'rgba(255,255,255,0.88)', borderRadius:10, fontSize:12, lineHeight:1.7 }}>{item.response||'(없음)'}</div>
      </div>

      {/* 채점 과정 (단계별 서술) */}
      {item.item_type === 'short_answer' && concepts.length > 0 && (
        <div style={{ marginTop:10, padding:'14px 16px', background:'#fafaf8', border:'1px solid var(--border)', borderRadius:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:10 }}>
            채점 과정 ({BKR[item.bloom_level]}, 서술형)
          </div>

          {/* Step 1: 학습자 답변 */}
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8, lineHeight:1.7 }}>
            <span style={{ fontWeight:700, color:'var(--primary)' }}>학습자 답변:</span> "{item.response}"
          </div>

          {/* Step 2: LLM에게 전달 */}
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10, fontStyle:'italic' }}>
            → LLM에게: "아래 핵심 개념이 학습자 답변에 언급되었는가? yes/no로만 판별"
          </div>

          {/* Step 3: 개념별 판정 */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {concepts.map(c => {
              const cr = item.concept_results;
              const hasLLM = cr && c.key in cr;
              const llmYes = hasLLM ? (cr[c.key]===true||cr[c.key]==='yes'||cr[c.key]==='Yes'||cr[c.key]==='true') : null;
              const resp = (item.response||'').toLowerCase();
              const kws = c.label.toLowerCase().split(/[·,\s()]+/).filter(w => w.length > 1);
              const found = kws.filter(kw => resp.includes(kw));
              const isMatch = llmYes ?? false;

              return <div key={c.key} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 12px', background: isMatch ? '#f0fdf4' : '#fef2f2', borderRadius:8, fontSize:12, border: `1px solid ${isMatch ? '#bbf7d0' : '#fecaca'}` }}>
                <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: isMatch ? '#22c55e' : '#ef4444', minWidth:28, flexShrink:0 }}>
                  {isMatch ? 'yes' : 'no'}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{c.key}: {c.label}</div>
                  {hasLLM && found.length > 0 && (
                    <div style={{ fontSize:10, color:'#666', marginTop:3 }}>
                      근거: 응답에서 "{found.join('", "')}" 발견
                    </div>
                  )}
                  {hasLLM && !isMatch && found.length > 0 && (
                    <div style={{ fontSize:10, color:'#b45309', marginTop:3 }}>
                      키워드 "{found.join('", "')}"가 있으나 LLM이 개념 충족으로 판정하지 않음
                    </div>
                  )}
                  {!hasLLM && found.length > 0 && (
                    <div style={{ fontSize:10, color:'#b45309', marginTop:3 }}>
                      키워드 발견: "{found.join('", "')}" (LLM 판정 데이터 없음)
                    </div>
                  )}
                  {!hasLLM && found.length === 0 && (
                    <div style={{ fontSize:10, color:'#991b1b', marginTop:3 }}>
                      응답에서 관련 표현 미발견
                    </div>
                  )}
                </div>
              </div>;
            })}
          </div>

          {/* Step 4: 점수 계산 */}
          <div style={{ fontFamily:'var(--mono)', fontSize:11, lineHeight:1.8, color:'var(--text2)', padding:'8px 12px', background:'white', borderRadius:6, border:'1px dashed var(--border)' }}>
            <div>코드 계산: matched {item.matched_count ?? '?'} / total {item.total_count ?? concepts.length} = <span style={{ fontWeight:700, color:'var(--primary)' }}>{item.auto_score.toFixed(4)}</span></div>
            <div>bloom_weight({BKR[item.bloom_level]}) = {item.weight.toFixed(1)}</div>
            <div>weighted_score = {item.auto_score.toFixed(4)} × {item.weight.toFixed(1)} = <span style={{ fontWeight:700, color:'var(--primary)' }}>{item.weighted.toFixed(4)}</span></div>
          </div>

          {/* LLM brief */}
          {item.concept_results?.brief && (
            <div style={{ marginTop:8, fontSize:11, color:'var(--text3)', fontStyle:'italic', padding:'6px 12px', background:'white', borderRadius:6 }}>
              LLM 요약: {String(item.concept_results.brief)}
            </div>
          )}
        </div>
      )}

      {/* MCQ는 간단 표시 */}
      {item.item_type === 'mcq' && (
        <div style={{ marginTop:8, padding:'10px 14px', background:'#fafaf8', border:'1px solid var(--border)', borderRadius:8, fontFamily:'var(--mono)', fontSize:11, color:'var(--text2)' }}>
          MCQ 정답 매칭: {item.auto_score === 1 ? '정답 ✓' : '오답 ✗'} → score = {item.auto_score.toFixed(1)}
        </div>
      )}

      {item.rubric?.scoring && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', marginBottom:4 }}>채점 기준</div>
          <div style={{ padding:'6px 10px', background:'var(--bg)', borderRadius:6, fontSize:11, lineHeight:1.7 }}>
            {Object.entries(item.rubric.scoring).map(([lv, desc]) => <div key={lv}><span style={{ fontWeight:700, color:'var(--primary)' }}>{lv}</span>: {String(desc)}</div>)}
          </div>
        </div>
      )}

      {item.auto_score===0&&<div style={{ marginTop:6, padding:'8px 10px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, fontSize:11, color:'#991b1b', lineHeight:1.6 }}>
        <span style={{ fontWeight:700 }}>0점 사유:</span> 필요 개념 {concepts.length}개 중 매칭된 항목 없음
      </div>}
    </div>}
  </div>;
}

function BP({ b }: { b:string }) {
  const c: Record<string,{bg:string;c:string}> = { remember:{bg:'#f0f0f5',c:'#666'}, understand:{bg:'#e3f2fd',c:'#1565c0'}, apply:{bg:'#fff3e0',c:'#e65100'}, analyze:{bg:'#f3e5f5',c:'#7b1fa2'}, evaluate:{bg:'#fce4ec',c:'#c62828'}, create:{bg:'#e8f5e9',c:'#2e7d32'} };
  const s = c[b]||c.remember;
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, background:s.bg, color:s.c }}>{BKR[b]||b}</span>;
}

function DR({ l, v }: { l:string; v:string }) {
  return <div style={{ display:'flex', gap:8, padding:'4px 0', fontSize:12 }}><span style={{ minWidth:60, color:'var(--text3)', fontWeight:600, flexShrink:0 }}>{l}</span><span style={{ color:'var(--text2)', lineHeight:1.6 }}>{v}</span></div>;
}
function MR({ k, v }: { k:string; v:string }) {
  return <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span style={{ color:'var(--text3)', fontFamily:'var(--mono)', fontSize:11 }}>{k}</span><span style={{ fontWeight:600, fontFamily:'var(--mono)', fontSize:11 }}>{v}</span></div>;
}
function TH({ children }: { children: React.ReactNode }) { return <th style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5 }}>{children}</th>; }
function TD({ children, m, b, style }: { children: React.ReactNode; m?:boolean; b?:boolean; style?:React.CSSProperties }) { return <td style={{ padding:'8px 10px', fontFamily:m?'var(--mono)':'inherit', fontWeight:b?700:400, ...style }}>{children}</td>; }