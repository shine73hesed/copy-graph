# backend/database.py
"""
ALE Phase 1 — 데이터베이스 모듈
aiosqlite 기반 SQLite 비동기 DB 관리

v8 추가: test_items, test_responses, retention_schedule, reading_logs 테이블
         sessions/interaction_logs 컬럼 마이그레이션
         v8 헬퍼 함수 (create_session_v8, save_test_response 등)
"""

import json
import os
import uuid
import time
import aiosqlite

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "ale.db")


async def get_db() -> aiosqlite.Connection:
    """DB 연결 반환. row_factory 설정 포함."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    return db


async def init_db():
    """테이블 생성. data/ 디렉토리 없으면 자동 생성."""
    os.makedirs(DB_DIR, exist_ok=True)

    db = await get_db()
    try:
        # 유저 테이블 — 인증용
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id      TEXT PRIMARY KEY,
                display_name TEXT,
                pin_hash     TEXT NOT NULL,
                role         TEXT DEFAULT 'student',
                created_at   REAL NOT NULL,
                last_login   REAL
            )
        """)

        # 학습자 테이블
        await db.execute("""
            CREATE TABLE IF NOT EXISTS learners (
                id          TEXT PRIMARY KEY,
                username    TEXT UNIQUE NOT NULL,
                pin         TEXT NOT NULL,
                role        TEXT DEFAULT 'nurse',
                created_at  REAL NOT NULL
            )
        """)

        # 세션 테이블
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id            TEXT PRIMARY KEY,
                learner_id    TEXT NOT NULL,
                node_id       TEXT NOT NULL,
                status        TEXT DEFAULT 'active',
                total_turns   INTEGER DEFAULT 0,
                final_mastery REAL,
                duration_sec  REAL,
                completed     BOOLEAN DEFAULT 0,
                created_at    REAL NOT NULL,
                updated_at    REAL NOT NULL,
                FOREIGN KEY (learner_id) REFERENCES learners(id)
            )
        """)

        # 상호작용 로그 테이블 — 매 턴 BKT/ZPD 상태 기록
        await db.execute("""
            CREATE TABLE IF NOT EXISTS interaction_logs (
                interaction_id   TEXT PRIMARY KEY,
                learner_id       TEXT NOT NULL,
                session_id       TEXT NOT NULL,
                node_id          TEXT NOT NULL,
                turn             INTEGER NOT NULL,
                timestamp        REAL NOT NULL,
                elapsed_sec      REAL,
                student_answer   TEXT,
                answer_length    INTEGER,
                score            REAL,
                score_source     TEXT,
                mastery_before   REAL,
                mastery_after    REAL,
                smoothed         REAL,
                streak           INTEGER,
                attempted        BOOLEAN,
                zpd_position     TEXT,
                struggle_pattern TEXT,
                tutor_response   TEXT,
                tutor_action     TEXT,
                is_first_turn    BOOLEAN DEFAULT 0,
                is_complete_turn BOOLEAN DEFAULT 0,
                gate_a_met       BOOLEAN DEFAULT 0,
                gate_b_met       BOOLEAN DEFAULT 0,
                p_correct        REAL,
                p_posterior       REAL,
                is_pre_test      BOOLEAN DEFAULT 0,
                is_post_test     BOOLEAN DEFAULT 0,
                moving_avg       REAL,
                trend            REAL,
                checklist_state  TEXT,
                input_tokens     INTEGER,
                output_tokens    INTEGER,
                cost_usd         REAL,
                FOREIGN KEY (learner_id) REFERENCES learners(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # 대화 로그 테이블 — 학습자/튜터 발화 기록
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversation_logs (
                id           TEXT PRIMARY KEY,
                session_id   TEXT NOT NULL,
                learner_id   TEXT NOT NULL,
                node_id      TEXT NOT NULL,
                turn         INTEGER NOT NULL,
                role         TEXT NOT NULL,
                content      TEXT NOT NULL,
                timestamp    REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # 세션별 체크리스트 항목 테이블 (v7 추가)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS session_checklist (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL,
                item_id     TEXT NOT NULL,
                label       TEXT NOT NULL,
                source      TEXT DEFAULT '',
                created_at  REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # 학습 노트 테이블 (v7 추가)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id            TEXT PRIMARY KEY,
                learner_id    TEXT NOT NULL,
                node_id       TEXT NOT NULL,
                session_id    TEXT,
                version       INTEGER DEFAULT 1,
                weak_points   TEXT DEFAULT '[]',
                vocabulary    TEXT DEFAULT '[]',
                strengths     TEXT DEFAULT '',
                next_focus    TEXT DEFAULT '',
                personal_memo TEXT DEFAULT '',
                created_at    REAL NOT NULL,
                updated_at    REAL NOT NULL
            )
        """)

        # v6.3 마이그레이션 — 기존 DB에 새 컬럼 추가
        migration_columns = [
            ("interaction_logs", "moving_avg", "REAL"),
            ("interaction_logs", "trend", "REAL"),
            ("interaction_logs", "checklist_state", "TEXT"),
            ("interaction_logs", "input_tokens", "INTEGER"),
            ("interaction_logs", "output_tokens", "INTEGER"),
            ("interaction_logs", "cost_usd", "REAL"),
            ("sessions", "report_json", "TEXT"),
        ]
        for table, col, col_type in migration_columns:
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            except Exception:
                pass  # 이미 존재하면 무시

        # v7 notes 마이그레이션 — version, strengths, next_focus 컬럼
        notes_migrations = [
            ("notes", "version", "INTEGER DEFAULT 1"),
            ("notes", "strengths", "TEXT DEFAULT ''"),
            ("notes", "next_focus", "TEXT DEFAULT ''"),
        ]
        for table, col, col_type in notes_migrations:
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            except Exception:
                pass

        # v8.3 마이그레이션 — gate_done, mode, pre_score, post_score
        v83_migrations = [
            ("sessions", "gate_done", "BOOLEAN DEFAULT 0"),
            ("sessions", "mode", "TEXT DEFAULT 'tutoring'"),
            ("sessions", "pre_score", "REAL"),
            ("sessions", "post_score", "REAL"),
        ]
        for table, col, col_type in v83_migrations:
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            except Exception:
                pass

        # UNIQUE 제약 제거는 SQLite에서 불가 — 새 DB에서는 이미 없음, 기존 DB는 무시

        # ── v8 신규 테이블 ──────────────────────────────────

        # 평가 문항 풀 (Pre/Post/Retention 공용)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS test_items (
                item_id     TEXT PRIMARY KEY,
                node_id     TEXT NOT NULL,
                form        TEXT NOT NULL DEFAULT 'A',
                item_type   TEXT NOT NULL DEFAULT 'short_answer',
                bloom_level TEXT,
                question    TEXT NOT NULL,
                rubric      TEXT,
                correct     TEXT,
                created_at  REAL NOT NULL
            )
        """)

        # 평가 응답 기록 (Pre/Post/Retention 매 문항)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS test_responses (
                id              TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                learner_id      TEXT NOT NULL,
                node_id         TEXT NOT NULL,
                item_id         TEXT NOT NULL,
                test_phase      TEXT NOT NULL,
                response        TEXT,
                concept_results TEXT,
                matched_count   INTEGER,
                total_count     INTEGER,
                auto_score      REAL,
                bloom_level     TEXT,
                elapsed_sec     REAL,
                created_at      REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (item_id) REFERENCES test_items(item_id)
            )
        """)

        # SM-2 기반 Retention 스케줄
        await db.execute("""
            CREATE TABLE IF NOT EXISTS retention_schedule (
                id              TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                learner_id      TEXT NOT NULL,
                node_id         TEXT NOT NULL,
                interval_days   INTEGER NOT NULL DEFAULT 1,
                repetition      INTEGER NOT NULL DEFAULT 0,
                easiness        REAL NOT NULL DEFAULT 2.5,
                next_review_at  REAL NOT NULL,
                last_score      REAL,
                status          TEXT DEFAULT 'pending',
                created_at      REAL NOT NULL,
                updated_at      REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # Reading 모드 행동 로그
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reading_logs (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL,
                learner_id  TEXT NOT NULL,
                event_type  TEXT NOT NULL,
                event_data  TEXT,
                timestamp   REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # ── v8 마이그레이션 — sessions 테이블 컬럼 추가 ──
        v8_session_migrations = [
            ("sessions", "mode", "TEXT DEFAULT 'tutoring'"),
            ("sessions", "pre_score", "REAL"),
            ("sessions", "pre_bloom", "TEXT"),
            ("sessions", "post_score", "REAL"),
            ("sessions", "post_bloom", "TEXT"),
            ("sessions", "post_clinical", "REAL"),
            ("sessions", "gain", "REAL"),
            ("sessions", "learning_started_at", "REAL"),
            ("sessions", "learning_ended_at", "REAL"),
            ("sessions", "learning_duration_sec", "INTEGER"),
        ]
        for table, col, col_type in v8_session_migrations:
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            except Exception:
                pass

        # ── v8 마이그레이션 — interaction_logs 테이블 컬럼 추가 ──
        v8_interaction_migrations = [
            ("interaction_logs", "bloom_level", "TEXT"),
            ("interaction_logs", "clinical_score", "REAL"),
            ("interaction_logs", "clinical_level", "INTEGER"),
            ("interaction_logs", "concept_results", "TEXT"),
            ("interaction_logs", "matched_count", "INTEGER"),
            ("interaction_logs", "total_count", "INTEGER"),
            ("interaction_logs", "newly_confirmed", "TEXT"),
            ("interaction_logs", "word_count_learner", "INTEGER"),
            ("interaction_logs", "word_count_tutor", "INTEGER"),
            ("interaction_logs", "word_ratio", "REAL"),
            ("interaction_logs", "info_density", "REAL"),
        ]
        for table, col, col_type in v8_interaction_migrations:
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            except Exception:
                pass

        # test_items에 options 컬럼 추가 (MCQ 선택지)
        try:
            await db.execute("ALTER TABLE test_items ADD COLUMN options TEXT")
        except Exception:
            pass

        await db.commit()
    finally:
        await db.close()


# ── 헬퍼 함수 ──────────────────────────────────────────

async def create_learner(username: str, pin: str, role: str = "nurse") -> str:
    """학습자 생성. 생성된 id 반환."""
    learner_id = uuid.uuid4().hex[:12]
    now = time.time()

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO learners (id, username, pin, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (learner_id, username, pin, role, now),
        )
        await db.commit()
        return learner_id
    finally:
        await db.close()


async def get_learner(username: str, pin: str) -> dict | None:
    """ID+PIN으로 학습자 조회. 없으면 None."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM learners WHERE username = ? AND pin = ?",
            (username, pin),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)
    finally:
        await db.close()


async def create_session(learner_id: str, node_id: str) -> str:
    """새 학습 세션 생성. session_id 반환."""
    session_id = uuid.uuid4().hex[:16]
    now = time.time()

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO sessions
               (id, learner_id, node_id, status, created_at, updated_at)
               VALUES (?, ?, ?, 'active', ?, ?)""",
            (session_id, learner_id, node_id, now, now),
        )
        await db.commit()
        return session_id
    finally:
        await db.close()


async def save_interaction(data: dict) -> str:
    """상호작용 로그 저장. interaction_id 반환."""
    interaction_id = uuid.uuid4().hex[:16]
    now = time.time()

    fields = [
        "learner_id", "session_id", "node_id", "turn",
        "elapsed_sec", "student_answer", "answer_length",
        "score", "score_source", "mastery_before", "mastery_after",
        "smoothed", "streak", "attempted", "zpd_position",
        "struggle_pattern", "tutor_response", "tutor_action",
        "is_first_turn", "is_complete_turn",
        "gate_a_met", "gate_b_met",
        "p_correct", "p_posterior", "is_pre_test", "is_post_test",
        "moving_avg", "trend", "checklist_state",
        "input_tokens", "output_tokens", "cost_usd",
    ]
    values = [data.get(f) for f in fields]

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO interaction_logs
               (interaction_id, learner_id, session_id, node_id, turn,
                timestamp, elapsed_sec, student_answer, answer_length,
                score, score_source, mastery_before, mastery_after,
                smoothed, streak, attempted, zpd_position,
                struggle_pattern, tutor_response, tutor_action,
                is_first_turn, is_complete_turn,
                gate_a_met, gate_b_met,
                p_correct, p_posterior, is_pre_test, is_post_test,
                moving_avg, trend, checklist_state,
                input_tokens, output_tokens, cost_usd)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (interaction_id, *values[:4], now, *values[4:]),
        )
        await db.commit()
        return interaction_id
    finally:
        await db.close()


