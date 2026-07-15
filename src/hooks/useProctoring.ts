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

type SecureModeDiagnostics = {
  availableHeight: number
  availableWidth: number
  clientHeight: number
  clientWidth: number
  clientWidthRatio: number
  gapLooksMaximized: boolean
  heightGap: number
  innerHeight: number
  innerWidth: number
  innerWidthRatio: number
  outerHeight: number
  outerHeightRatio: number
  outerWidth: number
  outerWidthRatio: number
  ratioLooksMaximized: boolean
  viewportLooksSplit: boolean
  visualViewportHeight: number
  visualViewportWidth: number
  visualViewportWidthRatio: number
  widthGap: number
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
  recordExternalViolation: (type: ViolationType, details?: string) => void
  resumeTest: () => void
  startTest: () => void
  status: ProctoringStatus
}

const SECURE_WIDTH_RATIO = 0.84
const SECURE_HEIGHT_RATIO = 0.7
const SECURE_MAX_GAP_PX = 180
const SPLIT_SCREEN_WIDTH_RATIO = 0.72
const SECURE_DIAGNOSTIC_LOG_INTERVAL_MS = 2000
const SECURE_MODE_RECHECK_INTERVAL_MS = 1500
const LOCK_VIOLATION_THRESHOLD = 4
const SCREENSHOT_SUPPRESSION_MS = 1000
const VIOLATION_COOLDOWN_MS = 2000

const violationPriority: Record<ViolationType, number> = {
  'focus-loss': 2,
  'tab-hidden': 3,
  'window-resize': 4,
  'camera-lost': 5,
  'camera-obstructed': 5,
  'screenshot-attempt': 6,
}

let lastSecureModeDiagnosticsLoggedAt = 0

const logSecureModeDiagnostics = (diagnostics: SecureModeDiagnostics) => {
  const now = Date.now()

  if (
    now - lastSecureModeDiagnosticsLoggedAt <
    SECURE_DIAGNOSTIC_LOG_INTERVAL_MS
  ) {
    return
  }

  lastSecureModeDiagnosticsLoggedAt = now

  console.warn('Secure maximized browser mode check failed', {
    'window.outerWidth': diagnostics.outerWidth,
    'window.outerHeight': diagnostics.outerHeight,
    'window.innerWidth': diagnostics.innerWidth,
    'window.innerHeight': diagnostics.innerHeight,
    'document.documentElement.clientWidth': diagnostics.clientWidth,
    'document.documentElement.clientHeight': diagnostics.clientHeight,
    'window.visualViewport.width': diagnostics.visualViewportWidth,
    'window.visualViewport.height': diagnostics.visualViewportHeight,
    'screen.availWidth': diagnostics.availableWidth,
    'screen.availHeight': diagnostics.availableHeight,
    outerWidthRatio: diagnostics.outerWidthRatio,
    outerHeightRatio: diagnostics.outerHeightRatio,
    innerWidthRatio: diagnostics.innerWidthRatio,
    clientWidthRatio: diagnostics.clientWidthRatio,
    visualViewportWidthRatio: diagnostics.visualViewportWidthRatio,
    widthGap: diagnostics.widthGap,
    heightGap: diagnostics.heightGap,
    ratioLooksMaximized: diagnostics.ratioLooksMaximized,
    gapLooksMaximized: diagnostics.gapLooksMaximized,
    viewportLooksSplit: diagnostics.viewportLooksSplit,
    'navigator.userAgent': navigator.userAgent,
  })
}

