import type { ReactNode } from 'react'
import type { ProctoringEvent } from '../types/proctoring'

type WarningOverlayProps = {
  cameraObstructionError?: string | null
  cameraReconnectError?: string | null
  event: ProctoringEvent | null
  isCheckingCamera?: boolean
  isCameraReconnecting?: boolean
  isLocked: boolean
  isOpen: boolean
  lockedEvidenceContent?: ReactNode
  onCloseAssessment: () => void
  onContactRecruiter: () => void
  onCheckCamera?: () => void | Promise<void>
  onReconnectCamera?: () => void | Promise<void>
  onResume: () => void
  proctoringError: string | null
  requiresCameraCheck?: boolean
  requiresCameraReconnect?: boolean
  showRecruiterContact: boolean
}

function WarningOverlay({
  cameraObstructionError = null,
  cameraReconnectError = null,
  event,
  isCheckingCamera = false,
  isCameraReconnecting = false,
  isLocked,
  isOpen,
  lockedEvidenceContent,
  onCloseAssessment,
  onContactRecruiter,
  onCheckCamera,
  onReconnectCamera,
  onResume,
  proctoringError,
  requiresCameraCheck = false,
  requiresCameraReconnect = false,
  showRecruiterContact,
}: WarningOverlayProps) {
  if (!isOpen) {
    return null
  }

  const isCameraWarning = event?.type === 'camera-lost'
  const isCameraObstructionWarning = event?.type === 'camera-obstructed'
  const shouldReconnectCamera = isCameraWarning || requiresCameraReconnect
  const shouldCheckCamera =
    !shouldReconnectCamera &&
    (isCameraObstructionWarning || requiresCameraCheck)
  const warningError =
    proctoringError ?? cameraReconnectError ?? cameraObstructionError
  const buttonLabel =
    shouldReconnectCamera && isCameraReconnecting
      ? 'Reconnecting camera...'
      : shouldReconnectCamera
        ? 'Reconnect camera and continue the test'
        : shouldCheckCamera && isCheckingCamera
          ? 'Checking camera...'
          : shouldCheckCamera
            ? 'Check camera and continue the test'
        : event?.buttonLabel ?? 'I understand and continue the test'

  const handlePrimaryAction = () => {
    if (shouldReconnectCamera && onReconnectCamera) {
      void onReconnectCamera()
      return
    }

    if (shouldCheckCamera && onCheckCamera) {
      void onCheckCamera()
      return
    }

    onResume()
  }

  return (
    <div className="warning-backdrop" role="presentation">
      <section
        aria-labelledby="warning-title"
        aria-modal="true"
        className={`warning-overlay ${
          isLocked ? 'warning-overlay--locked' : ''
        }`}
        role="dialog"
      >
        <span className="warning-icon" aria-hidden="true">
          !
        </span>
        <p className="eyebrow">Assessment paused</p>
        <h2 id="warning-title">
          {isLocked ? 'Assessment Locked' : event?.warningTitle ?? 'WARNING!'}
        </h2>
        <p className="warning-message">
          {isLocked
            ? 'Your assessment has been locked because multiple proctoring violations were detected. The recruiter/proctor will be notified and your assessment may be reviewed before a final decision is made.'
            : event?.message ?? 'A proctoring warning paused the test.'}
        </p>

        {isLocked && showRecruiterContact ? (
          <div className="contact-recruiter-panel" role="status">
            Please contact the recruiter for support regarding your assessment
            status.
          </div>
        ) : null}

        {warningError ? (
          <p className="inline-error" role="alert">
            {warningError}
          </p>
        ) : null}

        {isLocked ? (
          <div className="locked-actions">
            <button
              className="secondary-button"
              onClick={onCloseAssessment}
              type="button"
            >
              Close Assessment
            </button>
            <button
              className="primary-button"
              onClick={onContactRecruiter}
              type="button"
            >
              Contact Recruiter
            </button>
          </div>
        ) : (
          <button
            className="primary-button"
            disabled={
              (shouldReconnectCamera && isCameraReconnecting) ||
              (shouldCheckCamera && isCheckingCamera)
            }
            onClick={handlePrimaryAction}
            type="button"
          >
            {buttonLabel}
          </button>
        )}

        {isLocked && lockedEvidenceContent ? lockedEvidenceContent : null}
      </section>
    </div>
  )
}

export default WarningOverlay
