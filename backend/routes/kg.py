"""
KG(Knowledge Graph) 유틸리티 + API
- get_next_nodes: 완료 후 다음 노드 추천
- get_connected_nodes: 선수/후속 노드 조회
- GET /test/kg: KG 전체 + 학습자 진행률
"""

import json
from fastapi import APIRouter, Request

from routes.shared import sessions
from services.kg_service import get_node_bkt_params, get_all_node_ids, KG_DATA
from services.bkt_service import P_INIT
from database import get_db

router = APIRouter()


async def get_next_nodes(completed_node_id: str, learner_id: str = "") -> list:
    """완료 후 학습 가능한 다음 노드 — KG edge weight 기반 추천, DB에서 완료 노드 조회"""
    if not KG_DATA:
        return []

    all_nodes = {n["id"]: n for n in KG_DATA.get("nodes", [])}
    edges = KG_DATA.get("edges", [])

    # DB에서 완료된 노드 목록 조회 (서버 재시작해도 유지)
    completed_nodes = {completed_node_id}
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT DISTINCT node_id FROM sessions WHERE learner_id=? AND completed=1",
            (learner_id,),
        )
        rows = await cursor.fetchall()
        for row in rows:
            completed_nodes.add(row["node_id"])
        await db.close()
    except Exception:
        pass

    # 인메모리에서도 추가
    for sid, sess in sessions.items():
        if sess.get("completed") and sess.get("learner_id") == learner_id:
            completed_nodes.add(sess["node_id"])

    # 현재 완료 노드에서 직접 연결된 edge 정보 수집
    direct_edges = {}
    for edge in edges:
        if edge["source"] == completed_node_id:
            target = edge["target"]
            if target not in completed_nodes and target in all_nodes:
                direct_edges[target] = {
                    "weight": edge.get("weight", 0.5),
                    "relation": edge.get("relation", ""),
                }

    # prerequisite 충족되고 미완료인 노드
    available = []
    for nid, node in all_nodes.items():
        if nid in completed_nodes:
            continue
        prereqs = node.get("prerequisites", [])
        if prereqs and not all(p in completed_nodes for p in prereqs):
            continue  # prerequisite 미충족
        if not prereqs and nid != "치매_개요":
            continue  # root 노드(prerequisite 없음)는 스킵

        # 가중치 계산: 직접 연결 > depth 낮은 것 > 카테고리
        edge_info = direct_edges.get(nid, {})
        edge_weight = edge_info.get("weight", 0)
        relation = edge_info.get("relation", "")
        depth = node.get("depth", 0)

        # 점수: 직접 연결 가중치(0~1) * 10 + depth 역순(낮을수록 높음)
        score = edge_weight * 10 + max(0, 5 - depth)

        available.append({
            "id": nid,
            "label": node.get("label", nid),
            "relation": relation,
            "category": node.get("category", ""),
            "depth": depth,
            "score": round(score, 2),
        })

    # 점수 높은 순 정렬
    available.sort(key=lambda x: -x["score"])

    return available[:5]


def get_connected_nodes(node_id: str) -> list:
    """현재 노드의 KG 연결 노드 반환 (선수+후속)"""
    if not KG_DATA:
        return []
    edges = KG_DATA.get("edges", [])
    nodes = {n["id"]: n for n in KG_DATA.get("nodes", [])}
    connected = []
    for edge in edges:
        if edge["source"] == node_id and edge["target"] in nodes:
            connected.append({"id": edge["target"], "label": nodes[edge["target"]].get("label", edge["target"]), "relation": edge.get("relation", ""), "direction": "next"})
        elif edge["target"] == node_id and edge["source"] in nodes:
            connected.append({"id": edge["source"], "label": nodes[edge["source"]].get("label", edge["source"]), "relation": edge.get("relation", ""), "direction": "prev"})
    return connected


@router.get("/test/kg")
async def get_kg_data(request: Request):
    """KG 전체 데이터 + 학습자 진행률 반환"""
    if not KG_DATA:
        return {"nodes": [], "edges": []}

    user_id = request.cookies.get("ale_user") or "anonymous"
    nodes = KG_DATA.get("nodes", [])
    edges = KG_DATA.get("edges", [])

    # 학습자의 노드별 최종 상태 조회
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT node_id,
                      MAX(turn) as max_turn,
                      MAX(is_complete_turn) as completed,
                      checklist_state,
                      moving_avg
               FROM interaction_logs
               WHERE learner_id = ?
               GROUP BY node_id, session_id
               ORDER BY timestamp DESC""",
            (user_id,),
        )
        rows = await cursor.fetchall()

        # 노드별 최신 상태 집계
        node_progress = {}
        for row in rows:
            nid = row["node_id"]
            if nid not in node_progress or row["completed"]:
                cl_state = {}
                if row["checklist_state"]:
                    try:
                        cl_state = json.loads(row["checklist_state"])
                    except Exception:
                        pass
                confirmed = sum(1 for v in cl_state.values() if v == "confirmed")
                total = len(cl_state) if cl_state else 1
                completion = confirmed / total if total > 0 else 0

                node_progress[nid] = {
                    "completion": round(completion, 2),
                    "status": "completed" if row["completed"] else ("in_progress" if completion > 0 else "not_started"),
                    "turns": row["max_turn"] or 0,
                    "moving_avg": row["moving_avg"] or 0,
                }
    finally:
        await db.close()

    # prerequisite 충족 여부 판별
    completed_nodes = {nid for nid, p in node_progress.items() if p["status"] == "completed"}

    enriched_nodes = []
    for n in nodes:
        nid = n["id"]
        prereqs = n.get("prerequisites", [])
        prereqs_met = all(p in completed_nodes for p in prereqs) if prereqs else True

        progress = node_progress.get(nid, {"completion": 0, "status": "not_started", "turns": 0, "moving_avg": 0})
        if not prereqs_met and progress["status"] == "not_started":
            progress["status"] = "locked"

        enriched_nodes.append({**n, "progress": progress})

    return {"nodes": enriched_nodes, "edges": edges}
