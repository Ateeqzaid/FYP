from fastapi import APIRouter, Depends, HTTPException, status, Header, WebSocket, WebSocketDisconnect
from typing import Optional
from datetime import datetime, timezone
from supabase import create_client, Client
from app.config import settings
from app.schemas.monitoring import FrameAnalysisRequest, FrameAnalysisResponse
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

supabase = None
supabase_anon = None
_processor = None


def get_processor():
    global _processor
    if _processor is None:
        try:
            from app.services.processor import FrameProcessor
            _processor = FrameProcessor()
        except Exception:
            _processor = None
    return _processor


def get_supabase() -> Client:
    global supabase
    if supabase is None:
        from supabase import ClientOptions
        supabase = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
            options=ClientOptions(
                auto_refresh_token=False,
                persist_session=False,
            ),
        )
    return supabase


def get_supabase_anon() -> Client:
    global supabase_anon
    if supabase_anon is None:
        supabase_anon = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY
        )
    return supabase_anon


def get_user_from_token(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    supabase = get_supabase_anon()
    try:
        return supabase.auth.get_user(token)
    except:
        return None


@router.websocket("/ws/{attempt_id}")
async def websocket_endpoint(websocket: WebSocket, attempt_id: str):
    await ws_manager.connect(websocket, attempt_id)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket, attempt_id)


@router.post("/analyze", response_model=FrameAnalysisResponse)
async def analyze_frame(request: FrameAnalysisRequest, authorization: Optional[str] = Header(None)):
    user = get_user_from_token(authorization)
    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    proc = get_processor()
    if proc is None:
        return FrameAnalysisResponse(
            success=False,
            violations=[],
            processed=False,
            stats={"face_count": 0, "phone_detected": False, "head_pose": None, "eye_gaze": None},
        )
    try:
        result = proc.process_frame(request.frame_data, request.attempt_id)
        return FrameAnalysisResponse(
            success=result["success"],
            violations=result["violations"],
            processed=result["processed"],
            stats=result.get("stats"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset", response_model=dict)
async def reset_processor():
    proc = get_processor()
    if proc:
        proc.reset()
    return {"success": True, "message": "Processor reset"}


@router.post("/heartbeat", response_model=dict)
async def heartbeat(attempt_id: str, event_type: Optional[str] = None, authorization: Optional[str] = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    now = datetime.now(timezone.utc).isoformat()

    existing = supabase.table("exam_sessions").select("*").eq(
        "attempt_id", attempt_id
    ).eq("is_active", True).execute()

    if existing.data:
        supabase.table("exam_sessions").update({
            "session_end": now,
        }).eq("id", existing.data[0]["id"]).execute()

    session = supabase.table("exam_sessions").insert({
        "attempt_id": attempt_id,
        "is_active": True,
        "session_start": now,
    }).execute()

    return {
        "success": True,
        "data": session.data[0] if session.data else None,
    }


@router.get("/session/{attempt_id}", response_model=dict)
async def get_session(attempt_id: str, authorization: Optional[str] = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    session = supabase.table("exam_sessions").select("*").eq(
        "attempt_id", attempt_id
    ).eq("is_active", True).single().execute()

    return {
        "success": True,
        "data": session.data if session.data else None,
    }


@router.delete("/session/{attempt_id}", response_model=dict)
async def end_session(attempt_id: str, authorization: Optional[str] = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    supabase.table("exam_sessions").update({
        "is_active": False,
        "session_end": datetime.now(timezone.utc).isoformat(),
    }).eq("attempt_id", attempt_id).execute()

    return {
        "success": True,
        "message": "Session ended successfully",
    }
