"""
ALE v8.2 — admin.py 패치
기존 routes/admin.py에 아래 엔드포인트를 추가합니다.

1. DELETE /test/delete-session — 세션 삭제
2. GET /test/debug-logs/{session_id} — 디버그 로그 조회 (개발용)
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

# 기존 admin.py의 router를 사용하거나, 별도 router로 생성
# router = APIRouter()


# ── 1. 세션 삭제 ──────────────────────────────────────
async def delete_session_endpoint(request: Request):
    """DELETE /test/delete-session?session_id={sid}

    세션과 관련 데이터(interaction_logs, test_responses, test_debug_logs)를 삭제합니다.
    """
    session_id = request.query_params.get("session_id")
    if not session_id:
        return JSONResponse({"error": "session_id 필수"}, status_code=400)

    from database import get_db
    db = await get_db()
    try:
        # 관련 로그 삭제
        await db.execute("DELETE FROM interaction_logs WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM test_responses WHERE session_id = ?", (session_id,))

        # v8.2: 디버그 로그 삭제
        try:
            await db.execute("DELETE FROM test_debug_logs WHERE session_id = ?", (session_id,))
        except Exception:
            pass  # 테이블 없을 수 있음

        # 세션 삭제
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()

        # 인메모리 세션 제거
        from routes.shared import sessions
        sessions.pop(session_id, None)

        return {"ok": True, "session_id": session_id}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        await db.close()


# ── 2. 디버그 로그 조회 ──────────────────────────────
async def get_debug_logs_endpoint(session_id: str):
    """GET /test/debug-logs/{session_id}

    채점 디버그 로그를 반환합니다 (개발/디버깅용).
    """
    try:
        from database import get_db
        from database_v82_patch import get_debug_logs
        logs = await get_debug_logs(get_db, session_id)
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ══════════════════════════════════════════════════════
# 라우터 등록 가이드
# ══════════════════════════════════════════════════════
#
# 기존 routes/admin.py 파일 끝에 아래를 추가:
#
#   from routes.admin_v82_patch import delete_session_endpoint, get_debug_logs_endpoint
#   router.delete("/test/delete-session")(delete_session_endpoint)
#   router.get("/test/debug-logs/{session_id}")(get_debug_logs_endpoint)
#
# 또는 main.py에서:
#   from routes.admin_v82_patch import delete_session_endpoint, get_debug_logs_endpoint
#   app.delete("/test/delete-session")(delete_session_endpoint)
#   app.get("/test/debug-logs/{session_id}")(get_debug_logs_endpoint)
