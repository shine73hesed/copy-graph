# ALE v8 — 평가 프레임워크 (Evaluation Framework)

> **버전**: v8.0  
> **작성일**: 2026-03-30  
> **목적**: 기존 교수법(동영상/텍스트)과 ALE Socratic 대화의 학습 효과를 비교 검증하기 위한 평가 방법론 수립

---

## 1. 연구 배경

### 1.1 문제 정의

한국 치매 간호 교육의 3가지 구조적 문제:

1. **이론-실무 격차**: 교육이 이론 중심으로 편중, 임상 추론 훈련 부재. 한국 치매 간호 교육은 이론 위주로 환자에 대한 이해와 공감 형성에 한계 (참조: Perceptions of Dementia among Nursing Students in South Korea, 2024)
2. **수동적 학습**: 전통 강의/동영상은 학습자가 정보를 일방향으로 수용. STEM 메타분석에서 강의 수업 학생의 낙제율이 능동 학습 대비 1.5배 (참조: Freeman et al., 2014)
3. **평가 도구의 인지 수준 편향**: 기존 MCQ 시험의 약 77%가 Bloom의 Remember/Understand 수준만 측정, Apply/Analyze는 포착 안 됨 (참조: Frontiers in Education, 2025)

### 1.2 기존 해결 시도와 한계

| 방법 | 효과 | 한계 |
|------|------|------|
| Flipped Classroom | 능동 학습 촉진 | 교수자 필수, 소규모만 가능 |
| 시뮬레이션 (High-fidelity) | 임상 추론 훈련 | 고비용, 장비/공간 필요, 확장 불가 |
| PBL (문제기반학습) | 사례 적용 | 교수자 퍼실리테이션 필요, 개인 피드백 불가 |
| IGNITE (한국, 2024) | 태도/지식 향상 | 집합교육 필수, 확장성 제한 |

공통 한계: 확장 불가, 개인화 불가, 즉각적 피드백 없음, Bloom 하위 수준 평가에 머묾.

### 1.3 ALE의 접근

ALE = Socratic AI 튜터링으로 1:1 적응형 임상 추론 훈련을 확장 가능하게 제공.

핵심 차별점:
- 동일 콘텐츠 위에 Socratic 대화가 얹혀지는 구조 → 순수하게 **상호작용의 부가 효과** 측정 가능
- 학습자가 답변을 직접 구성하도록 강제 → cognitive offloading 방지 (단, 스캐폴딩 의존성 위험 존재 — 아래 "알려진 위험" 참조)
- 체크리스트 기반으로 개별 개념 습득 추적

---

## 2. 실험 설계

### 2.1 연구 질문

**RQ1**: 동일 콘텐츠에 Socratic AI 대화를 추가하면, 학습 성과(gain)가 유의미하게 높아지는가?

**RQ2**: 그 효과는 Bloom의 어떤 인지 수준(Remember/Understand/Apply/Analyze)에서 나타나는가?

**RQ3**: 임상 적용 능력(사례 기반 추론)에서 두 조건 간 차이가 있는가?

**RQ4**: 학습 효율성(gain per minute)에 차이가 있는가?

### 2.2 설계: Within-subjects Crossover

```
Group A: 노드1(Reading) → washout 1주 → 노드2(Tutoring)
Group B: 노드1(Tutoring) → washout 1주 → 노드2(Reading)
```

- 동일 피험자가 두 조건을 모두 경험 → 개인 차이 통제
- 적은 표본(N=20~30)으로 통계적 검정력 확보
- 학습 순서 효과를 무작위 배정으로 통제

### 2.3 조건 비교

```
조건 A (통제 — Reading):
  콘텐츠(텍스트 + 동영상) → 자율 학습 → Post-test

조건 B (실험 — Tutoring):
  콘텐츠(텍스트 + 동영상) + Socratic 대화 → Post-test

차이: 대화 유무 하나만. 플랫폼/콘텐츠/평가도구 전부 동일.
```

---

## 3. 평가 프레임워크 — 4단계

