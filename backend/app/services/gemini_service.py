import json
import re
import io
from typing import List, Optional
from PyPDF2 import PdfReader
from docx import Document
import google.generativeai as genai
from app.config import settings


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text.strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    text = "\n".join([p.text for p in doc.paragraphs])
    return text.strip()


def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif filename.lower().endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError("Unsupported file type. Only PDF and DOCX files are supported.")


def parse_questions_from_json(raw: str) -> List[dict]:
    json_match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON array found in Gemini response")
    questions = json.loads(json_match.group())
    validated = []
    for q in questions:
        q["correct_option"] = q["correct_option"].upper()
        if q["correct_option"] not in ("A", "B", "C", "D"):
            raise ValueError(f"Invalid correct_option '{q['correct_option']}' in question: {q.get('question_text', '')}")
        validated.append({
            "question_text": q["question_text"],
            "option_a": q["option_a"],
            "option_b": q["option_b"],
            "option_c": q["option_c"],
            "option_d": q["option_d"],
            "correct_option": q["correct_option"],
            "marks": q.get("marks", 1),
        })
    return validated


async def generate_questions_from_prompt(topic: str, count: int) -> List[dict]:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3.5-flash")

    prompt = f"""Generate {count} multiple-choice questions about "{topic}" and return them as a JSON array.
Each question must have exactly these fields:
- "question_text": the full question text
- "option_a": first option
- "option_b": second option
- "option_c": third option
- "option_d": fourth option
- "correct_option": one of "A", "B", "C", or "D"
- "marks": 1

Rules:
- Return ONLY the JSON array, no extra text, no markdown formatting.
- Make sure each question has exactly 4 plausible options with exactly one correct answer.
- Vary the difficulty and distribute correct answers across A, B, C, D evenly.

Generate exactly {count} questions."""

    response = model.generate_content(prompt)
    if not response.text:
        raise ValueError("Gemini returned an empty response")

    return parse_questions_from_json(response.text)


async def generate_questions_from_file(file_bytes: bytes, filename: str) -> List[dict]:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    text = extract_text(file_bytes, filename)
    if not text:
        raise ValueError("Could not extract any text from the file")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3.5-flash")

    prompt = f"""Extract all multiple-choice questions from the text below and return them as a JSON array.
Each question must have exactly these fields:
- "question_text": the full question text
- "option_a": first option
- "option_b": second option
- "option_c": third option
- "option_d": fourth option
- "correct_option": one of "A", "B", "C", or "D"
- "marks": default to 1 unless specified otherwise

Rules:
- Return ONLY the JSON array, no extra text, no markdown formatting.
- If a question has fewer than 4 options, fill missing options with "None of the above" or similar.
- The correct_option must be the letter of the correct answer.

Text:
{text[:30000]}"""

    response = model.generate_content(prompt)
    if not response.text:
        raise ValueError("Gemini returned an empty response")

    return parse_questions_from_json(response.text)
