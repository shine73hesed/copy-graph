// frontend/app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──
interface OverviewData {
  total_learners: number; new_this_week: number; total_sessions: number;
  completed_sessions: number; total_learning_sec: number; total_learning_display: string;
  avg_per_learner: string; total_cost_usd: number; total_input_tokens: number; total_output_tokens: number;
}
interface LearnerRow {
  learner_id: string; username: string; created_at: number; completed_nodes: number;
  total_nodes: number; total_learning_sec: number; total_learning_display: string;
  last_activity: number | null; last_activity_display: string;
}
interface NodeProgress { node_id: string; label: string; status: "completed"|"in_progress"|"not_started"; progress: number; }
interface SessionRow {
  id: string; node_id: string; node_label: string; mode: string; status: string; completed: boolean;
  pre_score: number|null; post_score: number|null; gain: number|null;
  total_turns: number; learning_duration_sec: number|null; learning_display: string;
  created_at: number; checklist_done: number; checklist_total: number;
}
interface LearnerDetail {
  learner_id: string; username: string;
  kpi: { total_learning_sec: number; total_learning_display: string; completed_nodes: number; total_nodes: number; total_sessions: number; completed_sessions: number; active_sessions: number; };
  node_progress: NodeProgress[]; sessions: SessionRow[];
}
interface ChecklistItem { id: string; label: string; status: string; }
interface TurnScore { turn: number; score: number|null; moving_avg: number|null; }
interface ConvMsg { role: string; content: string; turn: number; }
interface TestResponseItem {
  item_id: string; question: string; item_type: string; bloom_level: string;
  correct: string|null; options: string[]|null; response: string;
  auto_score: number|null; matched_count: number|null; total_count: number|null;
}
interface SessionDetail {
  session: { id: string; node_id: string; node_label: string; mode: string; status: string; completed: boolean; total_turns: number; learning_duration_sec: number|null; };
  checklist: ChecklistItem[]; turn_scores: TurnScore[]; conversation: ConvMsg[];
  cost: { total_cost_usd: number; input_tokens: number; output_tokens: number };
  reading_events: Array<{ event_type: string; event_data: string; timestamp: number }>;
  test_responses: { pre_test: TestResponseItem[]; post_test: TestResponseItem[] };
}
interface ModeStatEntry { session_count: number; avg_gain: number; avg_duration_sec: number; avg_duration_display: string; avg_turns: number|null; completed_nodes: number; completion_rate: number; }
interface ModeStats { [mode: string]: ModeStatEntry; }
interface ModeComparison {
  scope: string; learner_id: string|null; mode_stats: ModeStats;
  by_node: Array<{ node_id: string; label: string; reading_gain?: number; tutoring_gain?: number }>;
  learner_sessions: Array<{ session_id: string; node_id: string; node_label: string; mode: string; completed: boolean; gain: number|null; checklist_done: number; checklist_total: number; learning_display: string; }>;
}
interface BloomRow { bloom: string; bloom_kr: string; reading_gain: number|null; tutoring_gain: number|null; diff: number|null; }

// ── API ──
const API = <T,>(path: string): Promise<T> =>
  fetch(path.replace("/admin/", "/api/admin/"), { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });

