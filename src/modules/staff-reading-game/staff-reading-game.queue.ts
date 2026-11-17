import { notesForPreset, parseNote } from './staff-reading-game.notes'
import type { CanonicalNote, GameSettings, Letter } from './staff-reading-game.types'

/** Two random values in [0, 1) that decide one new prompt. */
export type PromptDraw = { pick: number; variant: number }

/**
 * One upcoming prompt: a new prompt (drawn only when it becomes current, so it can avoid the
 * note just shown) or a re-queued miss.
 */
export type QueueSlot =
  | { kind: 'new' }
  | {
      kind: 'requeued'
      targetNote: CanonicalNote
      /** Position of the miss that re-queued it. */
      missedAt: number
    }

export function newSlots(count: number): QueueSlot[] {
  return Array.from({ length: count }, () => ({ kind: 'new' }))
}

const MIN_REQUEUE_OFFSET = 3
const MAX_REQUEUE_OFFSET = 5

/**
 * Inserts a missed note so it is the k-th prompt after the miss, k ∈ {3, 4, 5} drawn
 * uniformly with `roll`; at the end if fewer than k prompts remain (D11). It may arrive later
 * (a later miss inserted ahead of it, or the adjacency shift), never earlier (D29).
 */
export function requeue(
  upcoming: readonly QueueSlot[],
  targetNote: CanonicalNote,
  missedAt: number,
  roll: number,
): QueueSlot[] {
  const offsets = MAX_REQUEUE_OFFSET - MIN_REQUEUE_OFFSET + 1
  const k = MIN_REQUEUE_OFFSET + Math.min(offsets - 1, Math.floor(roll * offsets))
  const index = Math.min(k - 1, upcoming.length)
  return [
    ...upcoming.slice(0, index),
    { kind: 'requeued', targetNote, missedAt },
    ...upcoming.slice(index),
  ]
}

/**
 * Takes the slot that becomes current, at `position`. A re-queued note that would come right
 * after the same prompt (`justShown` identity) waits behind the nearest slot that won't repeat
 * it (D11, D29): a new slot (its draw excludes the note just shown), else a re-queue of another
 * note that is still at least 3rd after its own miss. With neither, the repeat is shown anyway.
 */
export function takeNextSlot(
  upcoming: readonly QueueSlot[],
  justShown: string | null,
  letterOnly: boolean,
  position: number,
): { slot: QueueSlot; rest: QueueSlot[] } | null {
  const [first] = upcoming
  if (!first) return null
  const repeats = (slot: QueueSlot) =>
    slot.kind === 'requeued' && promptIdentity(slot.targetNote, letterOnly) === justShown
  if (!repeats(first)) return takeAt(upcoming, 0)
  const newIndex = upcoming.findIndex((slot) => slot.kind === 'new')
  if (newIndex !== -1) return takeAt(upcoming, newIndex)
  const requeueIndex = upcoming.findIndex(
    (slot) =>
      slot.kind === 'requeued' && !repeats(slot) && position - slot.missedAt >= MIN_REQUEUE_OFFSET,
  )
  return takeAt(upcoming, requeueIndex === -1 ? 0 : requeueIndex)
}

function takeAt(upcoming: readonly QueueSlot[], index: number) {
  return {
    slot: upcoming[index]!,
    rest: [...upcoming.slice(0, index), ...upcoming.slice(index + 1)],
  }
}

/** Place mode with strict octave off prompts a letter only (D8). */
export function isLetterOnly(settings: GameSettings): boolean {
  return settings.mode === 'place' && !settings.strictOctave
}

function letterOf(note: CanonicalNote): Letter {
  const parsed = parseNote(note)
  if (!parsed) throw new Error(`Invalid canonical note: ${note}`)
  return parsed.letter
}

/**
 * What identifies a prompt for never-twice-in-a-row and re-queue (D10):
 * the letter for letter prompts, the canonical note otherwise.
 */
export function promptIdentity(targetNote: CanonicalNote, letterOnly: boolean): string {
  return letterOnly ? letterOf(targetNote) : targetNote
}

/** Picks an item from a non-empty list with a random value in [0, 1). */
function pickFrom<T>(items: readonly T[], roll: number): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(roll * items.length)))
  return items[index]!
}

/** Picks uniformly among `items` other than `excluded` (all of them if none would remain). */
function pickExcluding<T extends string>(
  items: readonly T[],
  excluded: string | null,
  roll: number,
): T {
  const candidates = items.filter((item) => item !== excluded)
  return pickFrom(candidates.length > 0 ? candidates : items, roll)
}

/**
 * Draws a new prompt's target note uniformly from the preset, excluding the prompt just shown
 * (`justShown` is its identity). Letter prompts draw the letter first, then a note with it (D8).
 */
export function drawTargetNote(
  settings: GameSettings,
  draw: PromptDraw,
  justShown: string | null,
): CanonicalNote {
  const notes = notesForPreset(settings.rangePreset, settings.clef)
  if (!isLetterOnly(settings)) return pickExcluding(notes, justShown, draw.pick)
  const letters = [...new Set(notes.map(letterOf))]
  const letter = pickExcluding(letters, justShown, draw.pick)
  return pickFrom(
    notes.filter((note) => letterOf(note) === letter),
    draw.variant,
  )
}
