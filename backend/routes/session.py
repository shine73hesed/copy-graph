# backend/routes/session.py
"""
세션 생명주기 — 생성, 상태 조회, 복원, 재개
"""

import json
import time
import uuid
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import sessions
from routes.kg import get_next_nodes, get_connected_nodes
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
from services.content_loader import load_wiki_doc, find_plan_for_node, list_available_nodes, load_unified_content, load_checklist_from_plan
from services.kg_service import get_node_bkt_params, KG_DATA
from services.claude_client import generate_tutor_response
from services.state_machine import get_learning_target
from services.logger import (
    log_request, log_response,
    log_gate, log_tutor, log_error,
)
from database import (
    save_conversation, get_db, create_session, create_session_v8,
    get_conversation, get_session_interactions,
    save_session_checklist, get_session_checklist,
    load_test_items,
)

router = APIRouter()


@router.post("/test/start")
async def start_test_session(request: Request):
    """노드 선택 → 세션 생성 → 첫 임상 사례 제시"""
    data = await request.json()
    log_request("/test/start", data)

    try:
        node_id = data["node_id"]
        role = data.get("role", "nurse")
        mode = data.get("mode", "tutoring")  # 'reading' | 'tutoring' | 'random'
        # 쿠키 또는 요청 데이터에서 유저 ID 추출
        user_id = data.get("learner_id") or request.cookies.get("ale_user") or "anonymous"
        learner_id = user_id

        # v8: random 모드면 라운드로빈 배정
        if mode == "random":
            import random
            mode = random.choice(["reading", "tutoring"])

        # DB와 인메모리에 같은 session_id 사용 (v8: mode 포함)
        session_id = await create_session_v8(user_id, node_id, mode)
        print(f"[DB_DEBUG] create_session: sid={session_id}, user={user_id}, node={node_id}")

        # 콘텐츠 및 BKT 파라미터 로드
        # 통합 콘텐츠 파일 우선, 없으면 기존 분산 파일 폴백
        unified = load_unified_content(node_id)
        wiki_doc = unified["wiki_doc"] or load_wiki_doc(node_id)
        plan_guide = unified["plan_guide"] or find_plan_for_node(node_id)
        unified_checklist = unified.get("checklist_items", [])
        bkt_params = get_node_bkt_params(node_id)

        # ── 통합 노드 파일이 없으면 자동 생성 + 저장 ──
        if not unified["wiki_doc"] and wiki_doc:
            print(f"[AUTO_GEN] no unified file for {node_id}, generating...")
            try:
                from services.claude_client import generate_unified_node
                from services.content_loader import save_unified_content
                generated_md = await generate_unified_node(node_id, wiki_doc)
                save_unified_content(node_id, generated_md)
                # 생성된 파일을 다시 파싱
                unified = load_unified_content(node_id)
                if unified["wiki_doc"]:
                    wiki_doc = unified["wiki_doc"]
                if unified["plan_guide"]:
                    plan_guide = unified["plan_guide"]
                if unified.get("checklist_items"):
                    unified_checklist = unified["checklist_items"]
                print(f"[AUTO_GEN] saved: nodes/{node_id}.md, checklist={len(unified_checklist)} items")
            except Exception as e:
                print(f"[AUTO_GEN] failed for {node_id}: {e}")

        # 복원된 대화 이력이 있으면 사용, 없으면 새로 시작
        restore_history = data.get("restore_history")
        restore_checklist = data.get("restore_checklist")

        if restore_history and len(restore_history) > 0:
            print(f"[DB_DEBUG] restore_history mode: {len(restore_history)} messages")
            conversation_history = []
            for msg in restore_history:
                conversation_history.append({"role": msg["role"], "content": msg["content"]})

            restored_cl_state = restore_checklist if restore_checklist else {}

            last_tutor = ""
            for msg in reversed(conversation_history):
                if msg["role"] == "assistant":
                    last_tutor = msg["content"]
                    break

            # 체크리스트: plan/checklist(정본) → 통합 파일(nodes) → plan_guide □ 파싱 → 자동 생성
            checklist_items = load_checklist_from_plan(node_id)
            cl_source = "plan_checklist"

            if not checklist_items:
                checklist_items = unified_checklist if unified_checklist else []
                cl_source = "unified" if checklist_items else ""

            if not checklist_items:
                # plan_guide에서 해당 노드 섹션의 □ 파싱
                in_node_section = False
                for line in plan_guide.split('\n'):
                    stripped = line.strip()
                    if stripped.startswith('## ') and node_id in stripped and '체크리스트' in stripped:
                        in_node_section = True
                        continue
                    if in_node_section and stripped.startswith('## '):
                        break
                    if in_node_section and stripped == '---':
                        break
                    if in_node_section and stripped.startswith('□'):
                        parts = stripped[1:].strip().split(':', 1)
                        if len(parts) == 2:
                            checklist_items.append({"id": parts[0].strip(), "label": parts[1].strip(), "done": False})
                cl_source = "parsed" if checklist_items else ""

            if not checklist_items:
                from services.claude_client import generate_checklist
                checklist_items = await generate_checklist(node_id, wiki_doc)
                cl_source = "generated"
                print(f"[DEBUG] auto-generated checklist for {node_id}")

            print(f"[DEBUG] final checklist source: {cl_source}, items={[it['id']+': '+it['label'][:20] for it in checklist_items]}")

            # ── 체크리스트 DB 저장 (복원 세션도 새 session_id이므로 저장) ──
            await save_session_checklist(session_id, checklist_items, source=cl_source)

            user_turns = sum(1 for m in conversation_history if m["role"] == "user")

            # 이전 세션에서 score_history 복원 (같은 유저+노드의 최근 세션)
            restored_scores = []
            try:
                db_temp = await get_db()
                cursor_s = await db_temp.execute(
                    "SELECT id FROM sessions WHERE learner_id=? AND node_id=? AND id!=? ORDER BY updated_at DESC LIMIT 1",
                    (learner_id, node_id, session_id),
                )
                prev_sess = await cursor_s.fetchone()
                if prev_sess:
                    prev_interactions = await get_session_interactions(prev_sess["id"])
                    restored_scores = [r["score"] for r in prev_interactions if r.get("score") is not None]
                await db_temp.close()
            except Exception:
                pass

            sessions[session_id] = {
                "session_id": session_id,
                "node_id": node_id,
                "learner_id": learner_id,
                "role": role,
                "mode": mode,
                "status": f"learning_{mode}",
                "turn": user_turns,
                "mastery": P_INIT,
                "mastery_history": [],
                "score_history": restored_scores,
                "streak": 0,
                "zpd": "unknown",
                "struggle": "too_early",
                "gate_a": False,
                "gate_b": False,
                "completed": False,
                "start_time": time.time(),
                "learning_started_at": time.time(),
                "wiki_doc": wiki_doc,
                "plan_guide": plan_guide,
                "bkt_params": bkt_params,
                "conversation_history": conversation_history,
                "checklist_items": checklist_items,
                "checklist_state": restored_cl_state,
                "checklist_history": [restored_cl_state] if restored_cl_state else [],
                "sprint": 1,
                "handoff": None,
                "sprint_history": [],
            }

            connected = get_connected_nodes(node_id)
            print(f"[DB_DEBUG] restore_start complete: new_sid={session_id}, history_len={len(conversation_history)}, cl_items={len(checklist_items)}, user_turns={user_turns}")
            return {
                "session_id": session_id,
                "first_message": last_tutor or "이전 대화를 이어갑니다.",
                "checklist_items": checklist_items,
                "connected_nodes": connected,
                "restored": True,
            }

        # 첫 PS-I 사례 생성 — 학습 시작 요청으로 튜터 호출
        conversation_history = [
            {"role": "user", "content": "이 주제에 대해 학습을 시작합니다"}
        ]
        first_result = await generate_tutor_response(
            node_id=node_id,
            role=role,
            mastery=P_INIT,
            wiki_doc=wiki_doc,
            plan_guide=plan_guide,
            conversation_history=conversation_history,
            learning_state="",
        )
        first_message = first_result["text"]
        log_tutor(first_message)

        # 대화 이력에 튜터 응답 추가
        conversation_history.append({"role": "assistant", "content": first_message})

        # 첫 튜터 메시지 저장
        await save_conversation(session_id, learner_id, node_id, 0, "assistant", first_message)
        print(f"[DB_SAVE] start: sid={session_id}, turn=0, role=assistant, len={len(first_message)}")

        # 체크리스트: plan/checklist(정본) → 통합 파일(nodes) → plan_guide □ 파싱 → 자동 생성
        checklist_items = load_checklist_from_plan(node_id)
        cl_source = "plan_checklist"

        if not checklist_items:
            checklist_items = unified_checklist if unified_checklist else []
            cl_source = "unified" if checklist_items else ""

        if not checklist_items:
            # plan_guide에서 해당 노드 섹션의 □ 파싱
            in_node_section = False
            for line in plan_guide.split('\n'):
                stripped = line.strip()
                if stripped.startswith('## ') and node_id in stripped and '체크리스트' in stripped:
                    in_node_section = True
                    continue
                if in_node_section and stripped.startswith('## '):
                    break
                if in_node_section and stripped == '---':
                    break
                if in_node_section and stripped.startswith('□'):
                    parts = stripped[1:].strip().split(':', 1)
                    if len(parts) == 2:
                        checklist_items.append({"id": parts[0].strip(), "label": parts[1].strip(), "done": False})
            cl_source = "parsed" if checklist_items else ""

        if not checklist_items:
            from services.claude_client import generate_checklist
            checklist_items = await generate_checklist(node_id, wiki_doc)
            cl_source = "generated"
            print(f"[DEBUG] auto-generated checklist for {node_id}")

        print(f"[DEBUG] final checklist source: {cl_source}, items={[it['id']+': '+it['label'][:20] for it in checklist_items]}")

        # ── 체크리스트 DB 저장 (서버 재시작 후에도 보존) ──
        await save_session_checklist(session_id, checklist_items, source=cl_source)

        # v8: pre_test 문항 로딩
        pre_items = await load_test_items(node_id, form="A", phase="pre_test")

        # 세션 초기 상태
        sessions[session_id] = {
            "session_id": session_id,
            "node_id": node_id,
            "learner_id": learner_id,
            "role": role,
            "mode": mode,
            "status": "pre_test",
            "turn": 0,
            "mastery": P_INIT,
            "mastery_history": [],
            "score_history": [],
            "streak": 0,
            "zpd": "unknown",
            "struggle": "too_early",
            "gate_a": False,
            "gate_b": False,
            "completed": False,
            "start_time": time.time(),
            "learning_started_at": None,
            # 콘텐츠 캐시 — 매 턴 재로드 방지
            "wiki_doc": wiki_doc,
            "plan_guide": plan_guide,
            # 노드별 BKT 파라미터
            "bkt_params": bkt_params,
            # 대화 이력 — Claude API messages 형식
            "conversation_history": conversation_history,
            # 체크리스트 항목 (plan_guide에서 파싱)
            "checklist_items": checklist_items,
            # 체크리스트 상태 (Analyst가 매 턴 업데이트)
            "checklist_state": {},
            "checklist_history": [],
            "sprint": 1,
            "handoff": None,
            "sprint_history": [],
            # v8: pre/post 점수
            "pre_items": pre_items,
            "first_message": first_message,
        }

        # KG 연결 노드 (선수+후속)
        connected = get_connected_nodes(node_id)

        result = {
            "session_id": session_id,
            "mode": mode,
            "status": "pre_test",
            "first_message": first_message,
            "checklist_items": checklist_items,
            "connected_nodes": connected,
            "pre_test_items": pre_items,
        }
        log_response("/test/start", result)
        return result

    except Exception as e:
        log_error("/test/start", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/test/status")
async def get_session_status(session_id: str):
    """현재 세션 상태 조회 — 인메모리 우선, 없으면 DB 폴백"""
    from routes.shared import sessions

    session = sessions.get(session_id)
    if session:
        # 읽기 세션은 tutoring 필드가 없음
        if session.get("mode") == "reading" or "mastery" not in session:
            return {
                "session_id": session.get("session_id") or session_id,
                "status": session.get("status", "active"),
                "node_id": session.get("node_id", ""),
                "completed": session.get("completed", False),
                "mode": session.get("mode", "reading"),
                "pre_score": session.get("pre_score"),
                "post_score": session.get("post_score"),
            }

        try:
            from services.tutor import smoothed_mastery
            smoothed = smoothed_mastery(session.get("mastery_history", []))
        except Exception:
            smoothed = 0

        return {
            "session_id": session["session_id"],
            "status": session["status"],
            "node_id": session["node_id"],
            "turn": session["turn"],
            "completed": session.get("completed", False),
            "bkt": {
                "mastery": session["mastery"],
                "smoothed": smoothed,
                "streak": session["streak"],
            },
            "zpd": {
                "position": session["zpd"],
                "struggle": session["struggle"],
            },
            "gate": {
                "gate_a": session["gate_a"],
                "gate_b": session["gate_b"],
                "completed": session["completed"],
            },
            "score_history": session["score_history"],
            "mastery_history": session["mastery_history"],
        }

    # v8.2: 인메모리에 없으면 DB 폴백
    from database import get_db
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT id, node_id, mode, status, total_turns, completed,
                      pre_score, post_score, final_mastery
               FROM sessions WHERE id = ?""",
            (session_id,),
        )
        row = await cursor.fetchone()
        if not row:
            from fastapi.responses import JSONResponse
            return JSONResponse({"error": "세션을 찾을 수 없습니다"}, status_code=404)

        sess = dict(row)
        return {
            "session_id": session_id,
            "status": sess.get("status", "pre_test"),
            "node_id": sess.get("node_id"),
            "mode": sess.get("mode"),
            "turn": sess.get("total_turns", 0),
            "completed": bool(sess.get("completed")),
            "pre_score": sess.get("pre_score"),
            "post_score": sess.get("post_score"),
            "bkt": {"mastery": sess.get("final_mastery", 0)},
        }
    finally:
        await db.close()


@router.get("/test/sessions")
async def list_sessions(request: Request):
    """유저의 이전 세션 목록 반환"""
    user_id = request.cookies.get("ale_user")
    if not user_id:
        return JSONResponse({"error": "로그인 필요"}, status_code=401)

    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT s.id, s.node_id, s.mode, s.status, s.total_turns, s.completed,
                      s.pre_score, s.post_score, s.created_at, s.updated_at
               FROM sessions s WHERE s.learner_id = ? ORDER BY s.updated_at DESC LIMIT 20""",
            (user_id,),
        )
        rows = await cursor.fetchall()
        return {"sessions": [dict(r) for r in rows]}
    finally:
        await db.close()


