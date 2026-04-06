# backend/routes/diagrams.py
"""
도표(SVG) 제공 API — 대화 학습 중 [DIAGRAM:id] 태그로 참조
GET /diagrams/list — 전체 도표 목록
GET /diagrams/{diagram_id} — SVG 원본 반환
"""

import os
from fastapi import APIRouter
from fastapi.responses import Response, JSONResponse

router = APIRouter()

DIAGRAMS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "content", "diagrams",
)


@router.get("/diagrams/list")
async def list_diagrams():
    """전체 도표 목록 반환."""
    if not os.path.isdir(DIAGRAMS_DIR):
        return {"diagrams": []}

    diagrams = []
    for f in sorted(os.listdir(DIAGRAMS_DIR)):
        if not f.endswith('.svg'):
            continue
        diagram_id = f[:-4]  # .svg 제거
        diagrams.append({"id": diagram_id, "filename": f})

    return {"diagrams": diagrams}


@router.get("/diagrams/{diagram_id}")
async def get_diagram(diagram_id: str):
    """SVG 원본 반환."""
    path = os.path.join(DIAGRAMS_DIR, f"{diagram_id}.svg")
    if not os.path.isfile(path):
        return JSONResponse({"error": "도표를 찾을 수 없습니다"}, status_code=404)

    with open(path, "r", encoding="utf-8") as f:
        svg = f.read()

    return Response(content=svg, media_type="image/svg+xml")
