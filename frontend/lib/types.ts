// ALE v8.2 Frontend Type Definitions

export type SessionPhase = 'pre_test' | 'learning_reading' | 'learning_tutoring' | 'post_test' | 'completed';
export type SessionMode = 'reading' | 'tutoring';

export interface ChecklistItem {
  id: string;
  label: string;
  done?: boolean;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface TestItem {
  item_id: string;
  item_type: 'mcq' | 'short_answer';
  question: string;
  options?: string[];
  correct?: string;
  rubric?: Record<string, unknown>;
  bloom_level?: string;
}

export interface TestResponse {
  item_id: string;
  response: string;
  elapsed_sec?: number;
}

export interface Gate {
  gate_a: boolean;
  gate_a_bkt: boolean;
  gate_a_moving: boolean;
  gate_b: boolean;
  completed: boolean;
}

export interface ConnectedNode {
  id: string;
  label: string;
  direction?: string;
  score?: number;
}

// ── API Response types ──

export interface StartSessionResponse {
  session_id: string;
  mode: SessionMode;
  status: SessionPhase;
  first_message: string;
  checklist_items: ChecklistItem[];
  connected_nodes: ConnectedNode[];
  pre_test_items: TestItem[];
}

export interface AnswerResponse {
  turn: number;
  score: number;
  brief: string;
  moving_avg: number;
  trend: number;
  struggle: string;
  checklist: Record<string, string>;
  confirmed_count: number;
  total_items: number;
  tutor_message: string;
  bkt_mastery: number;
  gate: Gate;
  score_history: number[];
  usage: Record<string, unknown>;
  next_nodes: ConnectedNode[];
}

export interface LearningReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  bloom_analysis: string;
  gain_interpretation: string;
}

export interface SubmitTestResponse {
  test_phase: string;
  scores: Array<{ item_id: string; auto_score: number; bloom: string }>;
  phase_score: number;
  phase_bloom: string;
  next_status: SessionPhase;
  first_message?: string;
  checklist_items?: ChecklistItem[];
  content_url?: string;
  gain?: number;
  report?: LearningReport | null;
}

export interface ReadingContentResponse {
  node_id: string;
  markdown: string;
  mermaid_diagrams: string[];
  video_urls: string[];
  min_reading_sec: number;
}

export interface ReadingCompleteResponse {
  allowed: boolean;
  next_status?: string;
  post_test_items?: TestItem[];
  elapsed_sec?: number;
  required_sec?: number;
}

export interface RestoreResponse {
  session_id: string;
  node_id: string;
  conversation: Message[];
  checklist_items: ChecklistItem[];
  score_history: number[];
  status?: string;          // v8.2: completed 여부 판별
  has_report?: boolean;     // v8.2: 보고서 존재 여부
  pre_score?: number;       // v8.2
  post_score?: number;      // v8.2
  last_state: {
    moving_avg: number;
    trend: number;
    checklist_state: Record<string, string> | null;
    turn: number;
    mastery: number;
  } | null;
}

export interface KGNode {
  id: string;
  label: string;
  category?: string;
  depth?: number;
  progress?: {
    completion: number;
    status: string;
    turns: number;
    moving_avg: number;
  };
}

export interface KGResponse {
  nodes: KGNode[];
  edges: Array<{ source: string; target: string }>;
  description?: string;
}

export interface SessionListItem {
  id: string;
  node_id: string;
  mode?: SessionMode;
  status: string;
  total_turns: number;
  completed: number;
  created_at: string;
  updated_at: string;
  pre_score?: number | null;
  post_score?: number | null;
}

export interface WikiDocResponse {
  label: string;
  content: string;
  related: Array<{ id: string; label: string }>;
}

// v8.2: wiki-list 확장
export interface WikiListItem {
  id: string;
  label: string;
  category?: string;
  related?: string[];
}

export interface NoteResponse {
  weak_points: Array<{ concept: string; correct: string; learner_said: string; tip: string }>;
  vocabulary: Array<{ term: string; definition: string; learner_confused: string }>;
  strengths: string;
  next_focus: string;
  personal_memo?: string;
}

// v8.2: test debug log
export interface TestDebugLog {
  id: string;
  session_id: string;
  test_phase: string;
  item_id: string;
  timestamp: number;
  item_type?: string;
  question?: string;
  learner_response?: string;
  correct_answer?: string;
  llm_raw_response?: string;
  extraction_result?: string;
  extraction_error?: string;
  auto_score?: number;
  matched_count?: number;
  total_count?: number;
  matched_keys?: string;
  bloom_level?: string;
  scoring_method?: string;
  elapsed_ms?: number;
  error?: string;
}

// v8.2: cost response
export interface CostResponse {
  total_cost: number;
  session_costs: Array<{ session_id: string; cost: number }>;
}

// v8.2: notes list (for icon display)
export interface NoteListItem {
  node_id: string;
  has_note: boolean;
}
