from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class AttemptStatus(str):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FLAGGED = "flagged"
    REVIEWED = "reviewed"


class StudentAnswerBase(BaseModel):
    question_id: UUID
    selected_option: Optional[str] = None


class StudentAnswerCreate(StudentAnswerBase):
    attempt_id: UUID


class StudentAnswerResponse(StudentAnswerBase):
    id: UUID
    attempt_id: UUID
    is_correct: Optional[bool] = None
    answered_at: datetime

    class Config:
        from_attributes = True


class ExamAttemptBase(BaseModel):
    exam_id: UUID


class ExamAttemptCreate(ExamAttemptBase):
    student_id: UUID


class ExamAttemptUpdate(BaseModel):
    status: Optional[str] = None
    score: Optional[int] = None
    admin_review_notes: Optional[str] = None
    reviewed_by: Optional[UUID] = None


class ExamAttemptResponse(ExamAttemptBase):
    id: UUID
    student_id: UUID
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[int] = None
    status: str
    admin_review_notes: Optional[str] = None
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
