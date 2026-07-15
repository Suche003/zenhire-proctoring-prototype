import type { RefObject } from 'react'
import type {
  CameraObstructionState,
  CameraStatus,
} from '../types/cameraProctoring'

type CameraPreviewProps = {
  cameraError: string | null
  cameraStatus: CameraStatus
  obstructionState: CameraObstructionState
  videoRef: RefObject<HTMLVideoElement | null>
}

type PreviewState =
  | 'active'
  | 'analyzing'
  | 'obstructed'
  | 'lost'
  | 'reconnecting'

const previewStatusLabels: Record<PreviewState, string> = {
  active: 'Camera active',
  analyzing: 'Checking camera',
  obstructed: 'Camera view blocked',
  lost: 'Camera unavailable',
  reconnecting: 'Reconnecting camera',
}

const getPreviewState = (
  cameraStatus: CameraStatus,
  obstructionState: CameraObstructionState,
): PreviewState => {
  if (cameraStatus === 'requesting' || cameraStatus === 'reconnecting') {
    return 'reconnecting'
  }

  if (cameraStatus !== 'active') {
    return 'lost'
  }

  if (
    obstructionState === 'obstructed' ||
    obstructionState === 'recovering'
  ) {
    return 'obstructed'
  }

  if (
    obstructionState === 'analyzing' ||
    obstructionState === 'suspected'
  ) {
    return 'analyzing'
  }

  return 'active'
}

function CameraPreview({
  cameraError,
  cameraStatus,
  obstructionState,
  videoRef,
}: CameraPreviewProps) {
  const previewState = getPreviewState(cameraStatus, obstructionState)
  const statusLabel = previewStatusLabels[previewState]

  return (
    <section
      aria-label={`Live camera status: ${statusLabel}`}
      className={`camera-preview camera-preview--${previewState}`}
    >
      <div className="camera-preview-header">
        <div>
          <span
            aria-hidden="true"
            className={`camera-status-dot camera-status-dot--${previewState}`}
          />
          <p className="eyebrow">Live Camera</p>
        </div>
        <span aria-live="polite">{statusLabel}</span>
      </div>

      <div className="camera-video-frame">
        <video autoPlay muted playsInline ref={videoRef} />
        {previewState !== 'active' && previewState !== 'analyzing' ? (
          <div className="camera-video-placeholder">{statusLabel}</div>
        ) : null}
      </div>

      {cameraError && previewState === 'lost' ? <p>{cameraError}</p> : null}
    </section>
  )
}

export default CameraPreview
