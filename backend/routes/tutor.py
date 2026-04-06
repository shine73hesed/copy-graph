# backend/routes/tutor.py
"""
Socratic 튜터링 대화 루프 — handle_answer
Analyst(체크리스트+score) → struggle 판정 → Tutor 응답 → BKT/ZPD 갱신 → 완료 판정
"""

import json
import re
import time
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import sessions
from routes.kg import get_next_nodes


def _ensure_dict(obj) -> dict:
    """str→json.loads, dict→그대로, 기타→{}"""
    if isinstance(obj, dict):
        return obj
    if isinstance(obj, str):
        try:
            parsed = json.loads(obj)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}
from services.zpd_tracker import (
    determine_initial_mastery,
    estimate_zpd_position,
    detect_struggle_pattern,
)
from services.bkt_service import (
    P_INIT,
    update_continuous,
    smoothed_mastery,
    is_node_ready_to_complete,
)
from services.claude_client import analyze_answer_v8, generate_tutor_response
from services.test_scorer import calculate_turn_score, calculate_clinical_level
from services.logger import (
    log_request, log_response,
    log_gate, log_tutor, log_error,
)
from database import (
    save_interaction, save_conversation, update_session_turns,
    save_session_checklist, get_conversation, get_session_interactions,
    save_note, complete_session,
)

router = APIRouter()