const getSecureModeCheck = (): SecureModeCheck => {
  const outerWidth = window.outerWidth
  const outerHeight = window.outerHeight
  const innerWidth = window.innerWidth
  const innerHeight = window.innerHeight
  const clientWidth = document.documentElement.clientWidth
  const clientHeight = document.documentElement.clientHeight
  const visualViewportWidth = window.visualViewport?.width ?? innerWidth
  const visualViewportHeight = window.visualViewport?.height ?? innerHeight
  const availableWidth = window.screen.availWidth
  const availableHeight = window.screen.availHeight
  const outerWidthRatio = outerWidth / availableWidth
  const outerHeightRatio = outerHeight / availableHeight
  const innerWidthRatio = innerWidth / availableWidth
  const clientWidthRatio = clientWidth / availableWidth
  const visualViewportWidthRatio = visualViewportWidth / availableWidth
  const widthGap = availableWidth - outerWidth
  const heightGap = availableHeight - outerHeight
  const ratioLooksMaximized =
    outerWidthRatio >= SECURE_WIDTH_RATIO &&
    outerHeightRatio >= SECURE_HEIGHT_RATIO
  const gapLooksMaximized =
    widthGap <= SECURE_MAX_GAP_PX && heightGap <= SECURE_MAX_GAP_PX
  const viewportLooksSplit =
    innerWidthRatio < SPLIT_SCREEN_WIDTH_RATIO ||
    clientWidthRatio < SPLIT_SCREEN_WIDTH_RATIO ||
    visualViewportWidthRatio < SPLIT_SCREEN_WIDTH_RATIO
  const isSecure =
    (ratioLooksMaximized || gapLooksMaximized) && !viewportLooksSplit
  const diagnostics: SecureModeDiagnostics = {
    availableHeight,
    availableWidth,
    clientHeight,
    clientWidth,
    clientWidthRatio,
    gapLooksMaximized,
    heightGap,
    innerHeight,
    innerWidth,
    innerWidthRatio,
    outerHeight,
    outerHeightRatio,
    outerWidth,
    outerWidthRatio,
    ratioLooksMaximized,
    viewportLooksSplit,
    visualViewportHeight,
    visualViewportWidth,
    visualViewportWidthRatio,
    widthGap,
  }

  if (!isSecure) {
    logSecureModeDiagnostics(diagnostics)
  }

  const viewportFailureDetails = viewportLooksSplit
    ? 'Assessment viewport is reduced. Browser split-screen, split-tab, side panel, or resized mode may be active. '
    : ''

  return {
    isSecure,
    details: `${viewportFailureDetails}Window ${outerWidth}x${outerHeight}; viewport ${innerWidth}x${innerHeight}; client ${clientWidth}x${clientHeight}; visual viewport ${visualViewportWidth.toFixed(
      0,
    )}x${visualViewportHeight.toFixed(
      0,
    )}; available screen ${availableWidth}x${availableHeight}; outer ratios ${outerWidthRatio.toFixed(
      2,
    )}x${outerHeightRatio.toFixed(
      2,
    )}; viewport width ratios ${innerWidthRatio.toFixed(
      2,
    )}/${clientWidthRatio.toFixed(
      2,
    )}/${visualViewportWidthRatio.toFixed(
      2,
    )}; gaps ${widthGap}x${heightGap}px.`,
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

  const forceWindowResizeWarning = useCallback((details?: string) => {
    if (!hasStartedRef.current) {
      return
    }

    if (isLockedRef.current) {
      return
    }

    const type: ViolationType = 'window-resize'
    const now = Date.now()
    const lastViolationAt = lastViolationByTypeRef.current[type] ?? 0
    const shouldCountViolation = now - lastViolationAt >= VIOLATION_COOLDOWN_MS
    const currentOccurrence = violationCountsByTypeRef.current[type] ?? 0
    const occurrence = shouldCountViolation
      ? currentOccurrence + 1
      : Math.max(currentOccurrence, 1)
    const isRepeated = occurrence > 1
    const repeatedMessage = isRepeated
      ? ' This is a repeated violation. Continued behavior may lead to assessment lock.'
      : ''
    const copy = VIOLATION_COPY[type]
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

    activeWarningTypeRef.current = type
    setIsFrozen(true)
    setLatestEvent(event)

    if (!shouldCountViolation) {
      return
    }

    lastViolationByTypeRef.current[type] = now
    violationCountsByTypeRef.current[type] = occurrence

    const nextTotalViolationCount = totalViolationCountRef.current + 1

    totalViolationCountRef.current = nextTotalViolationCount
    setEvents((currentEvents) => [event, ...currentEvents])

    if (nextTotalViolationCount >= LOCK_VIOLATION_THRESHOLD) {
      isLockedRef.current = true
      setIsLocked(true)
    }
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

      if (
        type !== 'screenshot-attempt' &&
        type !== 'camera-lost' &&
        type !== 'camera-obstructed' &&
        screenshotRecentlyDetected
      ) {
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

  const recordExternalViolation = useCallback(
    (type: ViolationType, details?: string) => {
      recordViolation(type, details)
    },
    [recordViolation],
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
      forceWindowResizeWarning(secureModeCheck.details)
    }
  }, [checkSecureMode, forceWindowResizeWarning])

  const resumeTest = useCallback(() => {
    if (isLocked) {
      return
    }

    setProctoringError(null)

    const secureModeCheck = checkSecureMode()

    if (!secureModeCheck.isSecure) {
      setProctoringError(
        'Please maximize your browser window and close any split-screen or split-tab view before continuing.',
      )

      if (activeWarningTypeRef.current !== 'window-resize') {
        forceWindowResizeWarning(secureModeCheck.details)
      }

      return
    }

    setIsFrozen(false)
    setLatestEvent(null)
    activeWarningTypeRef.current = null
  }, [checkSecureMode, forceWindowResizeWarning, isLocked])

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
          forceWindowResizeWarning(secureModeCheck.details)
        }
      }, 300)
    }

    const secureModeIntervalId = window.setInterval(() => {
      if (!hasStartedRef.current) {
        return
      }

      if (isLockedRef.current) {
        return
      }

      const secureModeCheck = checkSecureMode()

      if (!secureModeCheck.isSecure) {
        forceWindowResizeWarning(secureModeCheck.details)
      }
    }, SECURE_MODE_RECHECK_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.clearInterval(secureModeIntervalId)

      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }
    }
  }, [checkSecureMode, forceWindowResizeWarning, recordViolation])

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
    recordExternalViolation,
    resumeTest,
    startTest,
    status,
  }
}
