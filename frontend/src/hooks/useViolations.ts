'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Violation } from '@/lib/types'

interface UseViolationsReturn {
  violations: Violation[]
  loading: boolean
  error: string | null
  fetchViolations: (attemptId: string) => Promise<void>
  clearLastViolation: () => void
}

export function useViolations(): UseViolationsReturn {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchViolations = useCallback(async (attemptId: string) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('violations')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('detected_at', { ascending: true })

      if (error) throw error
      setViolations(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch violations')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const clearLastViolation = useCallback(() => {
    setViolations(prev => prev.slice(0, -1))
  }, [])

  return {
    violations,
    loading,
    error,
    fetchViolations,
    clearLastViolation
  }
}
