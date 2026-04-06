# 인메모리 세션 저장소 — 모든 라우트 모듈이 이 dict를 import하여 공유
sessions: dict[str, dict] = {}