### 3.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    ALE v8 평가 프레임워크                      │
│                                                              │
│  Stage 1: Pre-Assessment (사전 평가)                          │
│    → Bloom별 문항으로 기존 수준 측정                            │
│    → MCQ(Remember/Understand) + 서술형(Apply)                 │
│    → pre_score 산출 → 시작점 조정 (Tutoring 모드)              │
│                                                              │
│  Stage 2: Learning (학습)                                     │
│    [Mode A: Reading]        [Mode B: Tutoring]                │
│    • 동일 콘텐츠 자율 읽기    • 동일 콘텐츠 + Socratic 대화      │
│    • 행동 로그 수집           • 턴별 score + bloom + checklist  │
│    • 최소 시간 후 완료        • [TOPIC_COMPLETE] 시 완료         │
│                                                              │
│  Stage 3: Post-Assessment (사후 평가)                         │
│    → 독립 환경 (튜터 없음)에서 동형검사 응답                     │
│    → MCQ(Remember/Understand) + 사례 서술형(Apply/Analyze)     │
│    → 임상 적용 루브릭 (Level 1~5) 적용                         │
│    → post_score 산출 → gain = post - pre                      │
│                                                              │
│  Stage 4: Retention Check (유지 평가)                         │
│    → 1일 → 3일 → 7일 → 14일 → 30일 (SM-2 변형)               │
│    → 2~3문항 핵심 퀴즈                                        │
│    → 정답률에 따라 간격 조정                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Stage 1: Pre-Assessment

#### 목적
학습 전 기존 지식 수준을 측정하여 (1) gain 계산의 baseline, (2) Tutoring 모드 시작점 조정.

#### 문항 구성 (노드당)

| # | Bloom 수준 | 유형 | 예시 (치매 개요) |
|---|-----------|------|----------------|
| Q1 | Remember | MCQ | "치매의 가장 정확한 정의는?" |
| Q2 | Understand | MCQ | "치매와 건망증의 핵심 차이를 고른다면?" |
| Q3 | Apply | 서술형 | "73세 할머니가 약을 자꾸 잊습니다. 치매인지 건망증인지 어떻게 구분하시겠어요?" |

#### pre_score 산출

```
pre_score = Σ(item_score × item_weight) / Σ(item_weight)

가중치:
  Remember: 1.0
  Understand: 1.5
  Apply: 2.0
  Analyze: 2.5
```

#### 시작점 조정 (Tutoring 모드만)

| pre_score 범위 | 시작 전략 | 튜터 프롬프트 힌트 |
|---------------|----------|-----------------|
| 0.0 ~ 0.2 | 기초부터 | "사례를 먼저 제시하고 개념을 유도하세요" |
| 0.3 ~ 0.5 | 핵심 확인 후 심화 | "핵심 개념을 확인한 뒤 심화 질문으로 이동하세요" |
| 0.6+ | 부족한 부분 집중 | "C1~C4 중 pre-test에서 약했던 영역을 집중하세요" |

### 3.3 Stage 2: Learning

#### Mode A (Reading) — 수집 데이터

| 데이터 | 수집 방법 | 용도 |
|--------|----------|------|
| 총 체류 시간 | 페이지 진입~완료 버튼 | 학습 시간 비교 |
| 스크롤 깊이 | JS scroll event (throttled) | 콘텐츠 소비 정도 |
| 동영상 재생 시간 | video API events | 실제 시청 여부 |
| 섹션별 체류 | IntersectionObserver | 어느 부분에 시간 투자했는지 |

최소 학습 시간: 콘텐츠 글자 수 기반 계산 (평균 읽기 속도 200자/분 기준, 최소 60% 이상 체류).

#### Mode B (Tutoring) — 수집 데이터

기존 v7의 interaction_logs + v8 추가:

