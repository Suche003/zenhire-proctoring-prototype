import { useEffect, useState } from 'react'
import type {
  CameraCaptureReason,
  CameraEvidence,
} from '../types/cameraProctoring'

type CameraEvidenceGalleryProps = {
  collapsible?: boolean
  evidence: CameraEvidence[]
  onClearEvidence: () => Promise<void>
}

const captureReasonLabels: Record<CameraCaptureReason, string> = {
  'assessment-start': 'Assessment start',
  'scheduled-capture': 'Scheduled capture',
  'violation-focus-loss': 'Focus loss violation',
  'violation-tab-hidden': 'Tab hidden violation',
  'violation-window-resize': 'Resize violation',
  'violation-screenshot-attempt': 'Screenshot attempt violation',
  'camera-interrupted': 'Camera interrupted',
  'camera-obstructed': 'Camera obstructed',
  'manual-test-capture': 'Final camera capture',
}

const formatCaptureTime = (capturedAt: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(capturedAt))

type EvidenceImageProps = {
  alt: string
  imageBlob: Blob
}

function EvidenceImage({ alt, imageBlob }: EvidenceImageProps) {
  const [objectUrl] = useState(() => URL.createObjectURL(imageBlob))

  useEffect(
    () => () => {
      URL.revokeObjectURL(objectUrl)
    },
    [objectUrl],
  )

  return <img alt={alt} src={objectUrl} />
}

function CameraEvidenceGallery({
  collapsible = false,
  evidence,
  onClearEvidence,
}: CameraEvidenceGalleryProps) {
  const [isClearing, setIsClearing] = useState(false)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null,
  )

  const selectedEvidence =
    evidence.find((record) => record.id === selectedEvidenceId) ?? null

  const handleClearEvidence = async () => {
    setIsClearing(true)

    try {
      await onClearEvidence()
      setSelectedEvidenceId(null)
    } finally {
      setIsClearing(false)
    }
  }

  const galleryContent = (
    <>
      <p className="camera-evidence-note">
        These images are stored only in this browser for prototype testing.
      </p>

      {evidence.length === 0 ? (
        <p className="camera-evidence-empty">No camera evidence is stored.</p>
      ) : (
        <div className="camera-evidence-grid">
          {evidence.map((record) => (
            <article className="camera-evidence-item" key={record.id}>
              <button
                aria-label={`Open ${captureReasonLabels[record.reason]} capture`}
                className="camera-evidence-thumbnail"
                onClick={() => setSelectedEvidenceId(record.id)}
                type="button"
              >
                <EvidenceImage
                  alt={`${captureReasonLabels[record.reason]} camera evidence`}
                  imageBlob={record.imageBlob}
                />
              </button>
              <div>
                <strong>{captureReasonLabels[record.reason]}</strong>
                <time dateTime={record.capturedAt}>
                  {formatCaptureTime(record.capturedAt)}
                </time>
                {record.violationId ? (
                  <small>Violation {record.violationId}</small>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <button
        className="secondary-button camera-evidence-clear"
        disabled={isClearing || evidence.length === 0}
        onClick={() => {
          void handleClearEvidence()
        }}
        type="button"
      >
        {isClearing ? 'Clearing evidence...' : 'Clear Prototype Evidence'}
      </button>

      {selectedEvidence ? (
        <div
          className="camera-evidence-modal-backdrop"
          onClick={() => setSelectedEvidenceId(null)}
          role="presentation"
        >
          <section
            aria-labelledby="camera-evidence-preview-title"
            aria-modal="true"
            className="camera-evidence-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="camera-evidence-modal-header">
              <div>
                <p className="eyebrow">Prototype Camera Evidence</p>
                <h2 id="camera-evidence-preview-title">
                  {captureReasonLabels[selectedEvidence.reason]}
                </h2>
              </div>
              <button
                aria-label="Close camera evidence preview"
                className="camera-evidence-close"
                onClick={() => setSelectedEvidenceId(null)}
                type="button"
              >
                X
              </button>
            </div>
            <EvidenceImage
              alt={`${captureReasonLabels[selectedEvidence.reason]} enlarged camera evidence`}
              imageBlob={selectedEvidence.imageBlob}
            />
            <p>{formatCaptureTime(selectedEvidence.capturedAt)}</p>
          </section>
        </div>
      ) : null}
    </>
  )

  if (collapsible) {
    return (
      <details className="camera-evidence-gallery camera-evidence-gallery--collapsible">
        <summary>
          Prototype Camera Evidence <span>{evidence.length}</span>
        </summary>
        <div className="camera-evidence-gallery-body">{galleryContent}</div>
      </details>
    )
  }

  return (
    <section
      aria-labelledby="camera-evidence-title"
      className="camera-evidence-gallery"
    >
      <div className="camera-evidence-gallery-header">
        <div>
          <p className="eyebrow">Review</p>
          <h2 id="camera-evidence-title">Prototype Camera Evidence</h2>
        </div>
        <span>{evidence.length} captures</span>
      </div>
      {galleryContent}
    </section>
  )
}

export default CameraEvidenceGallery
