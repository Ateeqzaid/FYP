import numpy as np
from typing import List, Tuple, Optional
from collections import deque, Counter


class EyeGazeDetector:
    def __init__(
        self,
        gaze_ratio_threshold: float = 0.90,
        blink_ratio_threshold: float = 0.20,
        blink_frame_tolerance: int = 3,
        smoothing_frames: int = 15,
    ):
        self.gaze_threshold = gaze_ratio_threshold
        self.blink_threshold = blink_ratio_threshold
        self.blink_tolerance = blink_frame_tolerance
        self.consecutive_blink_frames = 0
        self.smoothing_frames = smoothing_frames
        self._left_gaze_buffer: deque = deque(maxlen=smoothing_frames)
        self._right_gaze_buffer: deque = deque(maxlen=smoothing_frames)

    def eye_aspect_ratio(self, eye_landmarks: List[Tuple[float, float]]) -> float:
        if len(eye_landmarks) < 6:
            return 1.0
        p2_p6 = np.linalg.norm(np.array(eye_landmarks[1]) - np.array(eye_landmarks[5]))
        p3_p5 = np.linalg.norm(np.array(eye_landmarks[2]) - np.array(eye_landmarks[4]))
        p1_p4 = np.linalg.norm(np.array(eye_landmarks[0]) - np.array(eye_landmarks[3]))

        return (p2_p6 + p3_p5) / (2.0 * p1_p4 + 1e-6)

    def is_blinking(self, left_ear: float, right_ear: float) -> bool:
        avg_ear = (left_ear + right_ear) / 2.0

        if avg_ear < self.blink_threshold:
            self.consecutive_blink_frames += 1
        else:
            self.consecutive_blink_frames = 0

        if self.consecutive_blink_frames > self.blink_tolerance:
            return True
        return False

    def estimate_gaze(self, eye_landmarks: List[Tuple[float, float]]) -> str:
        if len(eye_landmarks) < 4:
            return "unknown"

        left_corner = np.array(eye_landmarks[0])
        right_corner = np.array(eye_landmarks[3])
        eye_width = np.linalg.norm(right_corner - left_corner)
        if eye_width < 1e-6:
            return "center"

        eye_center = (left_corner + right_corner) / 2.0

        iris_center = self._estimate_iris_center(eye_landmarks)
        if iris_center is None:
            return "center"

        gaze_vector = iris_center - eye_center
        horizontal_ratio = gaze_vector[0] / eye_width

        if horizontal_ratio < -self.gaze_threshold:
            return "left"
        elif horizontal_ratio > self.gaze_threshold:
            return "right"

        return "center"

    def _estimate_iris_center(self, eye_landmarks: List[Tuple[float, float]]) -> Optional[np.ndarray]:
        if len(eye_landmarks) < 6:
            return None
        iris_points = eye_landmarks[4:]
        if len(iris_points) < 2:
            return None
        return np.mean(iris_points, axis=0)

    def _estimate_gaze_fallback(self, eye_landmarks: List[Tuple[float, float]]) -> str:
        if len(eye_landmarks) < 4:
            return "unknown"
        pts = np.array(eye_landmarks[:4])
        center = pts.mean(axis=0)
        spread = np.std(pts, axis=0)
        if spread[0] < 5.0 and spread[1] < 5.0:
            return "center"
        return "center"

    def _smoothed_gaze(self, left_gaze: str, right_gaze: str) -> Tuple[str, str]:
        self._left_gaze_buffer.append(left_gaze)
        self._right_gaze_buffer.append(right_gaze)
        left = Counter(self._left_gaze_buffer).most_common(1)[0][0]
        right = Counter(self._right_gaze_buffer).most_common(1)[0][0]
        return left, right

    def reset(self):
        self._left_gaze_buffer.clear()
        self._right_gaze_buffer.clear()
        self.consecutive_blink_frames = 0

    def analyze(self, left_eye_pts: List[Tuple[float, float]], right_eye_pts: List[Tuple[float, float]]) -> dict:
        if len(left_eye_pts) < 6 or len(right_eye_pts) < 6:
            if len(left_eye_pts) >= 4 and len(right_eye_pts) >= 4:
                left_gaze = self._estimate_gaze_fallback(left_eye_pts)
                right_gaze = self._estimate_gaze_fallback(right_eye_pts)
                return {
                    "is_blinking": False,
                    "left_gaze": left_gaze,
                    "right_gaze": right_gaze,
                    "overall_gaze": left_gaze if left_gaze == right_gaze else "mixed",
                    "is_looking_away": False,
                }
            return {
                "is_blinking": False,
                "left_gaze": "unknown",
                "right_gaze": "unknown",
                "overall_gaze": "unknown",
                "is_looking_away": False,
            }

        left_ear = self.eye_aspect_ratio(left_eye_pts[:6])
        right_ear = self.eye_aspect_ratio(right_eye_pts[:6])
        blinking = self.is_blinking(left_ear, right_ear)

        if blinking:
            return {
                "is_blinking": True,
                "left_gaze": "blinking",
                "right_gaze": "blinking",
                "overall_gaze": "blinking",
                "is_looking_away": False,
            }

        left_gaze = self.estimate_gaze(left_eye_pts)
        right_gaze = self.estimate_gaze(right_eye_pts)
        left_gaze, right_gaze = self._smoothed_gaze(left_gaze, right_gaze)

        is_looking_away = (left_gaze != "center" and right_gaze != "center")

        return {
            "is_blinking": False,
            "left_gaze": left_gaze,
            "right_gaze": right_gaze,
            "overall_gaze": left_gaze if left_gaze == right_gaze else "mixed",
            "is_looking_away": is_looking_away,
        }
