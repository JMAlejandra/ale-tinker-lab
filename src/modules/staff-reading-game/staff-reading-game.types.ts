export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * Letter plus octave in scientific pitch notation, e.g. "G4". Stored as a plain string.
 * The type is loose (`"G99"` type-checks); `parseNote` / `isCanonicalNote` are the runtime gate for untrusted strings.
 */
export type CanonicalNote = `${Letter}${number}`

export const CLEFS = ['treble', 'bass'] as const
export type Clef = (typeof CLEFS)[number]

export const MODES = ['place', 'name'] as const
export type Mode = (typeof MODES)[number]

export const SESSION_TYPES = ['practice', 'round'] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const RANGE_PRESETS = ['landmarks', 'lines', 'spaces', 'full-staff', 'extended'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export const NOTE_NAMINGS = ['letters', 'solfege'] as const
export type NoteNaming = (typeof NOTE_NAMINGS)[number]

/** The eight settings the player chooses on the setup screen. */
export type GameSettings = {
  mode: Mode
  sessionType: SessionType
  clef: Clef
  rangePreset: RangePreset
  noteNaming: NoteNaming
  strictOctave: boolean
  soundOn: boolean
  previewSound: boolean
}

export const DEFAULT_SETTINGS = {
  mode: 'name',
  sessionType: 'practice',
  clef: 'treble',
  rangePreset: 'full-staff',
  noteNaming: 'letters',
  strictOctave: false,
  soundOn: true,
  previewSound: false,
} as const satisfies GameSettings

/** Timestamps are ISO 8601 strings in UTC. */
export type LocalProfile = {
  id: string
  createdAt: string
  linkedUserId: string | null
}

export type Settings = GameSettings & {
  ownerId: string
  updatedAt: string
}

export type Session = {
  id: string
  ownerId: string
  mode: Mode
  sessionType: SessionType
  clef: Clef
  rangePreset: RangePreset
  strictOctave: boolean
  startedAt: string
  endedAt: string | null
  completed: boolean
  score: number | null
  correctCount: number
  totalCount: number
  bestStreak: number
  syncedAt: string | null
}

export type Attempt = {
  id: string
  sessionId: string
  ownerId: string
  position: number
  targetNote: CanonicalNote
  clef: Clef
  /** Place mode: the canonical note placed. Name mode: the chosen letter. */
  answer: string
  isCorrect: boolean
  responseMs: number
  points: number
  streakAfter: number
  wasRequeued: boolean
  answeredAt: string
  syncedAt: string | null
}
