from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class QuestionBase(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    marks: int = 1
    order_index: int = 0


class QuestionCreate(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    id: UUID
    exam_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ExamBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int
    total_marks: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ExamCreate(ExamBase):
    pass


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    total_marks: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_published: Optional[bool] = None


class ExamResponse(ExamBase):
    id: UUID
    is_published: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExamWithQuestions(ExamResponse):
    questions: List[QuestionResponse] = []
