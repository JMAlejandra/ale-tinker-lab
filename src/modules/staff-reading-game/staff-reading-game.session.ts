import { parseNote } from './staff-reading-game.notes'
import {
  drawTargetNote,
  isLetterOnly,
  newSlots,
  promptIdentity,
  requeue,
  takeNextSlot,
  type PromptDraw,
  type QueueSlot,
} from './staff-reading-game.queue'
import { pointsFor } from './staff-reading-game.scoring'
import type { Attempt, CanonicalNote, GameSettings, Session } from './staff-reading-game.types'

/** New prompts in a Round; re-queued misses come on top. */
export const ROUND_LENGTH = 20
/** How long feedback shows before the next prompt (D19). */
export const FEEDBACK_CORRECT_MS = 600
export const FEEDBACK_WRONG_MS = 1200
/** Place mode, wrong answer: delay between the placed note's sound and the correct note's. */
export const WRONG_NOTE_SOUND_DELAY_MS = 400

/** Practice keeps at least this many upcoming prompts, enough for the furthest re-queue. */
const PRACTICE_LOOKAHEAD = 5
/** A note is re-queued at most this many times per Round; Practice has no cap (D10). */
const ROUND_REQUEUE_CAP = 2

export type SessionStatus = 'setup' | 'prompting' | 'feedback' | 'summary' | 'ended'

/** The prompt the player is answering. */
export type Prompt = {
  targetNote: CanonicalNote
  /** Place mode with strict octave off: only the letter is prompted, any octave is correct. */
  letterOnly: boolean
  wasRequeued: boolean
  /** 1-based position of the prompt in the session. */
  position: number
}

/** The judged answer, for the feedback display. */
export type AnswerResult = {
  isCorrect: boolean
  answer: string
  /** The prompt's target note, shown in green after a miss. */
  correctNote: CanonicalNote
  points: number
}

/** An Attempt without the fields the persistence layer adds. */
export type AttemptRecord = Omit<
  Attempt,
  'id' | 'sessionId' | 'ownerId' | 'answeredAt' | 'syncedAt'
>

export type SessionState = {
  status: SessionStatus
  settings: GameSettings
  current: Prompt | null
  lastResult: AnswerResult | null
  attempts: AttemptRecord[]
  streak: number
  /** Prompts after the current one. Empty in a Round means the current prompt is the last. */
  upcoming: QueueSlot[]
  /** Re-queues so far per prompt identity (canonical note, or letter for letter prompts). */
  requeueCounts: Record<string, number>
  /** The session finished: a Round answered to its end, or Practice exited to its summary. */
  completed: boolean
}

/** A commit: Name mode `answer` is a Letter, Place mode `answer` is the placed canonical note (D9). */
export type AnswerInput = {
  answer: string
  /** Prompt shown → commit, excluding time while the page was hidden. */
  responseMs: number
  /** Committed with the Confirm button (touch Place flow), which shifts the speed window (D13). */
  viaConfirm: boolean
}

export type SessionAction =
  | { type: 'start'; settings: GameSettings; draw: PromptDraw }
  | ({ type: 'answer'; requeueRoll: number } & AnswerInput)
  | { type: 'advance'; draw: PromptDraw }
  | { type: 'exit' }

/** A session in `setup`, ready to start with the given settings. */
export function createSession(settings: GameSettings): SessionState {
  return {
    status: 'setup',
    settings,
    current: null,
    lastResult: null,
    attempts: [],
    streak: 0,
    upcoming: [],
    requeueCounts: {},
    completed: false,
  }
}

function drawWith(rng: () => number): PromptDraw {
  return { pick: rng(), variant: rng() }
}

/** Starts a session with `settings`; `rng` returns values in [0, 1). */
export function startAction(settings: GameSettings, rng: () => number): SessionAction {
  return { type: 'start', settings, draw: drawWith(rng) }
}

/** Commits an answer to the current prompt; `rng` returns values in [0, 1). */
export function answerAction(input: AnswerInput, rng: () => number): SessionAction {
  return { type: 'answer', ...input, requeueRoll: rng() }
}

/** Leaves feedback for the next prompt (or the end of a Round); `rng` returns values in [0, 1). */
export function advanceAction(rng: () => number): SessionAction {
  return { type: 'advance', draw: drawWith(rng) }
}