@router.get("/test/restore")
async def restore_session(session_id: str, request: Request):
    """이전 세션의 대화 이력을 복원"""
    user_id = request.cookies.get("ale_user")
    if not user_id:
        return JSONResponse({"error": "로그인 필요"}, status_code=401)

    print(f"[DB_RESTORE] request: sid={session_id}, user={user_id}")

    conversation = await get_conversation(session_id)
    interactions = await get_session_interactions(session_id)

    print(f"[DB_RESTORE] sid={session_id}, conv_count={len(conversation)}, interaction_count={len(interactions)}")
    if conversation:
        print(f"[DB_RESTORE] first: role={conversation[0].get('role')}, content={str(conversation[0].get('content',''))[:60]}")
        print(f"[DB_RESTORE] last: role={conversation[-1].get('role')}, content={str(conversation[-1].get('content',''))[:60]}")
    else:
        print(f"[DB_RESTORE] WARNING: No conversation found for sid={session_id}")

    # 세션의 node_id 조회
    db = await get_db()
    try:
        cursor = await db.execute("SELECT node_id FROM sessions WHERE id=?", (session_id,))
        sess_row = await cursor.fetchone()
        node_id = sess_row["node_id"] if sess_row else "치매_개요"
        print(f"[DB_RESTORE] node_id={node_id}")
    finally:
        await db.close()

    # ── 체크리스트 items: DB 우선, 없으면 파일 파싱 폴백 ──
    checklist_items = await get_session_checklist(session_id)
    print(f"[DB_RESTORE] checklist_items from DB: {len(checklist_items)} items")

    if not checklist_items:
        # DB에 없는 구버전 세션 → 기존 파싱 로직 폴백
        plan_guide = find_plan_for_node(node_id)
        in_node_section = False
        for line in plan_guide.split('\n'):
            stripped = line.strip()
            if stripped.startswith('## ') and node_id in stripped and '체크리스트' in stripped:
                in_node_section = True
                continue
            if in_node_section and stripped.startswith('## '):
                break
            if in_node_section and stripped == '---':
                break
            if in_node_section and stripped.startswith('□'):
                parts = stripped[1:].strip().split(':', 1)
                if len(parts) == 2:
                    checklist_items.append({"id": parts[0].strip(), "label": parts[1].strip()})
        print(f"[DB_RESTORE] checklist_items from file parse: {len(checklist_items)} items")

    last = interactions[-1] if interactions else None

    result = {
        "session_id": session_id,
        "node_id": node_id,
        "conversation": conversation,
        "checklist_items": checklist_items,
        "score_history": [i["score"] for i in interactions if i.get("score") is not None],
        "last_state": {
            "moving_avg": last.get("moving_avg", 0) if last else 0,
            "trend": last.get("trend", 0) if last else 0,
            "checklist_state": last.get("checklist_state") if last else None,
            "turn": last["turn"] if last else 0,
            "mastery": last.get("mastery_after", 0) if last else 0,
        } if last else None,
    }
    print(f"[DB_RESTORE] returning: conv={len(conversation)}, cl_items={len(checklist_items)}, has_last_state={last is not None}")
    return result


