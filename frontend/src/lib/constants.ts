export const VIOLATION_TYPES = {
  no_face_detected: 'No Face Detected',
  multiple_faces: 'Multiple Faces Detected',
  phone_detected: 'Phone Detected',
  tab_switch: 'Tab Switch',
  window_blur: 'Window Blur',
  looking_away_excessive: 'Excessive Looking Away',
  head_pose_suspicious: 'Suspicious Head Movement',
  eye_gaze_suspicious: 'Suspicious Eye Movement',
} as const

export const VIOLATION_SEVERITY: Record<string, string> = {
  no_face_detected: 'high',
  multiple_faces: 'high',
  phone_detected: 'high',
  tab_switch: 'low',
  window_blur: 'medium',
  looking_away_excessive: 'low',
  head_pose_suspicious: 'medium',
  eye_gaze_suspicious: 'medium',
} as const

export const PENALTY_LEVELS: Record<string, 1 | 2 | 3> = {
  no_face_detected: 1,
  looking_away_excessive: 1,
  tab_switch: 2,
  window_blur: 2,
  head_pose_suspicious: 2,
  eye_gaze_suspicious: 2,
  phone_detected: 2,
  multiple_faces: 3,
} as const

export const PENALTY_LABELS: Record<number, string> = {
  1: 'Minor',
  2: 'Moderate',
  3: 'Major',
} as const

export const PENALTY_ACTIONS: Record<number, string> = {
  1: 'On-screen warning',
  2: 'Half time deducted',
  3: 'Exam auto-submitted',
} as const

export const PENALTY_COLORS: Record<number, string> = {
  1: 'text-yellow-500 bg-yellow-50 border-yellow-200',
  2: 'text-orange-500 bg-orange-50 border-orange-200',
  3: 'text-red-500 bg-red-50 border-red-200',
} as const

export const SEVERITY_COLORS = {
  low: 'text-yellow-500 bg-yellow-50',
  medium: 'text-orange-500 bg-orange-50',
  high: 'text-red-500 bg-red-50'
} as const

export const STATUS_COLORS = {
  in_progress: 'text-blue-500 bg-blue-50',
  completed: 'text-green-500 bg-green-50',
  flagged: 'text-red-500 bg-red-50',
  reviewed: 'text-gray-500 bg-gray-50'
} as const

export const MONITORING_INTERVAL = 5000
export const FRAME_SEND_INTERVAL = 1000
export const MAX_LOOKING_AWAY_SECONDS = 15
export const FACE_DETECTION_THRESHOLD = 10