| 데이터 | 필드 | 설명 |
|--------|------|------|
| 개념별 판별 결과 | `concept_results` | JSON: {"C1": true, "C2": false, ...} — LLM binary 추출 |
| 턴 점수 | `score` | matched/total로 코드가 계산 (LLM이 직접 매기지 않음) |
| Bloom 수준 | `bloom_level` | matched/total 비율 + 규칙으로 코드가 판정 |
| 임상 적용 점수 | `clinical_score` | C1~C4 언급 수 + structured/limitation → Level 자동 결정 |
| 새로 확인된 항목 | `newly_confirmed` | 이번 턴에서 confirmed 전환된 체크리스트 ID |
| 응답 시간 | `elapsed_sec` | 프론트엔드 측정, 초 단위 |
| 학습자 발화량 | `word_count_learner` | 학습자 답변 글자 수 |
| 튜터 발화량 | `word_count_tutor` | 튜터 응답 글자 수 |
| 자기주도성 비율 | `word_ratio` | 학습자/튜터 발화량 비율 |
| 정보 밀도 | `info_density` | matched_count / 학습자 글자수 × 100 |

### 3.4 Stage 3: Post-Assessment

#### 목적
독립 환경(튜터 없음)에서 학습 효과 측정. ALE 세션 내 수행이 아닌 **독립적 전이** 확인.

#### 문항 구성

Pre-test와 동형(Form A/B)이되 다른 문항:

| # | Bloom | 유형 | 예시 |
|---|-------|------|------|
| Q1 | Remember | MCQ | "치매를 '증후군'이라 부르는 이유는?" |
| Q2 | Understand | MCQ | "후천적 인지 저하에서 '후천적'이 중요한 이유는?" |
| Q3 | Apply | 서술형 | "68세 김할아버지 사례 — 치매 판단 + 근거 제시" |
| Q4 | Analyze | 서술형 | "이 환자에게 MMSE를 실시하면 어떤 영역이 특히 낮을 것으로 예상하나요?" |
| Q5 | Apply (임상) | 사례 서술형 | 새로운 사례 — C1~C4 근거를 들어 종합 판단 |

#### 임상 적용 루브릭 (Q5용)

| Level | 점수 | 기준 |
|-------|------|------|
| 1 | 0.2 | 결론만 ("치매인 것 같아요") — 근거 없음 |
| 2 | 0.4 | 근거 1개 ("기억력이 안 좋으니까") |
| 3 | 0.6 | 근거 2~3개 + 사례 데이터 매칭 |
| 4 | 0.8 | 근거 4개(C1~C4 전부) + 논리적 구조 + 다음 단계 언급 |
| 5 | 1.0 | Level 4 + 감별 한계 인식 + 추가 평가 제안 |

#### post_score 산출

pre_score와 동일한 가중 평균 방식. gain = post_score - pre_score.

### 3.5 Stage 4: Retention Check

#### SM-2 변형 간격

```
초기 간격: 1일
정답률 ≥ 0.8 → 간격 × 2 (1→3→7→14→30)
정답률 < 0.5 → 간격 리셋 (1일) + 해당 노드 복습 권유
정답률 0.5~0.8 → 간격 유지
```

#### 문항: 해당 노드의 핵심 문항 2~3개 (Form A/B에서 추출, 이전에 출제하지 않은 것 우선).

---

## 4. Bloom 수준별 측정 체계

### 4.1 왜 Bloom별 분리가 필요한가

기존 ITS 연구에서 "대화는 풍부하지만 시험 점수는 안 올랐다"는 결과가 보고됨 (Blasco et al., 2024). 이는 시험이 Remember/Understand만 측정했기 때문일 수 있음. Socratic 대화가 촉진하는 Apply/Analyze 능력은 기존 MCQ로 포착 불가.

ALE v8은 이를 검증하기 위해 **모든 문항에 Bloom 수준을 태깅하고, 수준별로 분리 분석**:

### 4.2 문항-Bloom 매핑 원칙

| Bloom 수준 | 문항이 요구하는 것 | 예시 |
|-----------|-----------------|------|
| Remember | 사실/용어 재인 또는 회상 | "치매의 가장 흔한 원인 질환은?" |
| Understand | 개념을 자기 말로 설명/재구성 | "왜 치매라고 할 수 있어요?" |
| Apply | 개념을 새 사례에 적용 | "이 환자가 치매인지 판단하세요" |
| Analyze | 비교/감별/구조화 | "건망증과 치매의 결정적 차이는? ADL 관점에서 설명" |

### 4.3 Bloom 태깅의 이중 적용

