'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ViolationType, WSViolation, PenaltyLevel } from '@/lib/types'
import { MONITORING_INTERVAL, FRAME_SEND_INTERVAL, PENALTY_LEVELS, PENALTY_ACTIONS, VIOLATION_TYPES } from '@/lib/constants'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const WS_URL = API_URL.replace(/^http/, 'ws')

interface MonitoringState {
  isMonitoring: boolean
  isWebcamActive: boolean
  violations: ViolationType[]
  lastViolation: ViolationType | null
  tabSwitchCount: number
  liveViolations: WSViolation[]
  triggeredPenalties: PenaltyLevel[]
  penaltyMessage: string | null
}

interface UseMonitoringReturn extends MonitoringState {
  startMonitoring: () => Promise<void>
  stopMonitoring: () => void
  sendViolation: (type: ViolationType, attemptId: string) => Promise<void>
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  streamRef: React.RefObject<MediaStream | null>
  setOnTimePenalty: (fn: () => void) => void
  setOnAutoSubmit: (fn: () => void) => void
}

export function useMonitoring(attemptId: string): UseMonitoringReturn {
  const [state, setState] = useState<MonitoringState>({
    isMonitoring: false,
    isWebcamActive: false,
    violations: [],
    lastViolation: null,
    tabSwitchCount: 0,
    liveViolations: [],
    triggeredPenalties: [],
    penaltyMessage: null,
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFrameTimeRef = useRef<number>(0)
  const lastViolationTimeRef = useRef<Record<string, number>>({})
  const violationCooldownRef = useRef(5000)
  const blurTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMonitoringRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const triggeredLevelsRef = useRef<Set<number>>(new Set())
  const onTimePenaltyRef = useRef<(() => void) | null>(null)
  const onAutoSubmitRef = useRef<(() => void) | null>(null)

  const setOnTimePenalty = useCallback((fn: () => void) => {
    onTimePenaltyRef.current = fn
  }, [])

  const setOnAutoSubmit = useCallback((fn: () => void) => {
    onAutoSubmitRef.current = fn
  }, [])

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token')
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }, [])

  const connectWebSocket = useCallback(() => {
    if (!attemptId || wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(`${WS_URL}/api/monitoring/ws/${attemptId}`)

      ws.onopen = () => {
        setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'violation') {
            setState(prev => ({
              ...prev,
              liveViolations: [...prev.liveViolations.slice(-49), msg.data],
            }))
          }
        } catch { }
      }

      ws.onerror = () => { }

      wsRef.current = ws
    } catch { }
  }, [attemptId])

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setState(prev => ({ ...prev, isWebcamActive: true }))
      return true
    } catch (err) {
      console.error('Webcam access denied:', err)
      return false
    }
  }, [])

  const sendViolation = useCallback(async (type: ViolationType, attemptId: string) => {
    const severity =
      type === 'multiple_faces' || type === 'phone_detected' || type === 'no_face_detected'
        ? 'high'
        : type === 'window_blur' || type === 'head_pose_suspicious' || type === 'eye_gaze_suspicious'
        ? 'medium'
        : 'low'

    const now = Date.now()
    const lastTime = lastViolationTimeRef.current[type] || 0
    if (now - lastTime < violationCooldownRef.current) return
    lastViolationTimeRef.current[type] = now

    try {
      const response = await fetch(`${API_URL}/api/violations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          attempt_id: attemptId,
          violation_type: type,
          severity,
          description: `Detected ${type} violation`,
          frame_snapshot_url: null,
        }),
      })

      if (response.ok) {
        const penaltyLevel = PENALTY_LEVELS[type] as 1 | 2 | 3 | undefined
        let penaltyMessage: string | null = null

        if (penaltyLevel && !triggeredLevelsRef.current.has(penaltyLevel)) {
          triggeredLevelsRef.current.add(penaltyLevel)

          if (penaltyLevel === 2 && onTimePenaltyRef.current) {
            penaltyMessage = `${PENALTY_ACTIONS[2]}: Moderate violation detected`
            onTimePenaltyRef.current()
          } else if (penaltyLevel === 3 && onAutoSubmitRef.current) {
            penaltyMessage = `${PENALTY_ACTIONS[3]}: Major violation detected`
            onAutoSubmitRef.current()
          } else if (penaltyLevel === 1) {
            penaltyMessage = `${PENALTY_ACTIONS[1]}: ${VIOLATION_TYPES[type] || 'Minor violation'}`
          }
        }

        setState(prev => ({
          ...prev,
          violations: [...prev.violations, type],
          lastViolation: type,
          triggeredPenalties: Array.from(triggeredLevelsRef.current) as PenaltyLevel[],
          penaltyMessage: penaltyMessage || null,
        }))
      }
    } catch (err) {
      console.error('Failed to log violation:', err)
    }
  }, [getAuthHeaders])

  const heartbeat = useCallback(async () => {
    try {
      await fetch(
        `${API_URL}/api/monitoring/heartbeat?attempt_id=${attemptId}`,
        { method: 'POST', headers: getAuthHeaders() }
      )
    } catch (err) {
      console.error('Heartbeat failed:', err)
    }
  }, [attemptId, getAuthHeaders])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    return canvas.toDataURL('image/jpeg', 0.5)
  }, [])

  const startMonitoring = useCallback(async () => {
    const webcamStarted = await startWebcam()
    if (!webcamStarted) return

    setState(prev => ({ ...prev, isMonitoring: true }))
    connectWebSocket()

    heartbeatIntervalRef.current = setInterval(heartbeat, MONITORING_INTERVAL)

    frameIntervalRef.current = setInterval(async () => {
      const now = Date.now()
      if (now - lastFrameTimeRef.current >= FRAME_SEND_INTERVAL) {
        const frame = captureFrame()
        if (frame) {
          lastFrameTimeRef.current = now
          try {
            const response = await fetch(`${API_URL}/api/monitoring/analyze`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                frame_data: frame,
                attempt_id: attemptId,
              }),
            })

            if (response.ok) {
              const data = await response.json()
              if (data.success && data.violations && data.violations.length > 0) {
                for (const violation of data.violations) {
                  await sendViolation(violation.type as ViolationType, attemptId)
                }
              }
            }
          } catch (err) {
            console.error('Error analyzing frame:', err)
          }
        }
      }
    }, 500)
  }, [startWebcam, heartbeat, captureFrame, sendViolation, attemptId, getAuthHeaders, connectWebSocket])

  const stopMonitoring = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }

    disconnectWebSocket()

    setState(prev => ({
      ...prev,
      isMonitoring: false,
      isWebcamActive: false,
    }))
  }, [disconnectWebSocket])

  useEffect(() => {
    isMonitoringRef.current = state.isMonitoring
  }, [state.isMonitoring])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isMonitoringRef.current) {
        sendViolation('tab_switch', attemptId)
        setState(prev => ({ ...prev, tabSwitchCount: prev.tabSwitchCount + 1 }))
      }
    }

    const handleFocus = () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current)
        blurTimerRef.current = null
      }
    }

    const handleBlur = () => {
      if (!isMonitoringRef.current) return
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
      blurTimerRef.current = setTimeout(() => {
        if (document.hidden) return
        sendViolation('window_blur', attemptId)
        blurTimerRef.current = null
      }, 2000)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current)
        blurTimerRef.current = null
      }
    }
  }, [sendViolation, attemptId])

  useEffect(() => {
    return () => {
      stopMonitoring()
    }
  }, [stopMonitoring])

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    sendViolation,
    videoRef,
    canvasRef,
    streamRef,
    setOnTimePenalty,
    setOnAutoSubmit,
  }
}