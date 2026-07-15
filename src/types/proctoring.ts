export type ViolationType =
  | 'focus-loss'
  | 'tab-hidden'
  | 'window-resize'
  | 'screenshot-attempt'
  | 'camera-lost'
  | 'camera-obstructed'

export type ViolationSeverity = 'warning' | 'critical'

export type ProctoringStatus = 'idle' | 'active' | 'frozen'

export type ProctoringEvent = {
  id: string
  type: ViolationType
  label: string
  message: string
  occurredAt: string
  severity: ViolationSeverity
  warningTitle: string
  buttonLabel: string
  isRepeated: boolean
  occurrence: number
  details?: string
}

export type ViolationCopy = {
  buttonLabel: string
  label: string
  message: string
  severity: ViolationSeverity
  warningTitle: string
}

export const VIOLATION_COPY: Record<ViolationType, ViolationCopy> = {
  'focus-loss': {
    label: 'Window focus lost',
    warningTitle: 'WARNING!',
    message:
      'We have noticed that you left the assessment window during the test. Changing windows, opening another application, or leaving the assessment environment is not allowed. If you continue this behavior, the recruiter/proctor will be notified and it may lead to disqualification.',
    severity: 'critical',
    buttonLabel: 'I understand and continue the test',
  },
  'tab-hidden': {
    label: 'Tab hidden',
    warningTitle: 'WARNING!',
    message:
      'We have noticed that you switched tabs during the assessment. Switching tabs, opening another window, or leaving the assessment page is not allowed. If you continue this behavior, the recruiter/proctor will be notified and it may lead to disqualification.',
    severity: 'critical',
    buttonLabel: 'I understand and continue the test',
  },
  'window-resize': {
    label: 'Browser resized / split-screen detected',
    warningTitle: 'WARNING!',
    message:
      'We have noticed that your assessment window is not in secure maximized mode. Half-screen, split-screen, split-tab view, side panels, or resized windows are not allowed during the assessment. If you continue this behavior, the recruiter/proctor will be notified and it may lead to disqualification.',
    severity: 'warning',
    buttonLabel: 'I understand and continue the test',
  },
  'screenshot-attempt': {
    label: 'Possible screenshot attempt detected',
    warningTitle: 'WARNING!',
    message:
      'We have noticed that you may be trying to take screenshots during the assessment. Taking screenshots, copying, or sharing assessment content is not allowed. If you continue this behavior, the recruiter/proctor will be notified and it may lead to disqualification.',
    severity: 'critical',
    buttonLabel: 'I understand and continue the test',
  },
  'camera-lost': {
    label: 'Camera access lost',
    warningTitle: 'WARNING!',
    message:
      'We have noticed that your camera access was lost or interrupted during the assessment. Keeping the camera active is required for this test. If the camera remains unavailable, the recruiter/proctor will be notified and it may lead to disqualification.',
    severity: 'critical',
    buttonLabel: 'Reconnect camera and continue the test',
  },
  'camera-obstructed': {
    label: 'Camera view obstructed',
    warningTitle: 'WARNING!',
    message:
      'We have noticed that your camera view appears to be covered, blocked, or unclear during the assessment. Your face and testing environment must remain visible while the assessment is in progress. Please uncover and correctly position your camera before continuing. Continued camera obstruction may notify the recruiter/proctor and may lead to disqualification.',
    severity: 'critical',
    buttonLabel: 'Check camera and continue the test',
  },
}
