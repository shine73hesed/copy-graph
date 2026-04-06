"""
관리자/디버그 라우트 — DB 조회 + 비용 추적
"""

from fastapi import APIRouter, Request
from database import get_db

router = APIRouter()


@router.get("/test/cost")
async def get_total_cost(request: Request):
    """학습자의 전체 누적 비용 반환"""
    user_id = request.cookies.get("ale_user") or "anonymous"
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) as total_cost, COALESCE(SUM(input_tokens), 0) as total_input, COALESCE(SUM(output_tokens), 0) as total_output FROM interaction_logs WHERE learner_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        return {
            "total_cost_usd": round(row["total_cost"], 4),
            "total_input_tokens": row["total_input"],
            "total_output_tokens": row["total_output"],
        }
    finally:
        await db.close()


@router.get("/db/stats")
async def db_stats():
    """DB 전체 통계"""
    db = await get_db()
    try:
        stats = {}
        for table in ['users', 'sessions', 'interaction_logs', 'conversation_logs']:
            try:
                cursor = await db.execute(f"SELECT COUNT(*) FROM {table}")
                row = await cursor.fetchone()
                stats[table] = row[0]
            except Exception:
                stats[table] = 0

        # 비용 합계
        cursor = await db.execute("SELECT COALESCE(SUM(cost_usd),0), COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0) FROM interaction_logs")
        row = await cursor.fetchone()
        stats["total_cost"] = round(row[0], 4)
        stats["total_input_tokens"] = row[1]
        stats["total_output_tokens"] = row[2]

        return stats
    finally:
        await db.close()


@router.get("/db/users")
async def db_users():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT user_id, display_name, role, created_at, last_login FROM users ORDER BY created_at DESC")
        return {"rows": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


@router.get("/db/sessions")
async def db_sessions():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id, learner_id, node_id, status, total_turns, completed, final_mastery, duration_sec, created_at, updated_at FROM sessions ORDER BY created_at DESC LIMIT 100")
        return {"rows": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


@router.get("/db/interactions")
async def db_interactions(session_id: str = "", learner_id: str = "", limit: int = 50):
    db = await get_db()
    try:
        query = "SELECT * FROM interaction_logs WHERE 1=1"
        params = []
        if session_id:
            query += " AND session_id=?"
            params.append(session_id)
        if learner_id:
            query += " AND learner_id=?"
            params.append(learner_id)
        query += f" ORDER BY timestamp DESC LIMIT {min(limit, 200)}"
        cursor = await db.execute(query, params)
        return {"rows": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


@router.get("/db/conversations")
async def db_conversations(session_id: str = "", limit: int = 100):
    db = await get_db()
    try:
        query = "SELECT * FROM conversation_logs WHERE 1=1"
        params = []
        if session_id:
            query += " AND session_id=?"
            params.append(session_id)
        query += f" ORDER BY timestamp ASC LIMIT {min(limit, 500)}"
        cursor = await db.execute(query, params)
        return {"rows": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()
