# SmartExam — AI-Powered Online Exam Monitoring System

A full-stack online examination platform with real-time AI proctoring that detects suspicious behavior during remote exams. Built with **FastAPI**, **Next.js 14**, and **Supabase**, featuring computer vision detectors powered by **MediaPipe**, **YOLOv8**, and **OpenCV**.

---

## Architecture Overview

```
[Student Browser]          [Admin Browser]
       |                         |
   Next.js 14 (TypeScript, TailwindCSS)
       |
  API Proxy (next.config.js)
  /api/* -> localhost:8000/api/*
       |
  [FastAPI Backend]
       |
  +----+----+----+----+
  |    |    |    |    |
Auth Exams Monitor Admin
       |
  [AI Detection Pipeline]
  Face | Phone | HeadPose | EyeGaze
       |
  [Supabase PostgreSQL]
```

---

## Features

### AI Proctoring
- **Face Detection** — MediaPipe FaceLandmarker (468 landmarks) with bounding box and iris tracking
- **Phone Detection** — YOLOv8n for real-time phone, tablet, and book detection
- **Head Pose Estimation** — solvePnP-based 3D head orientation (yaw/pitch/roll) with temporal smoothing
- **Eye Gaze Tracking** — Eye Aspect Ratio (EAR) for blink detection, iris-based gaze direction estimation
- **Violation State Machine** — Configurable cooldowns, thresholds, and severity levels for 8 violation types
- **Real-time WebSocket** — Live violation streaming to the student browser

### Violation Types

| Type | Severity | Description |
|------|----------|-------------|
| `no_face_detected` | High | No face visible for N seconds |
| `multiple_faces` | High | Multiple people detected in frame |
| `phone_detected` | High | Phone, tablet, or book detected via YOLOv8 |
| `tab_switch` | Low–Medium | Browser tab changed (visibility API) |
| `window_blur` | Medium | Window lost focus for >2 seconds |
| `looking_away_excessive` | Low | Face offset from center for too long |
| `head_pose_suspicious` | Medium | Head yaw/pitch exceeds threshold |
| `eye_gaze_suspicious` | Medium | Eyes looking away from screen |

### Student Portal
- Register/login via email/password or Google OAuth
- Join exams using a unique Exam ID
- Live webcam feed with real-time violation alerts (toast notifications + WebSocket)
- Timer countdown with auto-submit on expiry
- Navigate multiple-choice questions with auto-save

### Admin Portal
- Create and manage exams with title, duration, scheduling, and total marks
- AI-assisted question generation from uploaded PDF/DOCX files or topic prompts via Google Gemini
- Manual question creation, editing, and deletion
- Publish/unpublish exams and share Exam IDs with students
- Review detailed violation reports per attempt with timestamps
- Accept or reject flagged attempts

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14.2, TypeScript 5.4, TailwindCSS 3.4, Zustand 4.5 |
| **Backend** | FastAPI 0.110, Python 3.12+, Pydantic |
| **AI/ML** | MediaPipe FaceLandmarker, Ultralytics YOLOv8n, OpenCV, NumPy |
| **LLM** | Google Gemini API (AI question generation from files/prompts) |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Auth** | Supabase Auth + Google OAuth |
| **Real-time** | WebSocket (live violation streaming) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+
- A Supabase project (free tier works)

### 1. Database Setup

```bash
# Run the schema in Supabase SQL Editor
supabase/schema.sql
supabase/migration_add_violation_types.sql
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env   # Fill in your Supabase & API keys
pip install -r requirements.txt
python run.py
```

The API runs at `http://localhost:8000`.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local   # Fill in your keys
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GEMINI_API_KEY` | Google Gemini API key for AI question generation |
| `DETECTION_SMOOTHING_FRAMES` | Frame smoothing buffer size (default: 10) |
| `DETECTION_EYE_GAZE_THRESHOLD_RATIO` | Gaze deviation ratio threshold (default: 0.80) |
| `DETECTION_HEAD_POSE_THRESHOLD_DEGREES` | Head pose angle threshold (default: 55) |
| `DETECTION_VIOLATION_COOLDOWN_SECONDS` | Cooldown between same-type violations (default: 20) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## Project Structure

```
fyp/
├── backend/                        # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                 # Application entry point
│   │   ├── config.py               # Pydantic settings
│   │   ├── routers/                # API route handlers
│   │   │   ├── auth.py             # Authentication endpoints
│   │   │   ├── exams.py            # Exam CRUD & AI question generation
│   │   │   ├── attempts.py         # Exam attempt lifecycle
│   │   │   ├── violations.py       # Violation logging & reporting
│   │   │   └── monitoring.py       # Webcam analysis & WebSocket
│   │   ├── schemas/                # Pydantic models
│   │   └── services/               # Business logic & AI detectors
│   │       └── new_detectors/      # MediaPipe + YOLOv8 detection pipeline
│   ├── models/                     # Downloaded AI model files
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                       # Next.js 14 application
│   └── src/
│       ├── app/                    # Pages (landing, login, student, admin)
│       ├── hooks/                  # useAuth, useExam, useMonitoring, etc.
│       ├── lib/                    # Supabase client, types, constants
│       └── styles/                 # TailwindCSS globals
│
└── supabase/
    ├── schema.sql                  # Full database schema (7 tables, RLS, indexes)
    └── migration_add_violation_types.sql
