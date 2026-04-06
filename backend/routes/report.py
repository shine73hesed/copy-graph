# backend/routes/report.py
"""
학습 이력 리포트 — 노드별 세션 + 대화 요약 + 상세 성적 분석 (v8.2)
"""

import json
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from database import get_db, get_test_responses

router = APIRouter()


@router.get("/test/node-history")
async def get_node_history(node_id: str, request: Request):
    """과목(노드)별 학습 이력 — 해당 노드의 전체 세션 + 대화 요약 반환"""
    user_id = request.cookies.get("ale_user")
    if not user_id:
        return JSONResponse({"error": "로그인 필요"}, status_code=401)

    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT s.id, s.node_id, s.status, s.total_turns, s.completed,
                      s.final_mastery, s.duration_sec, s.created_at, s.updated_at
               FROM sessions s
               WHERE s.learner_id = ? AND s.node_id = ?
               ORDER BY s.created_at DESC
               LIMIT 20""",
            (user_id, node_id),
        )
        session_rows = await cursor.fetchall()
        sessions_list = []

        for sess in session_rows:
            sid = sess["id"]

            conv_cursor = await db.execute(
                """SELECT role, content, turn FROM conversation_logs
                   WHERE session_id = ? ORDER BY timestamp ASC""",
                (sid,),
            )
            conv_rows = await conv_cursor.fetchall()
            messages = [dict(r) for r in conv_rows]

            int_cursor = await db.execute(
                """SELECT checklist_state, score, moving_avg
                   FROM interaction_logs
                   WHERE session_id = ? ORDER BY turn DESC LIMIT 1""",
                (sid,),
            )
            last_int = await int_cursor.fetchone()
            checklist_state = {}
            if last_int and last_int["checklist_state"]:
                try:
                    checklist_state = json.loads(last_int["checklist_state"])
                except Exception:
                    pass

            cl_cursor = await db.execute(
                "SELECT item_id, label FROM session_checklist WHERE session_id = ? ORDER BY rowid ASC",
                (sid,),
            )
            cl_rows = await cl_cursor.fetchall()
            checklist_items = [{"id": r["item_id"], "label": r["label"]} for r in cl_rows]

            confirmed_count = sum(1 for v in checklist_state.values() if v == "confirmed")
            total_items = len(checklist_state) if checklist_state else len(checklist_items)

            sessions_list.append({
                "session_id": sid,
                "status": sess["status"],
                "total_turns": sess["total_turns"] or 0,
                "completed": bool(sess["completed"]),
                "final_mastery": sess["final_mastery"],
                "duration_sec": sess["duration_sec"],
                "created_at": sess["created_at"],
                "updated_at": sess["updated_at"],
                "message_count": len(messages),
                "messages": messages,
                "checklist_items": checklist_items,
                "checklist_state": checklist_state,
                "confirmed_count": confirmed_count,
                "total_items": total_items,
                "last_score": last_int["score"] if last_int else None,
                "last_moving_avg": last_int["moving_avg"] if last_int else None,
            })

        return {
            "node_id": node_id,
            "total_sessions": len(sessions_list),
            "sessions": sessions_list,
        }
    finally:
        await db.close()


@router.get("/test/session-report")
async def get_session_report(session_id: str, request: Request):
    """세션별 상세 성적 디버깅 리포트.

    v8.2: concept_results, rubric, matched_count, total_count,
          bloom_weights, report_json 포함.
    """
    user_id = request.cookies.get("ale_user")
    if not user_id:
        return JSONResponse({"error": "로그인 필요"}, status_code=401)

    db = await get_db()
    try:
        # 세션 기본 정보 + report_json
        cursor = await db.execute(
            """SELECT id, node_id, mode, status, pre_score, pre_bloom,
                      post_score, post_bloom, gain, learning_duration_sec,
                      created_at, updated_at
               FROM sessions WHERE id = ? AND learner_id = ?""",
            (session_id, user_id),
        )
        sess = await cursor.fetchone()
        if not sess:
            return JSONResponse({"error": "세션을 찾을 수 없습니다"}, status_code=404)

        sess_data = dict(sess)

        # report_json 조회 (컬럼 존재할 때만)
        report_json = None
        try:
            rj_cursor = await db.execute(
                "SELECT report_json FROM sessions WHERE id = ?", (session_id,)
            )
            rj_row = await rj_cursor.fetchone()
            if rj_row and rj_row["report_json"]:
                report_json = json.loads(rj_row["report_json"])
        except Exception:
            pass

        # pre/post 응답 가져오기
        pre_responses = await get_test_responses(session_id, "pre_test")
        post_responses = await get_test_responses(session_id, "post_test")

        # v8.2: 문항 정보 + 채점 근거 데이터 전부 포함
        async def enrich_responses(responses):
            enriched = []
            for r in responses:
                item_cursor = await db.execute(
                    "SELECT question, bloom_level, item_type, rubric, correct FROM test_items WHERE item_id = ?",
                    (r.get("item_id"),),
                )
                item_row = await item_cursor.fetchone()

                # rubric 파싱
                rubric_data = None
                if item_row:
                    raw_rubric = item_row["rubric"] if "rubric" in item_row.keys() else None
                    if raw_rubric:
                        try:
                            rubric_data = json.loads(raw_rubric) if isinstance(raw_rubric, str) else raw_rubric
                        except Exception:
                            rubric_data = None

                # concept_results 파싱
                concept_data = None
                raw_concept = r.get("concept_results")
                if raw_concept:
                    try:
                        concept_data = json.loads(raw_concept) if isinstance(raw_concept, str) else raw_concept
                    except Exception:
                        concept_data = None

                enriched.append({
                    "item_id": r.get("item_id"),
                    "question": item_row["question"] if item_row else "",
                    "item_type": item_row["item_type"] if item_row else "short_answer",
                    "bloom_level": r.get("bloom_level", "remember"),
                    # 학습자 응답 원문
                    "response": r.get("response", ""),
                    # 채점 결과
                    "auto_score": r.get("auto_score", 0),
                    "elapsed_sec": r.get("elapsed_sec"),
                    # v8.2: 채점 근거
                    "matched_count": r.get("matched_count"),
                    "total_count": r.get("total_count"),
                    "concept_results": concept_data,
                    "rubric": rubric_data,
                })
            return enriched

        pre_items = await enrich_responses(pre_responses)
        post_items = await enrich_responses(post_responses)

        # Bloom 분포 계산
        def bloom_dist(items):
            dist = {}
            for it in items:
                b = it.get("bloom_level", "remember")
                dist[b] = dist.get(b, 0) + 1
            return dist

        bloom_distribution = {
            "pre": bloom_dist(pre_items),
            "post": bloom_dist(post_items),
        }

        # Bloom별 평균 점수
        def bloom_avg_scores(items):
            bloom_scores = {}
            bloom_counts = {}
            for it in items:
                b = it.get("bloom_level", "remember")
                bloom_scores[b] = bloom_scores.get(b, 0) + it.get("auto_score", 0)
                bloom_counts[b] = bloom_counts.get(b, 0) + 1
            return {b: round(bloom_scores[b] / bloom_counts[b], 3) for b in bloom_scores}

        bloom_scores = {
            "pre": bloom_avg_scores(pre_items),
            "post": bloom_avg_scores(post_items),
        }

        return {
            "session_id": session_id,
            "node_id": sess_data.get("node_id"),
            "mode": sess_data.get("mode"),
            "status": sess_data.get("status"),
            "pre_score": sess_data.get("pre_score"),
            "post_score": sess_data.get("post_score"),
            "gain": sess_data.get("gain"),
            "pre_bloom": sess_data.get("pre_bloom"),
            "post_bloom": sess_data.get("post_bloom"),
            "learning_duration_sec": sess_data.get("learning_duration_sec"),
            "created_at": sess_data.get("created_at"),
            "pre_items": pre_items,
            "post_items": post_items,
            "bloom_distribution": bloom_distribution,
            "bloom_scores": bloom_scores,
            # v8.2 추가
            "bloom_weights": {
                "remember": 1.0,
                "understand": 1.2,
                "apply": 1.4,
                "analyze": 1.6,
                "evaluate": 1.8,
                "create": 2.0,
            },
            "scoring_method": "bloom_weighted_average",
            "report": report_json,
        }
    finally:
        await db.close()