async def get_session_interactions(session_id: str) -> list:
    """세션의 전체 상호작용 로그 조회 (턴 순)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM interaction_logs WHERE session_id = ? ORDER BY turn ASC",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_session_scores(session_id: str) -> list[float]:
    """세션의 score 목록 반환 (턴 순, None 제외)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT score FROM interaction_logs WHERE session_id = ? AND score IS NOT NULL ORDER BY turn ASC",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [row["score"] for row in rows]
    finally:
        await db.close()


async def get_session_current_mastery(session_id: str) -> float:
    """세션의 최신 mastery_after 값 반환. 없으면 0.0."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT mastery_after FROM interaction_logs WHERE session_id = ? AND mastery_after IS NOT NULL ORDER BY turn DESC LIMIT 1",
            (session_id,),
        )
        row = await cursor.fetchone()
        return row["mastery_after"] if row else 0.0
    finally:
        await db.close()


async def complete_session(
    session_id: str,
    final_mastery: float,
    total_turns: int,
    duration_sec: float,
):
    """세션 완료 처리. 상태/통계 업데이트."""
    now = time.time()

    db = await get_db()
    try:
        await db.execute(
            """UPDATE sessions
               SET status = 'completed',
                   completed = 1,
                   final_mastery = ?,
                   total_turns = ?,
                   duration_sec = ?,
                   updated_at = ?
               WHERE id = ?""",
            (final_mastery, total_turns, duration_sec, now, session_id),
        )
        await db.commit()
    finally:
        await db.close()


async def save_conversation(session_id: str, learner_id: str, node_id: str, turn: int, role: str, content: str) -> str:
    """대화 메시지 저장 (학습자/튜터 각각)"""
    msg_id = uuid.uuid4().hex[:16]
    now = time.time()
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO conversation_logs (id, session_id, learner_id, node_id, turn, role, content, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (msg_id, session_id, learner_id, node_id, turn, role, content, now),
        )
        await db.commit()
        return msg_id
    finally:
        await db.close()


async def get_conversation(session_id: str) -> list:
    """세션의 전체 대화 이력 조회 (턴 순)"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT role, content, turn, timestamp FROM conversation_logs WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ── v7 추가 함수 ──────────────────────────────────────────

