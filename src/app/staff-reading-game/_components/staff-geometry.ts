import {
  BOTTOM_LINE_STEP,
  MAX_STEP,
  MIN_STEP,
  TOP_LINE_STEP,
  clampStep,
} from '~/modules/staff-reading-game'

/**
 * Geometry of the Staff component, in viewBox units. The viewBox is 320 units wide
 * at minimum and the staff is rendered at `width: 100%` (max 640 px), so at 320 px
 * one unit is one pixel and the line spacing is exactly 24 px.
 */
export const STAFF_SPACE = 24
const HALF_SPACE = STAFF_SPACE / 2

export const MIN_VIEWBOX_WIDTH = 320
const PADDING_TOP = STAFF_SPACE
const PADDING_BOTTOM = STAFF_SPACE
/** Extra row under the staff for result icons in the compact layout. */
const ICON_ROW_HEIGHT = 20

export const CLEF_X = 10
/** First x where noteheads may go, right of the widest clef. */
const NOTES_START_X = 88
const STAFF_MARGIN_RIGHT = 6
/** Horizontal room per note: notehead plus result icon to its right. */
const NOTE_SLOT = 56
/** Compact: notehead only, icons go in a row under the staff. */
const COMPACT_NOTE_SLOT = 34

export function stepToY(step: number): number {
  return PADDING_TOP + (MAX_STEP - step) * HALF_SPACE
}

export const STAFF_LINE_STEPS: readonly number[] = [0, 2, 4, 6, 8]

const STAFF_HEIGHT = stepToY(MIN_STEP) + PADDING_BOTTOM

export function viewBoxHeight(compact: boolean): number {
  return compact ? STAFF_HEIGHT + ICON_ROW_HEIGHT : STAFF_HEIGHT
}

/** Centre y of the compact layout's icon row. */
export const ICON_ROW_Y = STAFF_HEIGHT + 6

export type NoteLayout = {
  /** viewBox width: 320, or wider when the notes need more room. */
  width: number
  /** Centre x of each notehead, left to right. */
  xs: number[]
}

/**
 * Spreads `count` noteheads left to right after the clef. They are centred in
 * the space when they fit in 320 units; otherwise the viewBox grows.
 */
export function layoutNotes(count: number, compact: boolean): NoteLayout {
  const slot = compact ? COMPACT_NOTE_SLOT : NOTE_SLOT
  const available = MIN_VIEWBOX_WIDTH - STAFF_MARGIN_RIGHT - NOTES_START_X
  const needed = count * slot
  const width = Math.max(MIN_VIEWBOX_WIDTH, NOTES_START_X + needed + STAFF_MARGIN_RIGHT)
  const start = NOTES_START_X + Math.max(0, (available - needed) / 2)
  const xs = Array.from({ length: count }, (_, i) => start + slot * (i + 0.5))
  return { width, xs }
}

export function staffRightX(width: number): number {
  return width - STAFF_MARGIN_RIGHT
}

/**
 * Converts a pointer's clientY to the nearest step in the visible area, using the
 * element's on-screen rect so any CSS scaling is accounted for. Positions outside
 * the visible area snap to the nearest valid step. Returns null when the element
 * has no layout (zero height).
 */
export function pointerYToStep(
  clientY: number,
  rect: { top: number; height: number },
  viewBoxHeightUnits: number,
): number | null {
  if (!(rect.height > 0)) return null
  const y = ((clientY - rect.top) * viewBoxHeightUnits) / rect.height
  const step = MAX_STEP - Math.round((y - PADDING_TOP) / HALF_SPACE)
  return clampStep(step)
}

function ordinal(n: number): string {
  return ['first', 'second', 'third', 'fourth', 'fifth'][n - 1] ?? `${n}th`
}

/**
 * Describes where a step sits ("second line", "space above the staff") without
 * naming the note, so screen readers do not give the answer away.
 */
export function describeStep(step: number): string {
  if (step >= BOTTOM_LINE_STEP && step <= TOP_LINE_STEP) {
    const n = Math.floor((step - BOTTOM_LINE_STEP) / 2) + 1
    return step % 2 === 0 ? `${ordinal(n)} line` : `${ordinal(n)} space`
  }
  const above = step > TOP_LINE_STEP
  const distance = above ? step - TOP_LINE_STEP : BOTTOM_LINE_STEP - step
  const side = above ? 'above' : 'below'
  if (distance === 1) return `space ${side} the staff`
  const ledger = Math.floor(distance / 2)
  return distance % 2 === 0
    ? `${ordinal(ledger)} ledger line ${side}`
    : `space ${side} the ${ordinal(ledger)} ledger line`
}
