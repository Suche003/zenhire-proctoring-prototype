import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  VIOLATION_COPY,
  type ProctoringEvent,
  type ProctoringStatus,
  type ViolationType,
} from '../types/proctoring'

type SecureModeCheck = {
  details: string
  isSecure: boolean
}

type UseProctoringResult = {
  assessmentRef: RefObject<HTMLDivElement | null>
  events: ProctoringEvent[]
  isFrozen: boolean
  isLocked: boolean
  isSecureMode: boolean
  isStarted: boolean
  latestEvent: ProctoringEvent | null
  proctoringError: string | null
  resumeTest: () => void
  startTest: () => void
  status: ProctoringStatus
}

const SECURE_WIDTH_RATIO = 0.92
const SECURE_HEIGHT_RATIO = 0.85
const LOCK_VIOLATION_THRESHOLD = 4
const SCREENSHOT_SUPPRESSION_MS = 1000
const VIOLATION_COOLDOWN_MS = 2000

const violationPriority: Record<ViolationType, number> = {
  'focus-loss': 2,
  'tab-hidden': 2,
  'window-resize': 1,
  'screenshot-attempt': 3,
}

const getSecureModeCheck = (): SecureModeCheck => {
  const outerWidth = window.outerWidth
  const outerHeight = window.outerHeight
  const availableWidth = window.screen.availWidth
  const availableHeight = window.screen.availHeight
  const isSecure =
    outerWidth >= availableWidth * SECURE_WIDTH_RATIO &&
    outerHeight >= availableHeight * SECURE_HEIGHT_RATIO

  return {
    isSecure,
    details: `Window ${outerWidth}x${outerHeight}; available screen ${availableWidth}x${availableHeight}.`,
  }
}