async def save_session_checklist(session_id: str, checklist_items: list, source: str = "") -> None:
    """세션의 체크리스트 항목을 DB에 저장"""
    now = time.time()
    db = await get_db()
    try:
        for item in checklist_items:
            await db.execute(
                "INSERT INTO session_checklist (session_id, item_id, label, source, created_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, item["id"], item["label"], source, now),
            )
        await db.commit()
    finally:
        await db.close()


async def get_session_checklist(session_id: str) -> list:
    """세션의 체크리스트 항목 조회"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT item_id, label FROM session_checklist WHERE session_id = ? ORDER BY rowid ASC",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [{"id": r["item_id"], "label": r["label"]} for r in rows]
    finally:
        await db.close()


async def update_session_turns(session_id: str, total_turns: int) -> None:
    """세션의 총 턴 수와 updated_at 갱신"""
    now = time.time()
    db = await get_db()
    try:
        await db.execute(
            "UPDATE sessions SET total_turns = ?, updated_at = ? WHERE id = ?",
            (total_turns, now, session_id),
        )
        await db.commit()
    finally:
        await db.close()


# ── 노트 CRUD ──────────────────────────────────────────

async def save_note(learner_id: str, node_id: str, session_id: str = None,
                    weak_points: str = "[]", vocabulary: str = "[]",
                    strengths: str = "", next_focus: str = "",
                    personal_memo: str = "") -> str:
    """노트 생성 — 같은 노드를 다시 학습하면 새 버전(v2, v3...)으로 추가"""
    now = time.time()
    db = await get_db()
    try:
        # 기존 노트 중 최신 버전 확인
        cursor = await db.execute(
            "SELECT version FROM notes WHERE learner_id=? AND node_id=? ORDER BY version DESC LIMIT 1",
            (learner_id, node_id),
        )
        existing = await cursor.fetchone()
        new_version = (existing["version"] + 1) if existing else 1

        note_id = uuid.uuid4().hex[:16]
        await db.execute(
            """INSERT INTO notes (id, learner_id, node_id, session_id, version,
               weak_points, vocabulary, strengths, next_focus, personal_memo, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (note_id, learner_id, node_id, session_id, new_version,
             weak_points, vocabulary, strengths, next_focus, personal_memo, now, now),
        )
        await db.commit()
        print(f"[NOTE] saved: {node_id} v{new_version} for {learner_id}")
        return note_id
    finally:
        await db.close()


