import { useEffect, useMemo, useRef, useState } from 'react'
import CameraEvidenceGallery from './CameraEvidenceGallery'
import CameraPreview from './CameraPreview'
import EventLog from './EventLog'
import QuestionCard from './QuestionCard'
import WarningOverlay from './WarningOverlay'
import { frontendQuestions } from '../data/frontendQuestions'
import { useCameraProctoring } from '../hooks/useCameraProctoring'
import { useProctoring } from '../hooks/useProctoring'
import type { AnswerMap } from '../types/assessment'
import type {
  CameraCaptureReason,
  CameraStatus,
} from '../types/cameraProctoring'
import type { ViolationType } from '../types/proctoring'

type PreTestStep = 'start' | 'welcome' | 'rules'

const statusLabels = {
  idle: 'Ready',
  active: 'In progress',
  frozen: 'Paused',
}

const cameraStatusLabels: Record<CameraStatus, string> = {
  idle: 'Not requested',
  requesting: 'Requesting access',
  active: 'Active',
  reconnecting: 'Reconnecting',
  denied: 'Permission denied',
  unavailable: 'Unavailable',
  interrupted: 'Interrupted',
  stopped: 'Stopped',
}

const cameraCaptureReasonLabels: Record<CameraCaptureReason, string> = {
  'assessment-start': 'Assessment start',
  'scheduled-capture': 'Scheduled',
  'violation-focus-loss': 'Focus loss',
  'violation-tab-hidden': 'Tab hidden',
  'violation-window-resize': 'Resize',
  'violation-screenshot-attempt': 'Screenshot attempt',
  'camera-interrupted': 'Camera interrupted',
  'camera-obstructed': 'Camera obstructed',
  'manual-test-capture': 'Final capture',
}

const violationCaptureReasons: Record<ViolationType, CameraCaptureReason> = {
  'focus-loss': 'violation-focus-loss',
  'tab-hidden': 'violation-tab-hidden',
  'window-resize': 'violation-window-resize',
  'screenshot-attempt': 'violation-screenshot-attempt',
  'camera-lost': 'camera-interrupted',
  'camera-obstructed': 'camera-obstructed',
}

const TEST_DURATION_SECONDS = 25 * 60
const LOCK_VIOLATION_THRESHOLD = 4
const ASSESSMENT_ID = 'ZH-FE-2026-001'
const candidate = {
  email: 'alex.candidate@example.com',
  name: 'Alex Candidate',
}

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

const formatEvidenceTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))