1. **문항 수준**: test_items 테이블에 각 문항의 bloom_level 고정
2. **응답 수준**: matched/total 비율로 규칙 기반 판정 (LLM 직접 판정이 아닌 코드 계산)
   - matched/total ≥ 80% → 문항이 요구한 Bloom 수준 달성
   - matched/total 50~79% → 한 단계 아래
   - matched/total < 50% → remember

---

## 5. 채점 체계: LLM = 데이터 추출기, 점수 = 코드 계산

### 5.1 핵심 원칙

```
[기존 v7]  LLM: "이 답변은 0.7점" → 저장 (블랙박스)
[v8]       LLM: "개념A: yes, 개념B: no, 개념C: yes" → 코드: 2/3 = 0.67 (투명)
```

LLM에게 점수를 매기라고 하지 않는다. LLM은 **핵심 개념의 유무를 binary(yes/no)로 판별**하는 추출기 역할만 한다. 점수는 `matched / total` (가중치 적용 시 `Σ(matched × weight) / Σ(weight)`) 공식으로 코드가 산출한다.

**이 원칙은 모든 평가 단계에 동일하게 적용된다:**

| 단계 | LLM의 역할 | 코드의 역할 |
|------|-----------|-----------|
| Pre-test 서술형 | "이 개념 언급했는가?" yes/no | matched/total = pre_score |
| 형성 평가 (매 턴) | "C1~C5 각각 언급했는가?" yes/no | matched/total = turn_score |
| Post-test 서술형 | "이 개념 언급했는가?" yes/no | matched/total = post_score |
| 임상 루브릭 | "C1~C4 + 구조화 + 감별?" yes/no | matched 개수 → Level 자동 결정 |
| Retention | 동일 | 동일 |

### 5.2 MCQ 채점

LLM 불필요. 코드가 정답 키 매칭.

```
score = 1.0 (정답) / 0.0 (오답)
```

### 5.3 서술형 채점 — LLM 추출 프롬프트

```
당신은 간호학 답변 분석기입니다. 점수를 매기지 마세요.
학습자의 답변에서 아래 핵심 개념이 언급되었는지 각각 yes/no로만 판별하세요.
간접적 표현(예: "밥도 못 해먹는다" → ADL 장애)도 의미가 통하면 yes로 판별합니다.

문항: {question}
학습자 답변: {response}

핵심 개념:
1. {concept_1} — {description_1}
2. {concept_2} — {description_2}
...

JSON으로만 응답:
{
    "concept_1": "yes" 또는 "no",
    "concept_2": "yes" 또는 "no",
    ...,
    "brief": "한줄 요약"
}
```

### 5.4 점수 산출 공식

```python
def score_response(llm_extraction: dict, rubric: dict) -> dict:
    """LLM binary 추출 + 루브릭 가중치 → 점수"""
    earned = sum(c["weight"] for c in rubric["criteria"]
                 if llm_extraction.get(c["key"]) == "yes")
    total = sum(c["weight"] for c in rubric["criteria"])
    score = earned / total if total > 0 else 0.0
    
    matched = [c["key"] for c in rubric["criteria"] 
               if llm_extraction.get(c["key"]) == "yes"]
    missing = [c["key"] for c in rubric["criteria"] 
               if llm_extraction.get(c["key"]) != "yes"]
    
    return {
        "score": round(score, 4),
        "matched": matched,
        "missing": missing,
        "matched_count": len(matched),
        "total_count": len(rubric["criteria"]),
        "brief": llm_extraction.get("brief", "")
    }
```

### 5.5 임상 적용 루브릭 — 자동 Level 결정

LLM이 Level을 매기지 않는다. C1~C4 언급 개수 + 구조화 여부로 **코드가 Level을 결정**:

```
C1~C4 중 언급 0개                    → Level 1 (0.2): 결론만
C1~C4 중 언급 1개                    → Level 2 (0.4): 근거 1개
C1~C4 중 언급 2~3개                  → Level 3 (0.6): 근거 다수
C1~C4 전부 + 구조화(structured=yes)  → Level 4 (0.8): 전부 + 구조화
Level 4 + 감별한계(limitation=yes)    → Level 5 (1.0): + 감별 한계
```

