'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, authFetch } from '@/hooks/useAuth'
import { ArrowLeft, Plus, Trash2, Save, Send, HelpCircle, Shield, Upload, Loader2, Sparkles } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface QuestionForm {
  question_text: string; option_a: string; option_b: string; option_c: string; option_d: string
  correct_option: string; marks: number
}

export default function CreateExamPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [totalMarks, setTotalMarks] = useState(100)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [questions, setQuestions] = useState<QuestionForm[]>([{ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', marks: 1 }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [promptTopic, setPromptTopic] = useState('')
  const [promptCount, setPromptCount] = useState(5)
  const [isPromptGenerating, setIsPromptGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center animate-pulse shadow-glow"><Shield className="w-4 h-4 text-white" /></div>
        <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    </div>
  )
  if (!user || user.role !== 'admin') { router.push('/login'); return null }

  const addQuestion = () => setQuestions([...questions, { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', marks: 1 }])
  const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index))
  const updateQuestion = (index: number, field: keyof QuestionForm, value: string | number) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    setQuestions(newQuestions)
  }

  const handleGenerateFromFile = async () => {
    if (!selectedFile) return
    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const res = await authFetch(`${API_URL}/api/exams/generate-questions-from-file`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to generate questions')
      const data = (await res.json()).data
      if (data && data.length > 0) {
        setQuestions(data.map((q: any) => ({
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          marks: q.marks
        })))
      }
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) { alert(`Failed: ${err.message}`) }
    finally { setIsGenerating(false) }
  }

  const handleGenerateFromPrompt = async () => {
    if (!promptTopic.trim()) { alert('Please enter a topic'); return }
    setIsPromptGenerating(true)
    try {
      const res = await authFetch(`${API_URL}/api/exams/generate-questions-from-prompt`, {
        method: 'POST',
        body: JSON.stringify({ topic: promptTopic, count: promptCount }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to generate questions')
      const data = (await res.json()).data
      if (data && data.length > 0) {
        setQuestions(data.map((q: any) => ({
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          marks: q.marks
        })))
      }
    } catch (err: any) { alert(`Failed: ${err.message}`) }
    finally { setIsPromptGenerating(false) }
  }

  const handleSave = async (publish: boolean) => {
    if (!title) { alert('Exam title is required'); return }
    setIsSubmitting(true)
    try {
      const payload: any = { title, description, duration_minutes: duration, total_marks: totalMarks }
      if (startTime) payload.start_time = new Date(startTime).toISOString()
      if (endTime) payload.end_time = new Date(endTime).toISOString()
      const examRes = await authFetch(`${API_URL}/api/exams`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!examRes.ok) throw new Error(await examRes.text())
      const exam = (await examRes.json()).data
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const qRes = await authFetch(`${API_URL}/api/exams/${exam.id}/questions`, {
          method: 'POST',
          body: JSON.stringify({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, marks: q.marks, order_index: i }),
        })
        if (!qRes.ok) throw new Error(await qRes.text())
      }
      if (publish) {
        await authFetch(`${API_URL}/api/exams/${exam.id}/publish`, { method: 'POST' })
      }
      router.push('/admin/dashboard')
    } catch (err: any) { alert(`Failed: ${err.message}`) }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="fixed top-[-15%] left-[-5%] w-[30%] h-[30%] rounded-full bg-gradient-to-br from-primary-400/10 to-primary-600/5 blur-3xl animate-float pointer-events-none" />
      <header className="glass sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="page-container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="btn-ghost p-2 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create New Exam</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set up exam details and questions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => handleSave(false)} disabled={isSubmitting} className="btn btn-secondary"><Save className="w-4 h-4" /> Save Draft</button>
            <button onClick={() => handleSave(true)} disabled={isSubmitting} className="btn btn-primary"><Send className="w-4 h-4" /> Publish Exam</button>
          </div>
        </div>
      </header>
      <main className="page-container py-8 max-w-4xl">
        <div className="space-y-8">
          <section className="card">
            <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Exam Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Exam Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="e.g. Midterm Examination: Computer Science" required />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="input h-24 resize-none" placeholder="Instructions or details about the exam..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Start Date & Time</label>
                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>End Date & Time</label>
                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (minutes) *</label>
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="input" min="1" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Total Marks *</label>
                <input type="number" value={totalMarks} onChange={e => setTotalMarks(parseInt(e.target.value))} className="input" min="1" required />
              </div>
            </div>
          </section>
          <section className="card">
            <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Generate Questions from File</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Upload a PDF or DOCX file containing MCQs to auto-generate questions using AI</p>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary hover:file:bg-primary-100"
                style={{ color: 'var(--text-secondary)' }}
              />
              <button
                onClick={handleGenerateFromFile}
                disabled={!selectedFile || isGenerating}
                className="btn btn-primary whitespace-nowrap"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isGenerating ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </section>
          <section className="card">
            <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Generate Questions with AI</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Describe a topic and number of MCQs — AI will generate them automatically</p>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Topic</label>
                <input type="text" value={promptTopic} onChange={e => setPromptTopic(e.target.value)} className="input" placeholder="e.g. Machine Learning Basics, World War II, Python Programming..." />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>No. of MCQs</label>
                <input type="number" value={promptCount} onChange={e => setPromptCount(parseInt(e.target.value) || 5)} className="input" min="1" max="50" />
              </div>
              <button
                onClick={handleGenerateFromPrompt}
                disabled={!promptTopic.trim() || isPromptGenerating}
                className="btn btn-primary whitespace-nowrap"
              >
                {isPromptGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isPromptGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Questions ({questions.length})</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Add multiple choice questions</p>
              </div>
            </div>
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={index} className="card animate-fade-in">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center" style={{ color: 'var(--accent)' }}><HelpCircle className="w-4 h-4" /></div>
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Question {index + 1}</h3>
                    </div>
                    <button onClick={() => removeQuestion(index)} disabled={questions.length === 1}
                      className="btn-ghost p-2 rounded-lg disabled:opacity-50" style={{ color: 'var(--danger)' }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Question Text</label>
                      <textarea value={q.question_text} onChange={e => updateQuestion(index, 'question_text', e.target.value)} className="input h-20 resize-none" placeholder="Enter the question here..." required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(['A', 'B', 'C', 'D'] as const).map(option => (
                        <div key={option}>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Option {option}</label>
                          <input type="text" value={q[`option_${option.toLowerCase()}` as keyof typeof q] as string}
                            onChange={e => updateQuestion(index, `option_${option.toLowerCase()}` as keyof QuestionForm, e.target.value)} className="input" required />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Correct Option</label>
                        <select value={q.correct_option} onChange={e => updateQuestion(index, 'correct_option', e.target.value)} className="select">
                          <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Marks</label>
                        <input type="number" value={q.marks} onChange={e => updateQuestion(index, 'marks', parseInt(e.target.value))} className="input" min="1" required />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <button onClick={addQuestion} className="btn btn-secondary"><Plus className="w-4 h-4" /> Add Question</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
