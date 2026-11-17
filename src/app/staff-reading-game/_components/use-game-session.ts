'use client'

import { useEffect, useRef, useState } from 'react'

import {
  DEFAULT_SETTINGS,
  FEEDBACK_CORRECT_MS,
  FEEDBACK_WRONG_MS,
  ResponseTimer,
  WRONG_NOTE_SOUND_DELAY_MS,
  advanceAction,
  answerAction,
  createId,
  createSession,
  exitAction,
  isCanonicalNote,
  selectSessionTotals,
  sessionReducer,
  startAction,
  type AudioEngine,
  type CanonicalNote,
  type GameSettings,
  type ProgressStorage,
  type Session,
  type SessionAction,
  type SessionState,
} from '~/modules/staff-reading-game'

export type UseGameSessionOptions = {
  /** Null until the shell has created it; nothing is saved meanwhile. */
  storage: ProgressStorage | null
  /** The audio engine, if one exists yet. Called after each commit. */
  getAudio?: () => AudioEngine | null
  /** Random values in [0, 1) for prompts and re-queues. Defaults to `Math.random`. */
  rng?: () => number
  /** Clock for response times in ms. Defaults to `performance.now()`. */
  now?: () => number
}

export type CommitInput = {
  /** Name mode: a Letter. Place mode: the placed canonical note (D9). */
  answer: string
  /** Committed with the Confirm button (touch Place flow, D13). */
  viaConfirm?: boolean
}

export type GameSession = {
  state: SessionState
  /**
   * Personal best for the running or last Round's mode, clef and range preset, read when it
   * started, before it was saved. Null when there was none (and for Practice).
   */
  personalBestBefore: number | null
  /** Starts a session with these settings; they stay fixed until it ends. */
  start: (settings: GameSettings) => void
  /** Commits an answer to the current prompt. Ignored outside `prompting`. */
  commit: (input: CommitInput) => void
  /** Place mode preview sound (D22): plays a note while placing. Ignored outside `prompting`. */
  preview: (note: CanonicalNote) => void
  /** Escape / exit button during play; leaves the summary or end screen otherwise. */
  exit: () => void
  /** Resolves once every storage write queued so far has settled. */
  whenSaved: () => Promise<void>
}

/** The parts of a Session record fixed at start. */
type SessionRecord = {
  id: string
  startedAt: string
  settings: GameSettings
  /** The local profile id, once read; null if it could not be read (nothing is saved then). */
  ownerId: string | null
}

type Controller = Omit<GameSession, 'state' | 'personalBestBefore'> & {
  /** Mounted: resumes a feedback pause that an unmount cut short. */
  attach: () => void
  /**
   * Unmounted: stops timers and keeps the state. A Round in the feedback of its final prompt is
   * finished as completed, as exit or the advance would (D29).
   */
  detach: () => void
  setPageHidden: (hidden: boolean) => void
}

type ControllerDeps = {
  initial: SessionState
  getOptions: () => UseGameSessionOptions
  onState: (state: SessionState) => void
  onPersonalBestBefore: (best: number | null) => void
}

function isPlaying(state: SessionState): boolean {
  return state.status === 'prompting' || state.status === 'feedback'
}

function feedbackDelay(state: SessionState): number {
  return state.lastResult?.isCorrect ? FEEDBACK_CORRECT_MS : FEEDBACK_WRONG_MS
}

function toSession(
  record: SessionRecord,
  ownerId: string,
  state: SessionState,
  endedAt: string | null,
): Session {
  const { settings } = record
  return {
    id: record.id,
    ownerId,
    mode: settings.mode,
    sessionType: settings.sessionType,
    clef: settings.clef,
    rangePreset: settings.rangePreset,
    strictOctave: settings.strictOctave,
    startedAt: record.startedAt,
    endedAt,
    ...selectSessionTotals(state),
    syncedAt: null,
  }
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden
}

/**
 * Plain object behind the hook: it runs the session reducer and every side effect of a
 * transition (timer, feedback pause, sound, saving) from the event that caused it, so nothing
 * runs twice under StrictMode.
 */
