/** @jest-environment jsdom */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DEFAULT_SETTINGS,
  noteToStep,
  type Attempt,
  type AudioEngine,
  type CanonicalNote,
  type GameSettings,
  type ProgressStorage,
  type Session,
} from '~/modules/staff-reading-game'

import { stepToY, viewBoxHeight } from './staff-geometry'
import { StaffReadingGame } from './staff-reading-game'

// jsdom has no PointerEvent; a MouseEvent subclass carrying pointerType/pointerId
// lets fireEvent.pointer* deliver the fields the staff reads.
class TestPointerEvent extends MouseEvent {
  pointerType: string
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? ''
    this.pointerId = init.pointerId ?? 1
  }
}

const HEIGHT = viewBoxHeight(false)

beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true })
})

beforeEach(() => {
  jest.useFakeTimers()
  // The staff renders at 1:1 scale: one viewBox unit per pixel, so clientY = stepToY(step).
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: HEIGHT,
    right: 320,
    width: 320,
    height: HEIGHT,
    toJSON: () => ({}),
  })
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  Reflect.deleteProperty(window, 'matchMedia')
})

function createFakeStorage(settings: Partial<GameSettings>) {
  const attempts: Attempt[] = []
  const sessionSaves: Session[] = []
  const storage: ProgressStorage = {
    getProfile: () =>
      Promise.resolve({
        id: 'profile-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        linkedUserId: null,
      }),
    getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS, mode: 'place', ...settings }),
    saveSettings: () => Promise.resolve(),
    saveSession: (session) => {
      sessionSaves.push({ ...session })
      return Promise.resolve()
    },
    addAttempt: (attempt) => {
      attempts.push({ ...attempt })
      return Promise.resolve()
    },
    listSessions: () => Promise.resolve([]),
    listAttempts: () => Promise.resolve([]),
    getPersonalBest: () => Promise.resolve(null),
    isPersisting: () => Promise.resolve(true),
    hasSeenHint: () => Promise.resolve(true),
    markHintSeen: () => Promise.resolve(),
  }
  return { storage, attempts, sessionSaves }
}

function createFakeAudio() {
  const play = jest.fn<void, [CanonicalNote, { delayMs?: number }?]>()
  const audio: AudioEngine = {
    unlock: jest.fn(),
    loadSamples: jest.fn(() => Promise.resolve()),
    play,
    setMuted: jest.fn(),
    dispose: jest.fn(),
  }
  return { audio, play }
}

/** Lets queued storage writes (promise chains) run, without advancing the game's timers. */
async function flushWrites() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

/**
 * Starts Place mode with `rng = () => 0`: the first prompt is E4 (strict octave) or the letter E
 * with target E4, the second F4 or F.
 */
