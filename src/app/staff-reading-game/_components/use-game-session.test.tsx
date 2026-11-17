/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'

import {
  DEFAULT_SETTINGS,
  parseNote,
  type GameSettings,
  type ProgressStorage,
  type Session,
} from '~/modules/staff-reading-game'

import { useGameSession, type UseGameSessionOptions } from './use-game-session'

const ROUND: GameSettings = { ...DEFAULT_SETTINGS, sessionType: 'round' }

/** Personal bests come from the saved sessions, like the real storage, starting from `best`. */
function createFakeStorage(best: number | null) {
  const calls: string[] = []
  const sessions = new Map<string, Session>()
  const storage: ProgressStorage = {
    getProfile: () => {
      calls.push('getProfile')
      return Promise.resolve({ id: 'profile-1', createdAt: '', linkedUserId: null })
    },
    getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS }),
    saveSettings: () => Promise.resolve(),
    saveSession: (session) => {
      calls.push(`saveSession:${session.completed ? 'completed' : 'open'}`)
      sessions.set(session.id, session)
      return Promise.resolve()
    },
    addAttempt: () => {
      calls.push('addAttempt')
      return Promise.resolve()
    },
    listSessions: () => Promise.resolve([]),
    listAttempts: () => Promise.resolve([]),
    getPersonalBest: () => {
      calls.push('getPersonalBest')
      const scores = [...sessions.values()]
        .filter((session) => session.completed && session.score !== null)
        .map((session) => session.score ?? 0)
      return Promise.resolve(
        scores.length > 0 || best !== null ? Math.max(best ?? 0, ...scores) : null,
      )
    },
    isPersisting: () => Promise.resolve(true),
    hasSeenHint: () => Promise.resolve(false),
    markHintSeen: () => Promise.resolve(),
  }
  return { storage, calls }
}

function renderSession(options: UseGameSessionOptions) {
  return renderHook(() => useGameSession(options), { wrapper: StrictMode })
}

function letterOf(note: string | undefined) {
  return parseNote(note ?? '')?.letter ?? 'C'
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useGameSession', () => {
  it('under StrictMode starts one session and schedules one advance per commit', async () => {
    const { storage, calls } = createFakeStorage(null)
    const { result, unmount } = renderSession({ storage, rng: () => 0 })

    act(() => result.current.start(ROUND))
    await act(() => result.current.whenSaved())
    expect(calls).toEqual(['getProfile', 'getPersonalBest', 'saveSession:open'])
    expect(result.current.state.status).toBe('prompting')
    // Let the test harness's own pending timers run, so only the game's are counted below.
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(jest.getTimerCount()).toBe(0)

    act(() => result.current.commit({ answer: letterOf(result.current.state.current?.targetNote) }))
    expect(jest.getTimerCount()).toBe(1)
    act(() => {
      jest.advanceTimersByTime(600)
    })
    expect(result.current.state.status).toBe('prompting')
    expect(result.current.state.current?.position).toBe(2)
    expect(jest.getTimerCount()).toBe(0)

    act(() => result.current.start(ROUND))
    expect(result.current.state.current?.position).toBe(2)

    unmount()
  })

  it('reads the personal best before the Round is saved and keeps it after the end', async () => {
    const { storage, calls } = createFakeStorage(900)
    const { result } = renderSession({ storage, rng: () => 0 })

    act(() => result.current.start(ROUND))
    await act(() => result.current.whenSaved())
    expect(result.current.personalBestBefore).toBe(900)

    while (result.current.state.status === 'prompting') {
      act(() =>
        result.current.commit({ answer: letterOf(result.current.state.current?.targetNote) }),
      )
      act(() => {
        jest.advanceTimersByTime(600)
      })
    }
    await act(() => result.current.whenSaved())

    expect(result.current.state.status).toBe('ended')
    expect(calls.filter((call) => call === 'addAttempt')).toHaveLength(20)
    expect(calls.filter((call) => call === 'getPersonalBest')).toHaveLength(1)
    // The stored best now includes this Round; the value kept is the one from before it.
    expect(await storage.getPersonalBest(ROUND)).toBeGreaterThan(900)
    expect(result.current.personalBestBefore).toBe(900)
  })

  it('unmounting during the final prompt of a Round finishes it as completed (D29)', async () => {
    const { storage, calls } = createFakeStorage(null)
    const { result, unmount } = renderSession({ storage, rng: () => 0 })
    act(() => result.current.start(ROUND))
    for (let i = 0; i < 20; i++) {
      act(() =>
        result.current.commit({ answer: letterOf(result.current.state.current?.targetNote) }),
      )
      if (i < 19) {
        act(() => {
          jest.advanceTimersByTime(600)
        })
      }
    }
    expect(result.current.state.status).toBe('feedback')
    const { whenSaved } = result.current

    unmount()
    await act(() => whenSaved())

    expect(calls.at(-1)).toBe('saveSession:completed')
  })

  it('unmounting mid-Round leaves it saved as incomplete', async () => {
    const { storage, calls } = createFakeStorage(null)
    const { result, unmount } = renderSession({ storage, rng: () => 0 })
    act(() => result.current.start(ROUND))
    act(() => result.current.commit({ answer: 'C' }))
    const { whenSaved } = result.current

    unmount()
    await act(() => whenSaved())

    expect(calls).not.toContain('saveSession:completed')
  })

  it('plays without storage', () => {
    const { result } = renderSession({ storage: null, rng: () => 0 })
    act(() => result.current.start(DEFAULT_SETTINGS))
    act(() => result.current.commit({ answer: 'C' }))
    expect(result.current.state.status).toBe('feedback')
    act(() => result.current.exit())
    expect(result.current.state.status).toBe('summary')
  })

  it('plays the preview sound only while a prompt is waiting for an answer', () => {
    const play = jest.fn()
    const audio = {
      unlock: jest.fn(),
      loadSamples: () => Promise.resolve(),
      play,
      setMuted: jest.fn(),
      dispose: jest.fn(),
    }
    const place: GameSettings = { ...DEFAULT_SETTINGS, mode: 'place', strictOctave: true }
    const { result } = renderSession({ storage: null, rng: () => 0, getAudio: () => audio })

    act(() => result.current.preview('G4'))
    act(() => result.current.start(place))
    act(() => result.current.preview('A4'))
    act(() => result.current.commit({ answer: 'E4' }))
    act(() => result.current.preview('B4'))

    expect(play.mock.calls).toEqual([['A4'], ['E4']])
  })
})
