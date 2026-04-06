# backend/routes/test.py
"""
Pre/Post/Retention 평가 API — v8.2
POST /test/submit: 테스트 응답 제출 → binary 추출 채점 → 상태 전이
"""

import json
import os
import time
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import sessions
from services.claude_client import extract_concepts, generate_learning_report, generate_post_test_items
from services.test_scorer import (
    score_short_answer,
    calculate_phase_score,
    determine_phase_bloom,
    normalize_rubric,
)
from services.state_machine import transition, get_learning_target
from database import (
    get_test_item,
    load_test_items,
    save_test_response,
    update_session_pre_score,
    update_session_post_score,
    update_session_status,
    update_session_learning_times,
    upsert_test_item,
)
from services.content_loader import load_wiki_doc, load_unified_content, WIKI_DIR

router = APIRouter()

# v8.2: read 폴더에서 교재 내용 로드
READ_DIR = os.path.join(WIKI_DIR, "read")


def _load_reading_content(node_id: str) -> str:
    """read/{node_id}/ 폴더의 모든 챕터를 합쳐서 반환. 없으면 빈 문자열."""
    node_dir = os.path.join(READ_DIR, node_id)
    if not os.path.isdir(node_dir):
        return ""
    parts = []
    for f in sorted(os.listdir(node_dir)):
        if not f.endswith('.md'):
            continue
        with open(os.path.join(node_dir, f), 'r', encoding='utf-8') as fh:
            parts.append(fh.read())
    return "\n\n---\n\n".join(parts)


async def generate_test_items(node_id: str, wiki_doc: str, form: str = "A", checklist_items: list = None) -> list:
    """사전/사후 평가 문항 자동 생성 — form에 따라 item_id 접미사 변경."""
    # generate_post_test_items를 재사용하되 form/item_id만 변경
    generated = await generate_post_test_items(node_id, wiki_doc, checklist_items)

    # form에 맞게 item_id 수정
    for item in generated:
        old_id = item.get("item_id", "")
        # 기존 _B1 → _A1 또는 유지
        if form == "A" and "_B" in old_id:
            item["item_id"] = old_id.replace("_B", "_A")
        elif form == "B" and "_A" in old_id:
            item["item_id"] = old_id.replace("_A", "_B")
        item["form"] = form
        item["node_id"] = node_id

    print(f"[GENERATE] {node_id} form={form}: {len(generated)}개 문항 생성")
    return generated


@router.get("/test/items/{node_id}")
async def get_test_items(node_id: str, form: str = "A"):
    """노드별 평가 문항 목록 반환. DB에 없으면 교재 기반 자동 생성."""
    items = await load_test_items(node_id, form=form)

    if not items:
        print(f"[TEST_ITEMS] {node_id}: form={form} 문항 없음, 자동 생성")

        # 교재 내용 로드 — read 폴더 챕터 우선, 없으면 nodes 폴백
        wiki_doc = _load_reading_content(node_id)
        if not wiki_doc:
            unified = load_unified_content(node_id)
            wiki_doc = unified.get("wiki_doc") or load_wiki_doc(node_id)

        if not wiki_doc:
            print(f"[TEST_ITEMS] {node_id}: 교재 내용 없음, 빈 문항 반환")
            return {"items": []}

        checklist_items = []
        try:
            unified = load_unified_content(node_id)
            checklist_items = unified.get("checklist_items", [])
        except Exception:
            pass

        generated = await generate_test_items(node_id, wiki_doc, form=form, checklist_items=checklist_items)
        for item in generated:
            await upsert_test_item(item)
        items = await load_test_items(node_id, form=form)
        print(f"[TEST_ITEMS] {node_id}: form={form} {len(items)}개 문항 자동 생성 완료")

    return {"items": items}