async def get_note(learner_id: str, node_id: str, version: int = None) -> dict | None:
    """노드별 노트 조회. version 지정 안 하면 최신 버전. 없으면 None."""
    db = await get_db()
    try:
        if version:
            cursor = await db.execute(
                "SELECT * FROM notes WHERE learner_id=? AND node_id=? AND version=?",
                (learner_id, node_id, version),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM notes WHERE learner_id=? AND node_id=? ORDER BY version DESC LIMIT 1",
                (learner_id, node_id),
            )
        row = await cursor.fetchone()
        if not row:
            return None
        result = dict(row)

        # 전체 버전 목록 추가
        cursor2 = await db.execute(
            "SELECT version, session_id, created_at FROM notes WHERE learner_id=? AND node_id=? ORDER BY version ASC",
            (learner_id, node_id),
        )
        versions = [dict(r) for r in await cursor2.fetchall()]
        result["versions"] = versions
        return result
    finally:
        await db.close()


async def update_note_memo(learner_id: str, node_id: str, memo: str, version: int = None) -> bool:
    """개인 필기 노트만 업데이트. version 없으면 최신 버전."""
    now = time.time()
    db = await get_db()
    try:
        if version:
            result = await db.execute(
                "UPDATE notes SET personal_memo=?, updated_at=? WHERE learner_id=? AND node_id=? AND version=?",
                (memo, now, learner_id, node_id, version),
            )
        else:
            # 최신 버전의 id 조회 후 업데이트
            cursor = await db.execute(
                "SELECT id FROM notes WHERE learner_id=? AND node_id=? ORDER BY version DESC LIMIT 1",
                (learner_id, node_id),
            )
            row = await cursor.fetchone()
            if not row:
                await db.close()
                return False
            result = await db.execute(
                "UPDATE notes SET personal_memo=?, updated_at=? WHERE id=?",
                (memo, now, row["id"]),
            )
        await db.commit()
        return result.rowcount > 0
    finally:
        await db.close()


