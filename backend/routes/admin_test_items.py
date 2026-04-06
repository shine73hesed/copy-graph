# backend/routes/admin_test_items.py
"""
ALE v8.2 — 테스트 문항 관리 API

기존 admin.py의 router에 추가하거나 별도 include.
main.py에서: app.include_router(admin_test_items_router)

═══ 엔드포인트 ═══
GET  /admin/test-items?node_id=치매_개요&form=A  — 문항 목록
PUT  /admin/test-items/{item_id}                  — 문항 수정
POST /admin/test-items                            — 문항 추가
DELETE /admin/test-items/{item_id}                — 문항 삭제
POST /admin/test-items/regenerate                 — 문항 재생성 (기존 삭제 후 LLM 생성)
GET  /admin/nodes                                 — 노드 목록 (문항 존재 여부 포함)
"""

import json
import time
import os
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from database import get_db, upsert_test_item, load_test_items
from services.content_loader import load_wiki_doc, load_unified_content, WIKI_DIR

router = APIRouter(prefix="/api")

READ_DIR = os.path.join(WIKI_DIR, "read")


def _load_reading_content(node_id: str) -> str:
    node_dir = os.path.join(READ_DIR, node_id)
    if not os.path.isdir(node_dir):
        return ""
    parts = []
    for f in sorted(os.listdir(node_dir)):
        if not f.endswith('.md'):
            continue
        with open(os.path.join(node_dir, f), 'r', encoding='utf-8') as fh:
            parts.append(fh.read())
    return "\n\n---\n\n".join(parts)