@router.post("/test/submit")
async def submit_test(request: Request):
    """Pre/Post/Retention 테스트 응답 제출 및 채점."""
    data = await request.json()

    try:
        session_id = data["session_id"]
        test_phase = data["test_phase"]
        responses = data["responses"]

        session = sessions.get(session_id)
        if not session:
            return JSONResponse({"error": "세션을 찾을 수 없습니다"}, status_code=404)

        results = []

        for resp in responses:
            item = await get_test_item(resp["item_id"])
            if not item:
                results.append({"item_id": resp["item_id"], "auto_score": 0.0, "bloom": "remember", "error": "item not found"})
                continue

            score_data = {}
            concept_results = None

            if item.get("item_type") == "mcq":
                # MCQ: 코드가 정답 매칭
                score = 1.0 if resp["response"] == item.get("correct") else 0.0
                print(f"[SCORING] MCQ {resp['item_id']}: answer={resp['response']}, correct={item.get('correct')}, score={score}")
            else:
                # 서술형: LLM binary 추출 → 코드가 점수 계산
                rubric = item.get("rubric")
                if isinstance(rubric, str):
                    rubric = json.loads(rubric)

                # v8.2 디버깅 로그
                print(f"\n{'='*60}")
                print(f"[SCORING] item={resp['item_id']}, type=short_answer, bloom={item.get('bloom_level')}")
                print(f"[SCORING] response: {resp['response'][:120]}")

                if rubric:
                    print(f"[SCORING] rubric keys: {list(rubric.keys())}")
                    if 'key_concepts' in rubric:
                        print(f"[SCORING] key_concepts ({len(rubric['key_concepts'])}개): {rubric['key_concepts']}")
                    if 'criteria' in rubric:
                        print(f"[SCORING] criteria ({len(rubric['criteria'])}개)")

                    # v8.2: normalize_rubric으로 key_concepts → criteria 변환 확인
                    normalized = normalize_rubric(rubric)
                    norm_criteria = normalized.get("criteria", [])
                    print(f"[SCORING] normalized criteria: {len(norm_criteria)}개 → {[c['key'] for c in norm_criteria]}")

                    # LLM에서 concept 추출
                    extraction = await extract_concepts(resp["response"], rubric)
                    print(f"[SCORING] LLM extraction: {json.dumps(extraction, ensure_ascii=False, default=str)[:300]}")

                    # 개별 concept 판정 로그
                    for c in norm_criteria:
                        key = c['key']
                        val = extraction.get(key, 'MISSING')
                        matched = val is True or (isinstance(val, str) and val.lower() in ('yes', 'true'))
                        print(f"[SCORING]   {key} ({c['concept'][:40]}): {val} → {'✓' if matched else '✗'}")

                    # 점수 계산
                    score_data = score_short_answer(extraction, rubric)
                    score = score_data["score"]
                    concept_results = extraction

                    print(f"[SCORING] RESULT: matched={score_data.get('matched_count')}/{score_data.get('total_count')}, score={score:.4f}")
                    print(f"[SCORING] matched_keys: {score_data.get('matched_keys')}")
                else:
                    print(f"[SCORING] rubric is None → score=0.0")
                    score = 0.0
                print(f"{'='*60}\n")

            bloom_level = item.get("bloom_level", "remember")

            # DB 저장
            await save_test_response({
                "session_id": session_id,
                "learner_id": session.get("learner_id", "anonymous"),
                "node_id": session.get("node_id", ""),
                "item_id": resp["item_id"],
                "test_phase": test_phase,
                "response": resp["response"],
                "concept_results": json.dumps(concept_results, ensure_ascii=False) if concept_results else None,
                "matched_count": score_data.get("matched_count"),
                "total_count": score_data.get("total_count"),
                "auto_score": score,
                "bloom_level": bloom_level,
                "elapsed_sec": resp.get("elapsed_sec"),
            })

            results.append({
                "item_id": resp["item_id"],
                "auto_score": score,
                "bloom": bloom_level,
            })

        # 종합 점수 계산 (블룸 가중 평균)
        phase_score = calculate_phase_score(results)
        phase_bloom = determine_phase_bloom(results)

        print(f"\n[PHASE_SCORE] {test_phase}: phase_score={phase_score:.4f}, phase_bloom={phase_bloom}")
        for r in results:
            print(f"  {r['item_id']}: score={r['auto_score']:.4f}, bloom={r['bloom']}")

        # 세션 상태 전이
        next_data = {}

        if test_phase == "pre_test":
            session["pre_score"] = phase_score
            session["pre_bloom"] = phase_bloom
            learning_target = get_learning_target(session.get("mode", "tutoring"))
            transition(session, learning_target)
            await update_session_pre_score(session_id, phase_score, phase_bloom)
            # v8.2: DB status 동기화
            await update_session_status(session_id, learning_target)

            if session.get("mode") == "tutoring":
                next_data["first_message"] = session.get("first_message")
                next_data["checklist_items"] = session.get("checklist_items")
            elif session.get("mode") == "reading":
                next_data["content_url"] = f"/reading/{session['node_id']}/content"

        elif test_phase == "post_test":
            pre_score = session.get("pre_score", 0)
            gain = phase_score - pre_score
            session["post_score"] = phase_score
            session["post_bloom"] = phase_bloom
            session["gain"] = gain
            # learning_ → post_test → completed 순서 보장
            current_status = session.get("status", "")
            if current_status.startswith("learning_"):
                transition(session, "post_test")
            transition(session, "completed")
            await update_session_post_score(session_id, phase_score, phase_bloom, gain)
            # v8.2: DB status 동기화
            await update_session_status(session_id, "completed")
            # v8.4: 학습 시간 DB 저장
            started = session.get("learning_started_at")
            if started:
                await update_session_learning_times(session_id, started, time.time())

            # 학습 리포트 자동 생성
            try:
                wiki_doc = session.get("wiki_doc", "")
                mode = session.get("mode", "reading")
                duration = session.get("learning_duration_sec", 0)

                pre_responses_detail = []
                post_responses_detail = []

                for r in results:
                    item = await get_test_item(r["item_id"])
                    post_responses_detail.append({
                        **r,
                        "question": item.get("question", "") if item else "",
                    })

                from database import get_test_responses
                pre_db_responses = await get_test_responses(session_id, "pre_test")
                for pr in pre_db_responses:
                    pre_responses_detail.append({
                        "item_id": pr.get("item_id"),
                        "auto_score": pr.get("auto_score", 0),
                        "bloom_level": pr.get("bloom_level", "remember"),
                        "question": pr.get("response", "")[:60],
                    })

                report = await generate_learning_report(
                    node_id=session.get("node_id", ""),
                    wiki_doc=wiki_doc,
                    pre_responses=pre_responses_detail,
                    post_responses=post_responses_detail,
                    pre_score=pre_score,
                    post_score=phase_score,
                    learning_duration_sec=duration,
                    mode=mode,
                )
                next_data["report"] = report

                # v8.2: 보고서 DB 저장
                if report:
                    try:
                        db = await __import__('database').get_db()
                        await db.execute(
                            "UPDATE sessions SET report_json = ?, updated_at = ? WHERE id = ?",
                            (json.dumps(report, ensure_ascii=False), time.time(), session_id),
                        )
                        await db.commit()
                        await db.close()
                    except Exception as e:
                        print(f"[REPORT] DB 저장 실패: {e}")

            except Exception as e:
                print(f"[REPORT] 리포트 생성 실패: {e}")
                import traceback
                traceback.print_exc()
                next_data["report"] = None

            next_data["gain"] = gain
            print(f"[PHASE_SCORE] gain = {phase_score:.4f} - {pre_score:.4f} = {gain:.4f}")

        return {
            "test_phase": test_phase,
            "scores": results,
            "phase_score": phase_score,
            "phase_bloom": phase_bloom,
            "next_status": session.get("status"),
            **next_data,
        }

    except KeyError as e:
        return JSONResponse({"error": f"필수 필드 누락: {e}"}, status_code=422)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)