async def list_notes(learner_id: str) -> list:
    """학습자의 전체 노트 목록"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, node_id, session_id, created_at, updated_at FROM notes WHERE learner_id=? ORDER BY updated_at DESC",
            (learner_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ── v8 헬퍼 함수 ──────────────────────────────────────────

async def create_session_v8(learner_id: str, node_id: str, mode: str = "tutoring") -> str:
    """v8 세션 생성. mode + status='pre_test' 포함."""
    session_id = uuid.uuid4().hex[:16]
    now = time.time()

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO sessions
               (id, learner_id, node_id, mode, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'pre_test', ?, ?)""",
            (session_id, learner_id, node_id, mode, now, now),
        )
        await db.commit()
        return session_id
    finally:
        await db.close()


async def update_session_status(session_id: str, status: str) -> None:
    """세션 상태 업데이트."""
    now = time.time()
    db = await get_db()
    try:
        await db.execute(
            "UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, session_id),
        )
        await db.commit()
    finally:
        await db.close()


async def update_session_pre_score(session_id: str, pre_score: float, pre_bloom: str) -> None:
    """Pre-test 점수/블룸 레벨 저장."""
    now = time.time()
    db = await get_db()
    try:
        await db.execute(
            """UPDATE sessions
               SET pre_score = ?, pre_bloom = ?, updated_at = ?
               WHERE id = ?""",
            (pre_score, pre_bloom, now, session_id),
        )
        await db.commit()
    finally:
        await db.close()


async def update_session_post_score(session_id: str, post_score: float, post_bloom: str, gain: float) -> None:
    """Post-test 점수/블룸/gain 저장 + 완료 처리."""
    now = time.time()
    db = await get_db()
    try:
        await db.execute(
            """UPDATE sessions
               SET post_score = ?, post_bloom = ?, gain = ?,
                   status = 'completed', completed = 1,
                   learning_ended_at = ?, updated_at = ?
               WHERE id = ?""",
            (post_score, post_bloom, gain, now, now, session_id),
        )
        await db.commit()
    finally:
        await db.close()


