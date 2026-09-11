import os
import urllib.request
import ssl
import zipfile

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")
CONFIG_DIR = os.path.join(BASE_DIR, "config")

MOBILENET_SSD_PROTOTXT = os.path.join(CONFIG_DIR, "ssd_mobilenet_v3_large_coco_2020_01_14.pbtxt")
CAFFE_MODEL = os.path.join(MODELS_DIR, "ssd_mobilenet_v3_large_coco_2020_01_14.caffemodel")

MOBILENET_PROTOTXT_URL = (
    "https://raw.githubusercontent.com/opencv/opencv_extra/master/testdata/dnn/ssd_mobilenet_v3_large_coco_2020_01_14.pbtxt"
)
CAFFE_MODEL_URL = (
    "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20200522/ssd_mobilenet_v3_large_coco_2020_01_14.caffemodel"
)


def download_file(url: str, dest_path: str) -> bool:
    if os.path.exists(dest_path):
        return True
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    try:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        urllib.request.urlretrieve(url, dest_path)
        return True
    except Exception as e:
        print(f"Download failed for {url}: {e}")
        return False


def ensure_ssd_mobilenet():
    success = True
    if not os.path.exists(MOBILENET_SSD_PROTOTXT):
        if not download_file(MOBILENET_PROTOTXT_URL, MOBILENET_SSD_PROTOTXT):
            success = False
    if not os.path.exists(CAFFE_MODEL):
        if not download_file(CAFFE_MODEL_URL, CAFFE_MODEL):
            success = False
    return success


def list_available_models():
    models = []
    if os.path.exists(CAFFE_MODEL) and os.path.exists(MOBILENET_SSD_PROTOTXT):
        models.append("ssd_mobilenet_v3")
    return models
