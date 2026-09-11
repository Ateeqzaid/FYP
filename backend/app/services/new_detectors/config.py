from pydantic_settings import BaseSettings
from typing import Optional


class DetectionConfig(BaseSettings):
    # Frame processing
    FRAME_WIDTH: int = 640
    FRAME_HEIGHT: int = 480
    PROCESS_EVERY_N_FRAMES: int = 1

    # Face detection (MediaPipe)
    FACE_DETECTION_CONFIDENCE: float = 0.5
    NO_FACE_TIMEOUT_SECONDS: int = 15
    MULTIPLE_FACES_TIMEOUT_SECONDS: int = 5

    # Phone detection (YOLOv8)
    PHONE_CONFIDENCE_THRESHOLD: float = 0.4
    PHONE_IGNORE_SECONDS: float = 2.0
    YOLO_MODEL_PATH: Optional[str] = None

    # Smoothing (temporal low-pass filter)
    SMOOTHING_FRAMES: int = 10

    # Head pose
    HEAD_POSE_THRESHOLD_DEGREES: int = 75
    HEAD_POSE_SUSPICIOUS_SECONDS: int = 15
    HEAD_POSE_CONSECUTIVE_FRAMES: int = 20

    # Eye gaze
    EYE_GAZE_THRESHOLD_RATIO: float = 0.90
    EYE_GAZE_SUSPICIOUS_SECONDS: int = 15
    EYE_BLINK_THRESHOLD_RATIO: float = 0.2
    EYE_BLINK_FRAMES_TOLERANCE: int = 3

    # Looking away (face offset from frame center)
    LOOKING_AWAY_OFFSET_RATIO: float = 0.65
    LOOKING_AWAY_CONSECUTIVE_FRAMES: int = 20
    LOOKING_AWAY_SUSPICIOUS_SECONDS: int = 15

    # Violation cooldowns
    VIOLATION_COOLDOWN_SECONDS: int = 20
    VIOLATION_LOG_API: str = "/api/violations"

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    class Config:
        env_prefix = "DETECTION_"
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


detection_config = DetectionConfig()
