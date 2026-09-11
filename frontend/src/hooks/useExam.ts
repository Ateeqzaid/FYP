'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Exam, ExamAttempt, StudentAnswer, Question } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface UseExamReturn {
  exam: Exam | null
  attempt: ExamAttempt | null
  questions: Question[]
  answers: Map<string, string>
  currentQuestion: number
  timeRemaining: number
  loading: boolean
  error: string | null
  examStartTime: string | null
  startExam: (examId: string) => Promise<void>
  selectAnswer: (questionId: string, option: string) => void
  nextQuestion: () => void
  prevQuestion: () => void
  goToQuestion: (index: number) => void
  submitExam: () => Promise<void>
  reduceTime: () => void
}

export function useExam(): UseExamReturn {
  const [exam, setExam] = useState<Exam | null>(null)
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [examStartTime, setExamStartTime] = useState<string | null>(null)

  const startExam = useCallback(async (examId: string) => {
    setLoading(true)
    setError(null)
    setExamStartTime(null)

    try {
      const token = localStorage.getItem('access_token')
      const userStr = localStorage.getItem('user')
      if (!token || !userStr) throw new Error('Not authenticated')
      
      const user = JSON.parse(userStr)

      // Fetch exam & questions from backend
      const examRes = await fetch(`${API_URL}/api/exams/${examId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!examRes.ok) {
        const errText = await examRes.text()
        throw new Error(`Failed to fetch exam: ${errText}`)
      }
      
      const examDataRes = await examRes.json()
      if (!examDataRes.success) throw new Error('Failed to fetch exam')
      
      const examData = examDataRes.data
      const questionsData = examData.questions || []

      // Create or get attempt from backend
      const attemptRes = await fetch(`${API_URL}/api/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ exam_id: examId, student_id: user.id })
      })
      
      if (!attemptRes.ok) {
        const errData = await attemptRes.json()
        const detail = errData.detail
        if (typeof detail === 'object' && detail.message === 'This exam has not started yet') {
          setExam(examData)
          setQuestions(questionsData)
          setExamStartTime(detail.start_time)
          setLoading(false)
          return
        }
        throw new Error(typeof detail === 'string' ? detail : `Failed to start attempt: ${JSON.stringify(detail)}`)
      }
      const attemptDataRes = await attemptRes.json()
      const attemptData = attemptDataRes.data

      setExam(examData)
      setAttempt(attemptData)
      setQuestions(questionsData)
      setTimeRemaining(examData.duration_minutes * 60)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to start exam')
    } finally {
      setLoading(false)
    }
  }, [])

  const selectAnswer = useCallback((questionId: string, option: string) => {
    setAnswers(prev => {
      const newAnswers = new Map(prev)
      newAnswers.set(questionId, option)
      return newAnswers
    })
  }, [])

  const nextQuestion = useCallback(() => {
    setCurrentQuestion(prev => Math.min(prev + 1, questions.length - 1))
  }, [questions.length])

  const prevQuestion = useCallback(() => {
    setCurrentQuestion(prev => Math.max(prev - 1, 0))
  }, [])

  const goToQuestion = useCallback((index: number) => {
    setCurrentQuestion(Math.max(0, Math.min(index, questions.length - 1)))
  }, [questions.length])

  const reduceTime = useCallback(() => {
    setTimeRemaining(prev => Math.floor(prev / 2))
  }, [])

  const submitExam = useCallback(async () => {
    if (!attempt) return

    setLoading(true)

    try {
      const token = localStorage.getItem('access_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      const answersList = Array.from(answers.entries()).map(([questionId, option]) => ({
        attempt_id: attempt.id,
        question_id: questionId,
        selected_option: option,
      }))

      const ansRes = await fetch(`${API_URL}/api/attempts/${attempt.id}/answers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(answersList),
      })
      if (!ansRes.ok) throw new Error('Failed to save answers')

      const subRes = await fetch(`${API_URL}/api/attempts/${attempt.id}/submit`, {
        method: 'POST',
        headers,
      })
      if (!subRes.ok) throw new Error('Failed to submit exam')

      const subData = await subRes.json()
      const score = subData.data?.score ?? 0

      setAttempt(prev => prev ? { ...prev, status: 'completed', score, submitted_at: new Date().toISOString() } : null)
    } catch (err: any) {
      setError(err.message || 'Failed to submit exam')
    } finally {
      setLoading(false)
    }
  }, [attempt, answers])

  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  return {
    exam,
    attempt,
    questions,
    answers,
    currentQuestion,
    timeRemaining,
    loading,
    error,
    examStartTime,
    startExam,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    submitExam,
    reduceTime
  }
}
