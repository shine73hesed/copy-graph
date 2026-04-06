# backend/main.py
from dotenv import load_dotenv
load_dotenv()

"""
ALE Phase 1 — FastAPI 엔트리포인트
페이지 서빙 + 테스트 세션 라우터

-실행
uvicorn main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from routes.session import router as session_router
from routes.tutor import router as tutor_router
from routes.kg import router as kg_router
from routes.admin import router as admin_router
from routes.report import router as report_router
from routes.wiki import router as wiki_router
from routes.test import router as test_router
from routes.reading import router as reading_router
from routes.auth import router as auth_router, verify_token
from database import init_db, seed_test_items_from_json


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 DB 초기화 + 문항 시딩"""
    await init_db()
    await seed_test_items_from_json()
    yield


app = FastAPI(title="ALE Phase 1", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/content-images", StaticFiles(directory="content/wiki_docs/demensia/images"), name="content-images")
app.mount("/content-videos", StaticFiles(directory="content/wiki_docs/demensia/videos"), name="content-videos")
app.include_router(session_router)
app.include_router(tutor_router)
app.include_router(kg_router)
app.include_router(admin_router)
app.include_router(report_router)
app.include_router(wiki_router)
app.include_router(test_router)
app.include_router(reading_router)
app.include_router(auth_router)

from routes.admin_test_items import router as admin_test_items_router
app.include_router(admin_test_items_router)

from routes.diagrams import router as diagrams_router
app.include_router(diagrams_router)

from routes.admin_dashboard import router as admin_dashboard_router
app.include_router(admin_dashboard_router)

templates = Jinja2Templates(directory="templates")


@app.middleware("http")
async def auth_check(request, call_next):
    """인증되지 않은 사용자를 로그인 페이지로 리다이렉트 (HTML 페이지만)"""
    path = request.url.path
    # HTML 페이지만 보호 (정확히 /test, /dashboard, /student 페이지)
    protected_pages = {"/test", "/dashboard", "/student"}
    if path in protected_pages:
        user_id = request.cookies.get("ale_user")
        token = request.cookies.get("ale_token")
        if not user_id or not verify_token(user_id, token):
            from fastapi.responses import RedirectResponse
            return RedirectResponse("/login")
    return await call_next(request)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """로그인 페이지"""
    return templates.TemplateResponse(request, "login.html")


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    """학생 대시보드"""
    return templates.TemplateResponse(request, "dashboard.html")


@app.get("/test", response_class=HTMLResponse)
async def test_page(request: Request):
    """테스트 페이지 (대화창 + BKT Monitor)"""
    return templates.TemplateResponse(request, "test.html")


@app.get("/student", response_class=HTMLResponse)
async def student_page(request: Request):
    """학생 학습 화면 (디버깅 없음)"""
    return templates.TemplateResponse(request, "student.html")

@app.get("/wiki", response_class=HTMLResponse)
async def student_page(request: Request):
    """학생 학습 화면 (디버깅 없음)"""
    return templates.TemplateResponse(request, "wiki.html")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """루트 → 대시보드로 리다이렉트"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/dashboard")


@app.get("/db")
async def db_page():
    return FileResponse("templates/db.html")