```

---

## Quick Start

### 1. Database

1. Create a project on [Supabase](https://supabase.com)
2. Run `supabase/schema.sql` and `supabase/migration_add_violation_types.sql` in the SQL Editor

### 2. Backend

```bash
cd backend
cp .env.example .env   # Configure your Supabase, Google, and Gemini keys
pip install -r requirements.txt
python run.py
```

The API starts at `http://localhost:8000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local   # Configure your keys
npm install
npm run dev
```

The app starts at `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GEMINI_API_KEY` | Google Gemini API key for AI question generation |
| `DETECTION_SMOOTHING_FRAMES` | Frame smoothing buffer size |
| `DETECTION_EYE_GAZE_THRESHOLD_RATIO` | Gaze deviation ratio threshold |
| `DETECTION_HEAD_POSE_THRESHOLD_DEGREES` | Head yaw/pitch angle threshold |
| `DETECTION_VIOLATION_COOLDOWN_SECONDS` | Cooldown between same-type violations |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## Project Structure

```
fyp/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Pydantic settings
│   │   ├── routers/                # API route handlers
│   │   │   ├── auth.py             # Register, login, Google OAuth, token refresh
│   │   │   ├── exams.py            # Exam CRUD, AI question generation
│   │   │   ├── attempts.py         # Start, answer, submit exam attempts
│   │   │   ├── violations.py       # Log, review, report violations
│   │   │   └── monitoring.py       # Frame analysis, WebSocket, heartbeat
│   │   ├── schemas/                # Pydantic request/response models
│   │   └── services/
│   │       ├── detectors.py        # Legacy Haar + MobileNet-SSD detectors
│   │       ├── gemini_service.py   # Google Gemini question generation
│   │       ├── websocket_manager.py
│   │       ├── processor.py        # FrameProcessor orchestrator
│   │       └── new_detectors/      # Current detection pipeline
│   │           ├── face_detector.py      # MediaPipe FaceLandmarker
│   │           ├── phone_detector.py     # YOLOv8 phone/tablet/book detection
│   │           ├── head_pose_detector.py # solvePnP 3D head pose estimation
│   │           ├── eye_gaze_detector.py  # EAR blink & iris gaze detection
│   │           └── violation_manager.py  # State machine with cooldowns
│   ├── models/                     # Pre-trained model files
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                       # Next.js 14 application
│   └── src/
│       ├── app/                    # Pages (landing, login, student, admin)
│       ├── hooks/                  # Custom React hooks
│       ├── lib/                    # Supabase client, types, constants
│       └── styles/                 # Global CSS with dark/light mode
│
└── supabase/
    ├── schema.sql                  # Database schema with RLS policies
    └── migration_add_violation_types.sql
```

---

## API Overview

All endpoints are prefixed with `/api`.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with email verification |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/google` | Google OAuth sign-in/sign-up |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |

### Exams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/exams` | List published exams |
| GET | `/exams/all` | List all exams (admin) |
| GET | `/exams/{id}` | Get exam with questions |
| POST | `/exams` | Create exam (admin) |
| PUT | `/exams/{id}` | Update exam (admin) |
| DELETE | `/exams/{id}` | Delete exam (admin) |
| POST | `/exams/{id}/publish` | Toggle publish status |
| POST | `/exams/generate-questions-from-file` | AI generate from PDF/DOCX |
| POST | `/exams/generate-questions-from-prompt` | AI generate from topic prompt |

### Exam Attempts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attempts` | Start an exam attempt |
| POST | `/attempts/{id}/submit` | Submit and auto-grade |
| POST | `/attempts/{id}/answers` | Save answers during attempt |
| GET | `/attempts/student/me` | Get current student's attempts |
| GET | `/attempts/list` | List all attempts (admin) |
| GET | `/attempts/{id}` | Get attempt details |
| PUT | `/attempts/{id}` | Update attempt status (admin) |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/monitoring/ws/{attempt_id}` | Real-time violation WebSocket |
| POST | `/monitoring/analyze` | Analyze a webcam frame |
| POST | `/monitoring/heartbeat` | Keep session alive |
| GET | `/monitoring/session/{attempt_id}` | Get active session |

### Violations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/violations` | Log a violation |
| GET | `/violations/all` | All violations (admin) |
| GET | `/violations/attempt/{id}` | Violations for an attempt |
| GET | `/violations/report/{id}` | Detailed violation report |
| PATCH | `/violations/{id}` | Update violation severity |

---

## AI Detection Pipeline

The monitoring system processes webcam frames through a multi-stage pipeline:

1. **Face Detection** — MediaPipe FaceLandmarker extracts 468 facial landmarks and bounding boxes
2. **Head Pose Estimation** — solvePnP computes 3D head orientation (yaw, pitch, roll) with temporal smoothing
3. **Eye Gaze Tracking** — Eye Aspect Ratio (EAR) for blink detection; iris landmarks for gaze direction
4. **Phone/Object Detection** — YOLOv8n detects phones, tablets, and books in the frame
5. **Violation Manager** — State machine with configurable cooldowns and severity thresholds

All detection parameters (thresholds, cooldowns, smoothing) are configurable via environment variables.

---

## Scripts

### Backend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot-reload on port 8000 |
| `npm start` | Start production server |
| `pip install -r requirements.txt` | Install Python dependencies |

### Frontend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

---

## License

MIT
