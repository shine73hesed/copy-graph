"""
인증 라우트 — 간단 로그인 (ID + 6자리 PIN)

PIN 형식: 숫자4자리 + 영문2자리 (예: 1578Rn, 0000Aa)
최초 로그인 시 자동 가입
"""

import hashlib
import hmac
import time
import re
import aiosqlite
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config import settings
from database import DB_PATH

router = APIRouter()

# PIN 형식: 숫자4 + 영문2 = 6자리
PIN_PATTERN = re.compile(r"^[0-9]{4}[A-Za-z]{2}$")
USER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_]{2,20}$")


class LoginRequest(BaseModel):
    user_id: str
    pin: str


def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


def make_token(user_id: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), user_id.encode(), hashlib.sha256
    ).hexdigest()[:32]


def verify_token(user_id: str, token: str) -> bool:
    if not user_id or not token:
        return False
    expected = make_token(user_id)
    return hmac.compare_digest(expected, token)


def set_auth_cookies(response: Response, user_id: str):
    token = make_token(user_id)
    max_age = 7 * 24 * 3600  # 7일
    response.set_cookie("ale_user", user_id, max_age=max_age, path="/", samesite="lax")
    response.set_cookie("ale_token", token, max_age=max_age, path="/", samesite="lax")


def clear_auth_cookies(response: Response):
    response.delete_cookie("ale_user", path="/")
    response.delete_cookie("ale_token", path="/")


# ─── 로그인 API ───

@router.post("/auth/login")
async def login(req: LoginRequest):
    uid = req.user_id.strip()
    pin = req.pin.strip()

    # 입력 검증
    if not USER_ID_PATTERN.match(uid):
        return JSONResponse(
            {"error": "ID는 영문/숫자/밑줄 2~20자"},
            status_code=400,
        )
    if not PIN_PATTERN.match(pin):
        return JSONResponse(
            {"error": "PIN은 숫자4자리+영문2자리 (예: 1578Rn)"},
            status_code=400,
        )

    pin_h = hash_pin(pin)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM users WHERE user_id=?", (uid,))
        user = await cur.fetchone()

        if user:
            # 기존 유저 → PIN 검증
            if user["pin_hash"] != pin_h:
                return JSONResponse({"error": "PIN이 일치하지 않습니다"}, status_code=401)
            # 마지막 로그인 시간 갱신
            await db.execute(
                "UPDATE users SET last_login=? WHERE user_id=?",
                (time.time(), uid),
            )
            await db.commit()
            is_new = False
            display_name = user["display_name"]
        else:
            # 신규 유저 → 자동 가입
            display_name = uid
            await db.execute(
                """INSERT INTO users (user_id, display_name, pin_hash, role, created_at, last_login)
                   VALUES (?, ?, ?, 'student', ?, ?)""",
                (uid, display_name, pin_h, time.time(), time.time()),
            )
            await db.commit()
            is_new = True

    response = JSONResponse({
        "user_id": uid,
        "display_name": display_name,
        "is_new": is_new,
    })
    set_auth_cookies(response, uid)
    return response


# ─── 로그아웃 ───

@router.post("/auth/logout")
async def logout():
    response = JSONResponse({"status": "logged_out"})
    clear_auth_cookies(response)
    return response


# ─── 현재 유저 정보 ───

@router.get("/auth/me")
async def get_me(request: Request):
    user_id = request.cookies.get("ale_user")
    token = request.cookies.get("ale_token")
    if not user_id or not verify_token(user_id, token):
        return JSONResponse({"error": "로그인 필요"}, status_code=401)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM users WHERE user_id=?", (user_id,))
        user = await cur.fetchone()
        if not user:
            return JSONResponse({"error": "유저 없음"}, status_code=404)

        return {
            "user_id": user["user_id"],
            "display_name": user["display_name"],
            "role": user["role"],
            "created_at": user["created_at"],
            "last_login": user["last_login"],
        }
