import {
  DEFAULT_SETTINGS,
  createBrowserProgressStorage,
  createId,
  type Attempt,
  type GameSettings,
  type Session,
} from '..'

const PROGRESS_KEY = 'ale-tinker-lab:staff-reading-game:progress'
const HINTS_KEY = 'ale-tinker-lab:staff-reading-game:hints'

class FakeStorage {
  readonly data = new Map<string, string>()
  failReads = false
  failWrites = false

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('SecurityError')
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

function makeStorage(storage: FakeStorage = new FakeStorage()) {
  let n = 0
  const progress = createBrowserProgressStorage({
    storage,
    now: () => new Date('2026-01-02T03:04:05.000Z'),
    uuid: () => `id-${++n}`,
  })
  return { storage, progress }
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    ownerId: 'owner',
    mode: 'name',
    sessionType: 'round',
    clef: 'treble',
    rangePreset: 'full-staff',
    strictOctave: false,
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:01:00.000Z',
    completed: true,
    score: 100,
    correctCount: 5,
    totalCount: 6,
    bestStreak: 3,
    syncedAt: null,
    ...overrides,
  }
}

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a1',
    sessionId: 's1',
    ownerId: 'owner',
    position: 0,
    targetNote: 'G4',
    clef: 'treble',
    answer: 'G',
    isCorrect: true,
    responseMs: 900,
    points: 10,
    streakAfter: 1,
    wasRequeued: false,
    answeredAt: '2026-01-01T00:00:10.000Z',
    syncedAt: null,
    ...overrides,
  }
}

