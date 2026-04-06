# backend/services/content_loader.py
"""
ALE Phase 1 — 콘텐츠 로더
위키 문서, 교수 계획, 임상 사례 파일을 읽어오는 유틸리티
"""

import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
WIKI_DIR = os.path.join(BASE_DIR, "content", "wiki_docs", "demensia")
PLAN_DIR = os.path.join(WIKI_DIR, "plan")
CASES_DIR = os.path.join(WIKI_DIR, "cases")


def load_wiki_doc(node_id: str) -> str:
    """위키 문서 로드. 없으면 빈 문자열 반환."""
    path = os.path.join(WIKI_DIR, f"{node_id}.md")
    if not os.path.isfile(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_plan_guide(plan_name: str) -> str:
    """교수 계획/채점 기준 파일 로드. 없으면 빈 문자열."""
    path = os.path.join(PLAN_DIR, f"{plan_name}.md")
    if not os.path.isfile(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_case(case_name: str) -> str:
    """임상 사례 파일 로드. 없으면 빈 문자열."""
    path = os.path.join(CASES_DIR, f"{case_name}.md")
    if not os.path.isfile(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def list_available_nodes() -> list[str]:
    """위키 디렉토리의 .md 파일 목록 반환 (확장자 제외, 디렉토리 제외)."""
    if not os.path.isdir(WIKI_DIR):
        return []
    return sorted(
        os.path.splitext(f)[0]
        for f in os.listdir(WIKI_DIR)
        if f.endswith(".md") and os.path.isfile(os.path.join(WIKI_DIR, f))
    )


def list_available_cases() -> list[str]:
    """케이스 디렉토리의 .md 파일 목록 반환 (확장자 제외)."""
    if not os.path.isdir(CASES_DIR):
        return []
    return sorted(
        os.path.splitext(f)[0]
        for f in os.listdir(CASES_DIR)
        if f.endswith(".md") and os.path.isfile(os.path.join(CASES_DIR, f))
    )


def find_plan_for_node(node_id: str) -> str:
    """plan 파일에서 <!-- node: {node_id} --> 주석을 검색, 해당 파일 전체 내용 반환.
    checklist 폴더를 먼저 검색 (정본), 없으면 plan 루트에서 탐색."""
    if not os.path.isdir(PLAN_DIR):
        print(f"[PLAN] PLAN_DIR not found: {PLAN_DIR}")
        return ""

    pattern = re.compile(r"<!--\s*node:\s*" + re.escape(node_id) + r"\s*-->")

    # 1순위: plan/checklist/ 폴더 (정본)
    checklist_dir = os.path.join(PLAN_DIR, "checklist")
    if os.path.isdir(checklist_dir):
        files = sorted(os.listdir(checklist_dir))
        print(f"[PLAN] searching checklist/ for '{node_id}': files={files}")
        for fname in files:
            if not fname.endswith(".md"):
                continue
            path = os.path.join(checklist_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            has_comment = bool(pattern.search(content))
            has_text = node_id in content
            print(f"[PLAN]   {fname}: comment_match={has_comment}, text_match={has_text}")
            if has_comment or has_text:
                print(f"[PLAN] ✓ found in checklist/{fname}")
                return content
    else:
        print(f"[PLAN] checklist_dir not found: {checklist_dir}")

    # 2순위: plan/ 루트 파일
    for fname in sorted(os.listdir(PLAN_DIR)):
        if not fname.endswith(".md"):
            continue
        path = os.path.join(PLAN_DIR, fname)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if pattern.search(content):
            print(f"[PLAN] ✓ found in plan/{fname}")
            return content

    print(f"[PLAN] ✗ no plan file found for '{node_id}'")
    return ""


def load_checklist_from_plan(node_id: str) -> list[dict]:
    """plan/checklist 파일에서 체크리스트 항목(□ C1: ...)만 파싱하여 반환.
    이 함수가 반환하는 체크리스트가 정본(ground truth)."""
    plan_content = find_plan_for_node(node_id)
    if not plan_content:
        return []

    items = []
    in_checklist = False
    for line in plan_content.split('\n'):
        stripped = line.strip()
        # 체크리스트 섹션 시작 감지
        if stripped.startswith('## ') and '체크리스트' in stripped:
            in_checklist = True
            continue
        # 다른 ## 섹션이면 체크리스트 끝
        if in_checklist and stripped.startswith('## '):
            break
        if in_checklist and stripped == '---':
            break
        if in_checklist and stripped.startswith('□'):
            parts = stripped[1:].strip().split(':', 1)
            if len(parts) == 2:
                items.append({"id": parts[0].strip(), "label": parts[1].strip(), "done": False})

    return items


def load_unified_content(node_id: str) -> dict:
    """통합 콘텐츠 파일 로드 — nodes/{node_id}.md에서 핵심 내용/체크리스트/교수 전략/자료를 파싱.
    통합 파일이 없으면 빈 dict 반환 (기존 분산 파일로 폴백)."""
    unified_path = os.path.join(WIKI_DIR, "nodes", f"{node_id}.md")
    if not os.path.isfile(unified_path):
        return {"wiki_doc": "", "plan_guide": "", "checklist_items": [], "materials": ""}

    with open(unified_path, "r", encoding="utf-8") as f:
        raw = f.read()
    return parse_unified_content(raw)


def parse_unified_content(raw: str) -> dict:
    """통합 마크다운을 ## 섹션별로 파싱."""
    sections = {"핵심 내용": "", "체크리스트": "", "교수 전략": "", "자료": ""}
    current = None

    for line in raw.split("\n"):
        stripped = line.strip()
        if stripped.startswith("## "):
            header = stripped[3:].strip()
            matched = False
            for key in sections:
                if key in header:
                    current = key
                    matched = True
                    break
            if not matched:
                # 알 수 없는 ## 헤더 — 현재 섹션에 포함 (### 하위 헤더 등)
                if current:
                    sections[current] += line + "\n"
            continue
        if stripped.startswith("# ") and not stripped.startswith("## "):
            # 최상위 # 헤더는 무시 (파일 제목)
            continue
        if current:
            sections[current] += line + "\n"

    # 체크리스트 파싱
    checklist_items = []
    for line in sections["체크리스트"].split("\n"):
        line = line.strip()
        if line.startswith("□"):
            parts = line[1:].strip().split(":", 1)
            if len(parts) == 2:
                checklist_items.append({"id": parts[0].strip(), "label": parts[1].strip(), "done": False})

    # plan_guide = 체크리스트 + 교수 전략 + 자료
    plan_guide = sections["체크리스트"] + "\n---\n" + sections["교수 전략"] + "\n---\n" + sections["자료"]

    return {
        "wiki_doc": sections["핵심 내용"].strip(),
        "plan_guide": plan_guide.strip(),
        "checklist_items": checklist_items,
        "materials": sections["자료"].strip(),
    }

def save_unified_content(node_id: str, content: str) -> str:
    """자동 생성된 통합 노드 파일을 nodes/ 디렉토리에 저장.
    반환: 저장된 파일 경로"""
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))
    WIKI_DIR = os.path.join(BASE_DIR, "content", "wiki_docs", "demensia")
    nodes_dir = os.path.join(WIKI_DIR, "nodes")
    os.makedirs(nodes_dir, exist_ok=True)

    path = os.path.join(nodes_dir, f"{node_id}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[CONTENT] saved unified node: {path} ({len(content)} chars)")
    return path

def save_unified_content(node_id: str, content: str) -> str:
    """자동 생성된 통합 노드 파일을 nodes/ 디렉토리에 저장.
    반환: 저장된 파일 경로"""
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))
    WIKI_DIR = os.path.join(BASE_DIR, "content", "wiki_docs", "demensia")
    nodes_dir = os.path.join(WIKI_DIR, "nodes")
    os.makedirs(nodes_dir, exist_ok=True)

    path = os.path.join(nodes_dir, f"{node_id}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[CONTENT] saved unified node: {path} ({len(content)} chars)")
    return path

def save_unified_content(node_id: str, content: str) -> str:
    """자동 생성된 통합 노드 파일을 nodes/ 디렉토리에 저장.
    반환: 저장된 파일 경로"""
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))
    WIKI_DIR = os.path.join(BASE_DIR, "content", "wiki_docs", "demensia")
    nodes_dir = os.path.join(WIKI_DIR, "nodes")
    os.makedirs(nodes_dir, exist_ok=True)

    path = os.path.join(nodes_dir, f"{node_id}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[CONTENT] saved unified node: {path} ({len(content)} chars)")
    return path
