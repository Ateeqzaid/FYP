-- Exam Monitoring System Database Schema
-- Run this in Supabase SQL Editor

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    total_marks INTEGER NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    is_published BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Exams policies
CREATE POLICY "Students can view published exams" ON exams
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Admins can manage own exams" ON exams
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        AND created_by = auth.uid()
    );

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    marks INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Questions policies
CREATE POLICY "Anyone can view questions" ON questions
    FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage own exam questions" ON questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = questions.exam_id
            AND exams.created_by = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Exam Attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id),
    student_id UUID NOT NULL REFERENCES profiles(id),
    started_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    score INTEGER,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'flagged', 'reviewed')),
    admin_review_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP
);

-- Enable RLS
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- Exam Attempts policies
CREATE POLICY "Students can view own attempts" ON exam_attempts
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create attempts" ON exam_attempts
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own attempts" ON exam_attempts
    FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Admins can view own exam attempts" ON exam_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = exam_attempts.exam_id
            AND exams.created_by = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage own exam attempts" ON exam_attempts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = exam_attempts.exam_id
            AND exams.created_by = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Student Answers table
CREATE TABLE IF NOT EXISTS student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    selected_option CHAR(1),
    is_correct BOOLEAN,
    answered_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

-- Student Answers policies
CREATE POLICY "Users can manage own answers" ON student_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exam_attempts
            WHERE id = attempt_id AND student_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view own exam answers" ON student_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exam_attempts ea
            JOIN exams ON exams.id = ea.exam_id
            WHERE ea.id = attempt_id
            AND exams.created_by = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Violations table
CREATE TABLE IF NOT EXISTS violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL CHECK (violation_type IN (
        'no_face_detected',
        'multiple_faces',
        'phone_detected',
        'tab_switch',
        'window_blur',
        'looking_away_excessive',
        'head_pose_suspicious',
        'eye_gaze_suspicious'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description TEXT,
    frame_snapshot_url TEXT,
    detected_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Violations policies
CREATE POLICY "Anyone can insert violations" ON violations
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can view own attempt violations" ON violations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exam_attempts ea
            WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view own exam violations" ON violations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exam_attempts ea
            JOIN exams ON exams.id = ea.exam_id
            WHERE ea.id = attempt_id
            AND exams.created_by = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Exam Sessions table
CREATE TABLE IF NOT EXISTS exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id),
    session_start TIMESTAMP DEFAULT NOW(),
    session_end TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    client_ip TEXT,
    user_agent TEXT
);

-- Enable RLS
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

-- Exam Sessions policies
CREATE POLICY "Users can manage own sessions" ON exam_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exam_attempts ea
            WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage own exam sessions" ON exam_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exam_attempts ea
            JOIN exams ON exams.id = ea.exam_id
            WHERE ea.id = attempt_id
            AND exams.created_by = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exams_published ON exams(is_published);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_violations_attempt ON violations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_sessions_attempt ON exam_sessions(attempt_id);
