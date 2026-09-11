from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
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


class PenaltyLevel(str, Enum):
    LEVEL_1 = "level_1"
    LEVEL_2 = "level_2"
    LEVEL_3 = "level_3"


PENALTY_LEVEL_BY_TYPE = {
    ViolationType.NO_FACE_DETECTED: PenaltyLevel.LEVEL_1,
    ViolationType.LOOKING_AWAY_EXCESSIVE: PenaltyLevel.LEVEL_1,
    ViolationType.TAB_SWITCH: PenaltyLevel.LEVEL_2,
    ViolationType.WINDOW_BLUR: PenaltyLevel.LEVEL_2,
    ViolationType.HEAD_POSE_SUSPICIOUS: PenaltyLevel.LEVEL_2,
    ViolationType.EYE_GAZE_SUSPICIOUS: PenaltyLevel.LEVEL_2,
    ViolationType.PHONE_DETECTED: PenaltyLevel.LEVEL_2,
    ViolationType.MULTIPLE_FACES: PenaltyLevel.LEVEL_3,
}

PENALTY_ACTION_BY_LEVEL = {
    PenaltyLevel.LEVEL_1: "on_screen_warning",
    PenaltyLevel.LEVEL_2: "half_time_deducted",
    PenaltyLevel.LEVEL_3: "auto_submit_exam",
}


class ViolationCreate(BaseModel):
    attempt_id: UUID
    violation_type: ViolationType
    severity: Severity = Severity.MEDIUM
    description: Optional[str] = None
    frame_snapshot_url: Optional[str] = None

    @property
    def penalty_level(self) -> PenaltyLevel:
        return PENALTY_LEVEL_BY_TYPE.get(self.violation_type, PenaltyLevel.LEVEL_1)

    @property
    def penalty_action(self) -> str:
        return PENALTY_ACTION_BY_LEVEL[self.penalty_level]


class ViolationResponse(BaseModel):
    id: UUID
    attempt_id: UUID
    violation_type: ViolationType
    severity: Severity
    description: Optional[str] = None
    frame_snapshot_url: Optional[str] = None
    detected_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
