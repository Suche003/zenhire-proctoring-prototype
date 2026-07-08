import type { ProctoringEvent } from '../types/proctoring'

type WarningOverlayProps = {
  event: ProctoringEvent | null
  isLocked: boolean
  isOpen: boolean
  onCloseAssessment: () => void
  onContactRecruiter: () => void
  onResume: () => void
  proctoringError: string | null
  showRecruiterContact: boolean
}

function WarningOverlay({
  event,
  isLocked,
  isOpen,
  onCloseAssessment,
  onContactRecruiter,
  onResume,
  proctoringError,
  showRecruiterContact,
}: WarningOverlayProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="warning-backdrop" role="presentation">
      <section
        aria-labelledby="warning-title"
        aria-modal="true"
        className="warning-overlay"
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

        {proctoringError ? (
          <p className="inline-error" role="alert">
            {proctoringError}
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
            onClick={onResume}
            type="button"
          >
            {event?.buttonLabel ?? 'I understand and continue the test'}
          </button>
        )}
      </section>
    </div>
  )
}

export default WarningOverlay