function TestScreen() {
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [cameraHasBeenRequested, setCameraHasBeenRequested] = useState(false)
  const [cameraObstructionError, setCameraObstructionError] = useState<
    string | null
  >(null)
  const [cameraReconnectError, setCameraReconnectError] = useState<
    string | null
  >(null)
  const [cameraStartError, setCameraStartError] = useState<string | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isHandlingCameraReconnect, setIsHandlingCameraReconnect] =
    useState(false)
  const [isCheckingCamera, setIsCheckingCamera] = useState(false)
  const [isStartingAssessment, setIsStartingAssessment] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [lockedAction, setLockedAction] = useState<'active' | 'closed' | 'contact'>(
    'active',
  )
  const [preTestStep, setPreTestStep] = useState<PreTestStep>('start')
  const [remainingSeconds, setRemainingSeconds] = useState(TEST_DURATION_SECONDS)
  const capturedViolationEvidenceRef = useRef<Set<string>>(new Set())
  const hasInitializedAssessmentSessionRef = useRef(false)
  const reportedCameraObstructionRef = useRef(false)
  const reportedCameraInterruptionRef = useRef(false)
  const terminalCameraCleanupStartedRef = useRef(false)
  const {
    assessmentRef,
    events,
    isFrozen,
    isLocked,
    isSecureMode,
    isStarted,
    latestEvent,
    proctoringError,
    recordExternalViolation,
    resumeTest,
    startTest,
    status,
  } = useProctoring()
  const {
    cameraError,
    cameraStatus,
    captureFrame,
    clearEvidence,
    evidence,
    evidenceCount,
    facePresenceStatus,
    isCameraObstructed,
    lastCapture,
    obstructionState,
    reconnectCamera,
    startCamera,
    stopCamera,
    videoRef,
  } = useCameraProctoring({
    assessmentId: ASSESSMENT_ID,
    scheduledCaptureEnabled:
      isStarted && !isSubmitted && !isLocked && lockedAction === 'active',
  })

  const totalQuestions = frontendQuestions.length
  const currentQuestion = frontendQuestions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id] ?? ''
  const criticalViolations = useMemo(
    () => events.filter((event) => event.severity === 'critical').length,
    [events],
  )
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1
  const answeredCount = useMemo(
    () =>
      frontendQuestions.filter((question) => {
        const answer = answers[question.id]

        return Boolean(answer?.trim())
      }).length,
    [answers],
  )
  const answerProgress = Math.round((answeredCount / totalQuestions) * 100)
  const visibleViolationCount = Math.min(events.length, LOCK_VIOLATION_THRESHOLD)
  const assessmentStatus = isLocked
    ? 'Locked for review'
    : events.length > 0
      ? 'Flagged'
      : 'Clean'
  const setupCameraError = !isStarted ? cameraError ?? cameraStartError : null
  const showCameraPreview =
    cameraHasBeenRequested &&
    !isSubmitted &&
    lockedAction === 'active' &&
    cameraStatus !== 'stopped'
  const faceVisibleLabel =
    facePresenceStatus === 'visible'
      ? 'Yes'
      : facePresenceStatus === 'not-visible'
        ? 'No'
        : 'Checking'
  const cameraViewLabel =
    obstructionState === 'clear'
      ? 'Clear'
      : obstructionState === 'obstructed' ||
          obstructionState === 'recovering'
        ? 'Obstructed'
        : 'Checking'
  const violationState =
    visibleViolationCount >= LOCK_VIOLATION_THRESHOLD
      ? 'locked'
      : visibleViolationCount >= 3
        ? 'danger'
        : visibleViolationCount >= 1
          ? 'warning'
          : 'clean'

  useEffect(() => {
    if (!isStarted || isFrozen || isSubmitted) {
      return
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timerId)
          terminalCameraCleanupStartedRef.current = true
          void stopCamera(true)
          setIsSubmitted(true)
          return 0
        }

        return currentSeconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isFrozen, isStarted, isSubmitted, stopCamera])

  useEffect(() => {
    const isAssessmentRunning =
      isStarted && !isSubmitted && !isLocked && lockedAction === 'active'

    if (!isAssessmentRunning) {
      return
    }

    if (cameraStatus === 'active') {
      reportedCameraInterruptionRef.current = false
      return
    }

    if (
      cameraStatus === 'interrupted' &&
      !reportedCameraInterruptionRef.current
    ) {
      reportedCameraInterruptionRef.current = true
      recordExternalViolation(
        'camera-lost',
        cameraError ?? 'Camera access was interrupted during the assessment.',
      )
    }
  }, [
    cameraError,
    cameraStatus,
    isLocked,
    isStarted,
    isSubmitted,
    lockedAction,
    recordExternalViolation,
  ])

  useEffect(() => {
    const isAssessmentRunning =
      isStarted && !isSubmitted && !isLocked && lockedAction === 'active'

    if (!isAssessmentRunning) {
      return
    }

    if (
      isCameraObstructed &&
      !reportedCameraObstructionRef.current
    ) {
      reportedCameraObstructionRef.current = true
      void captureFrame('camera-obstructed')
      recordExternalViolation(
        'camera-obstructed',
        'Camera frames remained dark, uniform, or low-detail while no face was visible.',
      )
      return
    }

    if (!isCameraObstructed && obstructionState === 'clear') {
      reportedCameraObstructionRef.current = false
    }
  }, [
    captureFrame,
    isCameraObstructed,
    isLocked,
    isStarted,
    isSubmitted,
    lockedAction,
    obstructionState,
    recordExternalViolation,
  ])

  useEffect(() => {
    if (!latestEvent || !isStarted) {
      return
    }

    if (capturedViolationEvidenceRef.current.has(latestEvent.id)) {
      return
    }

    capturedViolationEvidenceRef.current.add(latestEvent.id)
    if (latestEvent.type !== 'camera-obstructed') {
      void captureFrame(
        violationCaptureReasons[latestEvent.type],
        latestEvent.id,
      )
    }
  }, [captureFrame, isStarted, latestEvent])

  useEffect(() => {
    if (
      (isLocked || lockedAction === 'closed') &&
      !terminalCameraCleanupStartedRef.current
    ) {
      terminalCameraCleanupStartedRef.current = true
      void stopCamera(isLocked)
    }
  }, [isLocked, lockedAction, stopCamera])

  useEffect(
    () => () => {
      void stopCamera(false)
    },
    [stopCamera],
  )

  const updateAnswer = (answer: string) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: answer,
    }))
  }

  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex((index) => Math.max(index - 1, 0))
  }

  const goToNextQuestion = () => {
    setCurrentQuestionIndex((index) => Math.min(index + 1, totalQuestions - 1))
  }

  const beginAssessment = async () => {
    if (isStartingAssessment) {
      return
    }

    setCameraHasBeenRequested(true)
    setCameraStartError(null)
    setIsStartingAssessment(true)

    if (!hasInitializedAssessmentSessionRef.current) {
      try {
        await clearEvidence()
        hasInitializedAssessmentSessionRef.current = true
        capturedViolationEvidenceRef.current.clear()
        reportedCameraObstructionRef.current = false
        reportedCameraInterruptionRef.current = false
        terminalCameraCleanupStartedRef.current = false
      } catch {
        setCameraStartError(
          'Camera evidence storage could not be prepared in this browser.',
        )
        setIsStartingAssessment(false)
        return
      }
    }

    const didStartCamera = await startCamera()

    setIsStartingAssessment(false)

    if (!didStartCamera) {
      setCameraStartError(
        'Camera access is required before the assessment can begin.',
      )
      return
    }

    startTest()
  }

  const submitTest = async () => {
    terminalCameraCleanupStartedRef.current = true
    await stopCamera(true)
    setIsSubmitted(true)
  }

  const resumeAssessment = () => {
    const shouldRequireCamera =
      isStarted && !isSubmitted && !isLocked && lockedAction === 'active'

    if (shouldRequireCamera && cameraStatus !== 'active') {
      setCameraReconnectError(
        'Please enable and reconnect your camera before continuing.',
      )
      recordExternalViolation(
        'camera-lost',
        cameraError ?? 'Camera access is unavailable during the assessment.',
      )
      return
    }

    if (
      shouldRequireCamera &&
      (isCameraObstructed ||
        obstructionState === 'obstructed' ||
        obstructionState === 'recovering' ||
        obstructionState === 'suspected')
    ) {
      setCameraObstructionError(
        'Your camera view is still blocked or unclear. Please uncover and correctly position the camera before continuing.',
      )
      recordExternalViolation(
        'camera-obstructed',
        'Camera view was still obstructed when the candidate attempted to resume.',
      )
      return
    }

    resumeTest()
  }

  const checkCameraAndResumeTest = async () => {
    if (isCheckingCamera) {
      return
    }

    setIsCheckingCamera(true)
    setCameraObstructionError(null)

    const video = videoRef.current
    const cameraIsReady =
      cameraStatus === 'active' &&
      Boolean(video && video.videoWidth > 0 && video.videoHeight > 0)

    if (!cameraIsReady) {
      setCameraReconnectError(
        'Please enable and reconnect your camera before continuing.',
      )
      setIsCheckingCamera(false)
      return
    }

    const cameraViewIsClear =
      !isCameraObstructed && obstructionState === 'clear'

    if (!cameraViewIsClear) {
      setCameraObstructionError(
        'Your camera view is still blocked or unclear. Please uncover and correctly position the camera before continuing.',
      )
      setIsCheckingCamera(false)
      return
    }

    setIsCheckingCamera(false)
    resumeTest()
  }

  const reconnectAndResumeTest = async () => {
    if (isHandlingCameraReconnect) {
      return
    }

    setCameraReconnectError(null)
    setIsHandlingCameraReconnect(true)

    const didReconnect = await reconnectCamera()

    setIsHandlingCameraReconnect(false)

    if (!didReconnect) {
      setCameraReconnectError(
        'Please enable and reconnect your camera before continuing.',
      )
      return
    }

    setCameraObstructionError(null)
    resumeTest()
  }

  const copyProctoringReport = async () => {
    const reportLines = [
      'ZenHire Proctoring Report',
      `Candidate: ${candidate.name}`,
      `Email: ${candidate.email}`,
      `Assessment ID: ${ASSESSMENT_ID}`,
      `Assessment status: ${assessmentStatus}`,
      `Total questions: ${totalQuestions}`,
      `Answered questions: ${answeredCount}`,
      `Total violations: ${events.length}`,
      `Critical violations: ${criticalViolations}`,
      '',
      'Events:',
      ...events.map(
        (event) =>
          `${event.occurredAt} | ${event.severity.toUpperCase()} | ${event.label} | ${event.message}`,
      ),
    ]

    try {
      await navigator.clipboard.writeText(reportLines.join('\n'))
      setCopiedReport(true)
      window.setTimeout(() => setCopiedReport(false), 1800)
    } catch {
      setCopiedReport(false)
    }
  }

  const renderStepDots = (activeIndex: number) => (
    <div className="step-dots" aria-label="Assessment setup progress">
      {[0, 1, 2, 3].map((stepIndex) => (
        <span
          className={stepIndex === activeIndex ? 'step-dot step-dot--active' : 'step-dot'}
          key={stepIndex}
        />
      ))}
    </div>
  )

  if (lockedAction === 'closed') {
    return (
      <div className="assessment-shell">
        <main className="closed-page">
          <div className="closed-page-content">
            <section className="closed-card">
              <p className="eyebrow">Assessment closed</p>
              <h1>Assessment closed.</h1>
              <p>You may now exit this page.</p>
            </section>
            <CameraEvidenceGallery
              evidence={evidence}
              onClearEvidence={clearEvidence}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div
      className={`assessment-shell ${isFrozen ? 'assessment-shell--frozen' : ''}`}
      ref={assessmentRef}
    >
      <div className="assessment-content">
      <header className={`top-bar ${isStarted ? 'top-bar--test' : 'top-bar--setup'}`}>
        <div className="assessment-title-block">
          <span className="assessment-icon" aria-hidden="true">
            A/B
          </span>
          <div>
            <p className="brand">ZenHire.ai</p>
            <h1>Frontend Engineer Assessment</h1>
            <span>Assessment</span>
          </div>
        </div>
        <div className="top-actions">
          <span className={`status-pill status-pill--${status}`}>
            {statusLabels[status]}
          </span>
          {isStarted ? (
            <span
              className={`status-pill ${
                isSecureMode ? 'status-pill--active' : 'status-pill--frozen'
              }`}
            >
              {isSecureMode ? 'Secure mode' : 'Resize detected'}
            </span>
          ) : null}
          {!isStarted ? (
            <button
              className="language-button"
              type="button"
            >
              English
            </button>
          ) : null}
        </div>
      </header>

      {!isStarted && preTestStep === 'start' ? (
        <main className="start-layout">
          <section className="start-hero" aria-label="Application progress">
            <div className="flag-illustration" aria-hidden="true">
              <span className="flag-pole" />
              <span className="flag-cloth" />
              <span className="check-badge">OK</span>
            </div>
            <h2>Thank you for applying for this position!</h2>
            <p>
              You have reached the <strong>second step</strong> of the hiring
              process.
            </p>
          </section>

          <section className="start-card">
            <h2>Continue with assessment now?</h2>
            <button
              className="primary-button primary-button--wide"
              onClick={() => setPreTestStep('welcome')}
              type="button"
            >
              Start Now
            </button>

            <div className="start-divider">or</div>

            <h3>Start later</h3>
            <div className="start-later-grid">
              <div>
                <span className="start-mini-icon">7d</span>
                <p>You can start anytime in the next 7 days</p>
              </div>
              <div>
                <span className="start-mini-icon">Mail</span>
                <p>Click Start Assessment from your latest email</p>
              </div>
            </div>
          </section>
        </main>
      ) : !isStarted && preTestStep === 'welcome' ? (
        <main className="setup-page">
          <section className="setup-card">
            {renderStepDots(0)}
            <h2>Welcome!</h2>
            <div className="intro-chips">
              <span>{formatTime(TEST_DURATION_SECONDS)} to complete</span>
              <span>{totalQuestions} questions</span>
            </div>
            <p>
              Your task is to complete a Frontend Engineer assessment covering
              React, TypeScript, JavaScript, HTML/CSS, and practical
              problem-solving. Read each question carefully and choose the best
              answer, or provide a short written response where requested.
            </p>
            <ol className="instruction-list">
              <li>Keep your browser in secure maximized mode during the test.</li>
              <li>Use the question navigator to move between questions.</li>
              <li>Your answers are saved locally as you move through the test.</li>
            </ol>
            {proctoringError ? (
              <p className="inline-error" role="alert">
                {proctoringError}
              </p>
            ) : null}

            <div className="floating-setup-actions">
              <button
                className="primary-button"
                onClick={() => setPreTestStep('rules')}
                type="button"
              >
                Next
              </button>
            </div>
          </section>
        </main>
      ) : !isStarted && preTestStep === 'rules' ? (
        <main className="setup-page">
          <section className="setup-card setup-card--rules">
            {renderStepDots(3)}
            <h2>No cheating!</h2>

            <div className="rule-list">
              <div className="rule-item">
                <span className="rule-icon rule-icon--danger" aria-hidden="true">
                  !
                </span>
                <p>
                  Any cheating attempts will be detected and may result in
                  immediate disqualification.
                </p>
              </div>
              <div className="rule-item">
                <span className="rule-icon rule-icon--calm" aria-hidden="true">
                  OK
                </span>
                <p>Please complete the test honestly and to the best of your abilities.</p>
              </div>
            </div>

            <p className="best-effort-note">
              Camera images in this prototype are stored temporarily in the
              browser and are not uploaded.
            </p>

            {setupCameraError ? (
              <p className="inline-error" role="alert">
                {setupCameraError}
              </p>
            ) : null}

            {setupCameraError ? (
              <button
                className="secondary-button camera-retry-button"
                disabled={isStartingAssessment}
                onClick={() => {
                  void beginAssessment()
                }}
                type="button"
              >
                Retry Camera
              </button>
            ) : null}

            <div className="floating-setup-actions floating-setup-actions--split">
              <button
                className="secondary-button"
                onClick={() => setPreTestStep('welcome')}
                type="button"
              >
                Previous
              </button>
              <button
                className="primary-button"
                disabled={isStartingAssessment}
                onClick={() => {
                  void beginAssessment()
                }}
                type="button"
              >
                {isStartingAssessment ? 'Requesting camera...' : 'Next'}
              </button>
            </div>
          </section>
        </main>
      ) : isSubmitted ? (
        <main className="completion-page">
          <section className="completion-card">
          <span className="completion-icon" aria-hidden="true">
              OK
            </span>
            <p className="eyebrow">Submission complete</p>
            <h2>Assessment submitted</h2>
            <p>
              Thank you. This demo records the candidate answers locally and
              shows a submission summary without sending data to a backend.
            </p>

            <dl className="summary-grid">
              <div>
                <dt>Total questions</dt>
                <dd>{totalQuestions}</dd>
              </div>
              <div>
                <dt>Answered questions</dt>
                <dd>{answeredCount}</dd>
              </div>
              <div>
                <dt>Violations recorded</dt>
                <dd>
                  {events.length} / {LOCK_VIOLATION_THRESHOLD}
                </dd>
              </div>
              <div>
                <dt>Critical violations</dt>
                <dd>{criticalViolations}</dd>
              </div>
              <div>
                <dt>Assessment status</dt>
                <dd>{assessmentStatus}</dd>
              </div>
              <div>
                <dt>Time remaining</dt>
                <dd>{formatTime(remainingSeconds)}</dd>
              </div>
            </dl>

            <button
              className="primary-button copy-report-button"
              onClick={() => {
                void copyProctoringReport()
              }}
              type="button"
            >
              {copiedReport ? 'Proctoring report copied' : 'Copy Proctoring Report'}
            </button>
          </section>

          <section className="completion-log">
            <EventLog events={events} />
          </section>

          <CameraEvidenceGallery
            evidence={evidence}
            onClearEvidence={clearEvidence}
          />
        </main>
      ) : (
        <main className="test-page">
          <div className="test-progress-shell">
            <div className="progress-track progress-track--large">
              <span style={{ width: `${answerProgress}%` }} />
            </div>
            <span>
              {currentQuestionIndex + 1} out of {totalQuestions} question
            </span>
          </div>

          <section
            aria-label="Assessment monitoring"
            className="test-monitoring-section"
          >
            <div className="monitoring-overview">
              <div className="test-info-row">
                <div className="monitoring-stat monitoring-stat--time">
                  <span>Time remaining</span>
                  <strong className="timer">
                    {formatTime(remainingSeconds)}
                  </strong>
                </div>
                <div className="monitoring-stat">
                  <span>Violations</span>
                  <strong
                    className={`violation-chip violation-chip--${violationState}`}
                  >
                    {visibleViolationCount} / {LOCK_VIOLATION_THRESHOLD}
                  </strong>
                </div>
                <div className="monitoring-stat">
                  <span>Browser security</span>
                  <strong
                    className={`secure-mode-chip ${
                      isSecureMode ? '' : 'secure-mode-chip--warning'
                    }`}
                  >
                    {isSecureMode ? 'Secure mode active' : 'Secure mode required'}
                  </strong>
                </div>
                <div className="monitoring-stat">
                  <span>Camera</span>
                  <strong className="camera-summary-value">
                    {cameraStatusLabels[cameraStatus]}
                  </strong>
                </div>
              </div>

              <section
                aria-labelledby="camera-monitoring-title"
                className="camera-monitoring-card"
              >
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Live monitor</p>
                    <h2 id="camera-monitoring-title">Camera Monitoring</h2>
                  </div>
                  <span className={`status-pill status-pill--${status}`}>
                    {statusLabels[status]}
                  </span>
                </div>

                <dl className="monitor-list camera-monitoring-list">
                  <div>
                    <dt>Camera status</dt>
                    <dd>{cameraStatusLabels[cameraStatus]}</dd>
                  </div>
                  <div>
                    <dt>Face visible</dt>
                    <dd>{faceVisibleLabel}</dd>
                  </div>
                  <div>
                    <dt>Camera view</dt>
                    <dd>{cameraViewLabel}</dd>
                  </div>
                  <div>
                    <dt>Stored captures</dt>
                    <dd>{evidenceCount}</dd>
                  </div>
                  <div>
                    <dt>Last capture</dt>
                    <dd>
                      {lastCapture
                        ? formatEvidenceTime(lastCapture.capturedAt)
                        : 'None'}
                    </dd>
                  </div>
                  <div>
                    <dt>Last capture reason</dt>
                    <dd>
                      {lastCapture
                        ? cameraCaptureReasonLabels[lastCapture.reason]
                        : 'None'}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {showCameraPreview ? (
              <div className="test-camera-column">
                <CameraPreview
                  cameraError={cameraError}
                  cameraStatus={cameraStatus}
                  obstructionState={obstructionState}
                  videoRef={videoRef}
                />
              </div>
            ) : null}
          </section>

          <section className="test-workbench">
            <div className="workspace">
              <QuestionCard
                answer={currentAnswer}
                disabled={isFrozen}
                onAnswerChange={updateAnswer}
                question={currentQuestion}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={totalQuestions}
              />

              <div className="question-actions">
                <button
                  className="secondary-button"
                  disabled={isFrozen || currentQuestionIndex === 0}
                  onClick={goToPreviousQuestion}
                  type="button"
                >
                  Back
                </button>
                {isLastQuestion ? (
                  <button
                    className="primary-button"
                    disabled={isFrozen}
                    onClick={submitTest}
                    type="button"
                  >
                    Submit Test
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={isFrozen}
                    onClick={goToNextQuestion}
                    type="button"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>

            <aside className="navigator-panel" aria-label="Question navigator">
              <div className="navigator-heading">
                <p className="eyebrow">Navigator</p>
                <h2>Questions</h2>
              </div>
              <div className="question-number-grid">
                {frontendQuestions.map((question, index) => {
                  const isAnswered = Boolean(answers[question.id]?.trim())
                  const isCurrent = index === currentQuestionIndex

                  return (
                    <button
                      className={`question-number ${
                        isCurrent ? 'question-number--current' : ''
                      } ${isAnswered ? 'question-number--answered' : ''}`}
                      disabled={isFrozen}
                      key={question.id}
                      onClick={() => setCurrentQuestionIndex(index)}
                      type="button"
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>

              <div className="navigator-meta">
                <div>
                  <span>{answeredCount}</span>
                  <p>Answered</p>
                </div>
                <div className={`navigator-stat navigator-stat--${violationState}`}>
                  <span>
                    {visibleViolationCount}/{LOCK_VIOLATION_THRESHOLD}
                  </span>
                  <p>Violations</p>
                </div>
              </div>
            </aside>
          </section>

          <div className="proctoring-activity-card">
            <EventLog events={events} />
          </div>
        </main>
      )}
      </div>

      <WarningOverlay
        cameraObstructionError={cameraObstructionError}
        cameraReconnectError={cameraReconnectError}
        event={latestEvent}
        isCheckingCamera={isCheckingCamera}
        isCameraReconnecting={
          isHandlingCameraReconnect || cameraStatus === 'reconnecting'
        }
        isLocked={isLocked}
        isOpen={isFrozen}
        lockedEvidenceContent={
          isLocked ? (
            <CameraEvidenceGallery
              collapsible
              evidence={evidence}
              onClearEvidence={clearEvidence}
            />
          ) : null
        }
        onCloseAssessment={() => setLockedAction('closed')}
        onContactRecruiter={() => setLockedAction('contact')}
        onCheckCamera={checkCameraAndResumeTest}
        onReconnectCamera={reconnectAndResumeTest}
        onResume={resumeAssessment}
        proctoringError={proctoringError}
        requiresCameraCheck={
          Boolean(cameraObstructionError) || isCameraObstructed
        }
        requiresCameraReconnect={Boolean(cameraReconnectError)}
        showRecruiterContact={lockedAction === 'contact'}
      />
    </div>
  )
}

export default TestScreen
