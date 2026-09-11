import base64
import time
from typing import Optional


class FrameProcessor:
    def __init__(self):
        import numpy as np
        import cv2

        from app.services.new_detectors.face_detector import FaceDetectorMP
        from app.services.new_detectors.phone_detector import PhoneDetectorYOLO
        from app.services.new_detectors.head_pose_detector import HeadPoseDetector
        from app.services.new_detectors.eye_gaze_detector import EyeGazeDetector
        from app.services.new_detectors.violation_manager import ViolationManager
        from app.services.new_detectors.config import detection_config
        from app.services.websocket_manager import ws_manager

        self.np = np
        self.cv2 = cv2
        self.ws_manager = ws_manager
        self.detection_config = detection_config

        self.face_detector = FaceDetectorMP(
            min_detection_confidence=detection_config.FACE_DETECTION_CONFIDENCE,
        )
        self.phone_detector = PhoneDetectorYOLO(
            model_path=detection_config.YOLO_MODEL_PATH,
            confidence_threshold=detection_config.PHONE_CONFIDENCE_THRESHOLD,
        )
        self.head_pose_detector = HeadPoseDetector(
            threshold_degrees=detection_config.HEAD_POSE_THRESHOLD_DEGREES,
            smoothing_frames=detection_config.SMOOTHING_FRAMES,
        )
        self.eye_gaze_detector = EyeGazeDetector(
            gaze_ratio_threshold=detection_config.EYE_GAZE_THRESHOLD_RATIO,
            blink_ratio_threshold=detection_config.EYE_BLINK_THRESHOLD_RATIO,
            blink_frame_tolerance=detection_config.EYE_BLINK_FRAMES_TOLERANCE,
            smoothing_frames=detection_config.SMOOTHING_FRAMES,
        )
        self.violation_manager = ViolationManager(
            cooldown_seconds=detection_config.VIOLATION_COOLDOWN_SECONDS,
            no_face_timeout=detection_config.NO_FACE_TIMEOUT_SECONDS,
            multiple_faces_timeout=detection_config.MULTIPLE_FACES_TIMEOUT_SECONDS,
            phone_ignore_seconds=detection_config.PHONE_IGNORE_SECONDS,
            head_pose_suspicious_seconds=detection_config.HEAD_POSE_SUSPICIOUS_SECONDS,
            head_pose_consecutive_frames=detection_config.HEAD_POSE_CONSECUTIVE_FRAMES,
            eye_gaze_suspicious_seconds=detection_config.EYE_GAZE_SUSPICIOUS_SECONDS,
            looking_away_offset_ratio=detection_config.LOOKING_AWAY_OFFSET_RATIO,
            looking_away_consecutive_frames=detection_config.LOOKING_AWAY_CONSECUTIVE_FRAMES,
            looking_away_suspicious_seconds=detection_config.LOOKING_AWAY_SUSPICIOUS_SECONDS,
        )

    def process_frame(self, frame_data: str, attempt_id: str) -> dict:
        cv2 = self.cv2
        np = self.np
        frame = self._decode_frame(frame_data)
        if frame is None:
            return {"success": False, "violations": [], "processed": False}

        try:
            frame = cv2.resize(frame, (self.detection_config.FRAME_WIDTH, self.detection_config.FRAME_HEIGHT))
            now = time.time()

            face_bboxes, all_landmarks = self.face_detector.detect(frame)
            face_count = len(face_bboxes)

            phone_detected, phone_detections = self.phone_detector.detect(frame)

            events = []

            no_face_event = self.violation_manager.check_no_face(face_count, now)
            if no_face_event:
                events.append(no_face_event)

            multiple_faces_event = self.violation_manager.check_multiple_faces(face_count, now)
            if multiple_faces_event:
                events.append(multiple_faces_event)

            phone_event = self.violation_manager.check_phone(phone_detected, phone_detections, now)
            if phone_event:
                events.append(phone_event)

            looking_away_event = self.violation_manager.check_looking_away(
                face_bboxes[0].tolist() if face_bboxes else None,
                self.detection_config.FRAME_WIDTH,
                self.detection_config.FRAME_HEIGHT,
                now,
            )
            if looking_away_event:
                events.append(looking_away_event)

            head_pose_result = None
            gaze_result = None

            if face_count > 0 and all_landmarks:
                landmarks_2d, _ = all_landmarks[0]

                face_bbox = face_bboxes[0]
                face_width = int(face_bbox[2]) if len(face_bbox) >= 3 else 0

                if face_width >= 100:
                    pose_landmarks = self.face_detector.get_pose_landmarks(landmarks_2d)
                    head_pose_result = self.head_pose_detector.estimate(pose_landmarks, frame.shape)
                    head_pose_event = self.violation_manager.check_head_pose(head_pose_result, now)
                    if head_pose_event:
                        events.append(head_pose_event)

                    eye_data = self.face_detector.get_eye_landmarks(landmarks_2d)
                    if eye_data["left"] and eye_data["right"]:
                        gaze_result = self.eye_gaze_detector.analyze(eye_data["left"], eye_data["right"])
                        gaze_event = self.violation_manager.check_eye_gaze(gaze_result, now)
                        if gaze_event:
                            events.append(gaze_event)

            for ev in events:
                self.violation_manager.log_event(ev)

            pending = self.violation_manager.get_pending_events()

            violations_dicts = []
            for ev in pending:
                v = {
                    "type": ev.type,
                    "timestamp": ev.timestamp,
                    "confidence": ev.confidence,
                    "duration": ev.duration,
                }
                if ev.details:
                    v["details"] = ev.details
                violations_dicts.append(v)

            if violations_dicts:
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.ensure_future(
                            self.ws_manager.broadcast_violation(attempt_id, violations_dicts[-1])
                        )
                except RuntimeError:
                    pass

            stats = {
                "face_count": face_count,
                "phone_detected": phone_detected,
                "head_pose": head_pose_result,
                "eye_gaze": gaze_result,
            }

            return {
                "success": True,
                "violations": violations_dicts,
                "processed": True,
                "stats": stats,
            }

        except Exception as e:
            print(f"FrameProcessor error: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "violations": [], "processed": False, "error": str(e)}

    def _decode_frame(self, frame_data: str) -> Optional[object]:
        cv2 = self.cv2
        np = self.np
        try:
            if "," in frame_data:
                frame_data = frame_data.split(",")[1]
            image_data = base64.b64decode(frame_data)
            nparr = np.frombuffer(image_data, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"Error decoding frame: {e}")
            return None

    def reset(self):
        self.violation_manager.reset()
        self.head_pose_detector.reset()
        self.eye_gaze_detector.reset()