/** Exits the session (Escape or the exit button), or leaves the summary / end screen. */
export function exitAction(): SessionAction {
  return { type: 'exit' }
}

/**
 * Name mode: the chosen letter matches the target's letter. Place mode: the placed note's
 * letter matches (strict octave off) or the placed note is the exact target (strict octave on).
 */
function isCorrectAnswer(settings: GameSettings, prompt: Prompt, answer: string): boolean {
  const target = parseNote(prompt.targetNote)
  if (settings.mode === 'name') return target?.letter === answer
  if (prompt.letterOnly) return parseNote(answer)?.letter === target?.letter
  return answer === prompt.targetNote
}

function answerPrompt(
  state: SessionState,
  action: Extract<SessionAction, { type: 'answer' }>,
): SessionState {
  const prompt = state.current
  if (state.status !== 'prompting' || !prompt) return state
  const isCorrect = isCorrectAnswer(state.settings, prompt, action.answer)
  const streak = isCorrect ? state.streak + 1 : 0
  const scored = state.settings.sessionType === 'round' && !prompt.wasRequeued
  const points = scored ? pointsFor({ ...action, isCorrect, streak }) : 0
  const attempt: AttemptRecord = {
    position: prompt.position,
    targetNote: prompt.targetNote,
    clef: state.settings.clef,
    answer: action.answer,
    isCorrect,
    responseMs: action.responseMs,
    points,
    streakAfter: streak,
    wasRequeued: prompt.wasRequeued,
  }
  const identity = promptIdentity(prompt.targetNote, prompt.letterOnly)
  const requeuesSoFar = state.requeueCounts[identity] ?? 0
  const capped = state.settings.sessionType === 'round' && requeuesSoFar >= ROUND_REQUEUE_CAP
  const requeued = !isCorrect && !capped
  return {
    ...state,
    status: 'feedback',
    upcoming: requeued
      ? requeue(state.upcoming, prompt.targetNote, prompt.position, action.requeueRoll)
      : state.upcoming,
    requeueCounts: requeued
      ? { ...state.requeueCounts, [identity]: requeuesSoFar + 1 }
      : state.requeueCounts,
    streak,
    lastResult: { isCorrect, answer: action.answer, correctNote: prompt.targetNote, points },
    attempts: [...state.attempts, attempt],
  }
}

/** Serves the next upcoming prompt, or ends the Round when none is left. */
function nextPrompt(state: SessionState, draw: PromptDraw): SessionState {
  const letterOnly = isLetterOnly(state.settings)
  const justShown = state.current
    ? promptIdentity(state.current.targetNote, state.current.letterOnly)
    : null
  const position = state.attempts.length + 1
  const taken = takeNextSlot(state.upcoming, justShown, letterOnly, position)
  if (!taken) return endRound(state)
  const { slot, rest } = taken
  const isRound = state.settings.sessionType === 'round'
  return {
    ...state,
    status: 'prompting',
    upcoming: isRound ? rest : [...rest, ...newSlots(PRACTICE_LOOKAHEAD - rest.length)],
    current: {
      targetNote:
        slot.kind === 'requeued'
          ? slot.targetNote
          : drawTargetNote(state.settings, draw, justShown),
      letterOnly,
      wasRequeued: slot.kind === 'requeued',
      position,
    },
  }
}

function endRound(state: SessionState): SessionState {
  return { ...state, status: 'ended', current: null, completed: true }
}

function isPlaying(state: SessionState): boolean {
  return state.status === 'prompting' || state.status === 'feedback'
}

function startSession(settings: GameSettings, draw: PromptDraw): SessionState {
  const length = settings.sessionType === 'round' ? ROUND_LENGTH : PRACTICE_LOOKAHEAD
  return nextPrompt({ ...createSession(settings), upcoming: newSlots(length) }, draw)
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'start':
      return isPlaying(state) ? state : startSession(action.settings, action.draw)
    case 'answer':
      return answerPrompt(state, action)
    case 'advance':
      return state.status === 'feedback' ? nextPrompt(state, action.draw) : state
    case 'exit':
      return exitSession(state)
  }
}

