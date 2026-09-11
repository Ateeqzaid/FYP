-- Add new violation types to the check constraint
ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_violation_type_check;

ALTER TABLE violations ADD CONSTRAINT violations_violation_type_check
  CHECK (violation_type IN (
    'no_face_detected',
    'multiple_faces',
    'phone_detected',
    'tab_switch',
    'window_blur',
    'looking_away_excessive',
    'head_pose_suspicious',
    'eye_gaze_suspicious'
  ));
