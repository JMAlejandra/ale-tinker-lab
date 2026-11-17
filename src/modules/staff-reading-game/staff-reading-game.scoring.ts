/** Points before the speed bonus and streak multiplier. */
const BASE_POINTS = 100
const MAX_SPEED_BONUS = 50
/** The bonus is full up to this response time and falls linearly to 0 at `ZERO_BONUS_MS`. */
const FULL_BONUS_MS = 1000
const ZERO_BONUS_MS = 5000
/** Extra time allowed for the Confirm tap in the touch Place flow. */
const CONFIRM_SHIFT_MS = 1000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Multiplier for a correct answer, by the streak including that answer: ×1 (1–4), ×1.5 (5–9), ×2 (10+). */
export function streakMultiplier(streak: number): number {
  if (streak >= 10) return 2
  if (streak >= 5) return 1.5
  return 1
}

/**
 * Speed bonus (0–50, unrounded) for a correct answer. Full up to 1 s, 0 from 5 s.
 * `viaConfirm` (committed with the Confirm button, D13) shifts the window by 1 s.
 */
export function speedBonus(responseMs: number, viaConfirm: boolean): number {
  const t = responseMs - (viaConfirm ? CONFIRM_SHIFT_MS : 0)
  const fraction = (ZERO_BONUS_MS - t) / (ZERO_BONUS_MS - FULL_BONUS_MS)
  return MAX_SPEED_BONUS * clamp(fraction, 0, 1)
}

export type PointsInput = {
  isCorrect: boolean
  responseMs: number
  viaConfirm: boolean
  /** Streak including this answer. */
  streak: number
}

/** round((100 + speed bonus) × streak multiplier) for a correct answer, 0 for a wrong one. */
export function pointsFor({ isCorrect, responseMs, viaConfirm, streak }: PointsInput): number {
  if (!isCorrect) return 0
  return Math.round((BASE_POINTS + speedBonus(responseMs, viaConfirm)) * streakMultiplier(streak))
}
