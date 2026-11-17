import {
  CURRENT_SCHEMA_VERSION,
  hintFlagsSchema,
  migrate,
  type ProgressDocument,
} from './staff-reading-game.validators'
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type Clef,
  type GameSettings,
  type LocalProfile,
  type Mode,
  type RangePreset,
  type Session,
} from './staff-reading-game.types'

export const PROGRESS_STORAGE_KEY = 'ale-tinker-lab:staff-reading-game:progress'
export const HINTS_STORAGE_KEY = 'ale-tinker-lab:staff-reading-game:hints'
export const MAX_STORED_ATTEMPTS = 1000

export type PersonalBestKey = { mode: Mode; clef: Clef; rangePreset: RangePreset }

/**
 * Everything the game reads or writes goes through this interface. Asynchronous so a
 * server-backed implementation can replace the browser one. No method rejects because of storage failures.
 */
export type ProgressStorage = {
  /** The local profile, created on first call. */
  getProfile(): Promise<LocalProfile>
  /** Saved settings, or the defaults when none were saved. */
  getSettings(): Promise<GameSettings>
  saveSettings(settings: GameSettings): Promise<void>
  /** Inserts the session, or replaces the one with the same id. */
  saveSession(session: Session): Promise<void>
  /** Adds an attempt and applies the retention limit. */
  addAttempt(attempt: Attempt): Promise<void>
  listSessions(): Promise<Session[]>
  listAttempts(sessionId: string): Promise<Attempt[]>
  /** Highest score among completed Rounds with the same mode, clef and range preset; null if none. */
  getPersonalBest(key: PersonalBestKey): Promise<number | null>
  /** False when progress only lives in memory (storage missing, blocked or full). */
  isPersisting(): Promise<boolean>
  hasSeenHint(name: string): Promise<boolean>
  markHintSeen(name: string): Promise<void>
}

/** The subset of the Web Storage API the browser implementation needs. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type BrowserProgressStorageOptions = {
  /** Defaults to `window.localStorage`, resolved lazily. `null` forces in-memory only. */
  storage?: StorageLike | null
  now?: () => Date
  uuid?: () => string
}

/** A client-generated UUID, for session and attempt ids. */
export function createId(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // RFC 4122 version 4 and variant bits.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

function resolveDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    // Accessing localStorage throws when site data is blocked (e.g. some private modes).
    return null
  }
}

