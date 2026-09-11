from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from supabase import create_client, Client
from app.config import settings
from app.schemas.exam import (
    ExamCreate,
    ExamUpdate,
    ExamResponse,
    ExamWithQuestions,
    QuestionCreate,
    QuestionResponse,
)
from app.services.gemini_service import generate_questions_from_file, generate_questions_from_prompt


class GeneratePromptRequest(BaseModel):
    topic: str
    count: int = 5

router = APIRouter(prefix="/exams", tags=["Exams"])

supabase: Optional[Client] = None
supabase_anon: Optional[Client] = None


def get_supabase() -> Client:
    global supabase
    if supabase is None:
        from supabase import ClientOptions
        supabase = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
            options=ClientOptions(
                auto_refresh_token=False,
                persist_session=False
            )
        )
    return supabase


def get_supabase_anon() -> Client:
    global supabase_anon
    if supabase_anon is None:
        supabase_anon = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY
        )
    return supabase_anon


def get_user_from_token(authorization: str) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    supabase = get_supabase_anon()
    try:
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response
        return None
    except Exception as e:
        print(f"Error getting user from token: {e}")
        return None


@router.get("", response_model=dict)
async def list_exams(is_published: bool = True):
    supabase = get_supabase()

    query = supabase.table("exams").select("*")
    if is_published is not None:
        query = query.eq("is_published", is_published)

    result = query.execute()

    return {
        "success": True,
        "data": result.data
    }


@router.get("/all", response_model=dict)
async def list_all_exams(authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    result = supabase.table("exams").select("*").eq("created_by", user.user.id).execute()

    return {
        "success": True,
        "data": result.data
    }


@router.post("/generate-questions-from-file", response_model=dict)
async def generate_questions_from_upload(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    if not file.filename or not (file.filename.lower().endswith(".pdf") or file.filename.lower().endswith(".docx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported"
        )

    try:
        file_bytes = await file.read()
        questions = await generate_questions_from_file(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )

    return {
        "success": True,
        "data": questions
    }


@router.post("/generate-questions-from-prompt", response_model=dict)
async def generate_questions_from_prompt_endpoint(
    request: GeneratePromptRequest,
    authorization: str = Header(None)
):
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    if not request.topic.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Topic is required"
        )

    if request.count < 1 or request.count > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Count must be between 1 and 50"
        )

    try:
        questions = await generate_questions_from_prompt(request.topic, request.count)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate questions: {str(e)}"
        )

    return {
        "success": True,
        "data": questions
    }


@router.get("/{exam_id}", response_model=dict)
async def get_exam(exam_id: str):
    supabase = get_supabase()

    exam = supabase.table("exams").select("*").eq("id", exam_id).single().execute()

    if not exam.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    questions = supabase.table("questions").select("*").eq(
        "exam_id", exam_id
    ).order("order_index").execute()

    exam_data = exam.data
    exam_data["questions"] = questions.data

    return {
        "success": True,
        "data": exam_data
    }


@router.post("", response_model=dict)
async def create_exam(exam_data: ExamCreate, authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    insert_data = {
        "title": exam_data.title,
        "description": exam_data.description,
        "duration_minutes": exam_data.duration_minutes,
        "total_marks": exam_data.total_marks,
        "is_published": False,
        "created_by": user.user.id
    }
    
    if exam_data.start_time:
        insert_data["start_time"] = exam_data.start_time.isoformat()
    if exam_data.end_time:
        insert_data["end_time"] = exam_data.end_time.isoformat()

    exam = supabase.table("exams").insert(insert_data).execute()

    return {
        "success": True,
        "data": exam.data[0] if exam.data else None
    }


@router.put("/{exam_id}", response_model=dict)
async def update_exam(exam_id: str, exam_data: ExamUpdate, authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    try:
        existing = supabase.table("exams").select("created_by").eq("id", exam_id).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Exam not found")
    if not existing.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if existing.data["created_by"] != user.user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this exam")

    update_data = exam_data.model_dump(exclude_unset=True)

    exam = supabase.table("exams").update(update_data).eq("id", exam_id).execute()

    return {
        "success": True,
        "data": exam.data[0] if exam.data else None
    }


@router.delete("/{exam_id}", response_model=dict)
async def delete_exam(exam_id: str, authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    try:
        existing = supabase.table("exams").select("created_by").eq("id", exam_id).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Exam not found")
    if not existing.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if existing.data["created_by"] != user.user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this exam")

    attempts = supabase.table("exam_attempts").select("id").eq("exam_id", exam_id).execute()
    if attempts.data:
        for attempt in attempts.data:
            supabase.table("violations").delete().eq("attempt_id", attempt["id"]).execute()
            supabase.table("exam_sessions").delete().eq("attempt_id", attempt["id"]).execute()
            supabase.table("student_answers").delete().eq("attempt_id", attempt["id"]).execute()
        supabase.table("exam_attempts").delete().eq("exam_id", exam_id).execute()

    supabase.table("exams").delete().eq("id", exam_id).execute()

    return {
        "success": True,
        "message": "Exam deleted successfully"
    }


@router.post("/{exam_id}/publish", response_model=dict)
async def publish_exam(exam_id: str, authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    current = supabase.table("exams").select("is_published, created_by").eq("id", exam_id).single().execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if current.data["created_by"] != user.user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to publish this exam")

    new_status = not current.data["is_published"]
    supabase.table("exams").update({"is_published": new_status}).eq("id", exam_id).execute()

    return {
        "success": True,
        "data": { "is_published": new_status }
    }


@router.post("/{exam_id}/questions", response_model=dict)
async def add_question(exam_id: str, question_data: QuestionCreate, authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    exam = supabase.table("exams").select("created_by").eq("id", exam_id).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.data["created_by"] != user.user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to add questions to this exam")

    question = supabase.table("questions").insert({
        "exam_id": exam_id,
        "question_text": question_data.question_text,
        "option_a": question_data.option_a,
        "option_b": question_data.option_b,
        "option_c": question_data.option_c,
        "option_d": question_data.option_d,
        "correct_option": question_data.correct_option,
        "marks": question_data.marks,
        "order_index": question_data.order_index
    }).execute()

    return {
        "success": True,
        "data": question.data[0] if question.data else None
    }


@router.put("/{exam_id}/questions/{question_id}", response_model=dict)
async def update_question(
    exam_id: str,
    question_id: str,
    question_data: QuestionCreate,
    authorization: str = Header(None)
):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    exam = supabase.table("exams").select("created_by").eq("id", exam_id).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.data["created_by"] != user.user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify questions in this exam")

    question = supabase.table("questions").update({
        "question_text": question_data.question_text,
        "option_a": question_data.option_a,
        "option_b": question_data.option_b,
        "option_c": question_data.option_c,
        "option_d": question_data.option_d,
        "correct_option": question_data.correct_option,
        "marks": question_data.marks,
        "order_index": question_data.order_index
    }).eq("id", question_id).execute()

    return {
        "success": True,
        "data": question.data[0] if question.data else None
    }


@router.delete("/{exam_id}/questions/{question_id}", response_model=dict)
async def delete_question(exam_id: str, question_id: str, authorization: str = Header(None)):
    supabase = get_supabase()
    user = get_user_from_token(authorization)

    if not user or not user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    exam = supabase.table("exams").select("created_by").eq("id", exam_id).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.data["created_by"] != user.user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete questions from this exam")

    supabase.table("questions").delete().eq("id", question_id).execute()

    return {
        "success": True,
        "message": "Question deleted successfully"
    }
