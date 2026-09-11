'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { BookOpen, LogOut, ArrowRight, Search, Shield, Sparkles } from 'lucide-react'
import type { ExamAttempt } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function StudentDashboard() {
  const router = useRouter()
  const { user, loading: authLoading, logout } = useAuth()
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      try {
        const token = localStorage.getItem('access_token')
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const attemptsRes = await fetch(`${API_URL}/api/attempts/student/me`, { headers }).then(r => r.json())
        setAttempts(attemptsRes.data || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [user])

  const [examIdInput, setExamIdInput] = useState('')
  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault()
    if (!examIdInput.trim()) return
    const existingAttempt = attempts.find(a => a.exam_id === examIdInput.trim() && a.status === 'in_progress')
    router.push(existingAttempt ? `/student/exam/${examIdInput.trim()}?attemptId=${existingAttempt.id}` : `/student/exam/${examIdInput.trim()}`)
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

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="fixed top-[-15%] left-[-5%] w-[30%] h-[30%] rounded-full bg-gradient-to-br from-primary-400/10 to-primary-600/5 blur-3xl animate-float pointer-events-none" />

      <header className="glass sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="page-container flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-glow">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Student Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Welcome, <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</span>
            </span>
            <button onClick={logout} className="btn btn-ghost text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="page-container py-12">
        <div className="card-glass max-w-2xl mx-auto p-8 text-center mb-12 animate-scale-in" style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: 'var(--accent)' }}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-6" style={{ color: 'var(--accent)' }}>
            <Search className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Join an Exam</h1>
          <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>Enter the unique Exam ID provided by your instructor to begin.</p>
          <form onSubmit={handleStartExam} className="flex gap-3 max-w-lg mx-auto">
            <input type="text" value={examIdInput} onChange={(e) => setExamIdInput(e.target.value)} placeholder="Enter Exam ID" className="input flex-1 font-mono text-sm" required />
            <button type="submit" className="btn btn-primary whitespace-nowrap">
              Start Exam <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>


      </main>
    </div>
  )
}
