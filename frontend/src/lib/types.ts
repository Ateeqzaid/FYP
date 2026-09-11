export interface User {
  id: string
  email: string
  full_name: string
  role: 'student' | 'admin'
  created_at: string
  updated_at: string
}

export interface Exam {
  id: string
  title: string
  description: string
  duration_minutes: number
  total_marks: number
  is_published: boolean
  start_time: string | null
  end_time: string | null
  created_by: string
  created_at: string
  updated_at: string
  questions?: Question[]
}

export interface Question {
  id: string
  exam_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  marks: number
  order_index: number
  created_at: string
}

export interface ExamAttempt {
  id: string
  exam_id: string
  student_id: string
  started_at: string
  submitted_at: string | null
  score: number | null
  status: 'in_progress' | 'completed' | 'flagged' | 'reviewed'
  admin_review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  exam?: Exam
  answers?: StudentAnswer[]
}

export interface StudentAnswer {
  id: string
  attempt_id: string
  question_id: string
  selected_option: 'A' | 'B' | 'C' | 'D' | null
  is_correct: boolean | null
  answered_at: string
}

export type ViolationType =
  | 'no_face_detected'
  | 'multiple_faces'
  | 'phone_detected'
  | 'tab_switch'
  | 'window_blur'
  | 'looking_away_excessive'
  | 'head_pose_suspicious'
  | 'eye_gaze_suspicious'

export type Severity = 'low' | 'medium' | 'high'
export type PenaltyLevel = 1 | 2 | 3

export interface Violation {
  id: string
  attempt_id: string
  violation_type: ViolationType
  severity: Severity
  description: string | null
  frame_snapshot_url: string | null
  detected_at: string
  created_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface WSViolation {
  type: string
  timestamp: number
  confidence: number
  duration: number
  details?: Record<string, unknown>
}
