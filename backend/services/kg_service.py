"""
ALE Phase 1 — Knowledge Graph 서비스
KG JSON에서 노드 메타데이터 및 BKT 파라미터 조회
"""

import os
import json

# KG JSON 로드
_KG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "content", "wiki_docs", "demensia", "치매_케어_간호교육.json",
)

with open(_KG_PATH, "r", encoding="utf-8") as _f:
    KG_DATA: dict = json.load(_f)

# 노드 ID → 노드 데이터 룩업
NODES: dict[str, dict] = {node["id"]: node for node in KG_DATA["nodes"]}

# BKT 기본값 — 노드에 파라미터가 없을 때 사용
_BKT_DEFAULTS = {
    "p_init": 0.05,
    "p_transit": 0.08,
    "p_guess": 0.25,
    "p_slip": 0.10,
    "difficulty": 1.0,
}


def get_node(node_id: str) -> dict | None:
    """노드 전체 데이터 반환. 없으면 None."""
    return NODES.get(node_id)


def get_node_bkt_params(node_id: str) -> dict:
    """노드의 BKT 파라미터 반환. 없으면 기본값."""
    node = NODES.get(node_id)
    if node and "bkt" in node:
        # 노드 BKT에 누락된 키가 있으면 기본값으로 채움
        return {**_BKT_DEFAULTS, **node["bkt"]}
    return dict(_BKT_DEFAULTS)


def get_all_node_ids() -> list[str]:
    """전체 노드 ID 정렬 목록 반환."""
    return sorted(NODES.keys())


def get_node_label(node_id: str) -> str:
    """노드 라벨 반환. 없으면 node_id 그대로."""
    node = NODES.get(node_id)
    if node:
        return node.get("label", node_id)
    return node_id


def get_node_prerequisites(node_id: str) -> list[str]:
    """노드 선수 학습 목록 반환."""
    node = NODES.get(node_id)
    if node:
        return node.get("prerequisites", [])
    return []
