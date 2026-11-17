/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DEFAULT_SETTINGS,
  createSession,
  noteToStep,
  type AttemptRecord,
  type CanonicalNote,
  type GameSettings,
  type SessionState,
} from '~/modules/staff-reading-game'

import { EndScreen } from './end-screen'

type Spec = { note: CanonicalNote; correct: boolean; requeued?: boolean; ms?: number }

function endedRound(specs: Spec[], settings: Partial<GameSettings> = {}): SessionState {
  let streak = 0
  const attempts: AttemptRecord[] = specs.map((spec, position) => {
    streak = spec.correct ? streak + 1 : 0
    return {
      position,
      targetNote: spec.note,
      clef: 'treble',
      answer: spec.correct ? 'C' : 'B',
      isCorrect: spec.correct,
      responseMs: spec.ms ?? 1000,
      points: spec.correct ? 100 : 0,
      streakAfter: streak,
      wasRequeued: spec.requeued ?? false,
    }
  })
  return {
    ...createSession({ ...DEFAULT_SETTINGS, sessionType: 'round', ...settings }),
    status: 'ended',
    completed: true,
    attempts,
  }
}

function renderEnd(
  state: SessionState,
  personalBestBefore: number | null = null,
  handlers: { onPlayAgain?: () => void; onChangeSettings?: () => void } = {},
) {
  return render(
    <EndScreen
      state={state}
      personalBestBefore={personalBestBefore}
      onPlayAgain={handlers.onPlayAgain ?? (() => undefined)}
      onChangeSettings={handlers.onChangeSettings ?? (() => undefined)}
    />,
  )
}

/** 20 first-time prompts, 17 correct, three misses; the A3 miss is re-queued and fixed. */
function mixedRound(): SessionState {
  const specs: Spec[] = []
  for (let i = 0; i < 17; i++) specs.push({ note: 'E4', correct: true, ms: 1800 })
  specs.push({ note: 'G5', correct: false, ms: 1800 })
  specs.push({ note: 'A3', correct: false, ms: 1800 })
  specs.push({ note: 'D4', correct: false, ms: 1800 })
  specs.push({ note: 'A3', correct: true, requeued: true, ms: 1800 })
  return endedRound(specs)
}

function resultStaff() {
  return screen.getByRole('img', { name: /^Results staff/ })
}

function staffStates() {
  return [...resultStaff().querySelectorAll('g[data-step]')].map((g) => ({
    step: Number(g.getAttribute('data-step')),
    state: g.getAttribute('data-state'),
  }))
}

describe('EndScreen stats', () => {
  it('shows the heading, formatted score, accuracy, average response time and best streak', () => {
    const state = endedRound([
      ...Array.from({ length: 12 }, () => ({ note: 'C4' as const, correct: true, ms: 1500 })),
      { note: 'D4', correct: false, ms: 3000 },
      { note: 'D4', correct: true, requeued: true, ms: 1500 },
    ])
    renderEnd(state, 5000)

    expect(screen.getByRole('heading', { name: 'Round complete' })).toHaveFocus()
    // 13 correct attempts at 100 points each
    expect(screen.getByText('1,300')).toBeInTheDocument()
    const stat = (label: string) =>
      screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
    // 12 of the 13 first-time prompts were right
    expect(stat('Accuracy')).toBe('12/13 (92%)')
    // (12 * 1.5 + 3 + 1.5) / 14 = 1.607...
    expect(stat('Avg. response')).toBe('1.6 s')
    expect(stat('Best streak')).toBe('12')
  })

  it('formats a 20-prompt Round as 17/20 (85%) and 1.8 s', () => {
    renderEnd(mixedRound(), 100_000)
    expect(screen.getByText('17/20 (85%)')).toBeInTheDocument()
    expect(screen.getByText('1.8 s')).toBeInTheDocument()
  })
})

describe('EndScreen personal best', () => {
  it('shows the badge for a first Round (no previous best)', () => {
    renderEnd(mixedRound(), null)
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    expect(screen.queryByText(/^Personal best:/)).not.toBeInTheDocument()
  })

  it('shows the badge when the score is strictly higher than the previous best', () => {
    renderEnd(mixedRound(), 1700)
    expect(screen.getByText('New personal best')).toBeInTheDocument()
  })

  it('shows no badge when the score equals the previous best, and shows that best quietly', () => {
    renderEnd(mixedRound(), 1800)
    expect(screen.queryByText('New personal best')).not.toBeInTheDocument()
    expect(screen.getByText('Personal best: 1,800')).toBeInTheDocument()
  })

  it('shows no badge when the score is lower than the previous best', () => {
    renderEnd(mixedRound(), 12_345)
    expect(screen.queryByText('New personal best')).not.toBeInTheDocument()
    expect(screen.getByText('Personal best: 12,345')).toBeInTheDocument()
  })
})

describe('EndScreen results staff', () => {
  it('draws every prompted note low to high, coloured by result', () => {
    renderEnd(mixedRound())

    expect(staffStates()).toEqual([
      { step: noteToStep('A3', 'treble'), state: 'amber' },
      { step: noteToStep('D4', 'treble'), state: 'wrong' },
      { step: noteToStep('E4', 'treble'), state: 'correct' },
      { step: noteToStep('G5', 'treble'), state: 'wrong' },
    ])
    expect(resultStaff()).toHaveAccessibleName(
      'Results staff, 4 notes from low to high: 1 always correct, 1 mixed, 2 always missed',
    )
  })

  it('lists each note with its result for screen readers, in the chosen naming', () => {
    renderEnd(
      endedRound(
        [
          { note: 'G5', correct: false },
          { note: 'C4', correct: true },
        ],
        { noteNaming: 'solfege' },
      ),
    )
    const items = within(screen.getByRole('list', { name: 'Result for each note' })).getAllByRole(
      'listitem',
    )
    expect(items.map((item) => item.textContent)).toEqual([
      'Do4: always correct',
      'Sol5: always missed',
    ])
  })

  it('explains the colours with a legend that does not rely on colour alone', () => {
    const { container } = renderEnd(mixedRound())
    expect(screen.getByText('Always correct')).toBeInTheDocument()
    expect(screen.getByText('Mixed')).toBeInTheDocument()
    expect(screen.getByText('Always missed')).toBeInTheDocument()
    for (const icon of ['correct', 'mixed', 'wrong']) {
      expect(container.querySelector(`ul[aria-hidden] [data-icon="${icon}"]`)).not.toBeNull()
    }
  })
})

describe('EndScreen actions', () => {
  it('Play again and Change settings call their handlers', async () => {
    const onPlayAgain = jest.fn()
    const onChangeSettings = jest.fn()
    const user = userEvent.setup()
    renderEnd(mixedRound(), null, { onPlayAgain, onChangeSettings })

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
    expect(onChangeSettings).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Change settings' }))
    expect(onChangeSettings).toHaveBeenCalledTimes(1)
  })
})
