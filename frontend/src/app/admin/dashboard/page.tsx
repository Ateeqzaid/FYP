'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, authFetch } from '@/hooks/useAuth'
import {
  LayoutDashboard, BookOpen, FileText, LogOut, Plus, Edit, Trash2,
  CheckCircle, XCircle, AlertTriangle, Copy, Users, ChevronDown, ChevronRight, Shield, Sparkles
} from 'lucide-react'
import type { Exam, ExamAttempt, Violation } from '@/lib/types'
import { cn, formatDateTime, formatDate } from '@/lib/utils'
import { VIOLATION_TYPES, STATUS_COLORS } from '@/lib/constants'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading: authLoading, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'exams' | 'reports'>('exams')
  const [exams, setExams] = useState<Exam[]>([])
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedViolations, setExpandedViolations] = useState<Record<string, boolean>>({})
  const [expandedExamReports, setExpandedExamReports] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, attemptsRes, violationsRes] = await Promise.all([
          authFetch(`${API_URL}/api/exams/all`).then(r => r.json()),
          authFetch(`${API_URL}/api/attempts/list`).then(r => r.json()),
          authFetch(`${API_URL}/api/violations/all`).then(r => r.json()),
        ])
        setExams(examsRes.data || [])
        setAttempts(attemptsRes.data || [])
        setViolations(violationsRes.data || [])
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    if (user?.role === 'admin') fetchData()
  }, [user])

  const togglePublish = async (examId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/exams/${examId}/publish`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setExams(prev => prev.map(e => e.id === examId ? { ...e, is_published: data.data.is_published } : e))
      }
    } catch (e) { console.error(e) }
  }

  const fetchExams = async () => {
    const res = await authFetch(`${API_URL}/api/exams/all`)
    const data = await res.json()
    setExams(data.data || [])
  }

  const deleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return
    try {
      const res = await authFetch(`${API_URL}/api/exams/${examId}`, { method: 'DELETE' })
      if (res.ok) await fetchExams()
      else alert('Failed to delete exam')
    } catch (e) { alert('Error deleting exam') }
  }

  const reviewAttempt = async (attemptId: string, status: 'reviewed' | 'completed') => {
    try {
      const res = await authFetch(`${API_URL}/api/attempts/${attemptId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (res.ok) setAttempts(prev => prev.map(a => a.id === attemptId ? { ...a, status } : a))
    } catch (e) { console.error(e) }
  }

  const deleteAttempt = async (attemptId: string) => {
    if (!confirm('Are you sure you want to delete this exam report?')) return
    try {
      const res = await authFetch(`${API_URL}/api/attempts/${attemptId}`, { method: 'DELETE' })
      if (res.ok) {
        setAttempts(prev => prev.filter(a => a.id !== attemptId))
        setViolations(prev => prev.filter(v => v.attempt_id !== attemptId))
      } else alert('Failed to delete exam report')
    } catch (e) { alert('Error deleting exam report') }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center animate-pulse shadow-glow">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const Sidebar = () => (
    <aside className="min-h-screen fixed flex flex-col" style={{ width: 256, backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
      <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-glow">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Admin Panel</span>
        </div>
      </div>
      <nav className="p-3 space-y-1 flex-1">
        <button onClick={() => setActiveTab('exams')}
          className={cn("w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all",
            activeTab === 'exams' ? 'bg-primary-50 text-primary-700' : 'hover:bg-surface-50')}
          style={activeTab === 'exams' ? {} : { color: 'var(--text-secondary)' }}>
          <BookOpen className="w-4 h-4" /> Manage Exams
        </button>
        <button onClick={() => setActiveTab('reports')}
          className={cn("w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all",
            activeTab === 'reports' ? 'bg-primary-50 text-primary-700' : 'hover:bg-surface-50')}
          style={activeTab === 'reports' ? {} : { color: 'var(--text-secondary)' }}>
          <FileText className="w-4 h-4" /> Exam Reports
        </button>
      </nav>
      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center" style={{ color: 'var(--accent)' }}>
            <Users className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Administrator</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={logout} className="btn btn-ghost w-full text-sm justify-center">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  )

  const ExamsTab = () => (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Manage Exams</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Create, publish, and manage your exams</p>
        </div>
        <button onClick={() => router.push('/admin/exams/create')} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Create Exam
        </button>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <th className="table-header">Title</th>
              <th className="table-header">Duration</th>
              <th className="table-header">Marks</th>
              <th className="table-header">Start Time</th>
              <th className="table-header">End Time</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {exams.map(exam => (
              <tr key={exam.id} className="transition-colors hover:bg-surface-50/50">
                <td className="table-cell font-medium" style={{ color: 'var(--text-primary)' }}>{exam.title}</td>
                <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{exam.duration_minutes} min</td>
                <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{exam.total_marks}</td>
                <td className="table-cell text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatDateTime(exam.start_time)}
                </td>
                <td className="table-cell text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatDateTime(exam.end_time)}
                </td>
                <td className="table-cell">
                  <span className={cn("badge", exam.is_published ? "badge-success" : "badge-neutral")}>
                    {exam.is_published ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-1">
                    {exam.is_published && <button onClick={() => { navigator.clipboard.writeText(exam.id); alert('Exam ID copied!') }} className="btn-ghost p-2 rounded-lg"><Copy className="w-4 h-4" /></button>}
                    <button onClick={() => togglePublish(exam.id)} className="btn-ghost p-2 rounded-lg">
                      {exam.is_published ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    </button>
                    <button onClick={() => router.push(`/admin/exams/${exam.id}/edit`)} className="btn-ghost p-2 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => deleteExam(exam.id)} className="btn-ghost p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {exams.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No exams created yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Click "Create Exam" to get started</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )

  const ReportsTab = () => {
    const examAttemptsMap = attempts.reduce<Record<string, ExamAttempt[]>>((acc, a) => {
      if (!acc[a.exam_id]) acc[a.exam_id] = []
      acc[a.exam_id].push(a)
      return acc
    }, {})

    return (
      <>
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Exam Reports</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Review student attempts and violations</p>
        </div>
        <div className="space-y-4">
          {Object.entries(examAttemptsMap).map(([examId, examAttempts]) => {
            const exam = exams.find(e => e.id === examId)
            const isExpanded = expandedExamReports[examId] || false
            return (
              <div key={examId} className="card animate-fade-in overflow-hidden">
                <button onClick={() => setExpandedExamReports(prev => ({ ...prev, [examId]: !isExpanded }))}
                  className="w-full flex items-center justify-between p-5 hover:bg-surface-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center" style={{ color: 'var(--accent)' }}>
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{exam?.title || 'Unknown Exam'}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {exam?.duration_minutes} min &middot; {exam?.total_marks} marks
                        {exam?.start_time && <> &middot; {formatDate(exam.start_time)}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {examAttempts.length} student{examAttempts.length > 1 ? 's' : ''}
                    </span>
                    <span className={cn("badge", examAttempts.some(a => a.status === 'flagged') ? "badge-danger" : "badge-success")}>
                      {examAttempts.filter(a => a.status === 'completed' || a.status === 'reviewed').length}/{examAttempts.length} completed
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteExam(examId) }}
                      className="btn-ghost p-2 rounded-lg hover:bg-red-50"
                      title="Delete exam"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {examAttempts.map(attempt => {
                      const attemptViolations = violations.filter(v => v.attempt_id === attempt.id)
                      const isViolationsExpanded = expandedViolations[attempt.id] || false
                      return (
                        <div key={attempt.id} className="px-5 py-4 transition-colors hover:bg-surface-50/30" style={{ borderBottom: '1px solid var(--border)' }}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{(attempt as any).student_name || attempt.student_id}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {formatDateTime(attempt.started_at)}
                                {attempt.submitted_at && <> &middot; {formatDateTime(attempt.submitted_at)}</>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("badge", attempt.status === 'completed' ? "badge-success" : attempt.status === 'flagged' ? "badge-danger" : attempt.status === 'in_progress' ? "badge-info" : "badge-neutral")}>{attempt.status}</span>
                              {attempt.status !== 'completed' && attempt.status !== 'reviewed' && <>
                                <button onClick={() => reviewAttempt(attempt.id, 'completed')} className="btn-ghost p-1.5 rounded-lg text-emerald-600"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => reviewAttempt(attempt.id, 'reviewed')} className="btn-ghost p-1.5 rounded-lg text-red-500"><XCircle className="w-4 h-4" /></button>
                              </>}
                              <button onClick={() => deleteAttempt(attempt.id)} className="btn-ghost p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
                              <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Score</p>
                              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{attempt.score !== null ? `${attempt.score}/${exam?.total_marks}` : '-'}</p>
                            </div>
                            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
                              <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Violations</p>
                              <p className="text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                <AlertTriangle className="w-4 h-4 text-red-400" /> {attemptViolations.length}
                              </p>
                            </div>
                            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
                              <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Duration</p>
                              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                                {attempt.submitted_at ? Math.round((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 60000) + ' min' : 'In progress'}
                              </p>
                            </div>
                          </div>
                          {attemptViolations.length > 0 && (
                            <div>
                              <button onClick={() => setExpandedViolations(prev => ({ ...prev, [attempt.id]: !isViolationsExpanded }))}
                                className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-red-50 transition-colors text-xs"
                                style={{ color: 'var(--text-primary)' }}>
                                {isViolationsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-red-400" /> : <ChevronRight className="w-3.5 h-3.5 text-red-400" />}
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                <span className="font-medium text-red-700">{attemptViolations.length} Violation{attemptViolations.length > 1 ? 's' : ''}</span>
                              </button>
                              {isViolationsExpanded && (
                                <div className="rounded-lg p-3 mt-1 grid grid-cols-2 gap-2 animate-fade-in" style={{ backgroundColor: 'rgba(239,68,68,0.05)' }}>
                                  {attemptViolations.map((v, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{VIOLATION_TYPES[v.violation_type]}</span>
                                      <span className="ml-2" style={{ color: 'var(--text-muted)' }}>{formatDateTime(v.detected_at)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {Object.keys(examAttemptsMap).length === 0 && (
            <div className="card text-center py-16" style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: 'var(--border)' }}>
              <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No exam attempts yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Reports appear here once students take exams</p>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="fixed top-[-15%] left-[-5%] w-[30%] h-[30%] rounded-full bg-gradient-to-br from-primary-400/10 to-primary-600/5 blur-3xl animate-float pointer-events-none" />
      <Sidebar />
      <main className="ml-64 p-8" style={{ minHeight: '100vh' }}>
        {activeTab === 'exams' ? <ExamsTab /> : <ReportsTab />}
      </main>
    </div>
  )
}
