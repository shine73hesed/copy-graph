# backend/routes/reading.py
"""
Reading 모드 — 콘텐츠 제공 + 챕터 API + 행동 로그 + 완료 처리 (v8.2)
"""

import os
import time
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import sessions
from services.content_loader import load_wiki_doc, load_unified_content, WIKI_DIR
from services.state_machine import transition
from database import load_test_items, save_reading_log, upsert_test_item, update_session_learning_times, update_session_status
from services.claude_client import generate_post_test_items

router = APIRouter()

READ_DIR = os.path.join(WIKI_DIR, "read")


@router.get("/reading/subjects")
async def get_reading_subjects():
    """read 폴더의 하위 폴더 목록을 과목으로 반환."""
    if not os.path.isdir(READ_DIR):
        return {"subjects": []}

    subjects = []
    for name in sorted(os.listdir(READ_DIR)):
        full = os.path.join(READ_DIR, name)
        if not os.path.isdir(full):
            continue
        # 챕터 수 카운트
        chapter_count = len([f for f in os.listdir(full) if f.endswith('.md')])
        subjects.append({
            "id": name,
            "label": name.replace('_', ' '),
            "chapter_count": chapter_count,
        })

    return {"subjects": subjects}


def _calculate_min_reading_time(text: str) -> int:
    char_count = len(text)
    minutes = char_count / 500
    return max(int(minutes * 60), 120)


@router.get("/reading/{node_id}/content")
async def get_reading_content(node_id: str):
    unified = load_unified_content(node_id)
    wiki_doc = unified.get("wiki_doc") or load_wiki_doc(node_id)
    return {
        "node_id": node_id,
        "markdown": unified.get("core") or wiki_doc,
        "mermaid_diagrams": unified.get("materials", {}).get("mermaid", []) if isinstance(unified.get("materials"), dict) else [],
        "video_urls": [],
        "min_reading_sec": _calculate_min_reading_time(wiki_doc),
    }


@router.get("/reading/{node_id}/chapters")
async def get_reading_chapters(node_id: str):
    node_dir = os.path.join(READ_DIR, node_id)
    if not os.path.isdir(node_dir):
        return {"node_id": node_id, "chapters": []}

    chapters = []
    for f in sorted(os.listdir(node_dir)):
        if not f.endswith('.md'):
            continue
        file_id = f[:-3]
        parts = file_id.split('_', 1)
        try:
            order = int(parts[0])
            title = parts[1].replace('_', ' ') if len(parts) > 1 else file_id
        except ValueError:
            order = 999
            title = file_id.replace('_', ' ')

        chapters.append({"id": file_id, "title": title, "order": order, "filename": f})

    chapters.sort(key=lambda c: c["order"])
    return {"node_id": node_id, "chapters": chapters}


@router.get("/reading/{node_id}/chapter/{chapter_id}")
async def get_chapter_content(node_id: str, chapter_id: str):
    node_dir = os.path.join(READ_DIR, node_id)
    if not os.path.isdir(node_dir):
        return {"error": "노드 폴더 없음", "markdown": ""}

    path = os.path.join(node_dir, f"{chapter_id}.md")
    if not os.path.isfile(path):
        for f in os.listdir(node_dir):
            if f.startswith(chapter_id) and f.endswith('.md'):
                path = os.path.join(node_dir, f)
                break

    if not os.path.isfile(path):
        return {"error": "챕터를 찾을 수 없습니다", "markdown": ""}

    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read()

    return {"node_id": node_id, "chapter_id": chapter_id, "markdown": content}


@router.post("/reading/log")
async def log_reading_event(request: Request):
    data = await request.json()
    session_id = data.get("session_id")
    event_type = data.get("event_type")
    if not session_id or not event_type:
        return JSONResponse({"error": "session_id와 event_type 필수"}, status_code=400)

    session = sessions.get(session_id)
    learner_id = session["learner_id"] if session else "unknown"

    event_data = data.get("event_data")
    if isinstance(event_data, dict):
        import json
        event_data = json.dumps(event_data, ensure_ascii=False)

    log_id = await save_reading_log(session_id, learner_id, event_type, event_data)
    return {"ok": True, "log_id": log_id}


@router.post("/reading/complete")
async def complete_reading(request: Request):
    data = await request.json()
    session_id = data.get("session_id")

    session = sessions.get(session_id)
    if not session:
        return JSONResponse({"error": "세션을 찾을 수 없습니다"}, status_code=404)

    if session.get("status") in ("post_test", "completed"):
        return {
            "allowed": True,
            "next_status": session.get("status"),
            "post_test_items": await load_test_items(session["node_id"], form="B", phase="post_test"),
        }

    learning_started = session.get("learning_started_at")
    elapsed = (time.time() - learning_started) if learning_started else 0

    transition(session, "post_test")
    await update_session_status(session_id, "post_test")

    node_id = session["node_id"]
    post_items = await load_test_items(node_id, form="B", phase="post_test")

    if not post_items:
        print(f"[POST_TEST] {node_id}: form=B 문항 없음, 자동 생성 시작")
        wiki_doc = session.get("wiki_doc", "")
        checklist_items = session.get("checklist_items", [])
        generated = await generate_post_test_items(node_id, wiki_doc, checklist_items)
        for item in generated:
            await upsert_test_item(item)
        post_items = await load_test_items(node_id, form="B", phase="post_test")
        print(f"[POST_TEST] {node_id}: {len(post_items)}개 문항 자동 생성 완료")

    session["learning_ended_at"] = time.time()
    session["learning_duration_sec"] = int(elapsed)

    if learning_started:
        await update_session_learning_times(session_id, learning_started, session["learning_ended_at"])

    return {
        "allowed": True,
        "next_status": "post_test",
        "post_test_items": post_items,
    }