// ── Styles ──
const S = {
  page: { minHeight: "100vh", background: "var(--bg)", padding: "32px 40px", fontFamily: "var(--sans)" } as const,
  tabs: { display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 28 } as const,
  tab: (a: boolean) => ({ padding: "10px 22px", fontSize: 14, fontWeight: a?700:500, cursor: "pointer", borderBottom: a?"2px solid var(--primary)":"2px solid transparent", color: a?"var(--text)":"var(--text2)", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none", transition: "all 0.15s" }),
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 } as const,
  kpi: { background: "var(--white)", borderRadius: 16, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" } as const,
  kpiLabel: { fontSize: 12, color: "var(--text3)", fontWeight: 600, marginBottom: 4, letterSpacing: 0.3 } as const,
  kpiVal: { fontSize: 26, fontWeight: 800 } as const,
  kpiSub: { fontSize: 11, color: "var(--text3)", marginTop: 3 } as const,
  secTitle: { fontSize: 16, fontWeight: 700, margin: "24px 0 12px", color: "var(--text)" } as const,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", color: "var(--text3)", fontWeight: 600, fontSize: 11, borderBottom: "1px solid var(--border)", letterSpacing: 0.3, textTransform: "uppercase" as const },
  td: { padding: "10px 12px", borderBottom: "1px solid var(--border)" } as const,
  clickRow: { cursor: "pointer", transition: "background 0.1s" } as const,
  badge: (type: string) => {
    const m: Record<string,{bg:string;color:string}> = { tutoring:{bg:"var(--violet-bg)",color:"var(--violet)"}, reading:{bg:"#ecfdf5",color:"#059669"}, completed:{bg:"var(--teal-bg)",color:"var(--teal)"}, active:{bg:"var(--yellow-bg)",color:"#b45309"} };
    const c = m[type]||{bg:"var(--bg)",color:"var(--text3)"}; return { display:"inline-block",padding:"2px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:c.bg,color:c.color };
  },
  card: { background: "var(--white)", borderRadius: 20, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" } as const,
};
function fmtDate(ts: number|null) { if(!ts) return "—"; const d=new Date(ts*1000); return `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmtTokens(n: number) { return n>=1000?`${(n/1000).toFixed(1)}K`:String(n); }
function fmtScore(v: number|null) { return v!=null?`${Math.round(v*100)}`:"—"; }

// ═══ Main ═══
export default function AdminDashboard() {
  const [tab, setTab] = useState(0);
  const [overview, setOverview] = useState<OverviewData|null>(null);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [selectedLearner, setSelectedLearner] = useState("");
  const [learnerDetail, setLearnerDetail] = useState<LearnerDetail|null>(null);
  const [expandedSession, setExpandedSession] = useState("");
  const [sessionDetail, setSessionDetail] = useState<SessionDetail|null>(null);
  const [modeData, setModeData] = useState<ModeComparison|null>(null);
  const [bloomData, setBloomData] = useState<BloomRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API<OverviewData>("/admin/dashboard/overview"),
      API<{learners:LearnerRow[]}>("/admin/dashboard/learners"),
    ]).then(([ov,lr]) => {
      setOverview(ov); setLearners(lr.learners);
      if(lr.learners.length>0&&!selectedLearner) setSelectedLearner(lr.learners[0].learner_id);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  const loadLearner = useCallback(async (lid: string) => {
    if(!lid) return;
    const [detail,mc,bl] = await Promise.all([
      API<LearnerDetail>(`/admin/dashboard/learner/${lid}`),
      API<ModeComparison>(`/admin/dashboard/mode-comparison?learner_id=${lid}`),
      API<{by_bloom:BloomRow[]}>(`/admin/dashboard/bloom-comparison?learner_id=${lid}`),
    ]);
    setLearnerDetail(detail); setModeData(mc); setBloomData(bl.by_bloom);
    setExpandedSession(""); setSessionDetail(null);
  }, []);

  useEffect(() => { if(tab===1&&selectedLearner) loadLearner(selectedLearner); }, [tab,selectedLearner,loadLearner]);

  const toggleSession = async (sid: string) => {
    if(expandedSession===sid){setExpandedSession("");setSessionDetail(null);return;}
    setExpandedSession(sid);
    setSessionDetail(await API<SessionDetail>(`/admin/dashboard/session/${sid}/detail`));
  };
  const goToLearner = (lid: string) => { setSelectedLearner(lid); setTab(1); };

  if(loading) return (
    <div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:40,height:40,border:"3px solid var(--border)",borderTopColor:"var(--primary)",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontSize:14,color:"var(--text3)"}}>로딩 중...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:36,height:36,background:"var(--primary)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span className="material-symbols-outlined" style={{color:"white",fontSize:20}}>monitoring</span>
        </div>
        <div><div style={{fontSize:20,fontWeight:800}}>관리자 대시보드</div><div style={{fontSize:11,color:"var(--text3)"}}>학습자 추적 · 모드 비교</div></div>
        <a href="/dashboard" style={{marginLeft:"auto",fontSize:12,color:"var(--text3)",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span>학습자 화면
        </a>
      </div>

      {/* Tabs — 2탭 */}
      <div style={S.tabs}>
        {["전체 현황","학습자별 상세"].map((l,i) => <button key={i} style={S.tab(tab===i)} onClick={()=>setTab(i)}>{l}</button>)}
      </div>

      {/* ═══ 탭 ① 전체 현황 ═══ */}
      {tab===0&&overview&&(
        <div>
          <div style={S.kpiGrid}>
            <KpiCard label="총 학습자" value={String(overview.total_learners)} sub={`이번 주 +${overview.new_this_week}`}/>
            <KpiCard label="완료 세션" value={`${overview.completed_sessions}`} sub={`전체 ${overview.total_sessions} 중`}/>
            <KpiCard label="총 학습 시간" value={overview.total_learning_display} sub={`평균 ${overview.avg_per_learner} / 인`}/>
            <KpiCard label="총 API 비용" value={`$${overview.total_cost_usd.toFixed(2)}`} sub={`${fmtTokens(overview.total_input_tokens+overview.total_output_tokens)} tokens`}/>
          </div>
          <div style={S.secTitle}>학습자 목록</div>
          <div style={S.card}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>학습자</th><th style={S.th}>가입일</th><th style={S.th}>완료 노드</th><th style={S.th}>총 학습 시간</th><th style={S.th}>마지막 활동</th><th style={{...S.th,width:30}}></th></tr></thead>
              <tbody>
                {learners.map(l=>(
                  <tr key={l.learner_id} style={S.clickRow} onClick={()=>goToLearner(l.learner_id)}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--bg)"}} onMouseLeave={e=>{e.currentTarget.style.background=""}}>
                    <td style={{...S.td,fontWeight:700}}>{l.username}</td><td style={S.td}>{fmtDate(l.created_at)}</td>
                    <td style={S.td}>{l.completed_nodes}/{l.total_nodes}</td><td style={S.td}>{l.total_learning_display}</td>
                    <td style={S.td}>{l.last_activity_display}</td><td style={{...S.td,color:"var(--text3)",fontSize:16}}>›</td>
                  </tr>
                ))}
                {learners.length===0&&<tr><td colSpan={6} style={{...S.td,textAlign:"center",color:"var(--text3)",padding:40}}>등록된 학습자가 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ 탭 ② 학습자별 상세 + 모드 통계 ═══ */}
      {tab===1&&(
        <div>
          {/* 학습자 선택 */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <span style={{fontSize:13,color:"var(--text3)",fontWeight:600}}>학습자</span>
            <select value={selectedLearner} onChange={e=>setSelectedLearner(e.target.value)}
              style={{padding:"6px 14px",fontSize:13,fontWeight:600,border:"1px solid var(--border)",borderRadius:10,background:"var(--white)",color:"var(--text)",fontFamily:"var(--sans)"}}>
              {learners.map(l=><option key={l.learner_id} value={l.learner_id}>{l.username}</option>)}
            </select>
            <button onClick={()=>setTab(0)} style={{marginLeft:"auto",fontSize:12,padding:"5px 14px",border:"1px solid var(--border)",borderRadius:10,background:"var(--white)",cursor:"pointer",color:"var(--text2)",fontFamily:"var(--sans)"}}>‹ 목록으로</button>
          </div>

          {learnerDetail&&(<>
            {/* KPI */}
            <div style={{...S.kpiGrid,gridTemplateColumns:"repeat(3,1fr)"}}>
              <KpiCard label="총 학습 시간" value={learnerDetail.kpi.total_learning_display}/>
              <KpiCard label="완료 노드" value={`${learnerDetail.kpi.completed_nodes}/${learnerDetail.kpi.total_nodes}`}/>
              <KpiCard label="총 세션" value={String(learnerDetail.kpi.total_sessions)} sub={`완료 ${learnerDetail.kpi.completed_sessions} · 진행 ${learnerDetail.kpi.active_sessions}`}/>
            </div>

            {/* 노드별 진도 */}
            <div style={S.secTitle}>노드별 진도</div>
            <div style={{...S.card,padding:"16px 24px"}}>
              {learnerDetail.node_progress.map(n=>(
                <div key={n.node_id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:13,fontWeight:700,width:100,flexShrink:0}}>{n.label}</span>
                  <div style={{flex:1,height:20,background:"var(--bg)",borderRadius:6,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:6,transition:"width 0.4s",width:`${n.progress}%`,
                      background:n.status==="completed"?"var(--teal)":n.status==="in_progress"?"#fbbf24":"transparent"}}/>
                  </div>
                  <span style={{width:60,textAlign:"right",flexShrink:0}}>
                    {n.status==="completed"&&<span style={S.badge("completed")}>완료</span>}
                    {n.status==="in_progress"&&<span style={S.badge("active")}>학습 중</span>}
                    {n.status==="not_started"&&<span style={{fontSize:12,color:"var(--text3)"}}>미시작</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* 세션 이력 — Pre/Post/Gain 포함 */}
            <div style={S.secTitle}>세션 이력</div>
            <div style={S.card}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>과목</th><th style={S.th}>모드</th><th style={S.th}>상태</th>
                  <th style={S.th}>Pre</th><th style={S.th}>Post</th><th style={S.th}>Gain</th>
                  <th style={S.th}>체크리스트</th><th style={S.th}>턴</th><th style={S.th}>시간</th><th style={S.th}>날짜</th>
                </tr></thead>
                <tbody>
                  {learnerDetail.sessions.map(s=>(
                    <SessionRowBlock key={s.id} session={s} isExpanded={expandedSession===s.id}
                      detail={expandedSession===s.id?sessionDetail:null} onToggle={()=>toggleSession(s.id)}/>
                  ))}
                  {learnerDetail.sessions.length===0&&<tr><td colSpan={10} style={{...S.td,textAlign:"center",color:"var(--text3)",padding:40}}>세션 없음</td></tr>}
                </tbody>
              </table>
            </div>

            {/* ═══ 모드 통계 (통합) ═══ */}
            {modeData&&(<>
              <div style={S.secTitle}>모드 통계</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                <ModeCard mode="reading" stats={modeData.mode_stats["reading"]}/>
                <ModeCard mode="tutoring" stats={modeData.mode_stats["tutoring"]} accent/>
              </div>
              {modeData.mode_stats["reading"]&&modeData.mode_stats["tutoring"]&&(
                <div style={{background:"var(--teal-bg)",borderRadius:14,padding:"12px 18px",marginBottom:20,fontSize:13,color:"#065f46"}}>
                  <span style={{fontWeight:700}}>Tutoring 우위: </span>
                  gain <span style={{fontWeight:700}}>+{(modeData.mode_stats["tutoring"].avg_gain-modeData.mode_stats["reading"].avg_gain).toFixed(2)}</span>,
                  완료율 <span style={{fontWeight:700}}>+{modeData.mode_stats["tutoring"].completion_rate-modeData.mode_stats["reading"].completion_rate}%p</span> 높음
                </div>
              )}

              {/* 과목별 gain */}
              {modeData.by_node.length>0&&(<>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>과목별 gain 비교</div>
                <div style={{...S.card,padding:"16px 24px",marginBottom:20}}>
                  <Legend/>
                  {modeData.by_node.map(n=>(
                    <div key={n.node_id} style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{n.label}</div>
                      <GainBar label="R" value={n.reading_gain} color="#34d399" max={0.5}/>
                      <GainBar label="T" value={n.tutoring_gain} color="var(--violet)" max={0.5}/>
                    </div>
                  ))}
                </div>
              </>)}

              {/* Bloom 레벨별 gain */}
              {bloomData.length>0&&(<>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Bloom 레벨별 gain 비교</div>
                <div style={{...S.card,padding:"16px 24px"}}>
                  <Legend/>
                  {bloomData.map(b=>(
                    <div key={b.bloom} style={{marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:12,fontWeight:700,width:40}}>{b.bloom_kr}</span>
                        <div style={{flex:1}}>
                          <GainBar label="R" value={b.reading_gain} color="#34d399" max={0.4}/>
                          <GainBar label="T" value={b.tutoring_gain} color="var(--violet)" max={0.4}/>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,width:50,textAlign:"right",color:b.diff!=null&&b.diff>0.1?"#059669":"var(--text3)"}}>
                          {b.diff!=null?`+${b.diff.toFixed(2)}`:"—"}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{background:"var(--bg)",borderRadius:12,padding:"10px 16px",marginTop:12,fontSize:12,color:"var(--text2)"}}>
                    <span style={{fontWeight:700}}>핵심: </span>상위 Bloom(적용·분석)에서 Tutoring 우위 뚜렷 — 하위(기억)에선 차이 미미
                  </div>
                </div>
              </>)}
            </>)}
          </>)}
        </div>
      )}
    </div>
  );
}

// ═══ Sub Components ═══
function KpiCard({label,value,sub}:{label:string;value:string;sub?:string}) {
  return <div style={S.kpi}><div style={S.kpiLabel}>{label}</div><div style={S.kpiVal}>{value}</div>{sub&&<div style={S.kpiSub}>{sub}</div>}</div>;
}
function Legend() {
  return (
    <div style={{display:"flex",gap:16,marginBottom:12,fontSize:12}}>
      <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:3,background:"#34d399"}}/> Reading</span>
      <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:3,background:"var(--violet)"}}/> Tutoring</span>
    </div>
  );
}
function ModeCard({mode,stats,accent}:{mode:string;stats?:ModeStatEntry;accent?:boolean}) {
  if(!stats) return <div style={{...S.card,opacity:0.5,padding:"20px 24px"}}><div style={{fontSize:14,fontWeight:700,color:"var(--text3)"}}>{mode==="reading"?"Reading":"Tutoring"}</div><div style={{fontSize:13,color:"var(--text3)",marginTop:8}}>데이터 없음</div></div>;
  const isT=mode==="tutoring";
  return (
    <div style={{...S.card,padding:"20px 24px",border:accent?"1.5px solid var(--violet)":"1px solid var(--border)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{width:10,height:10,borderRadius:"50%",background:isT?"var(--violet)":"#34d399"}}/><span style={{fontSize:14,fontWeight:700}}>{isT?"Tutoring":"Reading"}</span>
        <span style={{fontSize:12,color:"var(--text3)",marginLeft:"auto"}}>{stats.session_count} 세션</span>
      </div>
      <StatRow label="평균 gain" value={`+${stats.avg_gain.toFixed(2)}`} highlight/>
      <StatRow label="평균 학습 시간" value={stats.avg_duration_display}/>
      <StatRow label="완료 노드 비율" value={`${stats.completion_rate}%`}/>
      {isT&&stats.avg_turns!=null&&<StatRow label="평균 턴 수" value={stats.avg_turns.toFixed(1)}/>}
    </div>
  );
}
function StatRow({label,value,highlight}:{label:string;value:string;highlight?:boolean}) {
  return <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13,borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--text2)"}}>{label}</span><span style={{fontWeight:700,color:highlight?"#059669":"var(--text)"}}>{value}</span></div>;
}
function GainBar({label,value,color,max}:{label:string;value?:number|null;color:string;max:number}) {
  const pct=value!=null?Math.min((value/max)*100,100):0;
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
      <span style={{fontSize:10,color:"var(--text3)",width:12,fontWeight:600}}>{label}</span>
      <div style={{flex:1,height:14,background:"var(--bg)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:4,transition:"width 0.4s"}}/></div>
      <span style={{fontSize:11,fontWeight:600,width:36,textAlign:"right",color:value!=null?"var(--text)":"var(--text3)"}}>{value!=null?value.toFixed(2):"—"}</span>
    </div>
  );
}
function SessionRowBlock({session:s,isExpanded,detail,onToggle}:{session:SessionRow;isExpanded:boolean;detail:SessionDetail|null;onToggle:()=>void}) {
  return (<>
    <tr style={S.clickRow} onClick={onToggle}
      onMouseEnter={e=>{e.currentTarget.style.background="var(--bg)"}} onMouseLeave={e=>{e.currentTarget.style.background=""}}>
      <td style={S.td}>{s.node_label}</td>
      <td style={S.td}><span style={S.badge(s.mode)}>{s.mode}</span></td>
      <td style={S.td}><span style={S.badge(s.completed?"completed":"active")}>{s.completed?"완료":"학습 중"}</span></td>
      <td style={{...S.td,fontFamily:"var(--mono)",fontSize:12}}>{fmtScore(s.pre_score)}</td>
      <td style={{...S.td,fontFamily:"var(--mono)",fontSize:12}}>{fmtScore(s.post_score)}</td>
      <td style={{...S.td,fontFamily:"var(--mono)",fontSize:12,fontWeight:700,
        color:s.gain!=null?(s.gain>0?"#059669":s.gain<0?"var(--rose)":"var(--text3)"):"var(--text3)"}}>
        {s.gain!=null?`${s.gain>0?"+":""}${Math.round(s.gain*100)}`:"—"}
      </td>
      <td style={S.td}>{s.checklist_total>0?`${s.checklist_done}/${s.checklist_total}`:"—"}</td>
      <td style={S.td}>{s.mode==="reading"?"—":s.total_turns||"—"}</td>
      <td style={S.td}>{s.learning_display}</td>
      <td style={S.td}>{fmtDate(s.created_at)}</td>
    </tr>
    {isExpanded&&<tr><td colSpan={10} style={{padding:0,border:"none"}}><SessionExpandPanel detail={detail} mode={s.mode}/></td></tr>}
  </>);
}
function SessionExpandPanel({detail,mode}:{detail:SessionDetail|null;mode:string}) {
  if(!detail) return <div style={{padding:"24px 16px",textAlign:"center",color:"var(--text3)",fontSize:13}}>로딩 중...</div>;
  if(mode==="reading") {
    const ev=detail.reading_events; const hasTR=detail.test_responses.pre_test.length>0||detail.test_responses.post_test.length>0;
    return (
      <div style={{background:"var(--bg)",borderRadius:16,padding:"16px 20px",margin:"4px 12px 12px"}}>
        <div style={{fontSize:13,color:"var(--text2)"}}>Reading 모드 — 행동 로그 {ev.length}건
          {ev.length>0&&<span style={{color:"var(--text3)",marginLeft:8}}>(스크롤 {ev.filter(e=>e.event_type==="scroll").length}회, 다이어그램 확장 {ev.filter(e=>e.event_type==="diagram_expand").length}회)</span>}
        </div>
        {hasTR&&<TestResponsesBlock testResponses={detail.test_responses}/>}
      </div>
    );
  }
  return (
    <div style={{background:"var(--bg)",borderRadius:16,padding:"16px 20px",margin:"4px 12px 12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>체크리스트</div>
          {detail.checklist.map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",fontSize:13}}>
              <span style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,
                background:c.status==="confirmed"?"var(--teal-bg)":"var(--border)",color:c.status==="confirmed"?"var(--teal)":"var(--text3)"}}>
                {c.status==="confirmed"?"✓":"·"}
              </span>
              <span style={{color:c.status==="confirmed"?"var(--text)":"var(--text3)"}}>{c.id}: {c.label}</span>
            </div>
          ))}
          {detail.checklist.length===0&&<div style={{fontSize:12,color:"var(--text3)"}}>체크리스트 없음</div>}
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>턴별 moving avg</div>
          {detail.turn_scores.length>0?(
            <div style={{display:"flex",alignItems:"flex-end",gap:3,height:100}}>
              {detail.turn_scores.map(t=>{const h=(t.moving_avg??t.score??0)*100;return(
                <div key={t.turn} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:"100%",maxWidth:20,height:h,background:"var(--violet)",borderRadius:"3px 3px 0 0",opacity:0.7+(h/300)}}/>
                  <span style={{fontSize:9,color:"var(--text3)",marginTop:2}}>{t.turn}</span>
                </div>
              );})}
            </div>
          ):<div style={{fontSize:12,color:"var(--text3)"}}>점수 데이터 없음</div>}
        </div>
      </div>
      {(detail.test_responses.pre_test.length>0||detail.test_responses.post_test.length>0)&&<TestResponsesBlock testResponses={detail.test_responses}/>}
      {detail.conversation.length>0&&(
        <div style={{marginTop:16}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>대화 미리보기 <span style={{fontWeight:400,color:"var(--text3)"}}>({detail.conversation.length}개 중 최초 6개)</span></div>
          {detail.conversation.slice(0,6).map((m,i)=>(
            <div key={i} style={{padding:"8px 12px",borderRadius:12,marginBottom:6,fontSize:13,lineHeight:1.6,maxWidth:"85%",whiteSpace:"pre-wrap" as const,wordBreak:"break-word" as const,
              ...(m.role==="user"?{background:"var(--violet-bg)",marginLeft:"auto"}:{background:"var(--white)",border:"1px solid var(--border)"})}}>
              {m.content.length>200?m.content.slice(0,200)+"...":m.content}
            </div>
          ))}
        </div>
      )}
      <div style={{marginTop:12,display:"flex",gap:16,fontSize:11,color:"var(--text3)"}}>
        <span>비용 ${detail.cost.total_cost_usd.toFixed(2)}</span><span>입력 {fmtTokens(detail.cost.input_tokens)}</span><span>출력 {fmtTokens(detail.cost.output_tokens)}</span>
      </div>
    </div>
  );
}
const BLOOM_KR: Record<string,string>={remember:"기억",understand:"이해",apply:"적용",analyze:"분석",evaluate:"평가",create:"창조"};
function TestResponsesBlock({testResponses}:{testResponses:{pre_test:TestResponseItem[];post_test:TestResponseItem[]}}) {
  return (
    <div style={{marginTop:16}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>사전·사후 테스트 문항 비교</div>
      {(["pre_test","post_test"] as const).map(phase=>{
        const items=testResponses[phase]; if(items.length===0) return null;
        const phaseLabel=phase==="pre_test"?"사전 (Pre)":"사후 (Post)";
        const avg=items.length>0?items.reduce((s,it)=>s+(it.auto_score??0),0)/items.length:0;
        return (
          <div key={phase} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:8,
                background:phase==="pre_test"?"var(--blue-bg)":"var(--teal-bg)",color:phase==="pre_test"?"var(--blue)":"var(--teal)"}}>{phaseLabel}</span>
              <span style={{fontSize:12,color:"var(--text3)"}}>평균 {(avg*100).toFixed(0)}점 · {items.length}문항</span>
            </div>
            <div style={{background:"var(--white)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
              {items.map((it,idx)=>{const sc=it.auto_score!=null?Math.round(it.auto_score*100):null;return(
                <div key={it.item_id} style={{padding:"10px 14px",borderBottom:idx<items.length-1?"1px solid var(--border)":"none"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4}}>
                    <span style={{fontSize:11,color:"var(--text3)",fontWeight:600,flexShrink:0,marginTop:1}}>Q{idx+1}</span>
                    <span style={{fontSize:12,fontWeight:600,flex:1}}>{it.question}</span>
                    <span style={{flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                      {it.bloom_level&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:6,background:"var(--violet-bg)",color:"var(--violet)",fontWeight:600}}>{BLOOM_KR[it.bloom_level]||it.bloom_level}</span>}
                      {sc!=null&&<span style={{fontSize:12,fontWeight:700,color:sc>=80?"var(--teal)":sc>=50?"#b45309":"var(--rose)"}}>{sc}점</span>}
                    </span>
                  </div>
                  {it.response&&<div style={{fontSize:12,color:"var(--text2)",marginLeft:24,padding:"6px 10px",background:"var(--bg)",borderRadius:8,lineHeight:1.6,whiteSpace:"pre-wrap" as const,wordBreak:"break-word" as const}}><span style={{fontSize:10,color:"var(--text3)",fontWeight:600}}>응답: </span>{it.response}</div>}
                  {it.item_type==="mcq"&&it.correct&&<div style={{fontSize:11,color:"var(--text3)",marginLeft:24,marginTop:3}}>정답: {it.correct}</div>}
                  {it.matched_count!=null&&it.total_count!=null&&<div style={{fontSize:11,color:"var(--text3)",marginLeft:24,marginTop:3}}>개념 매칭: {it.matched_count}/{it.total_count}</div>}
                </div>
              );})}
            </div>
          </div>
        );
      })}
    </div>
  );
}