async def update_session_learning_times(session_id: str, started_at: float, ended_at: float = None) -> None:
    """학습 시작/종료 시간 업데이트."""
    now = time.time()
    db = await get_db()
    try:
        if ended_at:
            duration = int(ended_at - started_at)
            await db.execute(
                """UPDATE sessions
                   SET learning_started_at = ?, learning_ended_at = ?,
                       learning_duration_sec = ?, updated_at = ?
                   WHERE id = ?""",
                (started_at, ended_at, duration, now, session_id),
            )
        else:
            await db.execute(
                """UPDATE sessions
                   SET learning_started_at = ?, updated_at = ?
                   WHERE id = ?""",
                (started_at, now, session_id),
            )
        await db.commit()
    finally:
        await db.close()


# ── v8 test_items / test_responses ──────────────────────

async def upsert_test_item(item: dict) -> None:
    """문항 upsert (서버 시작 시 JSON 파일에서 로딩)."""
    now = time.time()
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO test_items (item_id, node_id, form, item_type, bloom_level, question, rubric, correct, options, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(item_id) DO UPDATE SET
                   question = excluded.question,
                   rubric = excluded.rubric,
                   correct = excluded.correct,
                   options = excluded.options,
                   bloom_level = excluded.bloom_level""",
            (
                item["item_id"], item["node_id"], item.get("form", "A"),
                item.get("item_type", "short_answer"), item.get("bloom_level"),
                item["question"],
                json.dumps(item["rubric"], ensure_ascii=False) if isinstance(item.get("rubric"), (dict, list)) else item.get("rubric"),
                item.get("correct"),
                json.dumps(item["options"], ensure_ascii=False) if isinstance(item.get("options"), list) else item.get("options"),
                now,
            ),
        )
        await db.commit()
    finally:
        await db.close()


async def load_test_items(node_id: str, form: str = "A", phase: str = "pre_test") -> list:
    """노드+form 기준으로 문항 목록 로딩."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM test_items WHERE node_id = ? AND form = ? ORDER BY item_id ASC",
            (node_id, form),
        )
        rows = await cursor.fetchall()
        items = []
        for r in rows:
            item = dict(r)
            if item.get("rubric"):
                try:
                    item["rubric"] = json.loads(item["rubric"])
                except (json.JSONDecodeError, TypeError):
                    pass
            if item.get("options"):
                try:
                    item["options"] = json.loads(item["options"])
                except (json.JSONDecodeError, TypeError):
                    pass
            items.append(item)
        return items
    finally:
        await db.close()


async def get_test_item(item_id: str) -> dict | None:
    """단일 문항 조회."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM test_items WHERE item_id = ?",
            (item_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        item = dict(row)
        if item.get("rubric"):
            try:
                item["rubric"] = json.loads(item["rubric"])
            except (json.JSONDecodeError, TypeError):
                pass
        return item
    finally:
        await db.close()


async def save_test_response(data: dict) -> str:
    """평가 응답 저장. response_id 반환."""
    response_id = uuid.uuid4().hex[:16]
    now = time.time()

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO test_responses
               (id, session_id, learner_id, node_id, item_id, test_phase,
                response, concept_results, matched_count, total_count,
                auto_score, bloom_level, elapsed_sec, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                response_id,
                data["session_id"], data["learner_id"], data["node_id"],
                data["item_id"], data["test_phase"],
                data.get("response"),
                data.get("concept_results"),
                data.get("matched_count"),
                data.get("total_count"),
                data.get("auto_score"),
                data.get("bloom_level"),
                data.get("elapsed_sec"),
                now,
            ),
        )
        await db.commit()
        return response_id
    finally:
        await db.close()


async def get_test_responses(session_id: str, test_phase: str = None) -> list:
    """세션의 평가 응답 조회. test_phase 지정 시 해당 phase만."""
    db = await get_db()
    try:
        if test_phase:
            cursor = await db.execute(
                "SELECT * FROM test_responses WHERE session_id = ? AND test_phase = ? ORDER BY created_at ASC",
                (session_id, test_phase),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM test_responses WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ── v8 reading_logs ──────────────────────────────────────

async def save_reading_log(session_id: str, learner_id: str, event_type: str, event_data: str = None) -> str:
    """Reading 모드 행동 로그 저장."""
    log_id = uuid.uuid4().hex[:16]
    now = time.time()

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO reading_logs (id, session_id, learner_id, event_type, event_data, timestamp)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (log_id, session_id, learner_id, event_type, event_data, now),
        )
        await db.commit()
        return log_id
    finally:
        await db.close()


# ── v8 retention_schedule ────────────────────────────────

async def save_retention_schedule(
    session_id: str, learner_id: str, node_id: str,
    interval_days: int = 1, easiness: float = 2.5,
) -> str:
    """Retention 스케줄 생성."""
    schedule_id = uuid.uuid4().hex[:16]
    now = time.time()
    next_review = now + (interval_days * 86400)

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO retention_schedule
               (id, session_id, learner_id, node_id, interval_days, repetition,
                easiness, next_review_at, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?)""",
            (schedule_id, session_id, learner_id, node_id, interval_days, easiness, next_review, now, now),
        )
        await db.commit()
        return schedule_id
    finally:
        await db.close()