/**
 * During play: a Round returns to setup (incomplete), Practice goes to its summary. A Round in
 * the final answer's feedback, with every prompt answered, ends completed, as `advance` would.
 * From the summary or end screen: back to setup. Attempts are kept until the next start.
 */
function exitSession(state: SessionState): SessionState {
  const isRound = state.settings.sessionType === 'round'
  switch (state.status) {
    case 'feedback':
      if (isRound && state.upcoming.length === 0) return endRound(state)
      return exitPlay(state)
    case 'prompting':
      return exitPlay(state)
    case 'summary':
    case 'ended':
      return { ...state, status: 'setup' }
    case 'setup':
      return state
  }
}

function exitPlay(state: SessionState): SessionState {
  return state.settings.sessionType === 'round'
    ? { ...state, status: 'setup', current: null, upcoming: [], completed: false }
    : { ...state, status: 'summary', current: null, upcoming: [], completed: true }
}

// Selectors. They read the current or last session; attempts are kept until the next start.

/** Points so far (always 0 in Practice). */
export function selectScore(state: SessionState): number {
  return state.attempts.reduce((sum, attempt) => sum + attempt.points, 0)
}

export function selectStreak(state: SessionState): number {
  return state.streak
}

export function selectBestStreak(state: SessionState): number {
  return Math.max(0, ...state.attempts.map((attempt) => attempt.streakAfter))
}

function firstTimeAttempts(state: SessionState): AttemptRecord[] {
  return state.attempts.filter((attempt) => !attempt.wasRequeued)
}

/** Round progress: new prompts answered out of 20 (re-queued prompts don't count). */
export function selectProgress(state: SessionState): { answered: number; total: number } {
  return { answered: firstTimeAttempts(state).length, total: ROUND_LENGTH }
}

/** All attempts, re-queued ones included (Practice's "notes answered"). */
export function selectNotesAnswered(state: SessionState): number {
  return state.attempts.length
}

export type Accuracy = {
  correct: number
  total: number
  /** correct / total, or null before the first answer. */
  ratio: number | null
}

/** Correct first answers over first-time (non-re-queued) prompts (D14). */
export function selectAccuracy(state: SessionState): Accuracy {
  const firstTime = firstTimeAttempts(state)
  const correct = firstTime.filter((attempt) => attempt.isCorrect).length
  const total = firstTime.length
  return { correct, total, ratio: total > 0 ? correct / total : null }
}

/** The Session record's derived fields; the UI adds ids, owner and timestamps when saving. */
export type SessionTotals = Pick<
  Session,
  'completed' | 'score' | 'correctCount' | 'totalCount' | 'bestStreak'
>

export function selectSessionTotals(state: SessionState): SessionTotals {
  const { correct, total } = selectAccuracy(state)
  return {
    completed: state.completed,
    score: state.settings.sessionType === 'round' ? selectScore(state) : null,
    correctCount: correct,
    totalCount: total,
    bestStreak: selectBestStreak(state),
  }
}

export type NoteResult = {
  note: CanonicalNote
  /** End-screen colour: green, amber or red. */
  result: 'always-correct' | 'mixed' | 'always-missed'
}

/** Every target note prompted, in order of first appearance, with its result over all attempts. */
export function selectNoteResults(state: SessionState): NoteResult[] {
  const outcomes = new Map<CanonicalNote, { correct: boolean; missed: boolean }>()
  for (const { targetNote, isCorrect } of state.attempts) {
    const outcome = outcomes.get(targetNote) ?? { correct: false, missed: false }
    outcomes.set(targetNote, {
      correct: outcome.correct || isCorrect,
      missed: outcome.missed || !isCorrect,
    })
  }
  return [...outcomes].map(([note, { correct, missed }]) => ({
    note,
    result: !missed ? 'always-correct' : correct ? 'mixed' : 'always-missed',
  }))
}

/** Mean response time over all attempts in milliseconds (unrounded), or null before the first. */
export function selectAverageResponseMs(state: SessionState): number | null {
  if (state.attempts.length === 0) return null
  const sum = state.attempts.reduce((total, attempt) => total + attempt.responseMs, 0)
  return sum / state.attempts.length
}
