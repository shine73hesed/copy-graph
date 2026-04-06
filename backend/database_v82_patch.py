"""
ALE v8.2 — Database Patch
test_debug_logs 테이블 추가 + save/조회 함수

사용법: database.py의 init_db() 끝에서 이 모듈의 init_debug_tables()를 호출
또는 database.py에 직접 병합
"""

import uuid
import time
import aiosqlite

# 아래 import는 기존 database.py에서 가져오거나, 직접 병합 시 불필요
# from database import get_db


async def init_debug_tables(db: aiosqlite.Connection):
    """test_debug_logs 테이블 생성. init_db()에서 호출."""
    await db.execute("""
        CREATE TABLE IF NOT EXISTS test_debug_logs (
            id                TEXT PRIMARY KEY,
            session_id        TEXT NOT NULL,
            test_phase        TEXT NOT NULL,
            item_id           TEXT NOT NULL,
            timestamp         REAL NOT NULL,

            -- 입력
            item_type         TEXT,
            question          TEXT,
            learner_response  TEXT,
            correct_answer    TEXT,

            -- LLM 추출 (서술형만)
            llm_raw_response  TEXT,
            extraction_result TEXT,
            extraction_error  TEXT,

            -- 채점 결과
            auto_score        REAL,
            matched_count     INTEGER,
            total_count       INTEGER,
            matched_keys      TEXT,
            bloom_level       TEXT,
            scoring_method    TEXT,

            -- 메타
            elapsed_ms        INTEGER,
            error             TEXT,

            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    """)
    await db.commit()


async def save_test_debug_log(db_getter, data: dict) -> None:
    """test_debug_logs에 디버그 로그 저장.

    Args:
        db_getter: async callable that returns aiosqlite.Connection (= get_db)
        data: dict with debug log fields
    """
    db = await db_getter()
    try:
        await db.execute("""
            INSERT INTO test_debug_logs
            (id, session_id, test_phase, item_id, timestamp,
             item_type, question, learner_response, correct_answer,
             llm_raw_response, extraction_result, extraction_error,
             auto_score, matched_count, total_count, matched_keys,
             bloom_level, scoring_method, elapsed_ms, error)
            VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?)
        """, (
            data.get("id", str(uuid.uuid4())),
            data.get("session_id"),
            data.get("test_phase"),
            data.get("item_id"),
            data.get("timestamp", time.time()),
            data.get("item_type"),
            data.get("question"),
            data.get("learner_response"),
            data.get("correct_answer"),
            data.get("llm_raw_response"),
            data.get("extraction_result"),
            data.get("extraction_error"),
            data.get("auto_score"),
            data.get("matched_count"),
            data.get("total_count"),
            data.get("matched_keys"),
            data.get("bloom_level"),
            data.get("scoring_method"),
            data.get("elapsed_ms"),
            data.get("error"),
        ))
        await db.commit()
    finally:
        await db.close()


async def get_debug_logs(db_getter, session_id: str, test_phase: str = None) -> list:
    """세션의 디버그 로그 조회.

    Args:
        db_getter: async callable that returns aiosqlite.Connection
        session_id: 세션 ID
        test_phase: 선택. 'pre_test' | 'post_test'
    """
    db = await db_getter()
    try:
        if test_phase:
            cursor = await db.execute(
                "SELECT * FROM test_debug_logs WHERE session_id = ? AND test_phase = ? ORDER BY timestamp ASC",
                (session_id, test_phase),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM test_debug_logs WHERE session_id = ? ORDER BY timestamp ASC",
                (session_id,),
            )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await db.close()
