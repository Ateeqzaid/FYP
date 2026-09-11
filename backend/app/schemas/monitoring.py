from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class ViolationType(str, Enum):
    NO_FACE_DETECTED = "no_face_detected"
    MULTIPLE_FACES = "multiple_faces"
    PHONE_DETECTED = "phone_detected"
    TAB_SWITCH = "tab_switch"
    WINDOW_BLUR = "window_blur"
    LOOKING_AWAY_EXCESSIVE = "looking_away_excessive"
    HEAD_POSE_SUSPICIOUS = "head_pose_suspicious"
    EYE_GAZE_SUSPICIOUS = "eye_gaze_suspicious"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DetectionResult(BaseModel):
    face_count: int
    faces_detected: bool
    phone_detected: bool
    looking_away: bool
    violations: List[dict]
    confidence: float


class FrameAnalysisRequest(BaseModel):
    frame_data: str
    attempt_id: str
    timestamp: Optional[float] = None


class FrameAnalysisResponse(BaseModel):
    success: bool
    violations: List[dict]
    processed: bool
    stats: Optional[dict] = None


class WSMessage(BaseModel):
    type: str
    data: Any
    timestamp: float
