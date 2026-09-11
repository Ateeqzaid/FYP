import time
from typing import Dict, List, Optional, Any
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class ViolationEvent:
    type: str
    timestamp: float
    confidence: float
    duration: float = 0.0
    details: Optional[Dict[str, Any]] = None


@dataclass
class ViolationState:
    type: str
    start_time: Optional[float] = None
    last_triggered: float = 0
    consecutive_count: int = 0
    active: bool = False
    cooldown_until: float = 0


class ViolationManager:
    def __init__(
        self,
        cooldown_seconds: int = 20,
        no_face_timeout: int = 15,
        multiple_faces_timeout: int = 5,
        phone_ignore_seconds: float = 2.0,
        head_pose_suspicious_seconds: int = 15,
        head_pose_consecutive_frames: int = 20,
        eye_gaze_suspicious_seconds: int = 15,
        looking_away_offset_ratio: float = 0.65,
        looking_away_consecutive_frames: int = 20,
        looking_away_suspicious_seconds: int = 15,
    ):
        self.cooldown = cooldown_seconds
        self.no_face_timeout = no_face_timeout
        self.multiple_faces_timeout = multiple_faces_timeout
        self.phone_ignore_seconds = phone_ignore_seconds
        self.head_pose_suspicious_seconds = head_pose_suspicious_seconds
        self.head_pose_consecutive_frames = head_pose_consecutive_frames
        self.eye_gaze_suspicious_seconds = eye_gaze_suspicious_seconds
        self.looking_away_offset_ratio = looking_away_offset_ratio
        self.looking_away_consecutive_frames = looking_away_consecutive_frames
        self.looking_away_suspicious_seconds = looking_away_suspicious_seconds

        self._states: Dict[str, ViolationState] = defaultdict(lambda: ViolationState(type=""))
        self._phone_first_seen: Optional[float] = None
        self._no_face_start: Optional[float] = None
        self._multiple_faces_start: Optional[float] = None
        self._head_pose_buffer: List[float] = []
        self._gaze_buffer: List[float] = []
        self._looking_away_buffer: List[float] = []
        self._events: List[ViolationEvent] = []

    def check_no_face(self, face_count: int, now: float) -> Optional[ViolationEvent]:
        if face_count == 0:
            if self._no_face_start is None:
                self._no_face_start = now
            elapsed = now - self._no_face_start
            if elapsed >= self.no_face_timeout:
                if self._can_trigger("no_face_detected", now):
                    self._cooldown("no_face_detected", now)
                    return ViolationEvent(
                        type="no_face_detected",
                        timestamp=now,
                        confidence=1.0,
                        duration=round(elapsed, 1),
                    )
        else:
            self._no_face_start = None
        return None

    def check_multiple_faces(self, face_count: int, now: float) -> Optional[ViolationEvent]:
        if face_count > 1:
            if self._multiple_faces_start is None:
                self._multiple_faces_start = now
            elapsed = now - self._multiple_faces_start
            if elapsed >= self.multiple_faces_timeout:
                if self._can_trigger("multiple_faces", now):
                    self._cooldown("multiple_faces", now)
                    return ViolationEvent(
                        type="multiple_faces",
                        timestamp=now,
                        confidence=min(1.0, face_count / 4),
                        duration=round(elapsed, 1),
                    )
        else:
            self._multiple_faces_start = None
        return None

    def check_phone(self, phone_detected: bool, detections: List[dict], now: float) -> Optional[ViolationEvent]:
        if phone_detected and detections:
            if self._phone_first_seen is None:
                self._phone_first_seen = now

            elapsed = now - self._phone_first_seen
            if elapsed >= self.phone_ignore_seconds:
                if self._can_trigger("phone_detected", now):
                    max_conf = max(d["confidence"] for d in detections)
                    self._cooldown("phone_detected", now)
                    return ViolationEvent(
                        type="phone_detected",
                        timestamp=now,
                        confidence=max_conf,
                        duration=round(elapsed, 1),
                        details={"detections": detections},
                    )
        else:
            self._phone_first_seen = None
        return None

    def check_head_pose(self, pose_result: Optional[dict], now: float) -> Optional[ViolationEvent]:
        if pose_result and pose_result.get("is_suspicious"):
            self._head_pose_buffer.append(now)
        else:
            self._head_pose_buffer.clear()
            return None

        while len(self._head_pose_buffer) > self.head_pose_consecutive_frames * 2:
            self._head_pose_buffer.pop(0)

        if len(self._head_pose_buffer) < self.head_pose_consecutive_frames:
            return None

        time_span = self._head_pose_buffer[-1] - self._head_pose_buffer[0]
        if time_span >= self.head_pose_suspicious_seconds:
            if self._can_trigger("head_pose_suspicious", now):
                self._cooldown("head_pose_suspicious", now)
                direction = pose_result.get("direction", "unknown")
                return ViolationEvent(
                    type="head_pose_suspicious",
                    timestamp=now,
                    confidence=0.8,
                    duration=round(time_span, 1),
                    details={"direction": direction, "yaw": pose_result.get("yaw"), "pitch": pose_result.get("pitch")},
                )
        return None

    def check_eye_gaze(self, gaze_result: dict, now: float) -> Optional[ViolationEvent]:
        if gaze_result.get("is_looking_away") and not gaze_result.get("is_blinking"):
            self._gaze_buffer.append(now)
        else:
            self._gaze_buffer.clear()
            return None

        while len(self._gaze_buffer) > self.eye_gaze_suspicious_seconds * 2:
            self._gaze_buffer.pop(0)

        if len(self._gaze_buffer) < 10:
            return None

        time_span = self._gaze_buffer[-1] - self._gaze_buffer[0]
        if time_span >= self.eye_gaze_suspicious_seconds:
            if self._can_trigger("eye_gaze_suspicious", now):
                self._cooldown("eye_gaze_suspicious", now)
                return ViolationEvent(
                    type="eye_gaze_suspicious",
                    timestamp=now,
                    confidence=0.7,
                    duration=round(time_span, 1),
                    details={"gaze": gaze_result.get("overall_gaze")},
                )
        return None

    def check_looking_away(
        self, face_bbox: Optional[list], frame_width: int, frame_height: int, now: float
    ) -> Optional[ViolationEvent]:
        if face_bbox is None or len(face_bbox) < 4:
            self._looking_away_buffer.clear()
            return None

        x, y, w, h = face_bbox[:4]
        face_center_x = x + w // 2
        face_center_y = y + h // 2
        frame_center_x = frame_width // 2
        frame_center_y = frame_height // 2
        offset_x = abs(face_center_x - frame_center_x) / frame_width
        offset_y = abs(face_center_y - frame_center_y) / frame_height
        looking_away = offset_x > self.looking_away_offset_ratio or offset_y > self.looking_away_offset_ratio

        if looking_away:
            self._looking_away_buffer.append(now)
        else:
            self._looking_away_buffer.clear()
            return None

        while len(self._looking_away_buffer) > self.looking_away_consecutive_frames * 2:
            self._looking_away_buffer.pop(0)

        if len(self._looking_away_buffer) < self.looking_away_consecutive_frames:
            return None

        time_span = self._looking_away_buffer[-1] - self._looking_away_buffer[0]
        if time_span >= self.looking_away_suspicious_seconds:
            if self._can_trigger("looking_away_excessive", now):
                self._cooldown("looking_away_excessive", now)
                return ViolationEvent(
                    type="looking_away_excessive",
                    timestamp=now,
                    confidence=0.7,
                    duration=round(time_span, 1),
                    details={"offset_x": round(offset_x, 3), "offset_y": round(offset_y, 3)},
                )
        return None

    def _can_trigger(self, violation_type: str, now: float) -> bool:
        state = self._states[violation_type]
        return now >= state.cooldown_until

    def _cooldown(self, violation_type: str, now: float):
        state = self._states[violation_type]
        state.cooldown_until = now + self.cooldown

    def log_event(self, event: ViolationEvent):
        self._events.append(event)

    def get_pending_events(self) -> List[ViolationEvent]:
        events = list(self._events)
        self._events.clear()
        return events

    def reset(self):
        self._states.clear()
        self._phone_first_seen = None
        self._no_face_start = None
        self._multiple_faces_start = None
        self._head_pose_buffer.clear()
        self._gaze_buffer.clear()
        self._looking_away_buffer.clear()
        self._events.clear()
