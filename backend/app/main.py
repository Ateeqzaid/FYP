import os
os.environ["GLOG_minloglevel"] = "3"
os.environ["ABSL_MIN_LOG_LEVEL"] = "3"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    auth_router,
    exams_router,
    attempts_router,
    violations_router,
    monitoring_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting Exam Monitoring API - loading models...")
    try:
        from app.services.new_detectors.face_detector import FaceDetectorMP
        from app.services.new_detectors.phone_detector import PhoneDetectorYOLO

        _ = FaceDetectorMP()
        _ = PhoneDetectorYOLO()
        print("All AI models loaded successfully")
    except Exception as e:
        print(f"Warning: Could not pre-load models: {e}")
    yield
    print("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1}/openapi.json",
    docs_url=f"{settings.API_V1}/docs",
    redoc_url=f"{settings.API_V1}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_V1)
app.include_router(exams_router, prefix=settings.API_V1)
app.include_router(attempts_router, prefix=settings.API_V1)
app.include_router(violations_router, prefix=settings.API_V1)
app.include_router(monitoring_router, prefix=settings.API_V1)


@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
    }
