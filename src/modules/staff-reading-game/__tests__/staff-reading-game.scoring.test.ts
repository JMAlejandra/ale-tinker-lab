import { pointsFor, speedBonus, streakMultiplier } from '~/modules/staff-reading-game'

describe('pointsFor', () => {
  const fast = { responseMs: 500, viaConfirm: false }

  it('awards 150 for a fast correct first answer', () => {
    expect(pointsFor({ ...fast, isCorrect: true, streak: 1 })).toBe(150)
  })

  it('applies the multiplier to base plus bonus and rounds the result', () => {
    // (100 + 25) × 1.5 = 187.5
    expect(pointsFor({ isCorrect: true, responseMs: 3000, viaConfirm: false, streak: 5 })).toBe(188)
    // (100 + 11.25) × 1 = 111.25
    expect(pointsFor({ isCorrect: true, responseMs: 4100, viaConfirm: false, streak: 4 })).toBe(111)
    expect(pointsFor({ isCorrect: true, responseMs: 3000, viaConfirm: false, streak: 10 })).toBe(
      250,
    )
  })

  it('awards 100 at 5 s and slower', () => {
    expect(pointsFor({ isCorrect: true, responseMs: 5000, viaConfirm: false, streak: 1 })).toBe(100)
    expect(pointsFor({ isCorrect: true, responseMs: 60000, viaConfirm: false, streak: 1 })).toBe(
      100,
    )
  })

  it('awards 0 for a wrong answer', () => {
    expect(pointsFor({ ...fast, isCorrect: false, streak: 0 })).toBe(0)
  })
})

describe('streakMultiplier', () => {
  it.each([
    [1, 1],
    [4, 1],
    [5, 1.5],
    [9, 1.5],
    [10, 2],
    [25, 2],
  ])('gives streak %i a multiplier of %d', (streak, multiplier) => {
    expect(streakMultiplier(streak)).toBe(multiplier)
  })
})

describe('speedBonus', () => {
  it.each([
    [0, 50],
    [1000, 50],
    [3000, 25],
    [5000, 0],
    [9000, 0],
  ])('gives %i ms a bonus of %d', (responseMs, bonus) => {
    expect(speedBonus(responseMs, false)).toBe(bonus)
  })

  it.each([
    [1000, 50],
    [2000, 50],
    [4000, 25],
    [5000, 12.5],
    [6000, 0],
    [7000, 0],
  ])('with Confirm, gives %i ms a bonus of %d (window shifted by 1 s)', (responseMs, bonus) => {
    expect(speedBonus(responseMs, true)).toBe(bonus)
  })
})