LLM에게는 기존 C1~C4 판별에 추가로 `structured`와 `limitation` 두 개만 더 물어본다:

```
5. 구조화된 논리 — 근거를 나열이 아닌 체계적 순서로 제시했는가
6. 감별 한계 인식 — "이것만으로 확정은 어렵다" 또는 추가 검사 필요성을 언급했는가
```

### 5.6 Bloom 수준 판정

Bloom도 LLM 직접 판정 대신, 규칙 기반 보조:

- 문항에 요구된 Bloom 수준과, 달성 비율(matched/total)로 결정
- matched/total ≥ 80% → 문항 수준 달성
- matched/total 50~79% → 한 단계 아래
- matched/total < 50% → remember

Tutoring 매 턴에서는 LLM이 bloom을 힌트로 제공하되, 최종 기록은 위 규칙으로 보정.

### 5.7 형성 평가 보조 지표 (Tutoring 모드 전용)

아래 지표는 종속변수(두 조건 비교)가 아니라, "왜 Tutoring이 효과적이었는가"를 설명하는 **탐색적 보조 데이터**:

| 지표 | 계산 방법 | 의미 |
|------|----------|------|
| Word Count Ratio | `학습자_글자수 / 튜터_글자수` | 자기주도성 (높을수록 학습자가 더 많이 말함) |
| Information Density | `matched_count / 학습자_글자수 × 100` | 핵심 정보 비중 (길게 말했지만 핵심 없는 경우 감지) |
| 하브루타 재설명 | 체크리스트 confirmed 후 "다시 설명해주세요" 요청 시 재확인 결과 | 표면적 confirmed vs 실제 이해 검증 |

### 5.8 인간 채점 (연구 타당도)

binary 추출 방식이 인간 판단과 얼마나 일치하는지 검증 필수:

- Post-test 서술형 응답에 대해 **2명의 인간 채점자**가 동일 루브릭으로 독립 채점 (각 개념별 yes/no)
- Cohen's Kappa: 인간 채점자 간 일치도
- LLM 추출 vs 인간 채점의 일치도 (개념별 accuracy)
- **최종 분석에는 human_score를 primary**, auto_score를 supplementary

### 5.9 채점 방식 비교 요약

| 차원 | v7 (블랙박스) | v8 (binary 추출) |
|------|-------------|-----------------|
| 정확성 판정 | "답변이 정확함" (0.8점) | "5개 핵심 개념 중 4개 언급" (4/5=0.8) |
| 논리성 판정 | "설명이 논리적" (0.7점) | "구조화=yes, 감별한계=no" → Level 4 |
| 근거 | 없음 (LLM 주관) | 개념별 yes/no 목록 (투명) |
| 재현성 | 낮음 (동일 답변에 다른 점수) | 높음 (binary 판별은 LLM이 안정적, 점수는 공식) |
| 설명 가능성 | "왜 0.7?" → 모름 | "C1,C2,C4 언급, C3,C5 누락" → 명확 |

---

## 6. 분석 방법

### 6.1 기본 분석

| 분석 | 방법 | 독립변수 | 종속변수 |
|------|------|---------|---------|
| 학습 효과 비교 | Paired t-test (또는 Wilcoxon) | 조건 (Reading vs Tutoring) | gain score |
| 사전 수준 통제 | ANCOVA | 조건 | post_score (공변량: pre_score) |
| Bloom별 효과 | 반복측정 ANOVA | 조건 × Bloom 수준 | 수준별 점수 |
| 임상 적용 능력 | Mann-Whitney U | 조건 | clinical rubric score |
| 학습 효율성 | t-test | 조건 | gain / learning_duration_sec |

### 6.2 부가 분석 (탐색적 — 종속변수 아님)

