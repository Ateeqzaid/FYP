'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    const session = data.data
    localStorage.setItem('access_token', session.access_token)
    localStorage.setItem('refresh_token', session.refresh_token)
    return true
  } catch {
    return false
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('access_token')
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`
      res = await fetch(url, { ...options, headers })
    }
  }

  return res
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('access_token')
      const storedUser = localStorage.getItem('user')

      if (!token || !storedUser) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          const userData = data.data.user
          setUser(userData)
          localStorage.setItem('user', JSON.stringify(userData))
        } else if (res.status === 401) {
          const refreshed = await refreshTokens()
          if (refreshed) {
            const retryRes = await fetch(`${API_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
            })
            if (retryRes.ok) {
              const data = await retryRes.json()
              const userData = data.data.user
              setUser(userData)
              localStorage.setItem('user', JSON.stringify(userData))
            } else {
              clearSession()
            }
          } else {
            clearSession()
          }
        } else {
          if (storedUser) {
            try { setUser(JSON.parse(storedUser)) } catch {}
          }
        }
      } catch {
        if (storedUser) {
          try { setUser(JSON.parse(storedUser)) } catch {}
        }
      }
      setLoading(false)
    }

    verifySession()
  }, [])

  function clearSession() {
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  const logout = useCallback(async () => {
    clearSession()
    router.push('/login')
  }, [router])

  return { user, loading, logout, authFetch }
}
