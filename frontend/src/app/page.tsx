'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BookOpen, Shield, User, ArrowRight, Sun, Moon, Sparkles, Zap, Eye, Activity } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function HomePage() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/10 blur-3xl animate-float" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/10 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

      <header className="glass border-b border-transparent sticky top-0 z-50" style={{ borderBottomColor: 'var(--border)' }}>
        <div className="page-container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>SmartExam</span>
          </Link>
          <div className="flex items-center gap-3">
            {mounted && (
              <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" />
            )}
            <Link href="/login" className="btn btn-ghost">Sign In</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative">
        <div className="text-center max-w-3xl animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm font-medium mb-8 border" style={{ borderColor: 'var(--accent)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--accent)' }}>AI-Powered Proctoring</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 leading-tight">
            <span style={{ color: 'var(--text-primary)' }}>Smart Exam Monitoring</span>
            <br />
            <span className="gradient-text">Made Simple</span>
          </h1>

          <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Secure, automated proctoring solution powered by real-time AI.
            Detect suspicious behavior and ensure exam integrity with cutting-edge technology.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register?role=student"
              className="btn btn-primary text-base px-8 py-3 rounded-xl shadow-glow hover:shadow-glow-lg inline-flex"
            >
              <User className="w-5 h-5" />
              Student Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/register?role=admin"
              className="btn btn-secondary text-base px-8 py-3 rounded-xl inline-flex"
            >
              <Shield className="w-5 h-5" />
              Admin Portal
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full">
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Seamless Exams"
            description="Take exams with real-time AI monitoring and automated webcam verification for a smooth experience."
          />
          <FeatureCard
            icon={<Eye className="w-6 h-6" />}
            title="Smart Detection"
            description="Advanced algorithms detect suspicious behaviors including phone usage, multiple faces, and tab switching."
          />
          <FeatureCard
            icon={<Activity className="w-6 h-6" />}
            title="Admin Control"
            description="Comprehensive dashboard with detailed violation reports and full exam lifecycle management."
          />
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="page-container py-6">
          <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            SmartExam &mdash; AI-Powered Exam Monitoring System
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card-glass p-8 hover:-translate-y-1 group text-center">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300" style={{ color: 'var(--accent)' }}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  )
}
