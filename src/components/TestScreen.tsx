import { useEffect, useMemo, useState } from 'react'
import EventLog from './EventLog'
import QuestionCard from './QuestionCard'
import WarningOverlay from './WarningOverlay'
import { frontendQuestions } from '../data/frontendQuestions'
import { useProctoring } from '../hooks/useProctoring'
import type { AnswerMap } from '../types/assessment'

type PreTestStep = 'start' | 'welcome' | 'rules'

const statusLabels = {
  idle: 'Ready',
  active: 'In progress',
  frozen: 'Paused',
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

function TestScreen() {
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [copiedReport, setCopiedReport] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [lockedAction, setLockedAction] = useState<'active' | 'closed' | 'contact'>(
    'active',
  )
  const [preTestStep, setPreTestStep] = useState<PreTestStep>('start')
  const [remainingSeconds, setRemainingSeconds] = useState(TEST_DURATION_SECONDS)
  const {
    assessmentRef,
    events,
    isFrozen,
    isLocked,
    isSecureMode,
    isStarted,
    latestEvent,
    proctoringError,
    resumeTest,
    startTest,
    status,
  } = useProctoring()

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
          setIsSubmitted(true)
          return 0
        }

        return currentSeconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isFrozen, isStarted, isSubmitted])

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

  const submitTest = () => {
    setIsSubmitted(true)
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
          <section className="closed-card">
            <p className="eyebrow">Assessment closed</p>
            <h1>Assessment closed.</h1>
            <p>You may now exit this page.</p>
          </section>
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
                onClick={startTest}
                type="button"
              >
                Next
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

          <div className="test-info-row">
            <div className="timer" aria-label="Time remaining">
              {formatTime(remainingSeconds)}
            </div>
            <span>Time left to complete group</span>
            <span className={`violation-chip violation-chip--${violationState}`}>
              <strong>Violations</strong>
              <b>
                {visibleViolationCount} / {LOCK_VIOLATION_THRESHOLD}
              </b>
            </span>
            <span className={`secure-mode-chip ${isSecureMode ? '' : 'secure-mode-chip--warning'}`}>
              {isSecureMode ? 'Secure mode active' : 'Secure mode required'}
            </span>
          </div>

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
              <h2>Question</h2>
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

              <div className="proctoring-mini-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Live monitor</p>
                    <h2>Proctoring</h2>
                  </div>
                  <span className={`status-pill status-pill--${status}`}>
                    {statusLabels[status]}
                  </span>
                </div>

                <dl className="monitor-list">
                  <div>
                    <dt>Secure mode</dt>
                    <dd>{isSecureMode ? 'Maximized' : 'Needs attention'}</dd>
                  </div>
                  <div>
                    <dt>Test controls</dt>
                    <dd>{isFrozen ? 'Frozen' : 'Unlocked'}</dd>
                  </div>
                </dl>

                <EventLog events={events} />
              </div>
            </aside>
          </section>
        </main>
      )}
      </div>

      <WarningOverlay
        event={latestEvent}
        isLocked={isLocked}
        isOpen={isFrozen}
        onCloseAssessment={() => setLockedAction('closed')}
        onContactRecruiter={() => setLockedAction('contact')}
        onResume={resumeTest}
        proctoringError={proctoringError}
        showRecruiterContact={lockedAction === 'contact'}
      />
    </div>
  )
}

export default TestScreen
