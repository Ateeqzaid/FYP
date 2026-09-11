import os
import ssl
import urllib.request
from typing import Optional


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MODELS_DIR = os.path.join(BASE_DIR, "models")

FACE_LANDMARKER_MODEL = os.path.join(MODELS_DIR, "face_landmarker_v2_with_blendshapes.task")
FACE_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def download_file(url: str, dest_path: str) -> bool:
    if os.path.exists(dest_path):
        return True
    ensure_dir(os.path.dirname(dest_path))
    try:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        urllib.request.urlretrieve(url, dest_path)
        return True
    except Exception as e:
        print(f"Download failed for {url}: {e}")
        return False


def ensure_face_landmarker_model() -> Optional[str]:
    if download_file(FACE_LANDMARKER_URL, FACE_LANDMARKER_MODEL):
        return FACE_LANDMARKER_MODEL
    return None


def find_yolo_model() -> Optional[str]:
    candidates = [
        os.path.join(MODELS_DIR, "yolov8n.pt"),
        os.path.join(BASE_DIR, "yolov8n.pt"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path

    ensure_dir(MODELS_DIR)
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8n.pt")
        dst = os.path.join(MODELS_DIR, "yolov8n.pt")
        if os.path.exists("yolov8n.pt"):
            import shutil
            shutil.move("yolov8n.pt", dst)
        return dst
    except Exception as e:
        print(f"Could not load YOLO model: {e}")
        return None


def list_available_models() -> list:
    models = []
    if os.path.exists(FACE_LANDMARKER_MODEL):
        models.append("face_landmarker")
    if find_yolo_model() is not None:
        models.append("yolov8n")
    return models