@router.post("/test/resume")
async def resume_session(request: Request):
    """기존 세션 ID를 그대로 재사용하며 인메모리 세션만 복구. DB에 새 세션을 만들지 않음."""
    data = await request.json()
    log_request("/test/resume", data)

    try:
        session_id = data["session_id"]
        node_id = data["node_id"]
        role = data.get("role", "nurse")
        user_id = request.cookies.get("ale_user") or "anonymous"
        restore_history = data.get("restore_history", [])
        restore_checklist = data.get("restore_checklist", {})

        print(f"[DB_RESUME] sid={session_id}, node={node_id}, history_len={len(restore_history)}")

        # 이미 인메모리에 있으면 그대로 반환
        if session_id in sessions:
            print(f"[DB_RESUME] already in memory, skipping")
            sess = sessions[session_id]
            return {
                "session_id": session_id,
                "resumed": True,
                "checklist_items": sess.get("checklist_items", []),
            }

        # 콘텐츠 로드
        unified = load_unified_content(node_id)
        wiki_doc = unified["wiki_doc"] or load_wiki_doc(node_id)
        plan_guide = unified["plan_guide"] or find_plan_for_node(node_id)
        unified_checklist = unified.get("checklist_items", [])
        bkt_params = get_node_bkt_params(node_id)

        # 대화 이력 구성
        conversation_history = []
        for msg in restore_history:
            conversation_history.append({"role": msg["role"], "content": msg["content"]})

        # 체크리스트 items: plan/checklist(정본) → DB 저장분 → unified → plan_guide □ 파싱 → 자동 생성
        checklist_items = load_checklist_from_plan(node_id)
        if not checklist_items:
            checklist_items = await get_session_checklist(session_id)
        if not checklist_items:
            checklist_items = unified_checklist if unified_checklist else []
        if not checklist_items:
            in_node_section = False
            for line in plan_guide.split('\n'):
                stripped = line.strip()
                if stripped.startswith('## ') and node_id in stripped and '체크리스트' in stripped:
                    in_node_section = True
                    continue
                if in_node_section and stripped.startswith('## '):
                    break
                if in_node_section and stripped == '---':
                    break
                if in_node_section and stripped.startswith('□'):
                    parts = stripped[1:].strip().split(':', 1)
                    if len(parts) == 2:
                        checklist_items.append({"id": parts[0].strip(), "label": parts[1].strip()})
        if not checklist_items:
            from services.claude_client import generate_checklist
            checklist_items = await generate_checklist(node_id, wiki_doc)

        user_turns = sum(1 for m in conversation_history if m["role"] == "user")
        restored_cl_state = restore_checklist if restore_checklist else {}

        # DB에서 score_history 복원
        interact_rows = await get_session_interactions(session_id)
        restored_scores = [r["score"] for r in interact_rows if r.get("score") is not None]
        restored_mastery = interact_rows[-1].get("mastery_after", P_INIT) if interact_rows else P_INIT

        # 인메모리 세션 구성 (기존 session_id 사용!)
        resume_mode = data.get("mode", "tutoring")
        sessions[session_id] = {
            "session_id": session_id,
            "node_id": node_id,
            "learner_id": user_id,
            "role": role,
            "mode": resume_mode,
            "status": f"learning_{resume_mode}",
            "turn": user_turns,
            "mastery": restored_mastery,
            "mastery_history": [],
            "score_history": restored_scores,
            "streak": 0,
            "zpd": "unknown",
            "struggle": "too_early",
            "gate_a": False,
            "gate_b": False,
            "completed": False,
            "start_time": time.time(),
            "learning_started_at": time.time(),
            "wiki_doc": wiki_doc,
            "plan_guide": plan_guide,
            "bkt_params": bkt_params,
            "conversation_history": conversation_history,
            "checklist_items": checklist_items,
            "checklist_state": restored_cl_state,
            "checklist_history": [restored_cl_state] if restored_cl_state else [],
            "sprint": 1,
            "handoff": None,
            "sprint_history": [],
        }

        print(f"[DB_RESUME] inmemory restored: sid={session_id}, turns={user_turns}, scores={len(restored_scores)}, cl_items={len(checklist_items)}")

        return {
            "session_id": session_id,
            "resumed": True,
            "checklist_items": checklist_items,
        }

    except Exception as e:
        log_error("/test/resume", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.delete("/test/delete-session")
async def delete_session(session_id: str, request: Request):
    """세션 + 관련 데이터 삭제."""
    user_id = request.cookies.get("ale_user")
    if not user_id:
        return JSONResponse({"error": "로그인 필요"}, status_code=401)

    # 인메모리 세션 제거
    sessions.pop(session_id, None)

    db = await get_db()
    try:
        # 소유자 확인
        cursor = await db.execute(
            "SELECT id FROM sessions WHERE id = ? AND learner_id = ?",
            (session_id, user_id),
        )
        if not await cursor.fetchone():
            return JSONResponse({"error": "세션을 찾을 수 없습니다"}, status_code=404)

        # 관련 테이블 삭제
        await db.execute("DELETE FROM conversation_logs WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM interaction_logs WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM test_responses WHERE session_id = ?", (session_id,))
        try:
            await db.execute("DELETE FROM session_checklist WHERE session_id = ?", (session_id,))
        except Exception:
            pass
        try:
            await db.execute("DELETE FROM reading_logs WHERE session_id = ?", (session_id,))
        except Exception:
            pass
        # 세션 자체 삭제
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()

        print(f"[DELETE] session {session_id} deleted by {user_id}")
        return {"ok": True, "session_id": session_id}
    finally:
        await db.close()
