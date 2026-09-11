import os
import numpy as np
from typing import List, Dict, Tuple, Optional

from app.services.new_detectors.model_downloader import find_yolo_model


class PhoneDetectorYOLO:
    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = 0.4,
        phone_class_ids: Tuple[int, ...] = (67,),
        book_class_ids: Tuple[int, ...] = (73,),
        tablet_class_ids: Tuple[int, ...] = (66,),
    ):
        self.confidence_threshold = confidence_threshold
        self.target_class_ids = phone_class_ids + book_class_ids + tablet_class_ids
        self.class_labels = {67: "phone", 73: "book", 66: "tablet"}
        self.model = None
        self._initialized = False
        self._load_model(model_path)

    def _load_model(self, model_path: Optional[str]):
        try:
            from ultralytics import YOLO

            path = model_path or find_yolo_model()
            if path and os.path.exists(path):
                self.model = YOLO(path)
            else:
                self.model = YOLO("yolov8n.pt")
            self.model.to("cpu")
            self._initialized = True
            print(f"PhoneDetectorYOLO: model loaded from {path or 'default'}")
        except Exception as e:
            print(f"PhoneDetectorYOLO: Could not load model: {e}")

    def detect(self, frame: np.ndarray) -> Tuple[bool, List[Dict]]:
        if not self._initialized or self.model is None:
            return False, []

        try:
            orig_h, orig_w = frame.shape[:2]
            results = self.model(frame, verbose=False, device="cpu")
            detections = []
            phone_detected = False

            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue

                for i in range(len(boxes)):
                    cls_id = int(boxes.cls[i].item())
                    conf = float(boxes.conf[i].item())

                    if cls_id not in self.target_class_ids:
                        continue
                    if conf < self.confidence_threshold:
                        continue

                    x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                    x1 = int(max(0, x1))
                    y1 = int(max(0, y1))
                    x2 = int(min(orig_w, x2))
                    y2 = int(min(orig_h, y2))
                    w = x2 - x1
                    h = y2 - y1

                    if w < 10 or h < 10:
                        continue

                    label = self.class_labels.get(cls_id, "unknown")
                    if label == "phone":
                        phone_detected = True

                    detections.append({
                        "class": label,
                        "confidence": round(conf, 3),
                        "bbox": [x1, y1, w, h],
                        "class_id": cls_id,
                    })

            return phone_detected, detections

        except Exception as e:
            print(f"PhoneDetectorYOLO detect error: {e}")
            return False, []

    def close(self):
        self.model = None
        self._initialized = False
