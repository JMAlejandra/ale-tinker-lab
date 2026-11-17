import { MAX_STEP, MIDDLE_LINE_STEP, MIN_STEP } from '~/modules/staff-reading-game'

import {
  MIN_VIEWBOX_WIDTH,
  STAFF_SPACE,
  describeStep,
  layoutNotes,
  pointerYToStep,
  stepToY,
  viewBoxHeight,
} from './staff-geometry'

describe('staff geometry', () => {
  const height = viewBoxHeight(false)

  it('fits the visible area with padding in a 320-unit-wide viewBox at 24-unit spacing', () => {
    expect(STAFF_SPACE).toBe(24)
    expect(stepToY(0) - stepToY(2)).toBe(STAFF_SPACE)
    expect(stepToY(MAX_STEP)).toBeGreaterThan(0)
    expect(stepToY(MIN_STEP)).toBeLessThan(height)
    expect(layoutNotes(1, false).width).toBe(MIN_VIEWBOX_WIDTH)
  })

  describe('pointerYToStep', () => {
    it('maps each step centre back to its step at 1:1 scale', () => {
      const rect = { top: 0, height }
      for (let step = MIN_STEP; step <= MAX_STEP; step++) {
        expect(pointerYToStep(stepToY(step), rect, height)).toBe(step)
      }
    })

    it('snaps to the nearest line or space', () => {
      const rect = { top: 0, height }
      const middle = stepToY(MIDDLE_LINE_STEP)
      expect(pointerYToStep(middle - 5, rect, height)).toBe(MIDDLE_LINE_STEP)
      expect(pointerYToStep(middle + 5, rect, height)).toBe(MIDDLE_LINE_STEP)
      expect(pointerYToStep(middle - 7, rect, height)).toBe(MIDDLE_LINE_STEP + 1)
      expect(pointerYToStep(middle + 7, rect, height)).toBe(MIDDLE_LINE_STEP - 1)
    })

    it('accounts for the element offset and CSS scaling', () => {
      const rect = { top: 100, height: height * 2 }
      expect(pointerYToStep(100 + stepToY(3) * 2, rect, height)).toBe(3)
      expect(pointerYToStep(100 + stepToY(-2) * 2 + 3, rect, height)).toBe(-2)
    })

    it('clamps positions outside the visible area to the nearest valid step', () => {
      const rect = { top: 50, height }
      expect(pointerYToStep(0, rect, height)).toBe(MAX_STEP)
      expect(pointerYToStep(-1000, rect, height)).toBe(MAX_STEP)
      expect(pointerYToStep(50 + height, rect, height)).toBe(MIN_STEP)
      expect(pointerYToStep(5000, rect, height)).toBe(MIN_STEP)
    })

    it('returns null when the element has no layout', () => {
      expect(pointerYToStep(10, { top: 0, height: 0 }, height)).toBeNull()
    })
  })

  describe('layoutNotes', () => {
    it('spreads notes left to right without overlap', () => {
      const { xs } = layoutNotes(3, false)
      expect(xs).toHaveLength(3)
      expect(xs[0]!).toBeLessThan(xs[1]!)
      expect(xs[1]! - xs[0]!).toBeGreaterThanOrEqual(STAFF_SPACE * 2)
    })

    it('widens the viewBox when the notes do not fit, keeping every note inside', () => {
      const { width, xs } = layoutNotes(17, true)
      expect(width).toBeGreaterThan(MIN_VIEWBOX_WIDTH)
      expect(xs[16]!).toBeLessThan(width)
      expect(xs[1]! - xs[0]!).toBeGreaterThan(STAFF_SPACE)
    })

    it('needs less room per note in the compact layout', () => {
      expect(layoutNotes(17, true).width).toBeLessThan(layoutNotes(17, false).width)
    })
  })

  describe('describeStep', () => {
    it.each([
      [0, 'first line'],
      [1, 'first space'],
      [4, 'third line'],
      [8, 'fifth line'],
      [9, 'space above the staff'],
      [10, 'first ledger line above'],
      [11, 'space above the first ledger line'],
      [12, 'second ledger line above'],
      [-1, 'space below the staff'],
      [-2, 'first ledger line below'],
      [-3, 'space below the first ledger line'],
      [-4, 'second ledger line below'],
    ])('describes step %i as "%s"', (step, text) => {
      expect(describeStep(step)).toBe(text)
    })
  })
})