async function startPlace(settings: Partial<GameSettings> = {}) {
  const fake = createFakeStorage(settings)
  const fakeAudio = createFakeAudio()
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  const view = render(
    <StaffReadingGame
      storage={fake.storage}
      audio={fakeAudio.audio}
      rng={() => 0}
    />,
  )
  await user.click(await screen.findByRole('button', { name: 'Start' }))
  await flushWrites()
  return { ...fake, ...fakeAudio, user, view }
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

function staff() {
  return screen.getByRole('slider')
}

/** What the prompt card shows (without the screen-reader-only "Place"). */
function promptName() {
  return screen.getByRole('status').textContent?.replace(/^Place /, '')
}

function feedback() {
  const region = document.querySelector('[aria-live="polite"]')
  if (!region) throw new Error('no feedback region')
  return region
}

function staffNotes() {
  return Array.from(staff().querySelectorAll('g[data-step]')).map((group) => ({
    step: Number(group.getAttribute('data-step')),
    state: group.getAttribute('data-state'),
    icon: group.querySelector('[data-icon]')?.getAttribute('data-icon') ?? null,
  }))
}

function controls() {
  return screen.getByRole('group', { name: 'Place controls' })
}

function control(name: string) {
  return within(controls()).getByRole('button', { name })
}

const step = (note: CanonicalNote) => noteToStep(note, 'treble')

/** Keyboard: the first arrow press lands on the middle line (B4); then one step per press. */
async function placeByKeyboard(user: ReturnType<typeof userEvent.setup>, note: CanonicalNote) {
  await user.keyboard('{ArrowUp}')
  const delta = step(note) - step('B4')
  if (delta !== 0)
    await user.keyboard(`{${delta > 0 ? 'ArrowUp' : 'ArrowDown'}>${Math.abs(delta)}/}`)
}

function touch(type: 'pointerDown' | 'pointerMove' | 'pointerUp', note: CanonicalNote) {
  fireEvent[type](staff(), { pointerType: 'touch', pointerId: 7, clientY: stepToY(step(note)) })
}

function mockCoarsePointer(coarse: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: coarse && query === '(pointer: coarse)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

describe('Place the note: prompt', () => {
  it('shows the letter only with strict octave off, the octave with it on, in the current naming', async () => {
    const off = await startPlace()
    expect(promptName()).toBe('E')
    expect(staffNotes()).toEqual([])
    off.view.unmount()

    await startPlace({ strictOctave: true })
    expect(promptName()).toBe('E4')
  })

  it('names the prompt in solfège when chosen', async () => {
    await startPlace({ noteNaming: 'solfege', strictOctave: true })
    expect(promptName()).toBe('Mi4')
    expect(staff()).toHaveAccessibleName('Treble staff. Place Mi4.')
  })

  it('the next prompt replaces the card and clears the notehead; the staff keeps focus', async () => {
    const { user } = await startPlace({ strictOctave: true })
    const announced = screen.getByRole('status').firstElementChild
    expect(announced).toHaveTextContent('Place E4')
    await placeByKeyboard(user, 'E4')
    // Moving the notehead does not re-render (re-announce) the prompt.
    expect(screen.getByRole('status').firstElementChild).toBe(announced)
    await user.keyboard('{Enter}')
    advance(600)

    expect(promptName()).toBe('F4')
    expect(screen.getByRole('status').firstElementChild).not.toBe(announced)
    expect(staff()).toHaveFocus()
    expect(staff()).toHaveAttribute('aria-valuetext', 'No note placed')
    expect(staffNotes()).toEqual([])
  })
})

describe('Place the note: keyboard', () => {
  it('focuses the heading on entry; the first arrow moves focus to the staff and places the note', async () => {
    const { user } = await startPlace()
    expect(screen.getByRole('heading', { name: 'Place the note' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(staff()).toHaveFocus()
    expect(staffNotes()).toEqual([{ step: step('B4'), state: 'neutral', icon: null }])
    await user.keyboard('{ArrowDown}')
    expect(staffNotes()).toEqual([{ step: step('A4'), state: 'neutral', icon: null }])
  })

  it('arrows pressed on a button move the notehead too', async () => {
    const { user } = await startPlace()
    await user.click(control('Move note up'))
    control('Confirm').focus()
    await user.keyboard('{ArrowUp}')
    expect(staff()).toHaveFocus()
    expect(staffNotes()).toEqual([{ step: step('C5'), state: 'neutral', icon: null }])
  })

  it('arrows move the notehead from the middle line, Enter commits the placed note', async () => {
    const { user, attempts, play } = await startPlace({ sessionType: 'round', strictOctave: true })

    await user.keyboard('{Enter}')
    await flushWrites()
    expect(attempts).toHaveLength(0)

    await user.keyboard('{ArrowUp}')
    expect(staffNotes()).toEqual([{ step: step('B4'), state: 'neutral', icon: null }])
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(staffNotes()).toEqual([{ step: step('E4'), state: 'neutral', icon: null }])
    expect(play).not.toHaveBeenCalled()

    advance(1500)
    await user.keyboard('{Enter}')
    await flushWrites()

    expect(attempts[0]).toMatchObject({ targetNote: 'E4', answer: 'E4', isCorrect: true })
    // Keyboard commits use the normal window: 1.5 s earns a bonus of 43.75.
    expect(attempts[0]?.points).toBe(144)
    expect(play.mock.calls).toEqual([['E4']])
  })

  it('shows the controls after a keyboard placement, never for mouse use alone', async () => {
    const { user } = await startPlace()
    expect(controls()).toHaveClass('invisible')

    fireEvent.pointerMove(staff(), { pointerType: 'mouse', clientY: stepToY(step('G4')) })
    expect(controls()).toHaveClass('invisible')

    await user.keyboard('{ArrowUp}')
    expect(controls()).not.toHaveClass('invisible')
  })

  it('Name mode letter and number keys do nothing; Escape still exits', async () => {
    const { user, attempts } = await startPlace()
    await user.keyboard('e5')
    await flushWrites()
    expect(attempts).toHaveLength(0)
    expect(staffNotes()).toEqual([])

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })
})

describe('Place the note: mouse', () => {
  it('a ghost follows the pointer and a click commits without Confirm', async () => {
    const { attempts } = await startPlace({ sessionType: 'round', strictOctave: true })
    const y = stepToY(step('E4'))

    fireEvent.pointerMove(staff(), { pointerType: 'mouse', clientY: stepToY(step('G4')) })
    expect(staffNotes()).toEqual([{ step: step('G4'), state: 'ghost', icon: null }])
    fireEvent.pointerMove(staff(), { pointerType: 'mouse', clientY: y })
    expect(staffNotes()).toEqual([{ step: step('E4'), state: 'ghost', icon: null }])

    advance(1500)
    fireEvent.pointerDown(staff(), { pointerType: 'mouse', button: 0, clientY: y })
    fireEvent.pointerUp(staff(), { pointerType: 'mouse', button: 0, clientY: y })
    await flushWrites()

    expect(attempts[0]).toMatchObject({ answer: 'E4', isCorrect: true, points: 144 })
    expect(staffNotes()).toEqual([{ step: step('E4'), state: 'correct', icon: 'correct' }])
  })
})

describe('Place the note: touch and Confirm', () => {
  it('Confirm is disabled until a notehead is placed', async () => {
    const { user, attempts } = await startPlace()
    expect(control('Confirm')).toHaveAttribute('aria-disabled', 'true')
    await user.click(control('Confirm'))
    await flushWrites()
    expect(attempts).toHaveLength(0)
  })

  it('a tap places a provisional notehead, drag and the buttons adjust it, Confirm commits', async () => {
    const { user, attempts } = await startPlace({ sessionType: 'round', strictOctave: true })

    touch('pointerDown', 'A4')
    expect(staffNotes()).toEqual([{ step: step('A4'), state: 'neutral', icon: null }])
    expect(controls()).not.toHaveClass('invisible')
    touch('pointerMove', 'G4')
    touch('pointerUp', 'G4')
    expect(staffNotes()).toEqual([{ step: step('G4'), state: 'neutral', icon: null }])
    await flushWrites()
    expect(attempts).toHaveLength(0)

    await user.click(control('Move note down'))
    await user.click(control('Move note down'))
    await user.click(control('Move note up'))
    expect(staffNotes()).toEqual([{ step: step('F4'), state: 'neutral', icon: null }])
    await user.click(control('Move note down'))
    expect(control('Confirm')).not.toHaveAttribute('aria-disabled')

    advance(1500)
    await user.click(control('Confirm'))
    await flushWrites()

    expect(attempts[0]).toMatchObject({ answer: 'E4', isCorrect: true })
    // Confirm shifts the speed window by 1 s (D13): 1.5 s still earns the full bonus.
    expect(attempts[0]?.points).toBe(150)
    expect(staffNotes()).toEqual([{ step: step('E4'), state: 'correct', icon: 'correct' }])
    expect(feedback()).toHaveTextContent('Correct, E4')
  })

  it('Up and Down with no notehead start on the middle line', async () => {
    const { user } = await startPlace()
    await user.click(control('Move note down'))
    expect(staff()).toHaveAttribute('aria-valuetext', 'third line')
    expect(staffNotes()).toEqual([{ step: step('B4'), state: 'neutral', icon: null }])
  })

  it('shows the controls from the start on coarse-pointer devices', async () => {
    mockCoarsePointer(true)
    await startPlace()
    expect(controls()).not.toHaveClass('invisible')
    for (const name of ['Move note up', 'Move note down', 'Confirm']) {
      expect(control(name)).toHaveClass('h-14', 'touch-manipulation')
    }
  })

  it('locks the staff and the buttons during feedback', async () => {
    const { user, attempts } = await startPlace()
    touch('pointerDown', 'E4')
    touch('pointerUp', 'E4')
    await user.click(control('Confirm'))

    touch('pointerDown', 'G4')
    await user.keyboard('{ArrowUp}')
    await user.click(control('Move note up'))
    await user.click(control('Confirm'))
    await flushWrites()

    expect(attempts).toHaveLength(1)
    expect(control('Confirm')).toHaveAttribute('aria-disabled', 'true')
    expect(control('Move note up')).toHaveAttribute('aria-disabled', 'true')
    expect(staffNotes()).toEqual([{ step: step('E4'), state: 'correct', icon: 'correct' }])
  })
})

describe('Place the note: correctness', () => {
  it('strict octave off: any octave of the prompted letter is correct and is stored as placed', async () => {
    const { user, attempts } = await startPlace()
    expect(promptName()).toBe('E')

    await placeByKeyboard(user, 'E5')
    await user.keyboard('{Enter}')
    await flushWrites()

    expect(attempts[0]).toMatchObject({ targetNote: 'E4', answer: 'E5', isCorrect: true })
    expect(staffNotes()).toEqual([{ step: step('E5'), state: 'correct', icon: 'correct' }])
    expect(feedback()).toHaveTextContent('Correct, E')
    expect(feedback()).not.toHaveTextContent('E5')
  })

  it('strict octave on: only the exact pitch is correct', async () => {
    const { user, attempts } = await startPlace({ strictOctave: true })
    await placeByKeyboard(user, 'E5')
    await user.keyboard('{Enter}')
    await flushWrites()
    expect(attempts[0]).toMatchObject({ targetNote: 'E4', answer: 'E5', isCorrect: false })
  })
})

describe('Place the note: wrong-answer feedback and sound', () => {
  it('marks the placed note red and the correct note green, announces it and plays both', async () => {
    const { user, attempts, play } = await startPlace({ strictOctave: true })

    await placeByKeyboard(user, 'G4')
    await user.keyboard('{Enter}')
    await flushWrites()

    expect(attempts[0]).toMatchObject({ answer: 'G4', isCorrect: false, streakAfter: 0 })
    expect(staffNotes()).toEqual([
      { step: step('G4'), state: 'wrong', icon: 'wrong' },
      { step: step('E4'), state: 'correct', icon: 'correct' },
    ])
    expect(feedback()).toHaveTextContent('Wrong, it was E4')
    expect(feedback().querySelector('[data-icon="wrong"]')).not.toBeNull()
    expect(play.mock.calls).toEqual([['G4'], ['E4', { delayMs: 400 }]])

    advance(600)
    expect(staffNotes()).toHaveLength(2)
    advance(600)
    expect(staffNotes()).toEqual([])
  })

  it('letter prompts show their target note as the correct one, without the octave in the text', async () => {
    const { user, play } = await startPlace({ noteNaming: 'solfege' })
    await placeByKeyboard(user, 'D5')
    await user.keyboard('{Enter}')

    // Two columns even when the noteheads are one step apart, so both stay visible.
    expect(staffNotes()).toEqual([
      { step: step('D5'), state: 'wrong', icon: 'wrong' },
      { step: step('E4'), state: 'correct', icon: 'correct' },
    ])
    expect(feedback()).toHaveTextContent('Wrong, it was Mi')
    expect(play.mock.calls).toEqual([['D5'], ['E4', { delayMs: 400 }]])
  })

  it('a correct answer plays only the placed note', async () => {
    const { user, play } = await startPlace()
    await placeByKeyboard(user, 'E5')
    await user.keyboard('{Enter}')
    expect(play.mock.calls).toEqual([['E5']])
  })
})

describe('Place the note: preview sound', () => {
  it('plays each new step of the provisional notehead and the ghost', async () => {
    const { user, play } = await startPlace({ previewSound: true })

    await user.keyboard('{ArrowUp}{ArrowUp}')
    await user.click(control('Move note down'))
    fireEvent.pointerMove(staff(), { pointerType: 'mouse', clientY: stepToY(step('G4')) })
    fireEvent.pointerMove(staff(), { pointerType: 'mouse', clientY: stepToY(step('G4')) })
    touch('pointerDown', 'F4')

    expect(play.mock.calls).toEqual([['B4'], ['C5'], ['B4'], ['G4'], ['F4']])
  })

  it('stays silent while placing with preview sound off, or with sound off', async () => {
    const off = await startPlace()
    await off.user.keyboard('{ArrowUp}{ArrowUp}')
    expect(off.play).not.toHaveBeenCalled()
    off.view.unmount()

    const muted = await startPlace({ previewSound: true, soundOn: false })
    await muted.user.keyboard('{ArrowUp}{ArrowUp}')
    expect(muted.play).not.toHaveBeenCalled()
  })

  it('never previews during feedback', async () => {
    const { user, play } = await startPlace({ previewSound: true })
    await user.keyboard('{ArrowUp}{Enter}')
    play.mockClear()
    fireEvent.pointerMove(staff(), { pointerType: 'mouse', clientY: stepToY(step('G4')) })
    await user.keyboard('{ArrowUp}')
    expect(play).not.toHaveBeenCalled()
  })
})

describe('Place the note: Round end', () => {
  /** Places each prompt (strict octave, letter names) with a mouse click until the Round ends. */
  async function playRound() {
    for (let i = 0; i < 20; i++) {
      const name = promptName() as CanonicalNote
      const y = stepToY(step(name))
      fireEvent.pointerDown(staff(), { pointerType: 'mouse', button: 0, clientY: y })
      fireEvent.pointerUp(staff(), { pointerType: 'mouse', button: 0, clientY: y })
      advance(600)
    }
    await flushWrites()
  }

  it('a completed Place Round reaches the end screen, and Play again starts a new Place Round', async () => {
    const { sessionSaves, attempts, user } = await startPlace({
      sessionType: 'round',
      strictOctave: true,
    })
    await playRound()

    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument()
    expect(attempts).toHaveLength(20)
    expect(
      attempts.every((attempt) => attempt.isCorrect && attempt.answer === attempt.targetNote),
    ).toBe(true)
    expect(sessionSaves.at(-1)).toMatchObject({ mode: 'place', completed: true, correctCount: 20 })

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    await flushWrites()

    expect(promptName()).toBe('E4')
    expect(staffNotes()).toEqual([])
    expect(control('Confirm')).toHaveAttribute('aria-disabled', 'true')
    expect(sessionSaves.at(-1)).toMatchObject({
      mode: 'place',
      sessionType: 'round',
      strictOctave: true,
      completed: false,
    })
    expect(new Set(sessionSaves.map((save) => save.id)).size).toBe(2)

    await placeByKeyboard(user, 'E4')
    await user.keyboard('{Enter}')
    await flushWrites()
    expect(attempts.at(-1)).toMatchObject({ answer: 'E4', isCorrect: true, position: 1 })
  })
})
