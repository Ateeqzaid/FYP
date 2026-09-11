'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Shield, Mail, Lock, Sparkles } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed')
      }

      localStorage.setItem('access_token', data.data.session.access_token)
      localStorage.setItem('refresh_token', data.data.session.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.data.user))

      if (data.data.user.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/student/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="fixed top-[-15%] left-[-5%] w-[35%] h-[35%] rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/10 blur-3xl animate-float" />
      <div className="fixed bottom-[-15%] right-[-5%] w-[35%] h-[35%] rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/10 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

      <div className="flex items-center justify-between w-full max-w-md mb-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-shadow">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>SmartExam</span>
        </Link>
      </div>

      <div className="card-glass w-full max-w-md p-8 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-4" style={{ color: 'var(--accent)' }}>
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
          <p className="mt-1.5" style={{ color: 'var(--text-secondary)' }}>Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-6" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="you@example.com" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10 pr-10" placeholder="Enter your password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>Create one</Link>
        </p>
      </div>
    </div>
  )
}