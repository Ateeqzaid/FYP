import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict
from collections import deque


class HeadPoseDetector:
    def __init__(self, threshold_degrees: int = 75, smoothing_frames: int = 15):
        self.threshold = threshold_degrees
        self.pitch_threshold = threshold_degrees + 15
        self.smoothing_frames = smoothing_frames
        self._yaw_buffer: deque = deque(maxlen=smoothing_frames)
        self._pitch_buffer: deque = deque(maxlen=smoothing_frames)

        self.model_points = np.array([
            (0.0, 0.0, 0.0),
            (0.0, -330.0, -65.0),
            (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0),
            (-150.0, -150.0, -125.0),
            (150.0, -150.0, -125.0),
        ], dtype=np.float64)

        self.focal_length = 1.0
        self.camera_matrix = None
        self.dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    def _ensure_camera_matrix(self, frame_width: int, frame_height: int):
        if self.camera_matrix is None or self.focal_length != frame_width:
            self.focal_length = frame_width
            center = (frame_width / 2, frame_height / 2)
            self.camera_matrix = np.array([
                [self.focal_length, 0, center[0]],
                [0, self.focal_length, center[1]],
                [0, 0, 1],
            ], dtype=np.float64)

    def estimate_from_landmarks(
        self, landmarks_2d: List[Tuple[float, float]], frame_shape: Tuple[int, int],
        nose: int = 1, chin: int = 199, left_eye: int = 33,
        right_eye: int = 263, left_mouth: int = 61, right_mouth: int = 291,
    ) -> Optional[dict]:
        h, w = frame_shape[:2]
        self._ensure_camera_matrix(w, h)

        try:
            indices = [nose, chin, left_eye, right_eye, left_mouth, right_mouth]
            image_points = np.array([
                landmarks_2d[i] for i in indices if i < len(landmarks_2d)
            ], dtype=np.float64)

            if len(image_points) < 4:
                return None

            model_subset = self.model_points[:len(image_points)]

            success, rotation_vector, translation_vector = cv2.solvePnP(
                model_subset, image_points, self.camera_matrix, self.dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )

            if not success:
                return None

            rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
            yaw, pitch, roll = self._rotation_matrix_to_euler(rotation_matrix)

            direction = "center"
            if yaw < -self.threshold:
                direction = "left"
            elif yaw > self.threshold:
                direction = "right"

            if pitch < -self.pitch_threshold:
                direction = f"{direction}_up" if direction != "center" else "up"
            elif pitch > self.pitch_threshold:
                direction = f"{direction}_down" if direction != "center" else "down"

            return {
                "yaw": round(float(yaw), 2),
                "pitch": round(float(pitch), 2),
                "roll": round(float(roll), 2),
                "direction": direction,
                "is_suspicious": direction not in ("center",),
            }

        except Exception as e:
            print(f"HeadPoseDetector error: {e}")
            return None

    def _smooth_pose(self, raw_yaw: float, raw_pitch: float) -> Tuple[float, float]:
        self._yaw_buffer.append(raw_yaw)
        self._pitch_buffer.append(raw_pitch)
        smoothed_yaw = sum(self._yaw_buffer) / len(self._yaw_buffer)
        smoothed_pitch = sum(self._pitch_buffer) / len(self._pitch_buffer)
        return smoothed_yaw, smoothed_pitch

    def estimate(self, pose_landmarks: dict, frame_shape: Tuple[int, int]) -> Optional[dict]:
        try:
            h, w = frame_shape[:2]
            self._ensure_camera_matrix(w, h)

            required = ["nose", "chin", "left_eye", "right_eye", "left_mouth", "right_mouth"]
            image_pts = []
            for key in required:
                if key in pose_landmarks:
                    image_pts.append(pose_landmarks[key])
            if len(image_pts) < 4:
                self._yaw_buffer.clear()
                self._pitch_buffer.clear()
                return None

            image_points = np.array(image_pts, dtype=np.float64)
            model_subset = self.model_points[:len(image_points)]

            success, rotation_vector, _ = cv2.solvePnP(
                model_subset, image_points, self.camera_matrix, self.dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )
            if not success:
                self._yaw_buffer.clear()
                self._pitch_buffer.clear()
                return None

            rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
            raw_yaw, raw_pitch, roll = self._rotation_matrix_to_euler(rotation_matrix)
            smoothed_yaw, smoothed_pitch = self._smooth_pose(raw_yaw, raw_pitch)

            direction = "center"
            if smoothed_yaw < -self.threshold:
                direction = "left"
            elif smoothed_yaw > self.threshold:
                direction = "right"

            if smoothed_pitch < -self.pitch_threshold:
                direction = f"{direction}_up" if direction != "center" else "up"
            elif smoothed_pitch > self.pitch_threshold:
                direction = f"{direction}_down" if direction != "center" else "down"

            is_suspicious = direction not in ("center",)

            return {
                "yaw": round(float(smoothed_yaw), 2),
                "pitch": round(float(smoothed_pitch), 2),
                "roll": round(float(roll), 2),
                "direction": direction,
                "is_suspicious": is_suspicious,
            }

        except Exception as e:
            print(f"HeadPoseDetector estimate error: {e}")
            return None

    def reset(self):
        self._yaw_buffer.clear()
        self._pitch_buffer.clear()

    def _rotation_matrix_to_euler(self, rotation_matrix: np.ndarray) -> Tuple[float, float, float]:
        sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
        singular = sy < 1e-6
        if not singular:
            x = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
            y = np.arctan2(-rotation_matrix[2, 0], sy)
            z = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
        else:
            x = np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
            y = np.arctan2(-rotation_matrix[2, 0], sy)
            z = 0
        return (np.degrees(y), np.degrees(x), np.degrees(z))
