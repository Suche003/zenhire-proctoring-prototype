export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'reconnecting'
  | 'denied'
  | 'unavailable'
  | 'interrupted'
  | 'stopped'

export type CameraCaptureReason =
  | 'assessment-start'
  | 'scheduled-capture'
  | 'violation-focus-loss'
  | 'violation-tab-hidden'
  | 'violation-window-resize'
  | 'violation-screenshot-attempt'
  | 'camera-interrupted'
  | 'camera-obstructed'
  | 'manual-test-capture'

export type CameraObstructionState =
  | 'idle'
  | 'analyzing'
  | 'clear'
  | 'suspected'
  | 'obstructed'
  | 'recovering'
  | 'unavailable'

export type FacePresenceStatus =
  | 'checking'
  | 'visible'
  | 'not-visible'
  | 'unavailable'

export type CameraEvidence = {
  id: string
  assessmentId: string
  capturedAt: string
  reason: CameraCaptureReason
  imageBlob: Blob
  width: number
  height: number
  cameraStatus: CameraStatus
  violationId?: string
}
