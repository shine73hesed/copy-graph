# backend/routes/admin_dashboard.py
"""
v8.4 관리자 학습자 추적 대시보드 API
- 전체 현황 (overview, learners)
- 학습자별 상세 (learner detail, session detail)
- 모드 비교 (mode-comparison, bloom-comparison)
"""

import json
import time
from fastapi import APIRouter, HTTPException, Request
from database import get_db

router = APIRouter(prefix="/api", tags=["admin-dashboard"])

# ── 노드 한글 라벨 매핑 ──
NODE_LABELS = {
    "치매_개요": "치매 개요",
    "알츠하이머병": "알츠하이머병",
    "의사소통기법": "의사소통기법",
    "배회": "배회",
}

def _node_label(node_id: str) -> str:
    return NODE_LABELS.get(node_id, node_id)

def _sec_to_display(sec) -> str:
    if sec is None or sec == 0:
        return "0분"
    sec = int(sec)
    if sec < 60:
        return f"{sec}초"
    if sec < 3600:
        return f"{sec // 60}분"
    h = sec // 3600
    m = (sec % 3600) // 60
    return f"{h}시간 {m}분" if m else f"{h}시간"

def _time_ago(ts) -> str:
    if ts is None:
        return "—"
    diff = time.time() - ts
    if diff < 60:
        return "방금 전"
    if diff < 3600:
        return f"{int(diff // 60)}분 전"
    if diff < 86400:
        return f"{int(diff // 3600)}시간 전"
    return f"{int(diff // 86400)}일 전"


# ═══════════════════════════════════════════════════
# 탭 ① 전체 현황
# ═══════════════════════════════════════════════════