function createController(deps: ControllerDeps): Controller {
  let state = deps.initial
  let record: SessionRecord | null = null
  /** The record of the latest start, kept after it ends, so a late personal best still lands. */
  let latestRecord: SessionRecord | null = null
  let feedbackTimeout: ReturnType<typeof setTimeout> | null = null
  let timing = false
  let mounted = false
  let writes: Promise<void> = Promise.resolve()
  const timer = new ResponseTimer(() => (deps.getOptions().now ?? (() => performance.now()))())

  const rng = () => (deps.getOptions().rng ?? Math.random)()

  /** Runs the reducer and returns the new state. */
  function dispatch(action: SessionAction): SessionState {
    const next = sessionReducer(state, action)
    if (next !== state) {
      state = next
      deps.onState(next)
    }
    return state
  }

  /** Queues a storage write after the earlier ones; a failure never reaches the game. */
  function save(task: (storage: ProgressStorage) => Promise<void>) {
    const { storage } = deps.getOptions()
    if (!storage) return
    writes = writes.then(() => task(storage)).catch(() => undefined)
  }

  function playSound(action: (audio: AudioEngine) => void) {
    try {
      const audio = deps.getOptions().getAudio?.()
      if (audio) action(audio)
    } catch {
      // Sound is a nicety; never break the game.
    }
  }

  function clearFeedback() {
    if (feedbackTimeout !== null) clearTimeout(feedbackTimeout)
    feedbackTimeout = null
  }

  function scheduleAdvance() {
    clearFeedback()
    feedbackTimeout = setTimeout(() => {
      feedbackTimeout = null
      advance()
    }, feedbackDelay(state))
  }

  /** The prompt is shown and input enabled: time it from now. */
  function beginPrompt() {
    timer.start()
    timing = true
    if (isDocumentHidden()) timer.pause()
  }

  function stopTiming(): number {
    if (!timing) return 0
    timing = false
    return timer.stop()
  }

  function finish() {
    const ended = record
    record = null
    if (!ended) return
    const snapshot = state
    const endedAt = new Date().toISOString()
    save(async (storage) => {
      if (ended.ownerId !== null) {
        await storage.saveSession(toSession(ended, ended.ownerId, snapshot, endedAt))
      }
    })
  }

  function advance() {
    const next = dispatch(advanceAction(rng))
    if (next.status === 'prompting') beginPrompt()
    else if (next.status === 'ended') finish()
  }

  const start: Controller['start'] = (settings) => {
    if (isPlaying(state)) return
    clearFeedback()
    const snapshot = dispatch(startAction(settings, rng))
    if (snapshot.status !== 'prompting') return
    const started: SessionRecord = {
      id: createId(),
      startedAt: new Date().toISOString(),
      settings,
      ownerId: null,
    }
    record = started
    latestRecord = started
    deps.onPersonalBestBefore(null)
    save(async (storage) => {
      started.ownerId = (await storage.getProfile()).id
      if (settings.sessionType === 'round') {
        try {
          const { mode, clef, rangePreset } = settings
          const best = await storage.getPersonalBest({ mode, clef, rangePreset })
          if (latestRecord === started) deps.onPersonalBestBefore(best)
        } catch {
          // No personal best known: the session is still saved.
        }
      }
      await storage.saveSession(toSession(started, started.ownerId, snapshot, null))
    })
    beginPrompt()
  }

  const commit: Controller['commit'] = ({ answer, viaConfirm = false }) => {
    if (state.status !== 'prompting' || !state.current) return
    const responseMs = Math.round(stopTiming())
    const next = dispatch(answerAction({ answer, responseMs, viaConfirm }, rng))
    const prompt = next.current
    const attempt = next.attempts.at(-1)
    if (next.status !== 'feedback' || !prompt || !attempt) return
    if (next.settings.mode === 'name') {
      playSound((audio) => audio.play(prompt.targetNote))
    } else if (isCanonicalNote(answer)) {
      // Place mode: the placed note, then the correct one after a miss.
      const correctNote = next.lastResult?.isCorrect === false ? prompt.targetNote : null
      playSound((audio) => {
        audio.play(answer)
        if (correctNote) audio.play(correctNote, { delayMs: WRONG_NOTE_SOUND_DELAY_MS })
      })
    }
    const session = record
    const answeredAt = new Date().toISOString()
    if (session) {
      save(async (storage) => {
        if (session.ownerId === null) return
        await storage.addAttempt({
          ...attempt,
          id: createId(),
          sessionId: session.id,
          ownerId: session.ownerId,
          answeredAt,
          syncedAt: null,
        })
      })
    }
    if (mounted) scheduleAdvance()
  }

  const preview: Controller['preview'] = (note) => {
    if (state.status === 'prompting') playSound((audio) => audio.play(note))
  }

  const exit: Controller['exit'] = () => {
    const wasPlaying = isPlaying(state)
    clearFeedback()
    stopTiming()
    dispatch(exitAction())
    if (wasPlaying) finish()
  }

  return {
    start,
    commit,
    preview,
    exit,
    whenSaved: () => writes,
    attach() {
      mounted = true
      if (state.status === 'feedback' && feedbackTimeout === null) scheduleAdvance()
    },
    detach() {
      mounted = false
      clearFeedback()
      const isLastFeedback =
        state.status === 'feedback' &&
        state.settings.sessionType === 'round' &&
        state.upcoming.length === 0
      if (isLastFeedback) exit()
    },
    setPageHidden(hidden) {
      if (!timing) return
      if (hidden) timer.pause()
      else timer.resume()
    },
  }
}

/**
 * Runs one game session at a time: the session reducer, response timing (paused while the page
 * is hidden), the automatic advance after feedback, the sound after each commit and while placing,
 * and saving the session and its attempts. Storage and audio failures never interrupt play.
 */
export function useGameSession(options: UseGameSessionOptions): GameSession {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const [state, setState] = useState(() => createSession(DEFAULT_SETTINGS))
  const [personalBestBefore, setPersonalBestBefore] = useState<number | null>(null)
  const [controller] = useState(() =>
    createController({
      initial: state,
      getOptions: () => optionsRef.current,
      onState: setState,
      onPersonalBestBefore: setPersonalBestBefore,
    }),
  )

  useEffect(() => {
    controller.attach()
    const onVisibilityChange = () => controller.setPageHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      controller.detach()
    }
  }, [controller])

  return {
    state,
    personalBestBefore,
    start: controller.start,
    commit: controller.commit,
    preview: controller.preview,
    exit: controller.exit,
    whenSaved: controller.whenSaved,
  }
}