| 분석 | 목적 | 지표 역할 |
|------|------|----------|
| ALE 내부 지표 타당도 | checklist confirmed 수 ↔ post_test score 상관 | 도구 타당도 검증 |
| 세션 내 C5 ↔ Post C5 | Socratic 대화 내 임상 수행이 독립 전이를 예측하는가 | 전이 예측력 |
| Bloom 상승 궤적 | Tutoring 모드에서 턴별 bloom_level 변화 패턴 | 메커니즘 설명 |
| 응답 시간 패턴 | elapsed_sec과 score의 관계 (고민 vs 즉답) | 메커니즘 설명 |
| Reading 행동 ↔ 성과 | 스크롤 깊이/동영상 시청률과 post_score의 관계 | 통제 조건 참여도 검증 |
| Word Count Ratio | 학습자/튜터 발화량 비율 | 자기주도성 탐색 |
| Information Density | matched_count / 학습자_글자수 | 핵심 정보 비중 탐색 |
| LLM 추출 vs 인간 채점 일치도 | 개념별 accuracy + Cohen's Kappa | 채점 도구 신뢰도 검증 |

### 6.3 보고 구조 (발표용)

1. **문제**: 한국 치매 간호 교육은 이론 중심, 수동적, 임상 추론 훈련 부재
2. **기존 시도**: 시뮬레이션/PBL/플립러닝 — 효과 있지만 확장 불가, 개인화 불가
3. **제안**: ALE = Socratic AI 튜터링으로 1:1 적응형 임상 추론 훈련을 확장 가능하게
4. **검증**: Bloom 수준별 분리 측정
5. **기여**: "기존 시험이 잡지 못한 고차 사고 능력을 Socratic AI가 촉진한다"는 방법론적 + 실증적 기여

---

## 7. 문항 풀 설계 — 치매 개요 (01번 노드)

### 7.1 Pre-test 문항 (Form A)

```json
[
    {
        "id": "dem01_pre_R1",
        "bloom_level": "remember",
        "item_type": "mcq",
        "question": "치매의 가장 정확한 정의를 고르세요.",
        "options": [
            "A) 노화에 따른 자연스러운 기억력 감퇴",
            "B) 후천적 인지기능 저하로 일상생활에 장애가 있는 증후군",
            "C) 뇌의 특정 부위가 손상되어 발생하는 단일 질환",
            "D) 일시적인 혼란과 기억 장애 상태"
        ],
        "correct": "B",
        "max_score": 1.0
    },
    {
        "id": "dem01_pre_U1",
        "bloom_level": "understand",
        "item_type": "mcq",
        "question": "치매를 '증후군(syndrome)'이라 부르는 이유로 가장 적절한 것은?",
        "options": [
            "A) 원인이 밝혀지지 않았기 때문에",
            "B) 다양한 원인 질환에 의해 유사한 증상 묶음이 나타나기 때문에",
            "C) 증상이 시간에 따라 변하기 때문에",
            "D) 진단 기준이 표준화되지 않았기 때문에"
        ],
        "correct": "B",
        "max_score": 1.0
    },
    {
        "id": "dem01_pre_A1",
        "bloom_level": "apply",
        "item_type": "short_answer",
        "question": "73세 할머니가 약 먹는 것을 자꾸 잊습니다. 가족은 '요즘 깜빡깜빡한다'고 합니다. 이 분이 치매인지 단순 건망증인지 어떻게 구분하시겠어요? 근거를 들어 설명해주세요.",
        "rubric": {
            "criteria": [
                {"key": "후천적_인지_저하", "concept": "후천적 인지 저하", "desc": "이전에 정상이었다가 나중에 저하되었다는 의미", "weight": 0.2},
                {"key": "다영역_침범", "concept": "다영역 침범 여부", "desc": "기억력 외 다른 인지 영역도 저하", "weight": 0.2},
                {"key": "ADL_장애", "concept": "ADL 장애 여부", "desc": "일상생활 활동에 지장", "weight": 0.3},
                {"key": "감별_기준", "concept": "건망증과의 감별 기준", "desc": "건망증과 구분하는 핵심 차이 언급", "weight": 0.3}
            ]
        },
        "max_score": 1.0
    }
]
```

### 7.2 Post-test 문항 (Form B)