@router.post("/test/answer")
async def handle_answer(request: Request):
    """v6.2 — Analyst(체크리스트+score) → struggle 판정 → Tutor"""
    data = await request.json()
    log_request("/test/answer", data)

    try:
        session_id = data["session_id"]
        answer = data["answer"]
        session = sessions.get(session_id)
        if not session:
            return JSONResponse({"error": "세션을 찾을 수 없습니다"}, status_code=404)

        turn = session["turn"] + 1
        mastery_before = session["mastery"]

        # ── 대화 이력에 학습자 답변 추가 ──
        session["conversation_history"].append({"role": "user", "content": answer})

        # 학습자 답변 저장
        await save_conversation(session_id, session["learner_id"], session["node_id"], turn, "user", answer)
        print(f"[DB_SAVE] answer: sid={session_id}, turn={turn}, role=user, len={len(answer)}")

        # ── [1] Analyst Claude 호출 — v8 binary 추출 ──
        prev_checklist = _ensure_dict(session.get("checklist_state", {}))
        wiki_summary = session["wiki_doc"][:800]

        analyst_result = await analyze_answer_v8(
            node_id=session["node_id"],
            answer=answer,
            checklist_items=session.get("checklist_items", []),
            wiki_summary=wiki_summary,
            conversation_history=session["conversation_history"],
            prev_checklist=prev_checklist,
        )

        concept_results = analyst_result["concept_results"]  # {"C1": True, "C2": False, ...}
        brief = analyst_result["brief"]

        # v8: 코드가 점수 계산
        score_data = calculate_turn_score(concept_results, session.get("checklist_items", []))
        score = score_data["score"]

        # v8: 임상 수준
        clinical_level, clinical_score = calculate_clinical_level(concept_results)

        # v8: 보조 지표
        word_count_learner = len(answer)

        # concept_results → checklist_state 변환 (True→confirmed, False→not_yet)
        valid_ids = {it["id"] for it in session.get("checklist_items", [])}
        checklist_state = {}
        for cid in valid_ids:
            if concept_results.get(cid, False):
                checklist_state[cid] = "confirmed"
            else:
                checklist_state[cid] = prev_checklist.get(cid, "not_yet")

        # 이전 confirmed 항목 유지 — 절대 되돌리지 않음
        for prev_k, prev_v in prev_checklist.items():
            if prev_v == "confirmed" and prev_k in valid_ids:
                checklist_state[prev_k] = "confirmed"

        print(f"[DEBUG] v8 concept_results={concept_results}, checklist={checklist_state}")
        session["checklist_state"] = checklist_state

        # ── [2] score 기록 + 이동 평균 계산 ──
        if score is not None:
            session["score_history"].append(score)
            if score >= 0.60:
                session["streak"] += 1
            else:
                session["streak"] = 0

        scores_list = session["score_history"]
        recent_3 = scores_list[-3:] if len(scores_list) >= 3 else scores_list
        moving_avg = sum(recent_3) / len(recent_3) if recent_3 else 0
        trend = (scores_list[-1] - scores_list[-2]) if len(scores_list) >= 2 else 0.0

        # ── [3] struggle 판정 — 체크리스트 변화 기반 ──
        cl_history = session.get("checklist_history", [])
        cl_history.append(checklist_state)
        session["checklist_history"] = cl_history

        struggle = "too_early"
        if len(cl_history) >= 2:
            # 직전 턴 대비 새로 confirmed된 항목 수
            prev_cl = _ensure_dict(cl_history[-2])
            prev_confirmed = sum(1 for v in prev_cl.values() if v == "confirmed")
            curr_confirmed = sum(1 for v in checklist_state.values() if v == "confirmed")
            new_confirmed = curr_confirmed - prev_confirmed

            if len(cl_history) >= 3:
                # 최근 3턴 동안 변화 확인
                three_ago_cl = _ensure_dict(cl_history[-3])
                three_ago_confirmed = sum(1 for v in three_ago_cl.values() if v == "confirmed")
                total_new_in_3 = curr_confirmed - three_ago_confirmed
                if total_new_in_3 == 0 and curr_confirmed < len(checklist_state):
                    struggle = "unproductive"
                elif new_confirmed >= 2:
                    struggle = "breakthrough"
                elif curr_confirmed == len(checklist_state):
                    struggle = "comfort"
                else:
                    struggle = "productive"
            else:
                if new_confirmed >= 2:
                    struggle = "breakthrough"
                elif new_confirmed >= 1:
                    struggle = "productive"

        # ── [4] 체크리스트 카운트 ──
        confirmed_count = sum(1 for v in checklist_state.values() if v == "confirmed")
        total_items = len(checklist_state)
        all_confirmed = all(v == "confirmed" for v in checklist_state.values()) if checklist_state else False

        # 체크리스트 상태를 튜터에게 전달 (정보만, 규칙 아님)
        cl_context = ""
        system_hint_added = False
        if checklist_state:
            cl_lines = []
            for item in session.get("checklist_items", []):
                status = checklist_state.get(item["id"], "not_yet")
                mark = "✓" if status == "confirmed" else "✗"
                cl_lines.append(f"{mark} {item['id']}: {item['label']} — {status}")
            cl_context = "\n".join(cl_lines)
            not_yet_items = [item["id"] for item in session.get("checklist_items", []) if checklist_state.get(item["id"]) != "confirmed"]

            if not_yet_items:
                cl_context += f"\n\n아직 확인 안 된 항목: {', '.join(not_yet_items)}"
                cl_context += "\n이미 confirmed된 항목은 다시 묻지 마세요."
            else:
                cl_context += "\n\n모든 항목이 confirmed되었습니다. 마무리 정리 후 [TOPIC_COMPLETE]를 붙이세요."

            # 대화 이력에 시스템 메시지로 주입
            session["conversation_history"].append({
                "role": "user",
                "content": f"[시스템: 체크리스트 현황]\n{cl_context}"
            })
            system_hint_added = True

        # ── [5] Tutor Claude 호출 ──
        tutor_result = await generate_tutor_response(
            node_id=session["node_id"],
            role=session["role"],
            mastery=0,
            wiki_doc=session["wiki_doc"],
            plan_guide=session["plan_guide"],
            conversation_history=session["conversation_history"],
            handoff=session.get("handoff"),
        )
        tutor_raw = tutor_result["text"]
        log_tutor(tutor_raw)

        # 비용 계산 (Sonnet 4 기준)
        INPUT_COST = 3.0 / 1_000_000   # $3 per 1M input tokens
        OUTPUT_COST = 15.0 / 1_000_000  # $15 per 1M output tokens

        analyst_cost = analyst_result.get("input_tokens", 0) * INPUT_COST + analyst_result.get("output_tokens", 0) * OUTPUT_COST
        tutor_cost = tutor_result.get("input_tokens", 0) * INPUT_COST + tutor_result.get("output_tokens", 0) * OUTPUT_COST
        turn_cost = analyst_cost + tutor_cost

        # 태그 제거
        tutor_message = tutor_raw
        tutor_message = re.sub(r'\[TOPIC_COMPLETE\]', '', tutor_message).strip()

        # 대화 이력에 튜터 응답 추가
        session["conversation_history"].append({"role": "assistant", "content": tutor_message})

        # 시스템 메시지 제거 (대화 이력 오염 방지)
        if system_hint_added:
            session["conversation_history"] = [
                m for m in session["conversation_history"]
                if not (m["role"] == "user" and "[시스템:" in m["content"])
            ]

        # 튜터 응답 저장
        await save_conversation(session_id, session["learner_id"], session["node_id"], turn, "assistant", tutor_message)
        print(f"[DB_SAVE] tutor: sid={session_id}, turn={turn}, role=assistant, len={len(tutor_message)}")

        # ── Sprint 전환 체크 ──
        from services.claude_client import generate_handoff, SPRINT_SIZE
        sprint_turn_count = len([m for m in session["conversation_history"] if m["role"] == "user"])
        total_chars = sum(len(m["content"]) for m in session["conversation_history"])

        if sprint_turn_count >= SPRINT_SIZE or total_chars > 8000:
            try:
                current_sprint = session.get("sprint", 1)
                handoff = await generate_handoff(
                    conversation_history=session["conversation_history"],
                    checklist_state=session.get("checklist_state", {}),
                    checklist_items=session.get("checklist_items", []),
                    score_history=session.get("score_history", []),
                    moving_avg=moving_avg,
                    sprint_num=current_sprint,
                )
                # Sprint 이력 저장
                sprint_history = session.get("sprint_history", [])
                sprint_history.append(handoff)
                session["sprint_history"] = sprint_history
                session["handoff"] = handoff
                session["sprint"] = current_sprint + 1

                # conversation_history 리셋 (Claude에게 보낼 것만)
                old_len = len(session["conversation_history"])
                session["conversation_history"] = []
                summary = handoff.get("summary", {})
                print(f"\n{'─'*50}")
                print(f"[SPRINT] ✂ context reset: sprint {current_sprint}→{current_sprint+1}")
                print(f"[SPRINT]   cleared {old_len} msgs from conversation_history")
                print(f"[SPRINT]   handoff.partially_mentioned: {summary.get('partially_mentioned', 'N/A')}")
                print(f"[SPRINT]   handoff.last_question: {summary.get('last_question', 'N/A')[:80]}")
                print(f"{'─'*50}\n")
            except Exception as e:
                print(f"[SPRINT] transition failed: {e}")

        # ── [6] BKT 백그라운드 기록 ──
        p_correct = None
        p_posterior = None
        if score is not None:
            if turn == 1:
                session["mastery"] = determine_initial_mastery(score)
            else:
                bp = session["bkt_params"]
                bkt_result = update_continuous(
                    session["mastery"], score,
                    p_transit=bp["p_transit"],
                    p_slip=bp["p_slip"],
                    p_guess=bp["p_guess"],
                )
                session["mastery"] = bkt_result["mastery"]
                p_correct = bkt_result["p_correct"]
                p_posterior = bkt_result["p_posterior"]
            session["mastery_history"].append(session["mastery"])

        # ── [7] ZPD 백그라운드 기록 ──
        zpd_position = estimate_zpd_position(session["mastery"], session["score_history"])
        struggle_v6 = detect_struggle_pattern(session["score_history"])

        # ── [8] 완료 판정 ──
        all_confirmed = all(v == "confirmed" for v in checklist_state.values()) if checklist_state else False
        gate_a = all_confirmed
        gate_b = "[TOPIC_COMPLETE]" in tutor_raw
        completed = gate_a and gate_b

        # 튜터가 [TOPIC_COMPLETE] 붙이면 남은 체크리스트 자동 confirmed
        if gate_b and not gate_a:
            for k in checklist_state:
                checklist_state[k] = "confirmed"
            session["checklist_state"] = checklist_state
            gate_a = True
            confirmed_count = sum(1 for v in checklist_state.values() if v == "confirmed")
            all_confirmed = True
            completed = True

        # 체크리스트 전부 confirmed + 2턴 연속이면 강제 완료
        if gate_a and not gate_b:
            if session.get("prev_gate_a"):
                completed = True
        session["prev_gate_a"] = gate_a

        # gate 완료 시: DB status는 아직 learning_tutoring 유지 (사후평가 후 completed로 전이)
        # gate_done 플래그만 DB에 기록
        if completed:
            next_nodes = await get_next_nodes(session["node_id"], session["learner_id"])
            duration = time.time() - (session.get("start_time") or time.time())
            # DB에 gate 완료 + 통계만 저장 (status는 변경하지 않음)
            from database import get_db
            db = await get_db()
            try:
                await db.execute(
                    """UPDATE sessions
                       SET gate_done = 1,
                           final_mastery = ?,
                           total_turns = ?,
                           duration_sec = ?,
                           updated_at = ?
                       WHERE id = ?""",
                    (session["mastery"], turn, duration, time.time(), session_id),
                )
                await db.commit()
            finally:
                await db.close()
            print(f"[DB_SAVE] gate_done: sid={session_id}, turns={turn}, mastery={session['mastery']:.4f}")

            # ── 학습 노트 자동 생성 ──
            try:
                from services.claude_client import generate_note_content
                conv_logs = await get_conversation(session_id)
                interact_logs = await get_session_interactions(session_id)
                note_data = await generate_note_content(
                    node_id=session["node_id"],
                    wiki_doc=session.get("wiki_doc", ""),
                    conversation=conv_logs,
                    interactions=interact_logs,
                )
                await save_note(
                    learner_id=session["learner_id"],
                    node_id=session["node_id"],
                    session_id=session_id,
                    weak_points=json.dumps(note_data["weak_points"], ensure_ascii=False),
                    vocabulary=json.dumps(note_data["vocabulary"], ensure_ascii=False),
                    strengths=note_data.get("strengths", ""),
                    next_focus=note_data.get("next_focus", ""),
                )
                print(f"[NOTE] auto-generated: node={session['node_id']}, gaps={len(note_data['weak_points'])}, vocab={len(note_data['vocabulary'])}")
            except Exception as e:
                print(f"[NOTE] auto-generation failed: {e}")
        else:
            next_nodes = []

        # 백그라운드 비교용
        smoothed = smoothed_mastery(session["mastery_history"]) if session["mastery_history"] else 0
        gate_a_bkt = is_node_ready_to_complete(smoothed, session["streak"], turn)
        gate_a_moving = (
            moving_avg >= 0.75
            and len(scores_list) >= 4
            and all(s >= 0.6 for s in scores_list[-3:])
        )

        session["gate_a"] = gate_a
        session["gate_b"] = gate_b
        session["completed"] = completed
        session["turn"] = turn

        log_gate(gate_a, gate_b, completed)

        # v8: 튜터 응답 기반 보조 지표
        word_count_tutor = len(tutor_message)
        word_ratio = word_count_learner / max(word_count_tutor, 1)
        info_density = score_data["matched_count"] / max(word_count_learner, 1) * 100

        # ── DB 저장 ──
        await save_interaction({
            "learner_id": session["learner_id"],
            "session_id": session_id,
            "node_id": session["node_id"],
            "turn": turn,
            "student_answer": answer,
            "answer_length": len(answer),
            "score": score,
            "score_source": "analyst_v8",
            "mastery_before": mastery_before,
            "mastery_after": session["mastery"],
            "smoothed": smoothed,
            "streak": session["streak"],
            "attempted": score is not None,
            "zpd_position": zpd_position,
            "struggle_pattern": struggle_v6,
            "tutor_response": tutor_message,
            "tutor_action": brief,
            "is_first_turn": turn == 1,
            "is_complete_turn": completed,
            "gate_a_met": gate_a,
            "gate_b_met": gate_b,
            "p_correct": p_correct,
            "p_posterior": p_posterior,
            "moving_avg": round(moving_avg, 4),
            "trend": round(trend, 4),
            "checklist_state": json.dumps(checklist_state, ensure_ascii=False) if checklist_state else None,
            "bloom_level": score_data.get("bloom_level"),
            "clinical_score": clinical_score,
            "clinical_level": clinical_level,
            "concept_results": json.dumps(concept_results, ensure_ascii=False) if concept_results else None,
            "matched_count": score_data["matched_count"],
            "total_count": score_data["total_count"],
            "newly_confirmed": json.dumps(score_data["newly_confirmed"], ensure_ascii=False),
            "word_count_learner": word_count_learner,
            "word_count_tutor": word_count_tutor,
            "word_ratio": round(word_ratio, 4),
            "info_density": round(info_density, 2),
            "input_tokens": (analyst_result.get("input_tokens", 0) or 0) + (tutor_result.get("input_tokens", 0) or 0),
            "output_tokens": (analyst_result.get("output_tokens", 0) or 0) + (tutor_result.get("output_tokens", 0) or 0),
            "cost_usd": round(turn_cost, 5),
        })
        print(f"[DB_SAVE] interaction: sid={session_id}, turn={turn}, score={score}, cost=${round(turn_cost, 5)}")

        # 세션 메타 갱신 (총 턴 수 + updated_at)
        await update_session_turns(session_id, turn)

        # ── 응답 ──
        result = {
            "turn": turn,
            "score": score,
            "brief": brief,
            "moving_avg": round(moving_avg, 3),
            "trend": round(trend, 2),
            "struggle": struggle,
            "checklist": checklist_state,
            "confirmed_count": confirmed_count,
            "total_items": total_items,
            "tutor_message": tutor_message,
            "bkt_mastery": round(session["mastery"], 4),
            "gate": {
                "gate_a": gate_a,
                "gate_a_bkt": gate_a_bkt,
                "gate_a_moving": gate_a_moving,
                "gate_b": gate_b,
                "completed": completed,
            },
            "score_history": [round(s, 2) for s in scores_list],
            "usage": {
                "analyst_tokens": {"in": analyst_result.get("input_tokens", 0), "out": analyst_result.get("output_tokens", 0)},
                "tutor_tokens": {"in": tutor_result.get("input_tokens", 0), "out": tutor_result.get("output_tokens", 0)},
                "turn_cost_usd": round(turn_cost, 5),
            },
            "next_nodes": next_nodes,
        }
        log_response("/test/answer", result)
        return JSONResponse(content=result)

    except Exception as e:
        log_error("/test/answer", e)
        return JSONResponse({"error": str(e)}, status_code=500)
