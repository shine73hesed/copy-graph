"""
Wiki 교재 + 학습 노트 API
"""

import json
import os
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.content_loader import load_wiki_doc, load_unified_content
from services.kg_service import KG_DATA
from database import save_note, get_note, update_note_memo, list_notes, get_db

router = APIRouter()


@router.get("/test/summary/{node_id}")
async def get_summary(node_id: str):
    """노드의 summary 설명문 반환 (content/wiki_docs/demensia/summary/{label}.md)"""
    # KG에서 label 조회
    label = node_id
    if KG_DATA:
        for n in KG_DATA.get("nodes", []):
            if n["id"] == node_id:
                label = n.get("label", node_id)
                break

    # summary 파일 탐색
    summary_dir = os.path.join(os.path.dirname(__file__), "..", "content", "wiki_docs", "demensia", "summary")
    summary_path = os.path.join(summary_dir, f"{label}.md")

    summary_text = ""
    if os.path.exists(summary_path):
        with open(summary_path, "r", encoding="utf-8") as f:
            summary_text = f.read().strip()

    return {"node_id": node_id, "label": label, "summary": summary_text}


@router.get("/test/wiki/{node_id}")
async def get_wiki_doc(node_id: str, request: Request):
    """노드의 wiki 교재 내용 반환"""
    wiki_doc = load_wiki_doc(node_id)
    if not wiki_doc:
        return JSONResponse({"error": f"교재를 찾을 수 없습니다: {node_id}"}, status_code=404)

    # 통합 파일이 있으면 핵심 내용만 추출
    unified = load_unified_content(node_id)
    content = unified["wiki_doc"] if unified["wiki_doc"] else wiki_doc

    # KG에서 노드 메타 정보
    node_meta = None
    if KG_DATA:
        for n in KG_DATA.get("nodes", []):
            if n["id"] == node_id:
                node_meta = n
                break

    # 관련 노드 (edge 기반)
    related = []
    if KG_DATA:
        for edge in KG_DATA.get("edges", []):
            if edge["source"] == node_id:
                target_node = next((n for n in KG_DATA["nodes"] if n["id"] == edge["target"]), None)
                if target_node:
                    related.append({"id": edge["target"], "label": target_node.get("label", edge["target"]), "relation": edge.get("relation", "")})
            elif edge["target"] == node_id:
                source_node = next((n for n in KG_DATA["nodes"] if n["id"] == edge["source"]), None)
                if source_node:
                    related.append({"id": edge["source"], "label": source_node.get("label", edge["source"]), "relation": edge.get("relation", "")})

    return {
        "node_id": node_id,
        "label": node_meta.get("label", node_id) if node_meta else node_id,
        "category": node_meta.get("category", "") if node_meta else "",
        "depth": node_meta.get("depth", 0) if node_meta else 0,
        "content": content,
        "content_length": len(content),
        "related": related[:10],
    }


@router.get("/test/wiki-list")
async def list_wiki_docs(request: Request):
    """전체 wiki 교재 목록 반환 (KG 노드 순서)"""
    if not KG_DATA:
        return {"docs": []}

    docs = []
    for node in KG_DATA.get("nodes", []):
        nid = node["id"]
        wiki_doc = load_wiki_doc(nid)
        has_content = bool(wiki_doc)
        docs.append({
            "id": nid,
            "label": node.get("label", nid),
            "category": node.get("category", ""),
            "depth": node.get("depth", 0),
            "has_content": has_content,
            "content_length": len(wiki_doc) if wiki_doc else 0,
        })

    return {"docs": docs, "total": len(docs)}


# ── 노트 API ──────────────────────────────────────────

@router.get("/test/note/{node_id}")
async def get_note_api(node_id: str, request: Request, version: int = None):
    """노드별 학습 노트 조회. ?version=N으로 특정 버전 조회 가능."""
    user_id = request.cookies.get("ale_user") or "anonymous"
    note = await get_note(user_id, node_id, version=version)
    if not note:
        return JSONResponse({"error": "노트가 없습니다", "exists": False}, status_code=404)

    return {
        "exists": True,
        "node_id": node_id,
        "version": note.get("version", 1),
        "versions": note.get("versions", []),
        "weak_points": json.loads(note.get("weak_points") or "[]"),
        "vocabulary": json.loads(note.get("vocabulary") or "[]"),
        "strengths": note.get("strengths", ""),
        "next_focus": note.get("next_focus", ""),
        "personal_memo": note.get("personal_memo", ""),
        "created_at": note.get("created_at"),
        "updated_at": note.get("updated_at"),
    }


@router.put("/test/note/{node_id}/memo")
async def update_memo_api(node_id: str, request: Request):
    """개인 필기 노트 업데이트"""
    user_id = request.cookies.get("ale_user") or "anonymous"
    data = await request.json()
    memo = data.get("memo", "")

    # 노트가 없으면 새로 생성
    existing = await get_note(user_id, node_id)
    if not existing:
        await save_note(user_id, node_id, personal_memo=memo)
    else:
        await update_note_memo(user_id, node_id, memo)

    return {"ok": True, "node_id": node_id}


@router.get("/test/notes")
async def list_notes_api(request: Request):
    """전체 노트 목록"""
    user_id = request.cookies.get("ale_user") or "anonymous"
    notes = await list_notes(user_id)
    return {"notes": notes, "total": len(notes)}



@router.get("/test/session-note/{session_id}")
async def get_session_note(session_id: str, request: Request):
    """세션별 노트 조회."""
    user_id = request.cookies.get("ale_user") or "anonymous"
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT personal_memo FROM notes WHERE session_id = ? AND learner_id = ?",
            (session_id, user_id),
        )
        row = await cursor.fetchone()
        return {
            "session_id": session_id,
            "memo": row["personal_memo"] if row else "",
        }
    finally:
        await db.close()
 
 
@router.put("/test/session-note/{session_id}")
async def save_session_note(session_id: str, request: Request):
    """세션별 노트 저장/업데이트."""
    import time
    user_id = request.cookies.get("ale_user") or "anonymous"
    data = await request.json()
    memo = data.get("memo", "")
 
    db = await get_db()
    try:
        # 기존 노트 확인
        cursor = await db.execute(
            "SELECT id FROM notes WHERE session_id = ? AND learner_id = ?",
            (session_id, user_id),
        )
        existing = await cursor.fetchone()
 
        now = time.time()
        if existing:
            await db.execute(
                "UPDATE notes SET personal_memo = ?, updated_at = ? WHERE id = ?",
                (memo, now, existing["id"]),
            )
        else:
            # 세션 정보에서 node_id 가져오기
            cursor2 = await db.execute(
                "SELECT node_id FROM sessions WHERE id = ?",
                (session_id,),
            )
            sess_row = await cursor2.fetchone()
            node_id = sess_row["node_id"] if sess_row else "unknown"
 
            import uuid
            note_id = str(uuid.uuid4())[:8]
            await db.execute(
                """INSERT INTO notes (id, learner_id, node_id, session_id, personal_memo, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (note_id, user_id, node_id, session_id, memo, now, now),
            )
        await db.commit()
        return {"ok": True, "session_id": session_id}
    finally:
        await db.close()
 