@router.get("/admin/dashboard/overview")
async def overview():
    """KPI 카드용 전체 통계"""
    db = await get_db()
    try:
        # 학습자 수
        cur = await db.execute("SELECT COUNT(*) FROM users")
        total_learners = (await cur.fetchone())[0]

        # 세션 통계
        cur = await db.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done,
                COALESCE(SUM(
                    CASE WHEN learning_duration_sec IS NOT NULL AND learning_duration_sec > 0
                         THEN learning_duration_sec
                         ELSE MAX(0, COALESCE(updated_at - created_at, 0))
                    END
                ), 0) as total_sec
            FROM sessions
        """)
        row = await cur.fetchone()
        total_sessions = row[0]
        completed_sessions = row[1] or 0
        total_learning_sec = row[2] or 0

        # 비용
        cur = await db.execute("""
            SELECT
                COALESCE(SUM(cost_usd), 0),
                COALESCE(SUM(input_tokens), 0),
                COALESCE(SUM(output_tokens), 0)
            FROM interaction_logs
        """)
        cost_row = await cur.fetchone()

        # 이번 주 신규 학습자 (최근 7일)
        week_ago = time.time() - 7 * 86400
        cur = await db.execute(
            "SELECT COUNT(*) FROM users WHERE created_at >= ?", (week_ago,)
        )
        new_this_week = (await cur.fetchone())[0]

        avg_per_learner = (
            _sec_to_display(total_learning_sec / total_learners)
            if total_learners > 0 else "0분"
        )

        return {
            "total_learners": total_learners,
            "new_this_week": new_this_week,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "total_learning_sec": total_learning_sec,
            "total_learning_display": _sec_to_display(total_learning_sec),
            "avg_per_learner": avg_per_learner,
            "total_cost_usd": round(cost_row[0], 4),
            "total_input_tokens": cost_row[1],
            "total_output_tokens": cost_row[2],
        }
    finally:
        await db.close()


@router.get("/admin/dashboard/learners")
async def learners_list():
    """학습자 목록 + 완료 노드 수, 총 학습 시간, 마지막 활동"""
    db = await get_db()
    try:
        # 학습자별 세션 집계
        cur = await db.execute("""
            SELECT
                u.user_id as learner_id,
                u.display_name as username,
                u.created_at,
                COUNT(DISTINCT CASE WHEN s.completed = 1 THEN s.node_id END) as completed_nodes,
                COALESCE(SUM(
                    CASE WHEN s.learning_duration_sec IS NOT NULL AND s.learning_duration_sec > 0
                         THEN s.learning_duration_sec
                         ELSE MAX(0, COALESCE(s.updated_at - s.created_at, 0))
                    END
                ), 0) as total_sec,
                MAX(s.updated_at) as last_activity
            FROM users u
            LEFT JOIN sessions s ON u.user_id = s.learner_id
            GROUP BY u.user_id
            ORDER BY last_activity DESC NULLS LAST
        """)
        rows = await cur.fetchall()

        # 전체 노드 수 (고정 4개이지만 DB 기반으로도 가능)
        total_nodes = len(NODE_LABELS)

        result = []
        for r in rows:
            result.append({
                "learner_id": r["learner_id"],
                "username": r["username"],
                "created_at": r["created_at"],
                "completed_nodes": r["completed_nodes"],
                "total_nodes": total_nodes,
                "total_learning_sec": r["total_sec"],
                "total_learning_display": _sec_to_display(r["total_sec"]),
                "last_activity": r["last_activity"],
                "last_activity_display": _time_ago(r["last_activity"]),
            })

        return {"learners": result}
    finally:
        await db.close()


# ═══════════════════════════════════════════════════
# 탭 ② 학습자별 상세
# ═══════════════════════════════════════════════════

@router.get("/admin/dashboard/learner/{learner_id}")
async def learner_detail(learner_id: str):
    """학습자 KPI + 노드별 진도 + 세션 이력"""
    db = await get_db()
    try:
        # 학습자 확인
        cur = await db.execute(
            "SELECT * FROM users WHERE user_id = ?", (learner_id,)
        )
        learner = await cur.fetchone()
        if not learner:
            raise HTTPException(404, "학습자 없음")

        # 세션 목록
        cur = await db.execute("""
            SELECT
                id, node_id, mode, status, completed,
                pre_score, post_score, gain,
                total_turns, learning_duration_sec,
                created_at, updated_at
            FROM sessions
            WHERE learner_id = ?
            ORDER BY created_at DESC
        """, (learner_id,))
        sessions = [dict(r) for r in await cur.fetchall()]

        # 노드별 진도 계산
        node_progress = {}
        for nid in NODE_LABELS:
            node_sessions = [s for s in sessions if s["node_id"] == nid]
            if not node_sessions:
                node_progress[nid] = {
                    "node_id": nid,
                    "label": _node_label(nid),
                    "status": "not_started",
                    "progress": 0,
                }
            elif any(s["completed"] for s in node_sessions):
                node_progress[nid] = {
                    "node_id": nid,
                    "label": _node_label(nid),
                    "status": "completed",
                    "progress": 100,
                }
            else:
                # 진행 중: 체크리스트 기반 진도 계산
                latest = node_sessions[0]
                progress = await _calc_checklist_progress(db, latest["id"])
                node_progress[nid] = {
                    "node_id": nid,
                    "label": _node_label(nid),
                    "status": "in_progress",
                    "progress": progress,
                }

        # 세션별 체크리스트 요약 추가
        for s in sessions:
            cl = await _get_checklist_summary(db, s["id"])
            s["checklist_done"] = cl["done"]
            s["checklist_total"] = cl["total"]
            dur = s["learning_duration_sec"]
            if not dur or dur <= 0:
                dur = max(0, (s["updated_at"] or 0) - (s["created_at"] or 0))
            s["_effective_duration"] = dur
            s["learning_display"] = _sec_to_display(dur)
            s["node_label"] = _node_label(s["node_id"])

        # KPI
        completed_nodes = sum(1 for v in node_progress.values() if v["status"] == "completed")
        total_sec = sum(s["_effective_duration"] for s in sessions)
        total_sessions_count = len(sessions)
        completed_sessions_count = sum(1 for s in sessions if s["completed"])

        return {
            "learner_id": learner_id,
            "username": dict(learner).get("display_name") or dict(learner)["user_id"],
            "kpi": {
                "total_learning_sec": total_sec,
                "total_learning_display": _sec_to_display(total_sec),
                "completed_nodes": completed_nodes,
                "total_nodes": len(NODE_LABELS),
                "total_sessions": total_sessions_count,
                "completed_sessions": completed_sessions_count,
                "active_sessions": total_sessions_count - completed_sessions_count,
            },
            "node_progress": list(node_progress.values()),
            "sessions": sessions,
        }
    finally:
        await db.close()


async def _calc_checklist_progress(db, session_id: str) -> int:
    """체크리스트 기반 진도 퍼센트 계산 (0~100)"""
    # 체크리스트 항목 수
    cur = await db.execute(
        "SELECT COUNT(*) FROM session_checklist WHERE session_id = ?",
        (session_id,),
    )
    total = (await cur.fetchone())[0]
    if total == 0:
        return 0

    # 마지막 턴의 checklist_state에서 confirmed 개수
    cur = await db.execute("""
        SELECT checklist_state FROM interaction_logs
        WHERE session_id = ? AND checklist_state IS NOT NULL
        ORDER BY turn DESC LIMIT 1
    """, (session_id,))
    row = await cur.fetchone()
    if not row or not row["checklist_state"]:
        return 0

    try:
        state = json.loads(row["checklist_state"])
        if isinstance(state, dict):
            confirmed = sum(1 for v in state.values() if v == "confirmed")
        elif isinstance(state, list):
            confirmed = sum(1 for item in state if item.get("status") == "confirmed")
        else:
            confirmed = 0
    except (json.JSONDecodeError, TypeError):
        confirmed = 0

    return round(confirmed / total * 100)


async def _get_checklist_summary(db, session_id: str) -> dict:
    """세션의 체크리스트 done/total 반환"""
    cur = await db.execute(
        "SELECT COUNT(*) FROM session_checklist WHERE session_id = ?",
        (session_id,),
    )
    total = (await cur.fetchone())[0]
    if total == 0:
        return {"done": 0, "total": 0}

    cur = await db.execute("""
        SELECT checklist_state FROM interaction_logs
        WHERE session_id = ? AND checklist_state IS NOT NULL
        ORDER BY turn DESC LIMIT 1
    """, (session_id,))
    row = await cur.fetchone()
    if not row or not row["checklist_state"]:
        return {"done": 0, "total": total}

    try:
        state = json.loads(row["checklist_state"])
        if isinstance(state, dict):
            done = sum(1 for v in state.values() if v == "confirmed")
        elif isinstance(state, list):
            done = sum(1 for item in state if item.get("status") == "confirmed")
        else:
            done = 0
    except (json.JSONDecodeError, TypeError):
        done = 0

    return {"done": done, "total": total}


# ═══════════════════════════════════════════════════
# 탭 ② 세션 상세 (확장 패널)
# ═══════════════════════════════════════════════════

@router.get("/admin/dashboard/session/{session_id}/detail")
async def session_detail(session_id: str):
    """세션 확장 패널: 체크리스트, 턴별 점수, 대화, 비용"""
    db = await get_db()
    try:
        # 세션 기본 정보
        cur = await db.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        )
        session = await cur.fetchone()
        if not session:
            raise HTTPException(404, "세션 없음")
        session = dict(session)

        # ── 체크리스트 ──
        cur = await db.execute(
            "SELECT item_id, label FROM session_checklist WHERE session_id = ? ORDER BY rowid",
            (session_id,),
        )
        checklist_items = [{"id": r["item_id"], "label": r["label"]} for r in await cur.fetchall()]

        # 마지막 턴의 checklist_state
        cur = await db.execute("""
            SELECT checklist_state FROM interaction_logs
            WHERE session_id = ? AND checklist_state IS NOT NULL
            ORDER BY turn DESC LIMIT 1
        """, (session_id,))
        state_row = await cur.fetchone()
        cl_state = {}
        if state_row and state_row["checklist_state"]:
            try:
                parsed = json.loads(state_row["checklist_state"])
                if isinstance(parsed, dict):
                    cl_state = parsed
                elif isinstance(parsed, list):
                    cl_state = {item.get("id", str(i)): item.get("status", "not_yet") for i, item in enumerate(parsed)}
            except (json.JSONDecodeError, TypeError):
                pass

        checklist = []
        for item in checklist_items:
            checklist.append({
                "id": item["id"],
                "label": item["label"],
                "status": cl_state.get(item["id"], "not_yet"),
            })

        # ── 턴별 점수 ──
        cur = await db.execute("""
            SELECT turn, score, moving_avg, checklist_state
            FROM interaction_logs
            WHERE session_id = ? AND turn > 0
            ORDER BY turn ASC
        """, (session_id,))
        turn_scores = [
            {
                "turn": r["turn"],
                "score": round(r["score"], 3) if r["score"] is not None else None,
                "moving_avg": round(r["moving_avg"], 3) if r["moving_avg"] is not None else None,
            }
            for r in await cur.fetchall()
        ]

        # ── 대화 ──
        cur = await db.execute("""
            SELECT role, content, turn
            FROM conversation_logs
            WHERE session_id = ?
            ORDER BY timestamp ASC
            LIMIT 50
        """, (session_id,))
        conversation = [dict(r) for r in await cur.fetchall()]

        # ── 비용 ──
        cur = await db.execute("""
            SELECT
                COALESCE(SUM(cost_usd), 0) as cost,
                COALESCE(SUM(input_tokens), 0) as inp,
                COALESCE(SUM(output_tokens), 0) as out
            FROM interaction_logs
            WHERE session_id = ?
        """, (session_id,))
        cost_row = await cur.fetchone()

        # ── Reading 모드 행동 로그 ──
        reading_events = []
        if session.get("mode") == "reading":
            cur = await db.execute("""
                SELECT event_type, event_data, timestamp
                FROM reading_logs
                WHERE session_id = ?
                ORDER BY timestamp ASC
            """, (session_id,))
            reading_events = [dict(r) for r in await cur.fetchall()]

        # ── Pre/Post test 문항별 응답 ──
        test_responses = {"pre_test": [], "post_test": []}
        for phase in ["pre_test", "post_test"]:
            cur = await db.execute("""
                SELECT
                    tr.item_id, tr.test_phase, tr.response,
                    tr.auto_score, tr.bloom_level,
                    tr.matched_count, tr.total_count,
                    ti.question, ti.item_type, ti.correct, ti.options,
                    ti.bloom_level as item_bloom
                FROM test_responses tr
                LEFT JOIN test_items ti ON tr.item_id = ti.item_id
                WHERE tr.session_id = ? AND tr.test_phase = ?
                ORDER BY tr.item_id ASC
            """, (session_id, phase))
            for r in await cur.fetchall():
                row = dict(r)
                # options JSON 파싱
                if row.get("options"):
                    try:
                        row["options"] = json.loads(row["options"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                test_responses[phase].append({
                    "item_id": row["item_id"],
                    "question": row.get("question", ""),
                    "item_type": row.get("item_type", "short_answer"),
                    "bloom_level": row.get("item_bloom") or row.get("bloom_level", ""),
                    "correct": row.get("correct"),
                    "options": row.get("options"),
                    "response": row.get("response", ""),
                    "auto_score": round(row["auto_score"], 3) if row.get("auto_score") is not None else None,
                    "matched_count": row.get("matched_count"),
                    "total_count": row.get("total_count"),
                })

        return {
            "session": {
                "id": session["id"],
                "node_id": session["node_id"],
                "node_label": _node_label(session["node_id"]),
                "mode": session.get("mode", "tutoring"),
                "status": session["status"],
                "completed": bool(session["completed"]),
                "total_turns": session["total_turns"],
                "learning_duration_sec": session.get("learning_duration_sec"),
            },
            "checklist": checklist,
            "turn_scores": turn_scores,
            "conversation": conversation,
            "cost": {
                "total_cost_usd": round(cost_row["cost"], 4),
                "input_tokens": cost_row["inp"],
                "output_tokens": cost_row["out"],
            },
            "reading_events": reading_events,
            "test_responses": test_responses,
        }
    finally:
        await db.close()


# ═══════════════════════════════════════════════════
# 탭 ③ 모드 비교
# ═══════════════════════════════════════════════════

@router.get("/admin/dashboard/mode-comparison")
async def mode_comparison(learner_id: str = None):
    """
    Reading vs Tutoring 비교.
    - learner_id 없으면: 전체 통계
    - learner_id 있으면: 해당 학습자만
    """
    db = await get_db()
    try:
        where = "WHERE s.completed = 1"
        params = []
        if learner_id:
            where += " AND s.learner_id = ?"
            params.append(learner_id)

        # ── 전체/학습자 모드별 집계 ──
        cur = await db.execute(f"""
            SELECT
                s.mode,
                COUNT(*) as session_count,
                AVG(s.gain) as avg_gain,
                AVG(
                    CASE WHEN s.learning_duration_sec IS NOT NULL AND s.learning_duration_sec > 0
                         THEN s.learning_duration_sec
                         ELSE MAX(0, COALESCE(s.updated_at - s.created_at, 0))
                    END
                ) as avg_duration,
                AVG(CASE WHEN s.mode = 'tutoring' THEN s.total_turns END) as avg_turns,
                COUNT(DISTINCT s.node_id) as completed_nodes
            FROM sessions s
            {where} AND s.gain IS NOT NULL
            GROUP BY s.mode
        """, params)
        rows = await cur.fetchall()

        mode_stats = {}
        for r in rows:
            m = r["mode"] or "tutoring"
            mode_stats[m] = {
                "session_count": r["session_count"],
                "avg_gain": round(r["avg_gain"], 3) if r["avg_gain"] else 0,
                "avg_duration_sec": round(r["avg_duration"]) if r["avg_duration"] else 0,
                "avg_duration_display": _sec_to_display(r["avg_duration"]),
                "avg_turns": round(r["avg_turns"], 1) if r["avg_turns"] else None,
                "completed_nodes": r["completed_nodes"],
            }

        # 완료율 계산
        total_nodes = len(NODE_LABELS)
        for m in mode_stats:
            mode_stats[m]["completion_rate"] = round(
                mode_stats[m]["completed_nodes"] / total_nodes * 100
            ) if total_nodes > 0 else 0

        # ── 과목별 모드 비교 ──
        cur = await db.execute(f"""
            SELECT
                s.node_id, s.mode,
                AVG(s.gain) as avg_gain
            FROM sessions s
            {where} AND s.gain IS NOT NULL
            GROUP BY s.node_id, s.mode
        """, params)
        rows = await cur.fetchall()

        by_node = {}
        for r in rows:
            nid = r["node_id"]
            if nid not in by_node:
                by_node[nid] = {"node_id": nid, "label": _node_label(nid)}
            m = r["mode"] or "tutoring"
            by_node[nid][f"{m}_gain"] = round(r["avg_gain"], 3) if r["avg_gain"] else 0

        # ── 학습자별일 때: 세션 상세 리스트 ──
        learner_sessions = []
        if learner_id:
            cur = await db.execute("""
                SELECT
                    s.id, s.node_id, s.mode, s.completed, s.gain,
                    s.total_turns, s.learning_duration_sec,
                    s.created_at, s.updated_at
                FROM sessions s
                WHERE s.learner_id = ?
                ORDER BY s.created_at DESC
            """, (learner_id,))
            for r in await cur.fetchall():
                row = dict(r)
                cl = await _get_checklist_summary(db, row["id"])
                dur = row["learning_duration_sec"]
                if not dur or dur <= 0:
                    dur = max(0, (row.get("updated_at") or 0) - (row.get("created_at") or 0))
                learner_sessions.append({
                    "session_id": row["id"],
                    "node_id": row["node_id"],
                    "node_label": _node_label(row["node_id"]),
                    "mode": row["mode"] or "tutoring",
                    "completed": bool(row["completed"]),
                    "gain": round(row["gain"], 3) if row["gain"] else None,
                    "checklist_done": cl["done"],
                    "checklist_total": cl["total"],
                    "learning_display": _sec_to_display(dur),
                })

        return {
            "scope": "learner" if learner_id else "all",
            "learner_id": learner_id,
            "mode_stats": mode_stats,
            "by_node": list(by_node.values()),
            "learner_sessions": learner_sessions,
        }
    finally:
        await db.close()


@router.get("/admin/dashboard/bloom-comparison")
async def bloom_comparison(learner_id: str = None):
    """
    Bloom 레벨별 모드 gain 비교.
    post_test의 auto_score에서 pre_test의 auto_score를 빼서 gain 산출.
    """
    db = await get_db()
    try:
        where = "WHERE s.completed = 1"
        params = []
        if learner_id:
            where += " AND s.learner_id = ?"
            params.append(learner_id)

        # pre/post 별 bloom별 평균 score
        cur = await db.execute(f"""
            SELECT
                ti.bloom_level,
                s.mode,
                tr.test_phase,
                AVG(tr.auto_score) as avg_score
            FROM test_responses tr
            JOIN sessions s ON tr.session_id = s.id
            JOIN test_items ti ON tr.item_id = ti.item_id
            {where}
            GROUP BY ti.bloom_level, s.mode, tr.test_phase
        """, params)
        rows = await cur.fetchall()

        # pivot: bloom → mode → phase → score
        pivot = {}
        for r in rows:
            bl = r["bloom_level"] or "unknown"
            m = r["mode"] or "tutoring"
            ph = r["test_phase"]
            if bl not in pivot:
                pivot[bl] = {}
            if m not in pivot[bl]:
                pivot[bl][m] = {}
            pivot[bl][m][ph] = round(r["avg_score"], 3) if r["avg_score"] else 0

        # gain 계산
        bloom_order = ["remember", "understand", "apply", "analyze"]
        bloom_kr = {
            "remember": "기억", "understand": "이해",
            "apply": "적용", "analyze": "분석",
            "evaluate": "평가", "create": "창조",
        }
        result = []
        for bl in bloom_order:
            if bl not in pivot:
                continue
            entry = {"bloom": bl, "bloom_kr": bloom_kr.get(bl, bl)}
            for m in ["reading", "tutoring"]:
                if m in pivot[bl]:
                    pre = pivot[bl][m].get("pre_test", 0)
                    post = pivot[bl][m].get("post_test", 0)
                    entry[f"{m}_gain"] = round(post - pre, 3)
                else:
                    entry[f"{m}_gain"] = None
            # 차이
            rg = entry.get("reading_gain")
            tg = entry.get("tutoring_gain")
            if rg is not None and tg is not None:
                entry["diff"] = round(tg - rg, 3)
            else:
                entry["diff"] = None
            result.append(entry)

        return {"by_bloom": result}
    finally:
        await db.close()