import cv2
import numpy as np
import mediapipe as mp
import os
from typing import List, Tuple, Optional

from app.services.new_detectors.model_downloader import ensure_face_landmarker_model, FACE_LANDMARKER_MODEL

LEFT_EYE_INDICES = [33, 133, 157, 158, 159, 160, 161, 173]
RIGHT_EYE_INDICES = [362, 263, 384, 385, 386, 387, 388, 398]
LEFT_IRIS_INDICES = [468, 469, 470, 471, 472]
RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477]

NOSE_INDEX = 1
CHIN_INDEX = 199
LEFT_EYE_OUTER_INDEX = 33
RIGHT_EYE_OUTER_INDEX = 263
LEFT_MOUTH_INDEX = 61
RIGHT_MOUTH_INDEX = 291


class FaceDetectorMP:
    def __init__(
        self,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        max_num_faces: int = 5,
    ):
        self.max_num_faces = max_num_faces
        self._landmarker = None
        self._initialized = False
        self._init_landmarker(min_detection_confidence, min_tracking_confidence)

    def _init_landmarker(self, min_detection_confidence: float, min_tracking_confidence: float):
        try:
            model_path = ensure_face_landmarker_model()
            if model_path is None:
                print("FaceDetectorMP: No model available")
                return

            options = mp.tasks.vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_faces=self.max_num_faces,
                min_face_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence,
                output_face_blendshapes=False,
                output_facial_transformation_matrixes=False,
            )
            self._landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)
            self._initialized = True
        except Exception as e:
            print(f"FaceDetectorMP init error: {e}")
            self._initialized = False

    def detect(self, frame: np.ndarray) -> Tuple[List[np.ndarray], List[List]]:
        if not self._initialized or self._landmarker is None:
            return [], []

        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = self._landmarker.detect(mp_image)

            if result.face_landmarks is None or len(result.face_landmarks) == 0:
                return [], []

            h, w, _ = frame.shape
            face_bboxes = []
            all_landmarks = []

            for face_landmarks in result.face_landmarks:
                xs = [lm.x for lm in face_landmarks]
                ys = [lm.y for lm in face_landmarks]
                x_min = max(0, int(min(xs) * w))
                y_min = max(0, int(min(ys) * h))
                x_max = min(w, int(max(xs) * w))
                y_max = min(h, int(max(ys) * h))

                landmarks_2d = [(lm.x * w, lm.y * h) for lm in face_landmarks]
                landmarks_3d = [(lm.x, lm.y, lm.z) for lm in face_landmarks]

                face_bboxes.append(np.array([x_min, y_min, x_max - x_min, y_max - y_min]))
                all_landmarks.append((landmarks_2d, landmarks_3d))

            return face_bboxes, all_landmarks

        except Exception as e:
            print(f"FaceDetectorMP detect error: {e}")
            return [], []

    def get_face_count(self, frame: np.ndarray) -> int:
        bboxes, _ = self.detect(frame)
        return len(bboxes)

    def get_largest_face_landmarks(self, frame: np.ndarray) -> Optional[Tuple[List, List]]:
        bboxes, all_landmarks = self.detect(frame)
        if not bboxes:
            return None
        largest_idx = 0
        if len(bboxes) > 1:
            areas = [b[2] * b[3] for b in bboxes]
            largest_idx = int(np.argmax(areas))
        return all_landmarks[largest_idx]

    def get_eye_landmarks(self, landmarks_2d: List[Tuple[float, float]]) -> dict:
        left = [landmarks_2d[i] for i in LEFT_EYE_INDICES if i < len(landmarks_2d)]
        right = [landmarks_2d[i] for i in RIGHT_EYE_INDICES if i < len(landmarks_2d)]
        left_iris = [landmarks_2d[i] for i in LEFT_IRIS_INDICES if i < len(landmarks_2d)]
        right_iris = [landmarks_2d[i] for i in RIGHT_IRIS_INDICES if i < len(landmarks_2d)]
        return {"left": left, "right": right, "left_iris": left_iris, "right_iris": right_iris}

    def get_pose_landmarks(self, landmarks_2d: List[Tuple[float, float]]) -> dict:
        indices = [NOSE_INDEX, CHIN_INDEX, LEFT_EYE_OUTER_INDEX, RIGHT_EYE_OUTER_INDEX, LEFT_MOUTH_INDEX, RIGHT_MOUTH_INDEX]
        return {name: landmarks_2d[idx] for name, idx in zip(
            ["nose", "chin", "left_eye", "right_eye", "left_mouth", "right_mouth"], indices
        ) if idx < len(landmarks_2d)}

    def close(self):
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None
