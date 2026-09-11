import cv2
import numpy as np
import os
from typing import List, Tuple, Optional

from app.services.model_downloader import (
    ensure_ssd_mobilenet,
    CAFFE_MODEL,
    MOBILENET_SSD_PROTOTXT,
)

COCO_CLASSES = [
    "background", "person", "bicycle", "car", "motorcycle", "airplane", "bus",
    "train", "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag",
    "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
    "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana",
    "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza",
    "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table",
    "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock",
    "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
]

TARGET_CLASS_IDS = [77]

PHONE_COLOR_RANGES = [
    ((0, 0, 0), (180, 255, 60)),
    ((0, 0, 60), (180, 60, 180)),
]


class FaceDetector:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        self.profile_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_profileface.xml"
        )
        self.min_face_size = self.config.get("min_face_size", 30)
        self.scale_factor = self.config.get("scale_factor", 1.1)
        self.min_neighbors = self.config.get("min_neighbors", 5)

    def detect(self, frame: np.ndarray) -> Tuple[int, List[Tuple[int, int, int, int]]]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=(self.min_face_size, self.min_face_size),
        )
        faces_list = faces.tolist() if len(faces) > 0 else []
        profile_faces = self.profile_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=6,
            minSize=(self.min_face_size, self.min_face_size),
        )
        if len(profile_faces) > 0:
            for pf in profile_faces.tolist():
                if not self._overlaps(pf, faces_list):
                    faces_list.append(pf)
        return len(faces_list), faces_list

    def _overlaps(self, rect: Tuple[int, int, int, int], rects: List) -> bool:
        x1, y1, w1, h1 = rect
        for r in rects:
            x2, y2, w2, h2 = r
            if abs(x1 - x2) < max(w1, w2) * 0.5 and abs(y1 - y2) < max(h1, h2) * 0.5:
                return True
        return False


class ObjectDetector:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.confidence_threshold = self.config.get("confidence_threshold", 0.5)
        self.net = None
        self.initialized = False
        self._initialize_net()

    def _initialize_net(self):
        try:
            if os.path.exists(CAFFE_MODEL) and os.path.exists(MOBILENET_SSD_PROTOTXT):
                self.net = cv2.dnn.readNetFromCaffe(MOBILENET_SSD_PROTOTXT, CAFFE_MODEL)
                self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                self.initialized = True
                print("ObjectDetector: MobileNet-SSD loaded successfully")
            else:
                print("ObjectDetector: Model files not found, attempting download...")
                if ensure_ssd_mobilenet():
                    self.net = cv2.dnn.readNetFromCaffe(MOBILENET_SSD_PROTOTXT, CAFFE_MODEL)
                    self.initialized = True
                    print("ObjectDetector: MobileNet-SSD downloaded and loaded")
                else:
                    print("ObjectDetector: Could not download models, using contour fallback")
        except Exception as e:
            print(f"ObjectDetector init error: {e}")

    def detect(self, frame: np.ndarray) -> Tuple[bool, List[dict]]:
        if self.initialized and self.net is not None:
            return self._detect_dnn(frame)
        return self._detect_contour(frame)

    def _detect_dnn(self, frame: np.ndarray) -> Tuple[bool, List[dict]]:
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(frame, 1 / 127.5, (320, 320), (127.5, 127.5, 127.5), swapRB=True, crop=False)
        self.net.setInput(blob)
        try:
            output = self.net.forward()
        except:
            return False, []
        detections = []
        phone_detected = False
        for i in range(output.shape[2]):
            confidence = float(output[0, 0, i, 2])
            if confidence < self.confidence_threshold:
                continue
            class_id = int(output[0, 0, i, 1])
            if class_id in TARGET_CLASS_IDS:
                phone_detected = True
                box = output[0, 0, i, 3:7] * np.array([w, h, w, h])
                (x, y, x2, y2) = box.astype("int")
                detections.append({
                    "class": "phone",
                    "confidence": confidence,
                    "bbox": [int(x), int(y), int(x2 - x), int(y2 - y)],
                })
        return phone_detected, detections

    def _detect_contour(self, frame: np.ndarray) -> Tuple[bool, List[dict]]:
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        detections = []
        phone_detected = False
        img_area = h * w
        for contour in contours:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            x, y, cw, ch = cv2.boundingRect(contour)
            area = cv2.contourArea(contour)
            if area < img_area * 0.005 or area > img_area * 0.4:
                continue
            aspect_ratio = ch / cw if cw > 0 else 0
            rect_area = cw * ch
            fill_ratio = area / rect_area if rect_area > 0 else 0
            if 1.3 <= aspect_ratio <= 3.0 and fill_ratio > 0.3:
                phone_detected = True
                detections.append({
                    "class": "phone",
                    "confidence": 0.6,
                    "bbox": [x, y, cw, ch],
                })
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        for lower, upper in PHONE_COLOR_RANGES:
            lower = np.array(lower, dtype=np.uint8)
            upper = np.array(upper, dtype=np.uint8)
            color_mask = cv2.inRange(hsv, lower, upper)
            color_mask = cv2.GaussianBlur(color_mask, (5, 5), 0)
            color_mask = cv2.dilate(color_mask, None, iterations=2)
            color_contours, _ = cv2.findContours(color_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cc in color_contours:
                area = cv2.contourArea(cc)
                if area < 3000 or area > img_area * 0.25:
                    continue
                cx, cy, cw, ch = cv2.boundingRect(cc)
                aspect_ratio = ch / cw if cw > 0 else 0
                if 1.2 <= aspect_ratio <= 3.5:
                    phone_detected = True
                    detections.append({
                        "class": "phone",
                        "confidence": 0.5,
                        "bbox": [cx, cy, cw, ch],
                    })
        return phone_detected, detections


class BehaviorAnalyzer:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.looking_away_threshold = self.config.get("looking_away_threshold", 10)
        self.face_history = []
        self.max_history = 20

    def analyze(self, faces: List, frame_shape: Tuple[int, int]) -> bool:
        if not faces or len(faces) == 0:
            self.face_history.append(True)
        else:
            (x, y, w, h) = faces[0]
            face_center_x = x + w // 2
            face_center_y = y + h // 2
            frame_center_x = frame_shape[1] // 2
            frame_center_y = frame_shape[0] // 2
            offset_x = abs(face_center_x - frame_center_x) / frame_shape[1]
            offset_y = abs(face_center_y - frame_center_y) / frame_shape[0]
            looking_away = offset_x > 0.35 or offset_y > 0.35
            self.face_history.append(looking_away)
        if len(self.face_history) > self.max_history:
            self.face_history.pop(0)
        recent = sum(1 for x in self.face_history[-self.looking_away_threshold:] if x)
        return recent >= self.looking_away_threshold

    def reset(self):
        self.face_history = []
