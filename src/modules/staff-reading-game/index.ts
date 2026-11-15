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
