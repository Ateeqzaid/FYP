'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, Shield, Mail, User, Lock, UserPlus, Sparkles, CheckCircle } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('role') || 'student'

  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', full_name: '', role: initialRole as 'student' | 'admin'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleVerified, setGoogleVerified] = useState(false)
  const [googleToken, setGoogleToken] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: tokenResponse.access_token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Google verification failed')

      setFormData(prev => ({
        ...prev,
        email: data.data.email,
        full_name: data.data.name,
      }))
      setGoogleToken(tokenResponse.access_token)
      setGoogleVerified(true)
    } catch (err: any) {
      setError(err.message || 'Failed to verify with Google')
    }
  }

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google sign-in failed'),
    flow: 'implicit',
    scope: 'openid email profile',
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!googleVerified) { setError('Please verify your email with Google first'); return }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          google_token: googleToken,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Registration failed')
      router.push('/login')
    } catch (err: any) {
      setError(err.message || 'Failed to register')
    } finally { setLoading(false) }
  }

  return (
    <div className="card-glass w-full max-w-md p-8 animate-scale-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Create account</h1>
        <p className="mt-1.5" style={{ color: 'var(--text-secondary)' }}>Join SmartExam to get started</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-6" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
          {error}
        </div>
      )}

      {!googleVerified ? (
        <div className="space-y-4">
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            Verify your Google email to start registration
          </p>
          <button onClick={() => googleLogin()} className="btn btn-primary w-full py-3 flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Verify with Google
          </button>
        </div>
      ) : (
        <div className="mb-6 p-3 rounded-xl flex items-center gap-3 text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--text-primary)' }}>
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Verified as <strong>{formData.email}</strong></span>
        </div>
      )}

      <form onSubmit={handleRegister} className={`space-y-4 ${!googleVerified ? 'mt-6 opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} className="input pl-10" placeholder="John Doe" required disabled={!googleVerified} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input pl-10" placeholder="you@example.com" required disabled />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} className="input pl-10 pr-10" placeholder="Min 6 characters" required disabled={!googleVerified} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
          <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="input" placeholder="Confirm your password" required disabled={!googleVerified} />
        </div>
        <button type="submit" disabled={loading || !googleVerified} className="btn btn-primary w-full py-3">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <UserPlus className="w-4 h-4" />
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center mt-8 text-sm" style={{ color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>Sign In</Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-8 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
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

      <Suspense fallback={
        <div className="card-glass w-full max-w-md flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  )
}