```json
[
    {
        "id": "dem01_post_R1",
        "bloom_level": "remember",
        "item_type": "mcq",
        "question": "치매의 가장 흔한 원인 질환은?",
        "options": [
            "A) 혈관성 치매",
            "B) 루이체 치매",
            "C) 알츠하이머병",
            "D) 전두측두엽 치매"
        ],
        "correct": "C",
        "max_score": 1.0
    },
    {
        "id": "dem01_post_U1",
        "bloom_level": "understand",
        "item_type": "mcq",
        "question": "치매 진단에서 '후천적'이라는 조건이 중요한 이유는?",
        "options": [
            "A) 선천적 지적장애와 구분하기 위해",
            "B) 치료 가능성을 판단하기 위해",
            "C) 발병 시기를 정확히 알기 위해",
            "D) 유전 여부를 확인하기 위해"
        ],
        "correct": "A",
        "max_score": 1.0
    },
    {
        "id": "dem01_post_A1",
        "bloom_level": "apply",
        "item_type": "case_study",
        "question": "68세 김할아버지. 3개월 전부터 운전 중 길을 자주 잃고, 은행 ATM 사용법을 까먹었습니다. 배우자는 '원래 요리를 잘 했는데 이제 라면도 못 끓인다'고 합니다. 지난주에는 머리를 감고 나서 샴푸를 또 짰습니다.\n\n이 분이 치매인지 판단하시고, 근거를 들어 설명해주세요.",
        "rubric": {
            "criteria": [
                {"key": "후천적_발생", "concept": "후천적 발생 (3개월 전부터)", "desc": "이전에는 정상이었다가 최근 저하", "weight": 0.15},
                {"key": "다영역_침범", "concept": "다영역 침범 (기억+실행+시공간)", "desc": "두 가지 이상 인지 영역 언급", "weight": 0.2},
                {"key": "ADL_장애", "concept": "ADL 장애 (요리, ATM, 운전)", "desc": "일상생활 활동 지장 사례와 매칭", "weight": 0.25},
                {"key": "증후군_감별", "concept": "증후군으로서 원인 감별 필요", "desc": "단일 질환이 아닌 증후군, 원인 감별 언급", "weight": 0.15},
                {"key": "structured", "concept": "구조화된 논리", "desc": "근거를 나열이 아닌 체계적 순서로 제시", "weight": 0.15},
                {"key": "limitation", "concept": "추가 평가 제안", "desc": "MMSE 등 후속 검사 필요성 또는 확정 어려움 언급", "weight": 0.10}
            ],
            "clinical_rubric": true,
            "clinical_level_rule": "C1~C4 matched 수 + structured + limitation → Level 1~5 자동 결정"
        },
        "max_score": 1.0
    },
    {
        "id": "dem01_post_An1",
        "bloom_level": "analyze",
        "item_type": "short_answer",
        "question": "위 김할아버지에게 MMSE를 실시한다면, 어떤 인지 영역에서 점수가 특히 낮을 것으로 예상하나요? 사례의 증상과 연결하여 설명해주세요.",
        "rubric": {
            "criteria": [
                {"concept": "기억력(기억등록/회상) 영역 예측", "weight": 0.25},
                {"concept": "실행기능/주의집중 영역 예측", "weight": 0.25},
                {"concept": "시공간 능력 영역 예측", "weight": 0.25},
                {"concept": "사례 증상과 MMSE 영역의 매칭 근거", "weight": 0.25}
            ]
        },
        "max_score": 1.0
    }
]
```

### 7.3 동형검사 타당도

Form A와 Form B가 동일한 난이도인지 확인하기 위해:
- 파일럿(N=10)에서 양쪽 모두 실시
- Form A 총점과 Form B 총점의 상관계수(Pearson r ≥ 0.7) 확인
- 유의미한 차이 없음을 paired t-test로 확인 (p > 0.05)

---

## 8. 성적표 (Report Card) 데이터 모델