@router.get("/admin/test-items")
async def list_test_items(node_id: str = None, form: str = None):
    """문항 목록 조회. node_id/form 필터 가능."""
    db = await get_db()
    try:
        if node_id and form:
            cursor = await db.execute(
                "SELECT * FROM test_items WHERE node_id = ? AND form = ? ORDER BY item_id",
                (node_id, form),
            )
        elif node_id:
            cursor = await db.execute(
                "SELECT * FROM test_items WHERE node_id = ? ORDER BY form, item_id",
                (node_id,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM test_items ORDER BY node_id, form, item_id"
            )
        rows = await cursor.fetchall()
        items = []
        for r in rows:
            item = dict(r)
            if item.get("rubric") and isinstance(item["rubric"], str):
                try:
                    item["rubric"] = json.loads(item["rubric"])
                except:
                    pass
            items.append(item)
        return {"items": items, "count": len(items)}
    finally:
        await db.close()


@router.get("/admin/test-items/{item_id}")
async def get_test_item_detail(item_id: str):
    """단일 문항 조회."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM test_items WHERE item_id = ?", (item_id,))
        row = await cursor.fetchone()
        if not row:
            return JSONResponse({"error": "문항을 찾을 수 없습니다"}, status_code=404)
        item = dict(row)
        if item.get("rubric") and isinstance(item["rubric"], str):
            try:
                item["rubric"] = json.loads(item["rubric"])
            except:
                pass
        return item
    finally:
        await db.close()


@router.post("/admin/test-items")
async def create_test_item(request: Request):
    """문항 추가."""
    data = await request.json()
    required = ["item_id", "node_id", "form", "item_type", "question"]
    for field in required:
        if field not in data:
            return JSONResponse({"error": f"필수 필드 누락: {field}"}, status_code=422)

    item = {
        "item_id": data["item_id"],
        "node_id": data["node_id"],
        "form": data.get("form", "A"),
        "item_type": data.get("item_type", "short_answer"),
        "bloom_level": data.get("bloom_level", "remember"),
        "question": data["question"],
        "rubric": json.dumps(data["rubric"], ensure_ascii=False) if data.get("rubric") else None,
        "correct": data.get("correct"),
        "options": json.dumps(data["options"], ensure_ascii=False) if data.get("options") else None,
    }
    await upsert_test_item(item)
    return {"ok": True, "item_id": data["item_id"]}


@router.put("/admin/test-items/{item_id}")
async def update_test_item(item_id: str, request: Request):
    """문항 수정."""
    data = await request.json()
    db = await get_db()
    try:
        # 기존 문항 존재 확인
        cursor = await db.execute("SELECT * FROM test_items WHERE item_id = ?", (item_id,))
        if not await cursor.fetchone():
            return JSONResponse({"error": "문항을 찾을 수 없습니다"}, status_code=404)

        updates = []
        params = []
        for field in ["question", "bloom_level", "item_type", "correct"]:
            if field in data:
                updates.append(f"{field} = ?")
                params.append(data[field])
        if "rubric" in data:
            updates.append("rubric = ?")
            params.append(json.dumps(data["rubric"], ensure_ascii=False) if data["rubric"] else None)
        if "options" in data:
            updates.append("options = ?")
            params.append(json.dumps(data["options"], ensure_ascii=False) if data["options"] else None)

        if not updates:
            return {"ok": True, "message": "변경 없음"}

        params.append(item_id)
        await db.execute(f"UPDATE test_items SET {', '.join(updates)} WHERE item_id = ?", params)
        await db.commit()
        return {"ok": True, "item_id": item_id}
    finally:
        await db.close()


@router.delete("/admin/test-items/{item_id}")
async def delete_test_item(item_id: str):
    """문항 삭제."""
    db = await get_db()
    try:
        await db.execute("DELETE FROM test_items WHERE item_id = ?", (item_id,))
        await db.commit()
        return {"ok": True, "item_id": item_id}
    finally:
        await db.close()


@router.post("/admin/test-items/regenerate")
async def regenerate_test_items(request: Request):
    """특정 노드+form의 문항을 삭제하고 LLM으로 재생성."""
    data = await request.json()
    node_id = data.get("node_id")
    form = data.get("form", "A")

    if not node_id:
        return JSONResponse({"error": "node_id 필수"}, status_code=422)

    # 1. 기존 문항 삭제
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM test_items WHERE node_id = ? AND form = ?",
            (node_id, form),
        )
        old_count = (await cursor.fetchone())["cnt"]
        await db.execute(
            "DELETE FROM test_items WHERE node_id = ? AND form = ?",
            (node_id, form),
        )
        await db.commit()
        print(f"[REGENERATE] {node_id} form={form}: {old_count}개 기존 문항 삭제")
    finally:
        await db.close()

    # 2. 교재 내용 로드
    wiki_doc = _load_reading_content(node_id)
    if not wiki_doc:
        unified = load_unified_content(node_id)
        wiki_doc = unified.get("wiki_doc") or load_wiki_doc(node_id)

    if not wiki_doc:
        return JSONResponse({"error": "교재 내용을 찾을 수 없습니다"}, status_code=404)

    # 3. LLM 자동 생성
    from services.claude_client import generate_post_test_items
    generated = await generate_post_test_items(node_id, wiki_doc)

    # form/item_id 수정
    for item in generated:
        old_id = item.get("item_id", "")
        if form == "A" and "_B" in old_id:
            item["item_id"] = old_id.replace("_B", "_A")
        item["form"] = form
        item["node_id"] = node_id
        await upsert_test_item(item)

    print(f"[REGENERATE] {node_id} form={form}: {len(generated)}개 문항 재생성 완료")
    return {
        "ok": True,
        "node_id": node_id,
        "form": form,
        "deleted": old_count,
        "generated": len(generated),
    }


@router.get("/admin/nodes")
async def list_nodes_with_items():
    """노드 목록 + 각 노드의 문항 수."""
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT node_id, form, COUNT(*) as count
            FROM test_items
            GROUP BY node_id, form
            ORDER BY node_id, form
        """)
        rows = await cursor.fetchall()

        nodes = {}
        for r in rows:
            nid = r["node_id"]
            if nid not in nodes:
                nodes[nid] = {"node_id": nid, "form_A": 0, "form_B": 0}
            if r["form"] == "A":
                nodes[nid]["form_A"] = r["count"]
            elif r["form"] == "B":
                nodes[nid]["form_B"] = r["count"]

        return {"nodes": list(nodes.values())}
    finally:
        await db.close()


