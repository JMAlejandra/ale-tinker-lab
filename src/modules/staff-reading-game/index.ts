export {
  BOTTOM_LINE_STEP,
  LETTERS,
  MAX_STEP,
  MIDDLE_LINE_STEP,
  MIN_STEP,
  TOP_LINE_STEP,
  clampStep,
  formatNote,
  getLedgerLineSteps,
  isCanonicalNote,
  letterDisplayName,
  noteDisplayName,
  noteToFrequency,
  noteToMidi,
  noteToStep,
  notesForPreset,
  parseNote,
  stepToNote,
  visibleNotes,
} from './staff-reading-game.notes'
export type { ParsedNote } from './staff-reading-game.notes'
export {
  CLEFS,
  DEFAULT_SETTINGS,
  MODES,
  NOTE_NAMINGS,
  RANGE_PRESETS,
  SESSION_TYPES,
} from './staff-reading-game.types'
export type {
  Attempt,
  CanonicalNote,
  Clef,
  GameSettings,
  Letter,
  LocalProfile,
  Mode,
  NoteNaming,
  RangePreset,
  Session,
  SessionType,
  Settings,
} from './staff-reading-game.types'
export {
  HINTS_STORAGE_KEY,
  MAX_STORED_ATTEMPTS,
  PROGRESS_STORAGE_KEY,
  createBrowserProgressStorage,
  createId,
} from './staff-reading-game.storage'
export type {
  BrowserProgressStorageOptions,
  PersonalBestKey,
  ProgressStorage,
  StorageLike,
} from './staff-reading-game.storage'
export { createAudioEngine } from './staff-reading-game.audio'
export type { AudioContextLike, AudioEngine, AudioEngineOptions } from './staff-reading-game.audio'
export { pointsFor, speedBonus, streakMultiplier } from './staff-reading-game.scoring'
export type { PointsInput } from './staff-reading-game.scoring'
export { ResponseTimer } from './staff-reading-game.timer'
export {
  FEEDBACK_CORRECT_MS,
  FEEDBACK_WRONG_MS,
  ROUND_LENGTH,
  WRONG_NOTE_SOUND_DELAY_MS,
  advanceAction,
  answerAction,
  createSession,
  exitAction,
  selectAccuracy,
  selectAverageResponseMs,
  selectBestStreak,
  selectNoteResults,
  selectNotesAnswered,
  selectProgress,
  selectScore,
  selectSessionTotals,
  selectStreak,
  sessionReducer,
  startAction,
} from './staff-reading-game.session'
export type {
  Accuracy,
  AnswerInput,
  AnswerResult,
  AttemptRecord,
  NoteResult,
  Prompt,
  SessionAction,
  SessionState,
  SessionStatus,
  SessionTotals,
} from './staff-reading-game.session'
export type { PromptDraw, QueueSlot } from './staff-reading-game.queue'
