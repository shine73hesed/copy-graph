"""
ALE v8.2 — routes/session.py 패치 가이드

기존 GET /test/restore 응답에 아래 필드를 추가합니다:
- status: str          — 'active' | 'completed' (completed 세션 판별용)
- has_report: bool     — 보고서 존재 여부
- pre_score: float     — 사전 점수
- post_score: float    — 사후 점수

═══ 수정 위치: routes/session.py의 restore 엔드포인트 ═══

기존 응답:
    return {
        "session_id": session_id,
        "node_id": node_id,
        "conversation": conversation,
        "checklist_items": checklist_items,
        "score_history": score_history,
        "last_state": last_state,
    }

v8.2 변경:
    # DB에서 세션 상태 조회
    from database import get_db
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT status, completed, pre_score, post_score FROM sessions WHERE id = ?",
            (session_id,)
        )
        row = await cursor.fetchone()
        sess_status = dict(row) if row else {}
    finally:
        await db.close()

    is_completed = sess_status.get("completed", 0) == 1 or sess_status.get("status") == "completed"
    has_report = is_completed and sess_status.get("post_score") is not None

    return {
        "session_id": session_id,
        "node_id": node_id,
        "conversation": conversation,
        "checklist_items": checklist_items,
        "score_history": score_history,
        "last_state": last_state,
        # v8.2 추가
        "status": "completed" if is_completed else "active",
        "has_report": has_report,
        "pre_score": sess_status.get("pre_score"),
        "post_score": sess_status.get("post_score"),
    }

═══ 프론트엔드 useSession.ts에서 활용 ═══

restoreSession 함수에서:

    const data = await api.restore(sid);

    // v8.2: completed 세션이면 pre/post 스킵
    if (data.status === 'completed') {
        // 바로 learning phase로 진입
        dispatch({ type: 'SET_PHASE', payload: mode === 'reading' ? 'learning_reading' : 'learning_tutoring' });
        dispatch({ type: 'SET_PRE_SCORE', payload: data.pre_score });
        dispatch({ type: 'SET_POST_SCORE', payload: data.post_score });
        return;
    }
"""