const createEventId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useProctoring(): UseProctoringResult {
  const assessmentRef = useRef<HTMLDivElement | null>(null)
  const [events, setEvents] = useState<ProctoringEvent[]>([])
  const [isFrozen, setIsFrozen] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isSecureMode, setIsSecureMode] = useState(
    () => getSecureModeCheck().isSecure,
  )
  const [isStarted, setIsStarted] = useState(false)
  const [latestEvent, setLatestEvent] = useState<ProctoringEvent | null>(null)
  const [proctoringError, setProctoringError] = useState<string | null>(null)

  const hasStartedRef = useRef(false)
  const activeWarningTypeRef = useRef<ViolationType | null>(null)
  const isLockedRef = useRef(false)
  const lastScreenshotAttemptAtRef = useRef(0)
  const totalViolationCountRef = useRef(0)
  const lastViolationByTypeRef = useRef<Partial<Record<ViolationType, number>>>(
    {},
  )
  const violationCountsByTypeRef = useRef<
    Partial<Record<ViolationType, number>>
  >({})
  const resizeTimerRef = useRef<number | null>(null)

  const checkSecureMode = useCallback(() => {
    const secureModeCheck = getSecureModeCheck()

    setIsSecureMode(secureModeCheck.isSecure)
    return secureModeCheck
  }, [])

  const recordViolation = useCallback(
    (type: ViolationType, details?: string) => {
      if (!hasStartedRef.current) {
        return
      }

      if (isLockedRef.current) {
        return
      }

      const now = Date.now()
      const activeWarningType = activeWarningTypeRef.current
      const lastViolationAt = lastViolationByTypeRef.current[type] ?? 0
      const screenshotRecentlyDetected =
        now - lastScreenshotAttemptAtRef.current < SCREENSHOT_SUPPRESSION_MS

      if (type === 'screenshot-attempt') {
        lastScreenshotAttemptAtRef.current = now
      }

      if (type !== 'screenshot-attempt' && screenshotRecentlyDetected) {
        return
      }

      if (
        activeWarningType &&
        violationPriority[type] <= violationPriority[activeWarningType]
      ) {
        return
      }

      if (now - lastViolationAt < VIOLATION_COOLDOWN_MS) {
        return
      }

      lastViolationByTypeRef.current[type] = now
      activeWarningTypeRef.current = type
      setProctoringError(null)

      const copy = VIOLATION_COPY[type]
      const occurrence = (violationCountsByTypeRef.current[type] ?? 0) + 1
      const isRepeated = occurrence > 1
      const repeatedMessage = isRepeated
        ? ' This is a repeated violation. Continued behavior may lead to assessment lock.'
        : ''
      const nextTotalViolationCount = totalViolationCountRef.current + 1
      const event: ProctoringEvent = {
        buttonLabel: copy.buttonLabel,
        id: createEventId(),
        type,
        label: copy.label,
        message: `${copy.message}${repeatedMessage}`,
        occurredAt: new Date(now).toISOString(),
        severity: copy.severity,
        warningTitle: copy.warningTitle,
        isRepeated,
        occurrence,
        details,
      }

      violationCountsByTypeRef.current[type] = occurrence
      totalViolationCountRef.current = nextTotalViolationCount
      setLatestEvent(event)
      setIsFrozen(true)
      setEvents((currentEvents) => [event, ...currentEvents])

      if (nextTotalViolationCount >= LOCK_VIOLATION_THRESHOLD) {
        isLockedRef.current = true
        setIsLocked(true)
      }
    },
    [],
  )

  const startTest = useCallback(() => {
    setProctoringError(null)
    hasStartedRef.current = true
    setIsStarted(true)
    setIsFrozen(false)
    setIsLocked(false)
    setLatestEvent(null)
    activeWarningTypeRef.current = null
    isLockedRef.current = false
    lastViolationByTypeRef.current = {}
    totalViolationCountRef.current = 0
    violationCountsByTypeRef.current = {}

    const secureModeCheck = checkSecureMode()

    if (!secureModeCheck.isSecure) {
      recordViolation('window-resize', secureModeCheck.details)
    }
  }, [checkSecureMode, recordViolation])

  const resumeTest = useCallback(() => {
    if (isLocked) {
      return
    }

    setProctoringError(null)

    const secureModeCheck = checkSecureMode()

    if (!secureModeCheck.isSecure) {
      setProctoringError('Please maximize your browser window before continuing.')
      return
    }

    setIsFrozen(false)
    setLatestEvent(null)
    activeWarningTypeRef.current = null
  }, [checkSecureMode, isLocked])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordViolation(
          'tab-hidden',
          'The document visibility state changed to hidden.',
        )
      }
    }

    const handleBlur = () => {
      if (
        Date.now() - lastScreenshotAttemptAtRef.current <
        SCREENSHOT_SUPPRESSION_MS
      ) {
        return
      }

      recordViolation('focus-loss', 'The browser window emitted a blur event.')
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const code = event.code.toLowerCase()
      const isPrintScreen =
        event.key === 'PrintScreen' || event.code === 'PrintScreen'
      const isSnippingShortcut =
        key === 's' && event.shiftKey && (event.metaKey || event.ctrlKey)
      const isMacScreenshotShortcut =
        event.metaKey &&
        event.shiftKey &&
        (['3', '4', '5'].includes(key) ||
          ['digit3', 'digit4', 'digit5'].includes(code))

      if (isPrintScreen || isSnippingShortcut || isMacScreenshotShortcut) {
        event.preventDefault()
        lastScreenshotAttemptAtRef.current = Date.now()
        recordViolation(
          'screenshot-attempt',
          'Detected a PrintScreen or screenshot shortcut key event. Browser-level screenshot detection is best-effort.',
        )
      }
    }

    const handleResize = () => {
      if (!hasStartedRef.current) {
        return
      }

      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }

      resizeTimerRef.current = window.setTimeout(() => {
        if (!hasStartedRef.current) {
          return
        }

        const secureModeCheck = checkSecureMode()

        if (!secureModeCheck.isSecure) {
          recordViolation('window-resize', secureModeCheck.details)
        }
      }, 300)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)

      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }
    }
  }, [checkSecureMode, recordViolation])

  const status = useMemo<ProctoringStatus>(() => {
    if (!isStarted) {
      return 'idle'
    }

    return isFrozen ? 'frozen' : 'active'
  }, [isFrozen, isStarted])

  return {
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
  }
}
