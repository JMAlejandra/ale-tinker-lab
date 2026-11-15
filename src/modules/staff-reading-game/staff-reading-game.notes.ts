import type {
  CanonicalNote,
  Clef,
  Letter,
  NoteNaming,
  RangePreset,
} from './staff-reading-game.types'

/** Letters in scale order, for the answer buttons. */
export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Lowest and highest step of the visible area (staff plus 2 ledger lines each side). */
export const MIN_STEP = -4
export const MAX_STEP = 12
/** Step of the staff's middle line (B4 treble, D3 bass). */
export const MIDDLE_LINE_STEP = 4

/** Steps of the staff's bottom and top lines. */
export const BOTTOM_LINE_STEP = 0
export const TOP_LINE_STEP = 8

const SOLFEGE: Record<Letter, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

const SEMITONES: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** Bottom-line note of each clef (step 0). */
const BOTTOM_LINE: Record<Clef, { letter: Letter; octave: number }> = {
  treble: { letter: 'E', octave: 4 },
  bass: { letter: 'G', octave: 2 },
}

export type ParsedNote = { letter: Letter; octave: number }

const NOTE_PATTERN = /^([A-G])(\d)$/

/** Returns the letter and octave of a canonical note string, or null if invalid. */
export function parseNote(value: string): ParsedNote | null {
  const match = NOTE_PATTERN.exec(value)
  if (!match) return null
  return { letter: match[1] as Letter, octave: Number(match[2]) }
}

export function isCanonicalNote(value: string): value is CanonicalNote {
  return parseNote(value) !== null
}

export function formatNote(letter: Letter, octave: number): CanonicalNote {
  return `${letter}${octave}`
}

function parseOrThrow(note: CanonicalNote): ParsedNote {
  const parsed = parseNote(note)
  if (!parsed) throw new Error(`Invalid canonical note: ${note}`)
  return parsed
}

/** Position on the diatonic scale: octave * 7 + letter index (C = 0). */
function diatonicIndex({ letter, octave }: ParsedNote): number {
  return octave * 7 + LETTERS.indexOf(letter)
}

export function noteToStep(note: CanonicalNote, clef: Clef): number {
  return diatonicIndex(parseOrThrow(note)) - diatonicIndex(BOTTOM_LINE[clef])
}

export function stepToNote(step: number, clef: Clef): CanonicalNote {
  const index = diatonicIndex(BOTTOM_LINE[clef]) + step
  const letter = LETTERS[((index % 7) + 7) % 7]!
  return formatNote(letter, Math.floor(index / 7))
}

/** Snaps any step into the visible area. */
export function clampStep(step: number): number {
  return Math.min(MAX_STEP, Math.max(MIN_STEP, step))
}

/**
 * Steps at which a ledger line is drawn for a note at `step`, nearest the
 * staff first. Empty for notes on or inside the staff.
 */
export function getLedgerLineSteps(step: number): number[] {
  const lines: number[] = []
  if (step <= -2) {
    for (let s = -2; s >= step; s -= 2) lines.push(s)
  } else if (step >= TOP_LINE_STEP + 2) {
    for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) lines.push(s)
  }
  return lines
}

function notesForSteps(steps: number[], clef: Clef): CanonicalNote[] {
  return steps.map((step) => stepToNote(step, clef))
}

function range(from: number, to: number, by = 1): number[] {
  const out: number[] = []
  for (let s = from; s <= to; s += by) out.push(s)
  return out
}

/** All notes in the clef's visible area, low to high. */
export function visibleNotes(clef: Clef): CanonicalNote[] {
  return notesForSteps(range(MIN_STEP, MAX_STEP), clef)
}

/** Steps each range preset covers, per clef. */
const PRESET_STEPS: Record<RangePreset, Record<Clef, number[]>> = {
  landmarks: { treble: [-2, 2, 5], bass: [3, 6, 10] },
  lines: { treble: range(0, 8, 2), bass: range(0, 8, 2) },
  spaces: { treble: range(1, 7, 2), bass: range(1, 7, 2) },
  'full-staff': { treble: range(0, 8), bass: range(0, 8) },
  extended: { treble: range(MIN_STEP, MAX_STEP), bass: range(MIN_STEP, MAX_STEP) },
}

/** Notes a range preset can prompt for the clef, low to high. */
export function notesForPreset(preset: RangePreset, clef: Clef): CanonicalNote[] {
  return notesForSteps(PRESET_STEPS[preset][clef], clef)
}

export function letterDisplayName(letter: Letter, naming: NoteNaming): string {
  return naming === 'solfege' ? SOLFEGE[letter] : letter
}

/** "G" / "Sol", or "G4" / "Sol4" with `withOctave`. */
export function noteDisplayName(
  note: CanonicalNote,
  naming: NoteNaming,
  options: { withOctave?: boolean } = {},
): string {
  const { letter, octave } = parseOrThrow(note)
  const name = letterDisplayName(letter, naming)
  return options.withOctave ? `${name}${octave}` : name
}

export function noteToMidi(note: CanonicalNote): number {
  const { letter, octave } = parseOrThrow(note)
  return (octave + 1) * 12 + SEMITONES[letter]
}

/** Equal temperament, A4 = 440 Hz. */
export function noteToFrequency(note: CanonicalNote): number {
  return 440 * 2 ** ((noteToMidi(note) - 69) / 12)
}