```
학습자 성적표 — 치매 개요 (01번 노드)
┌──────────────────────────────────────────────┐
│ 학습자: 홍길동 (nurse)                         │
│ 학습 모드: Tutoring (Socratic 대화)            │
│ 학습 일시: 2026-04-01                         │
│                                               │
│ ── 평가 결과 ──                                │
│ 사전 수준 (pre)  : 0.27 (기초)                 │
│ 사후 수준 (post) : 0.78                        │
│ 성장폭 (gain)    : +0.51                       │
│                                               │
│ ── Bloom 수준별 ──                             │
│ Remember    : pre 1.0 → post 1.0 (유지)       │
│ Understand  : pre 0.5 → post 1.0 (+0.5)       │
│ Apply       : pre 0.0 → post 0.7 (+0.7)       │
│ Analyze     : (pre 미측정) → post 0.5          │
│                                               │
│ ── 임상 적용 ──                                │
│ 루브릭 Level: 3 (근거 2~3개 + 사례 매칭)        │
│ clinical_score: 0.6                            │
│                                               │
│ ── 학습 과정 (Tutoring 전용) ──                 │
│ 학습 턴 수    : 8턴                             │
│ 학습 시간     : 23분 14초                       │
│ 체크리스트:                                    │
│   C1 정의     : ✅ (T3에서 confirmed)           │
│   C2 다영역   : ✅ (T4에서 confirmed)           │
│   C3 ADL     : ✅ (T2에서 confirmed)           │
│   C4 증후군   : ✅ (T6에서 confirmed)           │
│   C5 임상적용 : ✅ (T8에서 confirmed)           │
│ 취약 영역: C4 (증후군) — 가장 늦게 이해          │
│ 강점 영역: C3 (ADL) — 빠르게 파악               │
│ Bloom 궤적: R→R→U→U→A→U→A→A                  │
│                                               │
│ ── 복습 ──                                     │
│ 다음 복습 예정: 2026-04-02 (1일 후)             │
└──────────────────────────────────────────────┘
```

---

## 9. 데이터 수집 매트릭스

### 양쪽 모드 공통

| 데이터 | 수집 시점 | DB 위치 |
|--------|----------|---------|
| pre_score, pre_bloom | 세션 시작 | sessions |
| post_score, post_bloom, post_clinical | 학습 후 | sessions |
| gain | 자동 계산 | sessions |
| learning_duration_sec | 학습 중 | sessions |
| 문항별 응답 + 채점 | pre/post | test_responses |

### Tutoring 모드 추가

| 데이터 | DB 위치 |
|--------|---------|
| 턴별 concept_results (binary 추출) | interaction_logs |
| 턴별 score (matched/total, 코드 계산) | interaction_logs |
| bloom_level (규칙 기반) | interaction_logs |
| clinical_score, clinical_level | interaction_logs |
| checklist_state, newly_confirmed | interaction_logs |
| elapsed_sec (턴별) | interaction_logs |
| word_count_learner, word_count_tutor, word_ratio, info_density | interaction_logs |
| 대화 전문 | conversation_logs |

### Reading 모드 추가

| 데이터 | DB 위치 |
|--------|---------|
| 스크롤 깊이, 동영상 재생, 섹션 체류 | reading_logs |

---

## 10. 선행연구 레퍼런스

| 연구 | 핵심 발견 | ALE 관련성 |
|------|----------|-----------|
| Kestin et al. (2025), Harvard RCT | AI 튜터가 능동 학습 대비 학습량↑, 시간↓, 참여도↑ | 실험 설계 모델 (crossover + pre/post) |
| Blasco et al. (2024), European K-12 | Socratic AI로 대화↑ but 시험 점수 변화 없음 | Bloom별 분리 측정 필요성 근거 |
| Fakour & Imani (2025), Taiwan | ChatGPT Socratic이 자기성찰/비판적 사고↑, 인간 튜터는 감정 피드백 우위 | Socratic AI의 인지적 효과 근거 |
| Gerlich (2025), 666명 설문 | AI 도구 빈번 사용 ↔ 비판적 사고↓ (cognitive offloading) | "답을 주는 AI"와 "질문하는 AI" 구분 필요 |
| Eedi/LearnLM (2025), UK RCT | AI+인간 감독 튜터가 인간 단독 대비 전이 문제 정답률↑ | Socratic 프롬프트 설계 참조 |
| IGNITE (2024), 한국 경상대 | 치매 케어 태도/지식 유의미 향상 (전환학습이론) | 한국 치매 간호 교육 선행연구 |
| MCQ Bloom 분석 (2025), Frontiers | MCQ의 77%가 LOT(Remember/Understand)만 측정 | 평가 도구 편향 근거 |