@router.post("/admin/test-items/import")
async def import_test_items_json(request: Request):
    """JSON 형식 문항 일괄 등록.

    유저가 제공하는 JSON 구조:
    {
        "unit": 1,
        "title": "...",
        "source": "...",       ← node_id로 사용 (없으면 title에서 생성)
        "pre_test": { "items": [...] },
        "post_test": { "items": [...] }
    }

    각 item:
    {
        "id": "pre-1-1",
        "type": "multiple_choice" | "short_answer",
        "bloom": "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate",
        "question": "...",
        "options": ["A...", "B...", ...],   (MCQ만)
        "answer": "B",                      (MCQ만)
        "rubric": ["기준1", "기준2", ...],   (서술형만)
        "explanation": "...",                (선택)
        "related_concept": "..."             (선택)
    }
    """
    data = await request.json()

    title = data.get("title", "")
    # node_id: source 파일명에서 추출 또는 title 기반
    source = data.get("source", "")
    if source:
        # "단원01_교재_치매는_증후군이다.md" → "치매는_증후군이다" 는 너무 길 수 있으니 그대로
        node_id = source.replace(".md", "").strip()
    else:
        node_id = title.replace(" ", "_").strip()

    # node_id를 직접 지정할 수도 있음
    if data.get("node_id"):
        node_id = data["node_id"]

    results = {"node_id": node_id, "pre_test": 0, "post_test": 0, "errors": [], "deleted": {}}

    # 형식 감지: 플랫({form, items}) vs 중첩({pre_test:{items}, post_test:{items}})
    if "items" in data and data.get("form"):
        # 플랫 형식: {form: "A", items: [...]}
        form = data["form"].upper()
        phase_key = "pre_test" if form == "A" else "post_test"
        phases = [(phase_key, form, data["items"])]
    else:
        # 중첩 형식: {pre_test: {items: [...]}, post_test: {items: [...]}}
        phases = []
        for phase_key, form in [("pre_test", "A"), ("post_test", "B")]:
            phase_data = data.get(phase_key, {})
            items = phase_data.get("items", [])
            if items:
                phases.append((phase_key, form, items))

    for phase_key, form, items in phases:
        if not items:
            continue

        # 기존 문항 삭제
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT COUNT(*) as cnt FROM test_items WHERE node_id = ? AND form = ?",
                (node_id, form),
            )
            old_count = (await cursor.fetchone())["cnt"]
            await db.execute(
                "DELETE FROM test_items WHERE node_id = ? AND form = ?",
                (node_id, form),
            )
            await db.commit()
            results["deleted"][form] = old_count
            print(f"[IMPORT] {node_id} form={form}: {old_count}개 기존 문항 삭제")
        finally:
            await db.close()

        for item in items:
            try:
                item_id = f"{node_id}_{form}_{item['id']}" if not item["id"].startswith(node_id) else item["id"]
                item_type = "mcq" if item.get("type") == "multiple_choice" else "short_answer"
                bloom = item.get("bloom", "remember").lower()

                # rubric 변환
                rubric = None
                if item_type == "short_answer" and item.get("rubric"):
                    raw_rubric = item["rubric"]
                    criteria = []
                    if isinstance(raw_rubric, list):
                        for idx, entry in enumerate(raw_rubric):
                            if isinstance(entry, str):
                                # ["기준1", "기준2", ...] 형식
                                criteria.append({
                                    "key": f"K{idx+1}",
                                    "concept": entry.split(":")[0].strip() if ":" in entry else entry[:30],
                                    "desc": entry,
                                    "weight": 1.0,
                                })
                            elif isinstance(entry, dict):
                                # [{item, description, points}, ...] 형식
                                criteria.append({
                                    "key": f"K{idx+1}",
                                    "concept": entry.get("item", entry.get("concept", f"기준{idx+1}")),
                                    "desc": entry.get("description", entry.get("desc", "")),
                                    "weight": entry.get("points", 10) / 10,
                                })
                    rubric = json.dumps({
                        "question": item["question"],
                        "criteria": criteria,
                    }, ensure_ascii=False)

                # MCQ options/correct
                correct = None
                options_json = None
                if item_type == "mcq":
                    options = item.get("options", [])
                    answer_key = item.get("answer", "")
                    # "B" → options[1] 매칭
                    if len(answer_key) == 1 and answer_key.isalpha():
                        idx = ord(answer_key.upper()) - ord("A")
                        correct = options[idx] if idx < len(options) else answer_key
                    else:
                        correct = answer_key
                    options_json = json.dumps(options, ensure_ascii=False)

                db_item = {
                    "item_id": item_id,
                    "node_id": node_id,
                    "form": form,
                    "item_type": item_type,
                    "bloom_level": bloom,
                    "question": item["question"],
                    "rubric": rubric,
                    "correct": correct,
                    "options": item.get("options", []) if item_type == "mcq" else None,
                }
                await upsert_test_item(db_item)
                results[phase_key] += 1

            except Exception as e:
                results["errors"].append(f"{item.get('id', '?')}: {str(e)}")

    print(f"[IMPORT] {node_id}: pre={results['pre_test']}, post={results['post_test']}, errors={len(results['errors'])}")
    return results
