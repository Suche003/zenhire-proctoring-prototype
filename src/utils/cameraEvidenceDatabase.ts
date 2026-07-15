import type { CameraEvidence } from '../types/cameraProctoring'

const DATABASE_NAME = 'zenhire-proctoring-prototype'
const DATABASE_VERSION = 1
const EVIDENCE_STORE_NAME = 'cameraEvidence'
const ASSESSMENT_INDEX_NAME = 'assessmentId'

export const MAX_CAMERA_EVIDENCE_PER_ASSESSMENT = 40

let databasePromise: Promise<IDBDatabase> | null = null

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const waitForTransaction = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })

const openEvidenceDatabase = () => {
  if (!('indexedDB' in window)) {
    return Promise.reject(
      new Error('IndexedDB is unavailable in this browser context.'),
    )
  }

  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(EVIDENCE_STORE_NAME)) {
        const store = database.createObjectStore(EVIDENCE_STORE_NAME, {
          keyPath: 'id',
        })
        store.createIndex(ASSESSMENT_INDEX_NAME, 'assessmentId', {
          unique: false,
        })
      }
    }

    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error)
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('Camera evidence database upgrade was blocked.'))
    }
  })

  return databasePromise
}

// This is frontend-only prototype storage. Production evidence would need
// encrypted backend storage, access control, consent, retention rules, and
// secure deletion.
export async function saveCameraEvidence(record: CameraEvidence) {
  const database = await openEvidenceDatabase()
  const transaction = database.transaction(
    EVIDENCE_STORE_NAME,
    'readwrite',
  )
  const completed = waitForTransaction(transaction)
  transaction.objectStore(EVIDENCE_STORE_NAME).put(record)
  await completed
  await trimCameraEvidence(
    record.assessmentId,
    MAX_CAMERA_EVIDENCE_PER_ASSESSMENT,
  )
}

export async function getCameraEvidence(assessmentId: string) {
  const database = await openEvidenceDatabase()
  const transaction = database.transaction(EVIDENCE_STORE_NAME, 'readonly')
  const records = await requestToPromise(
    transaction
      .objectStore(EVIDENCE_STORE_NAME)
      .index(ASSESSMENT_INDEX_NAME)
      .getAll(IDBKeyRange.only(assessmentId)),
  )

  return (records as CameraEvidence[]).sort(
    (left, right) =>
      new Date(right.capturedAt).getTime() -
      new Date(left.capturedAt).getTime(),
  )
}

export async function deleteCameraEvidence(id: string) {
  const database = await openEvidenceDatabase()
  const transaction = database.transaction(
    EVIDENCE_STORE_NAME,
    'readwrite',
  )
  const completed = waitForTransaction(transaction)
  transaction.objectStore(EVIDENCE_STORE_NAME).delete(id)
  await completed
}

export async function clearCameraEvidence(assessmentId: string) {
  const records = await getCameraEvidence(assessmentId)

  if (records.length === 0) {
    return
  }

  const database = await openEvidenceDatabase()
  const transaction = database.transaction(
    EVIDENCE_STORE_NAME,
    'readwrite',
  )
  const completed = waitForTransaction(transaction)
  const store = transaction.objectStore(EVIDENCE_STORE_NAME)
  records.forEach((record) => store.delete(record.id))
  await completed
}

export async function trimCameraEvidence(
  assessmentId: string,
  maximumCount: number,
) {
  const records = await getCameraEvidence(assessmentId)
  const excessCount = records.length - Math.max(0, maximumCount)

  if (excessCount <= 0) {
    return
  }

  const oldestRecords = [...records]
    .sort(
      (left, right) =>
        new Date(left.capturedAt).getTime() -
        new Date(right.capturedAt).getTime(),
    )
    .slice(0, excessCount)
  const database = await openEvidenceDatabase()
  const transaction = database.transaction(
    EVIDENCE_STORE_NAME,
    'readwrite',
  )
  const completed = waitForTransaction(transaction)
  const store = transaction.objectStore(EVIDENCE_STORE_NAME)
  oldestRecords.forEach((record) => store.delete(record.id))
  await completed
}