async def get_pending_retentions(learner_id: str) -> list:
    """학습자의 복습 대기 목록 (next_review_at <= 현재 시간)."""
    now = time.time()
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT * FROM retention_schedule
               WHERE learner_id = ? AND status = 'pending' AND next_review_at <= ?
               ORDER BY next_review_at ASC""",
            (learner_id, now),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def update_retention_schedule(
    schedule_id: str, interval_days: int, repetition: int,
    easiness: float, last_score: float, status: str = "pending",
) -> None:
    """Retention 스케줄 업데이트 (SM-2 결과 반영)."""
    now = time.time()
    next_review = now + (interval_days * 86400)

    db = await get_db()
    try:
        await db.execute(
            """UPDATE retention_schedule
               SET interval_days = ?, repetition = ?, easiness = ?,
                   next_review_at = ?, last_score = ?, status = ?, updated_at = ?
               WHERE id = ?""",
            (interval_days, repetition, easiness, next_review, last_score, status, now, schedule_id),
        )
        await db.commit()
    finally:
        await db.close()


# ── 문항 시딩 ──────────────────────────────────

async def seed_test_items_from_json():
    """content/test_items/*.json 파일을 읽어 DB에 시딩.
    이미 DB에 해당 node_id 문항이 존재하면 스킵 (관리자 수정 보존)."""
    items_dir = os.path.join(os.path.dirname(__file__), "content", "test_items")
    if not os.path.isdir(items_dir):
        print("[SEED] test_items 디렉토리 없음, 스킵")
        return

    # DB에 이미 존재하는 node_id 목록 조회
    db = await get_db()
    try:
        cursor = await db.execute("SELECT DISTINCT node_id FROM test_items")
        existing_nodes = {row["node_id"] for row in await cursor.fetchall()}
    finally:
        await db.close()

    total = 0
    skipped = 0
    for filename in os.listdir(items_dir):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(items_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                items = json.load(f)
            if not items:
                continue

            # 이 JSON 파일의 node_id 확인
            file_node_id = items[0].get("node_id", "")
            if file_node_id in existing_nodes:
                skipped += len(items)
                print(f"[SEED] {filename}: {file_node_id} 이미 DB에 존재, 스킵 ({len(items)}개)")
                continue

            for item in items:
                await upsert_test_item(item)
                total += 1
            print(f"[SEED] {filename}: {len(items)}개 문항 시딩")
        except Exception as e:
            print(f"[SEED] {filename} 로딩 실패: {e}")

    print(f"[SEED] 시딩 완료: 새로 {total}개, 스킵 {skipped}개")


# ═══  헬퍼 함수 추가 ═══
async def save_session_report(db_getter, session_id: str, report: dict) -> None:
    """학습 보고서를 sessions.report_json에 저장."""
    db = await db_getter()
    try:
        await db.execute(
            "UPDATE sessions SET report_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(report, ensure_ascii=False), time.time(), session_id),
        )
        await db.commit()
    finally:
        await db.close()