describe('profile and settings', () => {
  it('creates a local profile once and returns the same one on reload', async () => {
    const first = makeStorage()
    const profile = await first.progress.getProfile()
    expect(profile).toEqual({
      id: 'id-1',
      createdAt: '2026-01-02T03:04:05.000Z',
      linkedUserId: null,
    })
    expect(await first.progress.getProfile()).toEqual(profile)

    const reloaded = makeStorage(first.storage)
    expect(await reloaded.progress.getProfile()).toEqual(profile)
  })

  it('stores one versioned document under the progress key', async () => {
    const { storage, progress } = makeStorage()
    await progress.getProfile()
    const doc = JSON.parse(storage.data.get(PROGRESS_KEY) ?? 'null') as { schemaVersion: number }
    expect(doc.schemaVersion).toBe(1)
  })

  it('returns defaults when no settings were saved', async () => {
    const { progress } = makeStorage()
    expect(await progress.getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips settings across a reload', async () => {
    const first = makeStorage()
    const chosen: GameSettings = {
      mode: 'place',
      sessionType: 'round',
      clef: 'bass',
      rangePreset: 'lines',
      noteNaming: 'solfege',
      strictOctave: true,
      soundOn: false,
      previewSound: true,
    }
    await first.progress.saveSettings(chosen)
    const reloaded = makeStorage(first.storage)
    expect(await reloaded.progress.getSettings()).toEqual(chosen)
  })
})

describe('sessions and attempts', () => {
  it('upserts sessions by id and lists them', async () => {
    const { progress } = makeStorage()
    await progress.saveSession(session({ completed: false, endedAt: null, score: null }))
    await progress.saveSession(session())
    expect(await progress.listSessions()).toEqual([session()])
  })

  it('lists attempts for one session only, and they survive a reload', async () => {
    const first = makeStorage()
    await first.progress.saveSession(session())
    await first.progress.addAttempt(attempt({ id: 'a1' }))
    await first.progress.addAttempt(attempt({ id: 'a2', position: 1 }))
    await first.progress.addAttempt(attempt({ id: 'a3', sessionId: 'other' }))
    const reloaded = makeStorage(first.storage)
    expect((await reloaded.progress.listAttempts('s1')).map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('computes the personal best from completed rounds of the same mode, clef and range preset', async () => {
    const { progress } = makeStorage()
    const key = { mode: 'name', clef: 'treble', rangePreset: 'full-staff' } as const
    expect(await progress.getPersonalBest(key)).toBeNull()

    await progress.saveSession(session({ id: 'low', score: 80 }))
    await progress.saveSession(session({ id: 'high', score: 120 }))
    await progress.saveSession(session({ id: 'practice', sessionType: 'practice', score: 999 }))
    await progress.saveSession(session({ id: 'exited', completed: false, score: 500 }))
    await progress.saveSession(session({ id: 'bass', clef: 'bass', score: 700 }))
    await progress.saveSession(session({ id: 'place', mode: 'place', score: 700 }))
    await progress.saveSession(session({ id: 'lines', rangePreset: 'lines', score: 700 }))
    await progress.saveSession(session({ id: 'strict', strictOctave: true, score: 130 }))

    expect(await progress.getPersonalBest(key)).toBe(130)
  })
})

describe('retention', () => {
  async function seed(progress: ReturnType<typeof makeStorage>['progress']) {
    for (const [id, day] of [
      ['old', '01'],
      ['mid', '02'],
      ['new', '03'],
    ] as const) {
      await progress.saveSession(session({ id, startedAt: `2026-01-${day}T00:00:00.000Z` }))
    }
  }

  it('trims whole sessions oldest first once attempts exceed 1,000, keeping the session in progress', async () => {
    const { progress } = makeStorage()
    await seed(progress)
    for (let i = 0; i < 400; i++) {
      await progress.addAttempt(attempt({ id: `old-${i}`, sessionId: 'old', position: i }))
    }
    for (let i = 0; i < 400; i++) {
      await progress.addAttempt(attempt({ id: `mid-${i}`, sessionId: 'mid', position: i }))
    }
    for (let i = 0; i < 201; i++) {
      await progress.addAttempt(attempt({ id: `new-${i}`, sessionId: 'new', position: i }))
    }
    expect((await progress.listSessions()).map((s) => s.id).sort()).toEqual(['mid', 'new'])
    expect(await progress.listAttempts('old')).toEqual([])
    expect(await progress.listAttempts('mid')).toHaveLength(400)
    expect(await progress.listAttempts('new')).toHaveLength(201)
  })

  it('never trims the session the incoming attempt belongs to, even when it is the oldest', async () => {
    const { progress } = makeStorage()
    await seed(progress)
    for (let i = 0; i < 500; i++) {
      await progress.addAttempt(attempt({ id: `mid-${i}`, sessionId: 'mid', position: i }))
    }
    for (let i = 0; i < 501; i++) {
      await progress.addAttempt(attempt({ id: `old-${i}`, sessionId: 'old', position: i }))
    }
    expect((await progress.listSessions()).map((s) => s.id).sort()).toEqual(['new', 'old'])
    expect(await progress.listAttempts('old')).toHaveLength(501)
    expect(await progress.listAttempts('mid')).toEqual([])
  })
})

describe('migration and reset', () => {
  const resetCases: [string, string][] = [
    ['unparseable JSON', '{not json'],
    ['an unknown schema version', JSON.stringify({ schemaVersion: 99 })],
    ['an older schema version it cannot migrate', JSON.stringify({ schemaVersion: 0 })],
    ['a document that fails validation', JSON.stringify({ schemaVersion: 1, profile: 'nope' })],
    ['a non-object document', '42'],
  ]

  it.each(resetCases)('resets to an empty document for %s without throwing', async (_name, raw) => {
    const storage = new FakeStorage()
    storage.data.set(PROGRESS_KEY, raw)
    const { progress } = makeStorage(storage)
    const profile = await progress.getProfile()
    expect(profile.linkedUserId).toBeNull()
    expect(await progress.listSessions()).toEqual([])
    expect(await progress.getSettings()).toEqual(DEFAULT_SETTINGS)
    expect(await progress.isPersisting()).toBe(true)
  })

  it('rejects stored attempts whose target note is not canonical', async () => {
    const first = makeStorage()
    await first.progress.saveSession(session())
    await first.progress.addAttempt(attempt())
    const doc = JSON.parse(first.storage.data.get(PROGRESS_KEY) ?? '') as {
      attempts: { targetNote: string }[]
    }
    doc.attempts[0]!.targetNote = 'H9'
    first.storage.data.set(PROGRESS_KEY, JSON.stringify(doc))
    const reloaded = makeStorage(first.storage)
    expect(await reloaded.progress.listSessions()).toEqual([])
  })
})

describe('hint flags', () => {
  it('remembers a seen hint in a separate key that survives a progress reset', async () => {
    const storage = new FakeStorage()
    const first = makeStorage(storage)
    expect(await first.progress.hasSeenHint('silent-switch')).toBe(false)
    await first.progress.markHintSeen('silent-switch')
    expect(storage.data.has(HINTS_KEY)).toBe(true)

    storage.data.set(PROGRESS_KEY, '{broken')
    const reloaded = makeStorage(storage)
    await reloaded.progress.listSessions()
    expect(await reloaded.progress.hasSeenHint('silent-switch')).toBe(true)
    expect(await reloaded.progress.hasSeenHint('other')).toBe(false)
  })

  it('ignores a corrupt hints value', async () => {
    const storage = new FakeStorage()
    storage.data.set(HINTS_KEY, '[[[')
    const { progress } = makeStorage(storage)
    expect(await progress.hasSeenHint('silent-switch')).toBe(false)
  })
})

describe('storage unavailable', () => {
  it('serves everything from memory when reads throw, and reports not persisting', async () => {
    const storage = new FakeStorage()
    storage.failReads = true
    storage.failWrites = true
    const { progress } = makeStorage(storage)
    await progress.saveSettings({ ...DEFAULT_SETTINGS, clef: 'bass' })
    await progress.saveSession(session())
    await progress.addAttempt(attempt())
    await progress.markHintSeen('silent-switch')
    expect((await progress.getSettings()).clef).toBe('bass')
    expect(await progress.listSessions()).toEqual([session()])
    expect(await progress.listAttempts('s1')).toHaveLength(1)
    expect(await progress.hasSeenHint('silent-switch')).toBe(true)
    expect(await progress.isPersisting()).toBe(false)
  })

  it('does not overwrite stored progress when only reads fail, and nothing throws', async () => {
    const seeded = makeStorage()
    await seeded.progress.saveSession(session({ id: 'precious' }))
    const stored = seeded.storage.data.get(PROGRESS_KEY)

    seeded.storage.failReads = true
    const { progress } = makeStorage(seeded.storage)
    await expect(progress.listSessions()).resolves.toEqual([])
    await progress.saveSession(session({ id: 'new' }))
    await progress.saveSettings(DEFAULT_SETTINGS)
    await progress.addAttempt(attempt())
    await progress.markHintSeen('silent-switch')
    expect((await progress.listSessions()).map((s) => s.id)).toEqual(['new'])
    expect(await progress.isPersisting()).toBe(false)
    expect(seeded.storage.data.get(PROGRESS_KEY)).toBe(stored)
  })

  it('reports not persisting straight away when the store rejects writes', async () => {
    const seeded = makeStorage()
    await seeded.progress.saveSession(session())
    seeded.storage.failWrites = true
    const { progress } = makeStorage(seeded.storage)
    expect(await progress.isPersisting()).toBe(false)
    expect(await progress.listSessions()).toEqual([session()])
  })

  it('works when reading window.localStorage itself throws', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get() {
        return {
          get localStorage(): Storage {
            throw new Error('SecurityError')
          },
        }
      },
    })
    try {
      const progress = createBrowserProgressStorage()
      await progress.saveSession(session())
      expect(await progress.listSessions()).toEqual([session()])
      expect(await progress.isPersisting()).toBe(false)
    } finally {
      Reflect.deleteProperty(globalThis, 'window')
    }
  })

  it('works when no storage is available at all', async () => {
    const progress = createBrowserProgressStorage({ storage: null })
    await progress.saveSession(session())
    expect(await progress.listSessions()).toEqual([session()])
    expect(await progress.isPersisting()).toBe(false)
  })

  it('works in an environment without window (server rendering)', async () => {
    const progress = createBrowserProgressStorage()
    await progress.saveSession(session())
    expect(await progress.listSessions()).toHaveLength(1)
    expect(await progress.isPersisting()).toBe(false)
  })

  it('keeps the in-memory copy authoritative when a write hits the quota, and recovers later', async () => {
    const { storage, progress } = makeStorage()
    await progress.saveSession(session({ id: 'saved' }))
    expect(await progress.isPersisting()).toBe(true)

    storage.failWrites = true
    await progress.saveSession(session({ id: 'unsaved' }))
    expect(await progress.isPersisting()).toBe(false)
    expect((await progress.listSessions()).map((s) => s.id)).toEqual(['saved', 'unsaved'])

    storage.failWrites = false
    await progress.saveSession(session({ id: 'later' }))
    expect(await progress.isPersisting()).toBe(true)
    const reloaded = makeStorage(storage)
    expect((await reloaded.progress.listSessions()).map((s) => s.id)).toEqual([
      'saved',
      'unsaved',
      'later',
    ])
  })
})

describe('createId', () => {
  it('mints distinct non-empty ids', () => {
    const a = createId()
    const b = createId()
    expect(a).not.toBe('')
    expect(a).not.toBe(b)
  })
})
