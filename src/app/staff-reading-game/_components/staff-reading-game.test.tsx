/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DEFAULT_SETTINGS,
  type AudioEngine,
  type GameSettings,
  type PersonalBestKey,
  type ProgressStorage,
} from '~/modules/staff-reading-game'

import { StaffReadingGame } from './staff-reading-game'

type FakeOptions = {
  settings?: GameSettings
  persisting?: boolean
  bests?: (key: PersonalBestKey) => number | null
}

const silentAudio: AudioEngine = {
  unlock: () => undefined,
  loadSamples: () => Promise.resolve(),
  play: () => undefined,
  setMuted: () => undefined,
  dispose: () => undefined,
}

function createFakeStorage(options: FakeOptions = {}) {
  const saved: GameSettings[] = []
  const bestQueries: PersonalBestKey[] = []
  const unused = () => Promise.reject(new Error('not used by the setup screen'))
  const storage: ProgressStorage = {
    getProfile: () =>
      Promise.resolve({
        id: 'profile-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        linkedUserId: null,
      }),
    getSettings: () => Promise.resolve(options.settings ?? { ...DEFAULT_SETTINGS }),
    saveSettings: (settings) => {
      saved.push(settings)
      return Promise.resolve()
    },
    saveSession: () => Promise.resolve(),
    addAttempt: () => Promise.resolve(),
    listSessions: unused,
    listAttempts: unused,
    getPersonalBest: (key) => {
      bestQueries.push(key)
      return Promise.resolve(options.bests?.(key) ?? null)
    },
    isPersisting: () => Promise.resolve(options.persisting ?? true),
    hasSeenHint: () => Promise.resolve(false),
    markHintSeen: () => Promise.resolve(),
  }
  return { storage, saved, bestQueries }
}

async function renderGame(options?: FakeOptions) {
  const fake = createFakeStorage(options)
  render(
    <StaffReadingGame
      storage={fake.storage}
      audio={silentAudio}
    />,
  )
  await screen.findByRole('button', { name: 'Start' })
  return fake
}

describe('StaffReadingGame setup screen', () => {
  it('shows the spec defaults', async () => {
    await renderGame()
    expect(screen.getByRole('radio', { name: /Name the note/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Practice' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Treble' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Full staff' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Letters (C D E)' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Sound/ })).toBeChecked()
  })

  it('shows strict octave and preview sound only in Place mode', async () => {
    const user = userEvent.setup()
    await renderGame()
    expect(screen.queryByRole('checkbox', { name: /Strict octave/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Preview sound/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Place the note/ }))
    expect(screen.getByRole('checkbox', { name: /Strict octave/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Preview sound while placing/ })).not.toBeChecked()

    await user.click(screen.getByRole('radio', { name: /Name the note/ }))
    expect(screen.queryByRole('checkbox', { name: /Strict octave/ })).not.toBeInTheDocument()
  })

  it('saves every change through the progress storage', async () => {
    const user = userEvent.setup()
    const { saved } = await renderGame()

    await user.click(screen.getByRole('radio', { name: /Place the note/ }))
    await user.click(screen.getByRole('radio', { name: /Round/ }))
    await user.click(screen.getByRole('radio', { name: 'Bass' }))
    await user.click(screen.getByRole('radio', { name: 'Landmarks' }))
    await user.click(screen.getByRole('radio', { name: /Solfège/ }))
    await user.click(screen.getByRole('checkbox', { name: /Strict octave/ }))
    await user.click(screen.getByRole('checkbox', { name: /Sound$/ }))
    await user.click(screen.getByRole('checkbox', { name: /Preview sound/ }))

    await waitFor(() => expect(saved).toHaveLength(8))
    expect(saved.at(-1)).toEqual({
      mode: 'place',
      sessionType: 'round',
      clef: 'bass',
      rangePreset: 'landmarks',
      noteNaming: 'solfege',
      strictOctave: true,
      soundOn: false,
      previewSound: true,
    })
  })

  it('restores saved settings', async () => {
    await renderGame({
      settings: { ...DEFAULT_SETTINGS, mode: 'place', clef: 'bass', strictOctave: true },
    })
    expect(screen.getByRole('radio', { name: /Place the note/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Bass' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Strict octave/ })).toBeChecked()
  })

  it('shows the personal best and updates it when mode, clef or range change', async () => {
    const user = userEvent.setup()
    await renderGame({
      bests: ({ mode, clef, rangePreset }) =>
        mode === 'name' && clef === 'treble' && rangePreset === 'full-staff'
          ? 3450
          : clef === 'bass'
            ? 120
            : null,
    })
    expect(await screen.findByText('Personal best: 3,450')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Bass' }))
    expect(await screen.findByText('Personal best: 120')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Place the note/ }))
    await user.click(screen.getByRole('radio', { name: 'Treble' }))
    await waitFor(() => expect(screen.queryByText(/Personal best/)).not.toBeInTheDocument())
  })

  it('re-fetches the personal best when returning to the setup screen', async () => {
    const user = userEvent.setup()
    let best: number | null = null
    await renderGame({ bests: () => best })
    expect(screen.queryByText(/Personal best/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    best = 500
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    await user.click(screen.getByRole('button', { name: 'Back to setup' }))
    expect(await screen.findByText('Personal best: 500')).toBeInTheDocument()
  })

  it('omits the personal best line when there is none', async () => {
    await renderGame()
    expect(screen.queryByText(/Personal best/)).not.toBeInTheDocument()
  })

  it('shows a status notice only when progress is not being saved', async () => {
    const { unmount } = render(<StaffReadingGame storage={createFakeStorage().storage} />)
    await screen.findByRole('button', { name: 'Start' })
    expect(screen.queryByText(/isn't being saved/)).not.toBeInTheDocument()
    unmount()

    render(<StaffReadingGame storage={createFakeStorage({ persisting: false }).storage} />)
    await screen.findByRole('button', { name: 'Start' })
    expect(screen.getByRole('status')).toHaveTextContent(
      "Progress isn't being saved on this device.",
    )
  })

  it('Start leaves the setup screen and exiting returns with settings kept', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('radio', { name: 'Bass' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Exit' }))
    await user.click(screen.getByRole('button', { name: 'Back to setup' }))
    expect(screen.getByRole('radio', { name: 'Bass' })).toBeChecked()
  })
})