export function createBrowserProgressStorage(
  options: BrowserProgressStorageOptions = {},
): ProgressStorage {
  const now = options.now ?? (() => new Date())
  const uuid = options.uuid ?? createId

  let resolved = false
  let backing: StorageLike | null = null
  let doc: ProgressDocument | null = null
  let persisting = true
  let readFailed = false
  let hints: Record<string, boolean> | null = null

  function getBacking(): StorageLike | null {
    if (!resolved) {
      backing = options.storage !== undefined ? options.storage : resolveDefaultStorage()
      resolved = true
    }
    return backing
  }

  function emptyDocument(): ProgressDocument {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profile: { id: uuid(), createdAt: now().toISOString(), linkedUserId: null },
      settings: null,
      sessions: [],
      attempts: [],
    }
  }

  function persist(): void {
    const store = getBacking()
    // After a failed read the stored document may be valid progress we could not see: never overwrite it.
    if (!store || !doc || readFailed) {
      persisting = false
      return
    }
    try {
      store.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(doc))
      persisting = true
    } catch {
      persisting = false
    }
  }

  function load(): ProgressDocument {
    if (doc) return doc
    const store = getBacking()
    let loaded: ProgressDocument | null = null
    if (store) {
      let raw: string | null = null
      try {
        raw = store.getItem(PROGRESS_STORAGE_KEY)
      } catch {
        readFailed = true
      }
      if (raw !== null) {
        try {
          loaded = migrate(JSON.parse(raw) as unknown)
        } catch {
          // Unparseable JSON: reset to a fresh document below.
          loaded = null
        }
      }
    }
    // A loaded document is re-written and a fresh one is written, which doubles as a write probe:
    // isPersisting() is accurate before the first game write. A reset replaces bad data;
    // a failed read leaves storage untouched (see persist).
    doc = loaded ?? emptyDocument()
    persist()
    return doc
  }

  function loadHints(): Record<string, boolean> {
    if (hints) return hints
    let loaded: Record<string, boolean> = {}
    const store = getBacking()
    if (store) {
      try {
        const raw = store.getItem(HINTS_STORAGE_KEY)
        if (raw !== null) {
          const parsed = hintFlagsSchema.safeParse(JSON.parse(raw) as unknown)
          if (parsed.success) loaded = parsed.data
        }
      } catch {
        loaded = {}
      }
    }
    hints = loaded
    return hints
  }

  function trimAttempts(current: ProgressDocument, inProgressSessionId: string): void {
    if (current.attempts.length <= MAX_STORED_ATTEMPTS) return
    const oldestFirst = current.sessions
      .filter((s) => s.id !== inProgressSessionId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const removed = new Set<string>()
    let remaining = current.attempts.length
    for (const s of oldestFirst) {
      if (remaining <= MAX_STORED_ATTEMPTS) break
      removed.add(s.id)
      remaining -= current.attempts.filter((a) => a.sessionId === s.id).length
    }
    if (removed.size === 0) return
    current.sessions = current.sessions.filter((s) => !removed.has(s.id))
    current.attempts = current.attempts.filter((a) => !removed.has(a.sessionId))
  }

  return {
    getProfile() {
      return Promise.resolve({ ...load().profile })
    },

    getSettings() {
      const { settings } = load()
      if (!settings) return Promise.resolve({ ...DEFAULT_SETTINGS })
      return Promise.resolve({
        mode: settings.mode,
        sessionType: settings.sessionType,
        clef: settings.clef,
        rangePreset: settings.rangePreset,
        noteNaming: settings.noteNaming,
        strictOctave: settings.strictOctave,
        soundOn: settings.soundOn,
        previewSound: settings.previewSound,
      })
    },

    saveSettings(settings) {
      const current = load()
      current.settings = {
        ...settings,
        ownerId: current.profile.id,
        updatedAt: now().toISOString(),
      }
      persist()
      return Promise.resolve()
    },

    saveSession(session) {
      const current = load()
      const index = current.sessions.findIndex((s) => s.id === session.id)
      if (index === -1) current.sessions.push({ ...session })
      else current.sessions[index] = { ...session }
      persist()
      return Promise.resolve()
    },

    addAttempt(attempt) {
      const current = load()
      current.attempts.push({ ...attempt })
      trimAttempts(current, attempt.sessionId)
      persist()
      return Promise.resolve()
    },

    listSessions() {
      return Promise.resolve(load().sessions.map((s) => ({ ...s })))
    },

    listAttempts(sessionId) {
      return Promise.resolve(
        load()
          .attempts.filter((a) => a.sessionId === sessionId)
          .map((a) => ({ ...a })),
      )
    },

    getPersonalBest({ mode, clef, rangePreset }) {
      let best: number | null = null
      for (const s of load().sessions) {
        if (s.sessionType !== 'round' || !s.completed || s.score === null) continue
        if (s.mode !== mode || s.clef !== clef || s.rangePreset !== rangePreset) continue
        if (best === null || s.score > best) best = s.score
      }
      return Promise.resolve(best)
    },

    isPersisting() {
      load()
      return Promise.resolve(persisting)
    },

    hasSeenHint(name) {
      return Promise.resolve(loadHints()[name] === true)
    },

    markHintSeen(name) {
      const flags = loadHints()
      flags[name] = true
      const store = getBacking()
      if (store) {
        try {
          store.setItem(HINTS_STORAGE_KEY, JSON.stringify(flags))
        } catch {
          // Hint flags are best-effort; the in-memory copy still answers hasSeenHint.
        }
      }
      return Promise.resolve()
    },
  }
}
