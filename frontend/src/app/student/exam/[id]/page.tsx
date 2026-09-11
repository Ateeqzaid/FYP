'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useExam } from '@/hooks/useExam'
import { useMonitoring } from '@/hooks/useMonitoring'
import {
  Clock, Camera, AlertTriangle, ChevronLeft, ChevronRight,
  Flag, X, Send, CameraOff, Timer, CheckCircle2, Shield, Sparkles,
  BookOpen, ListChecks, FileText, Play
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VIOLATION_TYPES } from '@/lib/constants'

function ExamContent({ examId }: { examId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { exam, attempt, questions, answers, currentQuestion, timeRemaining, loading: examLoading, error, examStartTime, startExam, selectAnswer, nextQuestion, prevQuestion, goToQuestion, submitExam, reduceTime } = useExam()
  const { isMonitoring, isWebcamActive, lastViolation, tabSwitchCount, startMonitoring, stopMonitoring, videoRef, canvasRef, streamRef, liveViolations, penaltyMessage, triggeredPenalties, setOnTimePenalty, setOnAutoSubmit } = useMonitoring(attempt?.id || '')

  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showViolationAlert, setShowViolationAlert] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const shownInstructionsRef = useRef(false)
  const hasAutoSubmittedRef = useRef(false)

  useEffect(() => {
    if (!examStartTime) { setCountdown(null); return }
    const updateCountdown = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((new Date(examStartTime).getTime() - now) / 1000))
      setCountdown(diff)
      if (diff <= 0) setShowInstructions(true)
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [examStartTime])

  useEffect(() => { if (examId) startExam(examId) }, [examId, startExam])
  useEffect(() => {
    if (exam && questions.length > 0 && !examStartTime && !shownInstructionsRef.current) {
      shownInstructionsRef.current = true
      setShowInstructions(true)
    }
  }, [exam, questions, examStartTime])
  useEffect(() => { if (attempt?.id && !isMonitoring && !showInstructions) startMonitoring() }, [attempt?.id, isMonitoring, startMonitoring, showInstructions])
  useEffect(() => {
    if (videoRef.current && streamRef?.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play()
    }
  })
  useEffect(() => {
    if (
      timeRemaining <= 0 &&
      attempt?.status === 'in_progress' &&
      !hasAutoSubmittedRef.current
    ) {
      hasAutoSubmittedRef.current = true
      stopMonitoring()
      submitExam().then(() => router.push('/student/dashboard'))
    }
  }, [timeRemaining, attempt?.status, stopMonitoring, submitExam, router])
  const timePenaltyAppliedRef = useRef(false)
  const autoSubmitTriggeredRef = useRef(false)

  useEffect(() => {
    setOnTimePenalty(() => {
      if (timePenaltyAppliedRef.current) return
      timePenaltyAppliedRef.current = true
      reduceTime()
    })
    setOnAutoSubmit(() => {
      if (autoSubmitTriggeredRef.current) return
      autoSubmitTriggeredRef.current = true
      stopMonitoring()
      submitExam().then(() => router.push('/student/dashboard'))
    })
  }, [setOnTimePenalty, setOnAutoSubmit, reduceTime, stopMonitoring, submitExam, router])

  useEffect(() => {
    if (lastViolation) {
      setShowViolationAlert(true)
      const timer = setTimeout(() => setShowViolationAlert(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [lastViolation])

  const handleSubmit = async () => { stopMonitoring(); await submitExam(); router.push('/student/dashboard') }
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

  if (examStartTime && countdown !== null && countdown > 0 && !showInstructions) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="fixed top-[-15%] left-[-5%] w-[35%] h-[35%] rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/10 blur-3xl animate-float" />
        <div className="card-glass max-w-md w-full text-center p-10 animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-6" style={{ color: 'var(--accent)' }}><Timer className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{exam?.title || 'Exam'}</h1>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Starts in</p>
          <div className="text-6xl font-bold font-mono mb-8 tracking-tight" style={{ color: 'var(--accent)' }}>{formatTime(countdown)}</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The exam will begin shortly. Please wait...</p>
        </div>
      </div>
    )
  }

  if (showInstructions && exam && questions.length > 0) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="fixed top-[-15%] left-[-5%] w-[35%] h-[35%] rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/10 blur-3xl animate-float pointer-events-none" />
        <div className="page-container py-12 max-w-2xl mx-auto">
          <div className="card-glass p-8 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-6" style={{ color: 'var(--accent)' }}>
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>{exam.title}</h1>
            <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Please read the instructions carefully before starting</p>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <Clock className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{exam.duration_minutes} min</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Duration</div>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <ListChecks className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{questions.length}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Questions</div>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <FileText className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{exam.total_marks}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Marks</div>
                </div>
              </div>

              {exam.description && (
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Description</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{exam.description}</p>
                </div>
              )}

              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Exam Guidelines</h3>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    Ensure you are in a quiet, well-lit environment with no distractions.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    Your webcam must remain active throughout the exam for monitoring purposes.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    Do not switch tabs or windows during the exam. This will be flagged as a violation.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    Each question has one correct answer. You can navigate between questions freely.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    The exam will auto-submit when the timer reaches zero.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    Do not navigate away from this page or refresh your browser during the exam.
                  </li>
                </ul>
              </div>
            </div>

            <button onClick={() => { setShowInstructions(false); if (!attempt) startExam(examId) }}
              className="btn btn-primary w-full mt-8 text-base py-4">
              <Play className="w-5 h-5" /> Start Exam
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen relative flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="card max-w-md w-full text-center p-8 animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5"><AlertTriangle className="w-7 h-7 text-red-500" /></div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Failed to start exam</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button onClick={() => router.push('/student/dashboard')} className="btn btn-primary">Return to Dashboard</button>
        </div>
      </div>
    )
  }

  if (examLoading || !exam || !attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center animate-pulse shadow-glow"><Shield className="w-6 h-6 text-white" /></div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading exam...</div>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentQuestion]
  const answeredCount = answers.size

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} className="hidden" />
      <div className="fixed top-[-15%] left-[-5%] w-[30%] h-[30%] rounded-full bg-gradient-to-br from-primary-400/10 to-primary-600/5 blur-3xl animate-float pointer-events-none" />

      <header className="glass sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="page-container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-glow"><Shield className="w-4 h-4 text-white" /></div>
            <h1 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{exam.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-medium", timeRemaining < 300 ? 'bg-red-50 text-red-700' : 'glass')}>
              <Clock className="w-4 h-4" /> {formatTime(timeRemaining)}
            </div>
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium", isWebcamActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {isWebcamActive ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
              {isWebcamActive ? 'Camera Active' : 'No Camera'}
            </div>
            {tabSwitchCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {tabSwitchCount}
              </div>
            )}
            {triggeredPenalties.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Penalty: Lv {triggeredPenalties.join('/')}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-container pt-20 pb-8 flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Question <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{currentQuestion + 1}</span> of {questions.length}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}><span className="font-medium text-emerald-600">{answeredCount}</span> answered</span>
            </div>
            <p className="text-lg mb-8 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{currentQ.question_text}</p>
            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map(option => {
                const isSelected = answers.get(currentQ.id) === option
                return (
                  <button key={option} onClick={() => selectAnswer(currentQ.id, option)}
                    className={cn("w-full p-4 rounded-xl border-2 text-left transition-all duration-150", isSelected ? 'border-primary shadow-sm' : 'hover:border-primary/30')}
                    style={{ backgroundColor: isSelected ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: isSelected ? 'var(--accent)' : 'var(--border) ' }}>
                    <div className="flex items-center gap-3">
                      <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-semibold transition-all", isSelected ? 'bg-primary text-white shadow-sm' : 'bg-surface-100')}
                        style={isSelected ? {} : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                        {option}
                      </span>
                      <span className={cn("text-sm", isSelected ? 'font-medium' : '')} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {currentQ[`option_${option.toLowerCase()}` as keyof typeof currentQ]}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: 'var(--accent)' }} />}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={prevQuestion} disabled={currentQuestion === 0} className="btn btn-secondary disabled:opacity-50"><ChevronLeft className="w-4 h-4" /> Previous</button>
              {currentQuestion === questions.length - 1 ? (
                <button onClick={() => setShowSubmitModal(true)} className="btn btn-primary"><Send className="w-4 h-4" /> Submit Exam</button>
              ) : (
                <button onClick={nextQuestion} className="btn btn-primary">Next <ChevronRight className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 flex-shrink-0 space-y-6">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Live Feed</h3>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", isWebcamActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                <span className={cn("w-2 h-2 rounded-full", isWebcamActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                {isWebcamActive ? 'Live' : 'Off'}
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-black/5" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef as React.RefObject<HTMLVideoElement>} className="w-full h-full object-cover" playsInline muted />
              {!isWebcamActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <CameraOff className="w-8 h-8 text-white/60" />
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>Questions</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => goToQuestion(i)}
                  className={cn("aspect-square rounded-lg text-sm font-medium transition-all", i === currentQuestion ? 'bg-primary text-white shadow-sm' : answers.has(q.id) ? 'border' : '')}
                  style={i === currentQuestion ? {} : answers.has(q.id) ? { backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.2)' } : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {liveViolations.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                <Flag className="w-4 h-4 text-red-500" /> Violations
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {liveViolations.map((v, i) => (
                  <div key={i} className="text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    {VIOLATION_TYPES[v.type as keyof typeof VIOLATION_TYPES] || v.type}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {showViolationAlert && lastViolation && (
        <div className="fixed bottom-4 right-4 px-5 py-3.5 rounded-xl shadow-elevated flex items-center gap-3 animate-slide-up"
          style={{ backgroundColor: 'var(--danger)', color: 'white' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">Violation Detected</div>
            <div className="text-xs opacity-80">{VIOLATION_TYPES[lastViolation]}</div>
          </div>
          <button onClick={() => setShowViolationAlert(false)} className="ml-2 p-1 rounded-lg hover:bg-white/20"><X className="w-4 h-4" /></button>
        </div>
      )}

      {penaltyMessage && (
        <div className="fixed top-20 right-4 px-5 py-3.5 rounded-xl shadow-elevated flex items-center gap-3 animate-slide-up z-50"
          style={{ backgroundColor: '#7c3aed', color: 'white' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">Penalty Applied</div>
            <div className="text-xs opacity-80">{penaltyMessage}</div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="rounded-2xl p-6 max-w-md w-full mx-4 animate-scale-in shadow-modal"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Submit Exam</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              You have answered <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{answeredCount}</span> of{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{questions.length}</span> questions. Are you sure?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} className="btn btn-primary flex-1"><Send className="w-4 h-4" /> Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center animate-pulse shadow-glow"><Shield className="w-4 h-4 text-white" /></div>
          <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
        </div>
      </div>
    }>
      <ExamContent examId={params.id} />
    </Suspense>
  )
}
