import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type {
  CameraCaptureReason,
  CameraEvidence,
  CameraObstructionState,
  CameraStatus,
  FacePresenceStatus,
} from '../types/cameraProctoring'
import {
  clearCameraEvidence,
  getCameraEvidence,
  saveCameraEvidence,
} from '../utils/cameraEvidenceDatabase'
import {
  analyzeCameraFrame,
  CAMERA_OBSTRUCTION_CONFIG,
} from '../utils/cameraFrameAnalysis'

type UseCameraProctoringOptions = {
  assessmentId: string
  scheduledCaptureEnabled: boolean
}

type UseCameraProctoringResult = {
  cameraError: string | null
  cameraStatus: CameraStatus
  captureFrame: (
    reason: CameraCaptureReason,
    violationId?: string,
  ) => Promise<CameraEvidence | null>
  clearEvidence: () => Promise<void>
  evidence: CameraEvidence[]
  evidenceCount: number
  facePresenceStatus: FacePresenceStatus
  isCameraActive: boolean
  isCameraObstructed: boolean
  lastCapture: CameraEvidence | null
  obstructionState: CameraObstructionState
  reconnectCamera: () => Promise<boolean>
  refreshEvidence: () => Promise<CameraEvidence[]>
  startCamera: () => Promise<boolean>
  stopCamera: (captureFinalFrame?: boolean) => Promise<void>
  videoRef: RefObject<HTMLVideoElement | null>
}

const CAMERA_CAPTURE_INTERVAL_MS = 30000
const CAMERA_MUTE_GRACE_MS = 1500
const CAMERA_READY_POLL_MS = 1000
const CAPTURE_WIDTH = 480
const CAPTURE_HEIGHT = 270
const CAPTURE_QUALITY = 0.7
const CAMERA_ANALYSIS_DEBUG = import.meta.env.DEV

const cameraConstraints: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 },
  },
  audio: false,
}

const createEvidenceId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getPublicAssetPath = (assetPath: string) => {
  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${basePath}${assetPath.replace(/^\//, '')}`
}

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', CAPTURE_QUALITY)
  })

const getCameraFailure = (
  error: unknown,
): { message: string; status: CameraStatus } => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return {
        status: 'denied',
        message:
          'Camera permission was denied. Please allow camera access to start the assessment.',
      }
    }

    if (error.name === 'NotFoundError') {
      return {
        status: 'unavailable',
        message:
          'No camera was found. Please connect a camera to start the assessment.',
      }
    }

    if (error.name === 'NotReadableError') {
      return {
        status: 'unavailable',
        message:
          'The camera could not be started. It may already be in use by another application.',
      }
    }

    if (error.name === 'AbortError') {
      return {
        status: 'interrupted',
        message:
          'Camera startup was interrupted. Please retry camera access before continuing.',
      }
    }
  }

  return {
    status: 'unavailable',
    message:
      'Camera access failed. Please check your browser and device camera settings.',
  }
}

export function useCameraProctoring({
  assessmentId,
  scheduledCaptureEnabled,
}: UseCameraProctoringOptions): UseCameraProctoringResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraStatusRef = useRef<CameraStatus>('idle')
  const obstructionStateRef = useRef<CameraObstructionState>('idle')
  const faceDetectorRef = useRef<FaceDetector | null>(null)
  const faceDetectorInitializationRef = useRef<Promise<void> | null>(null)
  const faceDetectorGenerationRef = useRef(0)
  const faceDetectorAvailableRef = useRef<boolean | null>(null)
  const assessmentStartCaptureRequestedRef = useRef(false)
  const scheduledCaptureInProgressRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const interruptionReportedRef = useRef(false)
  const isCameraObstructedRef = useRef(false)
  const suspiciousFrameCountRef = useRef(0)
  const clearFrameCountRef = useRef(0)
  const streamStartedAtRef = useRef(0)
  const muteTimerRef = useRef<number | null>(null)
  const scheduledCaptureIntervalRef = useRef<number | null>(null)
  const assessmentStartCaptureTimerRef = useRef<number | null>(null)
  const frameAnalysisIntervalRef = useRef<number | null>(null)
  const streamInactiveHandlerRef = useRef<(() => void) | null>(null)
  const trackReadyStateTimerRef = useRef<number | null>(null)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [evidence, setEvidence] = useState<CameraEvidence[]>([])
  const [facePresenceStatus, setFacePresenceStatus] =
    useState<FacePresenceStatus>('checking')
  const [isCameraObstructed, setIsCameraObstructed] = useState(false)
  const [obstructionState, setObstructionState] =
    useState<CameraObstructionState>('idle')
  const [streamVersion, setStreamVersion] = useState(0)

  const updateCameraStatus = useCallback((status: CameraStatus) => {
    cameraStatusRef.current = status
    setCameraStatus(status)
  }, [])

  const updateObstructionState = useCallback(
    (state: CameraObstructionState) => {
      obstructionStateRef.current = state
      setObstructionState(state)
    },
    [],
  )

  const resetObstructionTracking = useCallback(() => {
    suspiciousFrameCountRef.current = 0
    clearFrameCountRef.current = 0
    isCameraObstructedRef.current = false
    setIsCameraObstructed(false)
    setFacePresenceStatus('checking')
    updateObstructionState('analyzing')
  }, [updateObstructionState])

  const refreshEvidence = useCallback(async () => {
    try {
      const records = await getCameraEvidence(assessmentId)
      setEvidence(records)
      return records
    } catch (error) {
      if (CAMERA_ANALYSIS_DEBUG) {
        console.warn('Camera evidence could not be read from IndexedDB.', error)
      }
      return []
    }
  }, [assessmentId])

  const clearEvidence = useCallback(async () => {
    await clearCameraEvidence(assessmentId)
    assessmentStartCaptureRequestedRef.current = false
    setEvidence([])
  }, [assessmentId])

  const clearMuteTimer = useCallback(() => {
    if (muteTimerRef.current !== null) {
      window.clearTimeout(muteTimerRef.current)
      muteTimerRef.current = null
    }
  }, [])

  const clearTrackReadyStateTimer = useCallback(() => {
    if (trackReadyStateTimerRef.current !== null) {
      window.clearInterval(trackReadyStateTimerRef.current)
      trackReadyStateTimerRef.current = null
    }
  }, [])

  const clearCaptureTimers = useCallback(() => {
    if (scheduledCaptureIntervalRef.current !== null) {
      window.clearInterval(scheduledCaptureIntervalRef.current)
      scheduledCaptureIntervalRef.current = null
    }

    if (assessmentStartCaptureTimerRef.current !== null) {
      window.clearTimeout(assessmentStartCaptureTimerRef.current)
      assessmentStartCaptureTimerRef.current = null
    }
  }, [])

  const clearFrameAnalysisTimer = useCallback(() => {
    if (frameAnalysisIntervalRef.current !== null) {
      window.clearInterval(frameAnalysisIntervalRef.current)
      frameAnalysisIntervalRef.current = null
    }
  }, [])

  const clearStreamListeners = useCallback((stream: MediaStream) => {
    if (streamInactiveHandlerRef.current) {
      stream.removeEventListener('inactive', streamInactiveHandlerRef.current)
      streamInactiveHandlerRef.current = null
    }

    stream.getVideoTracks().forEach((track) => {
      track.onended = null
      track.onmute = null
      track.onunmute = null
    })
  }, [])

  const stopCurrentStream = useCallback(() => {
    const currentStream = streamRef.current

    clearMuteTimer()
    clearTrackReadyStateTimer()

    if (currentStream) {
      clearStreamListeners(currentStream)
      currentStream.getTracks().forEach((track) => track.stop())
    }

    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setStreamVersion((version) => version + 1)
  }, [clearMuteTimer, clearStreamListeners, clearTrackReadyStateTimer])

  const disposeFaceDetector = useCallback(() => {
    faceDetectorGenerationRef.current += 1
    faceDetectorRef.current?.close()
    faceDetectorRef.current = null
    faceDetectorInitializationRef.current = null
    faceDetectorAvailableRef.current = null
  }, [])

  const attachStreamToVideo = useCallback(() => {
    const currentStream = streamRef.current
    const video = videoRef.current

    if (!currentStream || !video) {
      return
    }

    if (video.srcObject !== currentStream) {
      video.srcObject = currentStream
    }

    const playResult = video.play()

    if (playResult !== undefined) {
      playResult.catch(() => {
        setCameraError(
          'Camera preview could not autoplay. The camera stream is still active.',
        )
      })
    }
  }, [])

  const markCameraInterrupted = useCallback(
    (message: string) => {
      if (intentionalStopRef.current || interruptionReportedRef.current) {
        return
      }

      interruptionReportedRef.current = true
      clearMuteTimer()
      clearTrackReadyStateTimer()
      clearFrameAnalysisTimer()
      setCameraError(message)
      updateCameraStatus('interrupted')
      updateObstructionState('unavailable')
      setFacePresenceStatus('checking')
    },
    [
      clearFrameAnalysisTimer,
      clearMuteTimer,
      clearTrackReadyStateTimer,
      updateCameraStatus,
      updateObstructionState,
    ],
  )

  const monitorStreamInterruption = useCallback(
    (stream: MediaStream) => {
      clearMuteTimer()
      clearTrackReadyStateTimer()

      streamInactiveHandlerRef.current = () => {
        markCameraInterrupted('Camera stream became inactive.')
      }
      stream.addEventListener('inactive', streamInactiveHandlerRef.current)

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          markCameraInterrupted('Camera video track ended.')
        }

        track.onmute = () => {
          clearMuteTimer()

          muteTimerRef.current = window.setTimeout(() => {
            if (track.muted && track.readyState === 'live') {
              markCameraInterrupted('Camera video track is muted.')
            }
          }, CAMERA_MUTE_GRACE_MS)
        }

        track.onunmute = () => {
          clearMuteTimer()
        }
      })

      trackReadyStateTimerRef.current = window.setInterval(() => {
        const hasEndedTrack = stream
          .getVideoTracks()
          .some((track) => track.readyState === 'ended')

        if (hasEndedTrack) {
          markCameraInterrupted('Camera video track is no longer active.')
        }
      }, CAMERA_READY_POLL_MS)
    },
    [clearMuteTimer, clearTrackReadyStateTimer, markCameraInterrupted],
  )

  const initializeFaceDetector = useCallback(async () => {
    if (faceDetectorRef.current || faceDetectorAvailableRef.current === false) {
      return
    }

    if (faceDetectorInitializationRef.current) {
      return faceDetectorInitializationRef.current
    }

    const detectorGeneration = faceDetectorGenerationRef.current
    const initialization = (async () => {
      try {
        const visionFiles = await FilesetResolver.forVisionTasks(
          getPublicAssetPath('mediapipe/wasm'),
        )
        const detector = await FaceDetector.createFromOptions(visionFiles, {
          baseOptions: {
            modelAssetPath: getPublicAssetPath('models/face_detector.tflite'),
          },
          minDetectionConfidence: 0.5,
          runningMode: 'VIDEO',
        })

        if (detectorGeneration !== faceDetectorGenerationRef.current) {
          detector.close()
          return
        }

        faceDetectorRef.current = detector
        faceDetectorAvailableRef.current = true
      } catch (error) {
        faceDetectorAvailableRef.current = false
        setFacePresenceStatus('unavailable')

        if (CAMERA_ANALYSIS_DEBUG) {
          console.warn(
            'MediaPipe face detector is unavailable; camera obstruction checks will use frame analysis only.',
            error,
          )
        }
      } finally {
        faceDetectorInitializationRef.current = null
      }
    })()

    faceDetectorInitializationRef.current = initialization
    return initialization
  }, [])

  const requestCamera = useCallback(
    async (status: 'requesting' | 'reconnecting') => {
      if (!navigator.mediaDevices?.getUserMedia) {
        updateCameraStatus('unavailable')
        updateObstructionState('unavailable')
        setCameraError(
          'Camera access is not available in this browser or connection context.',
        )
        return false
      }

      intentionalStopRef.current = true
      clearFrameAnalysisTimer()
      stopCurrentStream()
      intentionalStopRef.current = false
      interruptionReportedRef.current = false
      setCameraError(null)
      updateCameraStatus(status)
      resetObstructionTracking()

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(cameraConstraints)

        streamRef.current = stream
        streamStartedAtRef.current = Date.now()
        monitorStreamInterruption(stream)
        updateCameraStatus('active')
        setStreamVersion((version) => version + 1)
        window.setTimeout(attachStreamToVideo, 0)
        void initializeFaceDetector()
        return true
      } catch (error) {
        const failure = getCameraFailure(error)

        streamRef.current = null
        updateCameraStatus(failure.status)
        updateObstructionState('unavailable')
        setCameraError(failure.message)
        setStreamVersion((version) => version + 1)
        return false
      }
    },
    [
      attachStreamToVideo,
      clearFrameAnalysisTimer,
      initializeFaceDetector,
      monitorStreamInterruption,
      resetObstructionTracking,
      stopCurrentStream,
      updateCameraStatus,
      updateObstructionState,
    ],
  )

  const startCamera = useCallback(
    () => requestCamera('requesting'),
    [requestCamera],
  )

  const reconnectCamera = useCallback(
    () => requestCamera('reconnecting'),
    [requestCamera],
  )

  const captureFrame = useCallback(
    async (
      reason: CameraCaptureReason,
      violationId?: string,
    ): Promise<CameraEvidence | null> => {
      const video = videoRef.current
      const currentStatus = cameraStatusRef.current
      const canCapture =
        currentStatus === 'active' ||
        (currentStatus === 'interrupted' && reason === 'camera-interrupted')

      if (!video || !streamRef.current || !canCapture) {
        return null
      }

      const sourceWidth = video.videoWidth
      const sourceHeight = video.videoHeight

      if (sourceWidth <= 0 || sourceHeight <= 0) {
        return null
      }

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        return null
      }

      canvas.width = CAPTURE_WIDTH
      canvas.height = CAPTURE_HEIGHT

      const sourceAspectRatio = sourceWidth / sourceHeight
      const targetAspectRatio = CAPTURE_WIDTH / CAPTURE_HEIGHT
      let sourceX = 0
      let sourceY = 0
      let croppedWidth = sourceWidth
      let croppedHeight = sourceHeight

      if (sourceAspectRatio > targetAspectRatio) {
        croppedWidth = sourceHeight * targetAspectRatio
        sourceX = (sourceWidth - croppedWidth) / 2
      } else if (sourceAspectRatio < targetAspectRatio) {
        croppedHeight = sourceWidth / targetAspectRatio
        sourceY = (sourceHeight - croppedHeight) / 2
      }

      context.drawImage(
        video,
        sourceX,
        sourceY,
        croppedWidth,
        croppedHeight,
        0,
        0,
        CAPTURE_WIDTH,
        CAPTURE_HEIGHT,
      )

      const imageBlob = await canvasToBlob(canvas)

      if (!imageBlob) {
        return null
      }

      const evidenceItem: CameraEvidence = {
        id: createEvidenceId(),
        assessmentId,
        capturedAt: new Date().toISOString(),
        reason,
        imageBlob,
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
        cameraStatus: currentStatus,
        ...(violationId ? { violationId } : {}),
      }

      try {
        await saveCameraEvidence(evidenceItem)
        await refreshEvidence()
        return evidenceItem
      } catch (error) {
        if (CAMERA_ANALYSIS_DEBUG) {
          console.warn('Camera evidence could not be stored.', error)
        }
        return null
      }
    },
    [assessmentId, refreshEvidence],
  )

  const captureScheduledFrame = useCallback(
    async (reason: CameraCaptureReason) => {
      if (scheduledCaptureInProgressRef.current) {
        return null
      }

      scheduledCaptureInProgressRef.current = true

      try {
        return await captureFrame(reason)
      } finally {
        scheduledCaptureInProgressRef.current = false
      }
    },
    [captureFrame],
  )

  const stopCamera = useCallback(
    async (captureFinalFrame = false) => {
      if (captureFinalFrame && cameraStatusRef.current === 'active') {
        await captureFrame('manual-test-capture')
      }

      intentionalStopRef.current = true
      interruptionReportedRef.current = false
      clearCaptureTimers()
      clearFrameAnalysisTimer()
      stopCurrentStream()
      disposeFaceDetector()
      setCameraError(null)
      updateCameraStatus('stopped')
      updateObstructionState('idle')
      setFacePresenceStatus('checking')
      isCameraObstructedRef.current = false
      setIsCameraObstructed(false)
    },
    [
      captureFrame,
      clearCaptureTimers,
      clearFrameAnalysisTimer,
      disposeFaceDetector,
      stopCurrentStream,
      updateCameraStatus,
      updateObstructionState,
    ],
  )

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshEvidence()
    }, 0)

    return () => window.clearTimeout(refreshTimer)
  }, [refreshEvidence])

  useEffect(() => {
    attachStreamToVideo()
  }, [attachStreamToVideo, cameraStatus, streamVersion])

  useEffect(() => {
    clearCaptureTimers()

    if (!scheduledCaptureEnabled || cameraStatus !== 'active') {
      return undefined
    }

    if (!assessmentStartCaptureRequestedRef.current) {
      assessmentStartCaptureRequestedRef.current = true

      const captureAssessmentStart = async (attempt = 0) => {
        const captured = await captureScheduledFrame('assessment-start')

        if (!captured && attempt < 6) {
          assessmentStartCaptureTimerRef.current = window.setTimeout(() => {
            void captureAssessmentStart(attempt + 1)
          }, 500)
        }
      }

      assessmentStartCaptureTimerRef.current = window.setTimeout(() => {
        void captureAssessmentStart()
      }, 500)
    }

    scheduledCaptureIntervalRef.current = window.setInterval(() => {
      void captureScheduledFrame('scheduled-capture')
    }, CAMERA_CAPTURE_INTERVAL_MS)

    return clearCaptureTimers
  }, [
    cameraStatus,
    captureScheduledFrame,
    clearCaptureTimers,
    scheduledCaptureEnabled,
  ])

  useEffect(() => {
    clearFrameAnalysisTimer()

    if (!scheduledCaptureEnabled || cameraStatus !== 'active') {
      return undefined
    }

    void initializeFaceDetector()

    const analysisCanvas = document.createElement('canvas')
    analysisCanvas.width = CAMERA_OBSTRUCTION_CONFIG.analysisWidth
    analysisCanvas.height = CAMERA_OBSTRUCTION_CONFIG.analysisHeight
    const analysisContext = analysisCanvas.getContext('2d', {
      willReadFrequently: true,
    })

    if (!analysisContext) {
      if (CAMERA_ANALYSIS_DEBUG) {
        console.warn('Camera frame analysis canvas is unavailable.')
      }
      return undefined
    }

    const analyzeCurrentFrame = () => {
      const video = videoRef.current

      if (
        cameraStatusRef.current !== 'active' ||
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0 ||
        Date.now() - streamStartedAtRef.current <
          CAMERA_OBSTRUCTION_CONFIG.startupGraceMs
      ) {
        return
      }

      analysisContext.drawImage(
        video,
        0,
        0,
        CAMERA_OBSTRUCTION_CONFIG.analysisWidth,
        CAMERA_OBSTRUCTION_CONFIG.analysisHeight,
      )
      const frameAnalysis = analyzeCameraFrame(
        analysisContext.getImageData(
          0,
          0,
          CAMERA_OBSTRUCTION_CONFIG.analysisWidth,
          CAMERA_OBSTRUCTION_CONFIG.analysisHeight,
        ),
      )

      let noFaceDetected = false
      const detector = faceDetectorRef.current

      if (detector) {
        try {
          const result = detector.detectForVideo(video, performance.now())
          noFaceDetected = result.detections.length === 0
          setFacePresenceStatus(noFaceDetected ? 'not-visible' : 'visible')
        } catch (error) {
          detector.close()
          faceDetectorRef.current = null
          faceDetectorAvailableRef.current = false
          setFacePresenceStatus('unavailable')

          if (CAMERA_ANALYSIS_DEBUG) {
            console.warn(
              'MediaPipe face detection stopped; camera obstruction checks will use frame analysis only.',
              error,
            )
          }
        }
      } else if (faceDetectorAvailableRef.current === false) {
        setFacePresenceStatus('unavailable')
      } else {
        setFacePresenceStatus('checking')
      }

      const detectorIsUnavailable = faceDetectorAvailableRef.current === false
      const suspiciousFrame = detectorIsUnavailable
        ? frameAnalysis.likelyObstructed
        : noFaceDetected && frameAnalysis.likelyObstructed

      if (CAMERA_ANALYSIS_DEBUG) {
        console.debug('Camera obstruction analysis', {
          ...frameAnalysis,
          faceDetectorAvailable: faceDetectorAvailableRef.current,
          noFaceDetected,
          suspiciousFrame,
        })
      }

      if (suspiciousFrame) {
        clearFrameCountRef.current = 0
        suspiciousFrameCountRef.current += 1

        if (
          !isCameraObstructedRef.current &&
          suspiciousFrameCountRef.current >=
            CAMERA_OBSTRUCTION_CONFIG.requiredConsecutiveFrames
        ) {
          isCameraObstructedRef.current = true
          setIsCameraObstructed(true)
          updateObstructionState('obstructed')
        } else if (!isCameraObstructedRef.current) {
          updateObstructionState('suspected')
        }

        return
      }

      suspiciousFrameCountRef.current = 0
      clearFrameCountRef.current += 1

      if (isCameraObstructedRef.current) {
        if (
          clearFrameCountRef.current >=
          CAMERA_OBSTRUCTION_CONFIG.recoveryConsecutiveFrames
        ) {
          isCameraObstructedRef.current = false
          setIsCameraObstructed(false)
          updateObstructionState('clear')
        } else {
          updateObstructionState('recovering')
        }
      } else if (
        clearFrameCountRef.current >=
        CAMERA_OBSTRUCTION_CONFIG.recoveryConsecutiveFrames
      ) {
        updateObstructionState('clear')
      } else {
        updateObstructionState('analyzing')
      }
    }

    frameAnalysisIntervalRef.current = window.setInterval(
      analyzeCurrentFrame,
      CAMERA_OBSTRUCTION_CONFIG.analysisIntervalMs,
    )

    return clearFrameAnalysisTimer
  }, [
    cameraStatus,
    clearFrameAnalysisTimer,
    initializeFaceDetector,
    scheduledCaptureEnabled,
    updateObstructionState,
  ])

  useEffect(
    () => () => {
      void stopCamera(false)
    },
    [stopCamera],
  )

  return {
    cameraError,
    cameraStatus,
    captureFrame,
    clearEvidence,
    evidence,
    evidenceCount: evidence.length,
    facePresenceStatus,
    isCameraActive: cameraStatus === 'active',
    isCameraObstructed,
    lastCapture: evidence[0] ?? null,
    obstructionState,
    reconnectCamera,
    refreshEvidence,
    startCamera,
    stopCamera,
    videoRef,
  }
}
