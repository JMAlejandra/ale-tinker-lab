/** @jest-environment jsdom */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DEFAULT_SETTINGS,
  LETTERS,
  parseNote,
  stepToNote,
  type Attempt,
  type AudioEngine,
  type GameSettings,
  type Letter,
  type PersonalBestKey,
  type ProgressStorage,
  type Session,
} from '~/modules/staff-reading-game'

import { StaffReadingGame } from './staff-reading-game'

type FakeStorageOptions = {
  settings?: Partial<GameSettings>
  best?: number | null
  /** Personal best computed from the completed Rounds saved so far (and `best` as the floor). */
  liveBest?: boolean
  seenHints?: string[]
  failWrites?: boolean
}

function createFakeStorage(options: FakeStorageOptions = {}) {
  const sessionSaves: Session[] = []
  const attempts: Attempt[] = []
  const settingsSaves: GameSettings[] = []
  const bestQueries: PersonalBestKey[] = []
  const hintsMarked: string[] = []
  const fail = () => Promise.reject(new Error('storage full'))
  const storage: ProgressStorage = {
    getProfile: () =>
      Promise.resolve({
        id: 'profile-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        linkedUserId: null,
      }),
    getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS, ...options.settings }),
    saveSettings: (settings) => {
      settingsSaves.push(settings)
      return Promise.resolve()
    },
    saveSession: (session) => {
      if (options.failWrites) return fail()
      sessionSaves.push({ ...session })
      return Promise.resolve()
    },
    addAttempt: (attempt) => {
      if (options.failWrites) return fail()
      attempts.push({ ...attempt })
      return Promise.resolve()
    },
    listSessions: () => Promise.resolve([]),
    listAttempts: () => Promise.resolve([]),
    getPersonalBest: (key) => {
      bestQueries.push(key)
      if (!options.liveBest) return Promise.resolve(options.best ?? null)
      const scores = sessionSaves.flatMap((save) =>
        save.completed && save.score !== null ? [save.score] : [],
      )
      const best = Math.max(options.best ?? 0, ...scores)
      return Promise.resolve(scores.length > 0 || options.best != null ? best : null)
    },
    isPersisting: () => Promise.resolve(true),
    hasSeenHint: (name) => Promise.resolve(options.seenHints?.includes(name) ?? false),
    markHintSeen: (name) => {
      hintsMarked.push(name)
      return Promise.resolve()
    },
  }
  return { storage, sessionSaves, attempts, settingsSaves, bestQueries, hintsMarked }
}

function createFakeAudio(options: { throwOnPlay?: boolean } = {}) {
  const calls: string[] = []
  const play = jest.fn((note: string) => {
    calls.push(`play:${note}`)
    if (options.throwOnPlay) throw new Error('audio failed')
  })
  const setMuted = jest.fn((muted: boolean) => {
    calls.push(`setMuted:${muted}`)
  })
  const audio: AudioEngine = {
    unlock: jest.fn(() => {
      calls.push('unlock')
    }),
    loadSamples: jest.fn(() => {
      calls.push('loadSamples')
      return Promise.resolve()
    }),
    play,
    setMuted,
    dispose: jest.fn(),
  }
  return { audio, calls, play, setMuted }
}

/** Lets queued storage writes (promise chains) run, without advancing the game's timers. */
async function flushWrites() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

function staffNote() {
  const staff = screen.getByRole('img', { name: /staff with one note/ })
  const group = staff.querySelector('g[data-step]')
  if (!group) throw new Error('no note on the staff')
  return { step: Number(group.getAttribute('data-step')), state: group.getAttribute('data-state') }
}

/** The letter of the note on the treble staff. */
function shownLetter(): Letter {
  const letter = parseNote(stepToNote(staffNote().step, 'treble'))?.letter
  if (!letter) throw new Error('unreadable note')
  return letter
}

function otherLetter(letter: Letter): Letter {
  return letter === 'C' ? 'D' : 'C'
}

function answerButtons() {
  return within(screen.getByRole('group', { name: 'Answers' })).getAllByRole('button')
}

function answerButton(name: string) {
  return within(screen.getByRole('group', { name: 'Answers' })).getByRole('button', { name })
}

/** A stat's value, without the Review marker that may follow it. */
function stat(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.firstChild?.textContent
}

function hasReviewMarker() {
  return within(screen.getByRole('banner')).queryByText('Review') !== null
}

function liveRegion() {
  const region = document.querySelector('[aria-live="polite"]')
  if (!region) throw new Error('no live region')
  return region
}

async function startGame(
  storageOptions: FakeStorageOptions = {},
  audioOptions: { throwOnPlay?: boolean } = {},
) {
  const fake = createFakeStorage(storageOptions)
  const fakeAudio = createFakeAudio(audioOptions)
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

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('Name the note: starting', () => {
  it('unlocks audio, loads samples and saves the session as started', async () => {
    const { calls, sessionSaves } = await startGame({ settings: { sessionType: 'round' } })

    expect(calls).toEqual(['setMuted:false', 'unlock', 'loadSamples'])
    expect(sessionSaves).toHaveLength(1)
    expect(sessionSaves[0]).toMatchObject({
      ownerId: 'profile-1',
      mode: 'name',
      sessionType: 'round',
      clef: 'treble',
      rangePreset: 'full-staff',
      completed: false,
      endedAt: null,
      score: 0,
      syncedAt: null,
    })
    expect(sessionSaves[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('moves focus into the game, but not to the setup heading on first load', async () => {
    const fake = createFakeStorage()
    render(<StaffReadingGame storage={fake.storage} />)
    const heading = await screen.findByRole('heading', { name: 'Staff Reading Game' })
    expect(heading).not.toHaveFocus()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('heading', { name: 'Name the note' })).toHaveFocus()
  })

  it('locks the settings and shows one note with seven answer buttons in scale order', async () => {
    await startGame()

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(staffNote().state).toBe('neutral')
    expect(answerButtons().map((button) => button.textContent)).toEqual([...LETTERS])
  })

  it('names the buttons in solfège when chosen', async () => {
    await startGame({ settings: { noteNaming: 'solfege' } })
    expect(answerButtons().map((button) => button.textContent)).toEqual([
      'Do',
      'Re',
      'Mi',
      'Fa',
      'Sol',
      'La',
      'Si',
    ])
  })

  it('starts with sound muted when Sound is off', async () => {
    const { calls } = await startGame({ settings: { soundOn: false } })
    expect(calls).toEqual(['setMuted:true', 'unlock', 'loadSamples'])
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Name the note: answering', () => {
  it('a correct answer turns green with a check, plays the note, saves and advances after 600 ms', async () => {
    const { user, play, attempts, sessionSaves } = await startGame()
    const letter = shownLetter()
    expect(play).not.toHaveBeenCalled()

    await user.click(answerButton(letter))
    await flushWrites()

    const chosen = answerButton(letter)
    expect(chosen).toHaveAttribute('data-state', 'correct')
    expect(chosen.querySelector('[data-icon="correct"]')).not.toBeNull()
    expect(staffNote().state).toBe('correct')
    expect(liveRegion()).toHaveTextContent(`Correct, ${letter}`)
    expect(play).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledWith('E4')

    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      sessionId: sessionSaves[0]?.id,
      ownerId: 'profile-1',
      position: 1,
      targetNote: 'E4',
      clef: 'treble',
      answer: letter,
      isCorrect: true,
      points: 0,
      streakAfter: 1,
      wasRequeued: false,
      syncedAt: null,
    })
    expect(attempts[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(attempts[0]?.answeredAt ?? '').toISOString()).toBe(attempts[0]?.answeredAt)

    advance(599)
    expect(staffNote().state).toBe('correct')
    advance(1)
    expect(staffNote().state).toBe('neutral')
    expect(liveRegion()).toHaveTextContent('')
    expect(answerButton(letter)).not.toHaveAttribute('data-state')
  })

  it('a wrong answer marks the choice red and the right one green, and waits 1,200 ms', async () => {
    const { user, attempts, play } = await startGame()
    const letter = shownLetter()
    const wrong = otherLetter(letter)

    await user.click(answerButton(wrong))
    await flushWrites()

    expect(answerButton(wrong)).toHaveAttribute('data-state', 'wrong')
    expect(answerButton(wrong).querySelector('[data-icon="wrong"]')).not.toBeNull()
    expect(answerButton(letter)).toHaveAttribute('data-state', 'correct')
    expect(staffNote().state).toBe('wrong')
    expect(liveRegion()).toHaveTextContent(`Wrong, it was ${letter}`)
    expect(play).toHaveBeenCalledWith('E4')
    expect(attempts[0]).toMatchObject({ answer: wrong, isCorrect: false, streakAfter: 0 })

    advance(600)
    expect(staffNote().state).toBe('wrong')
    advance(600)
    expect(staffNote().state).toBe('neutral')
  })

  it('announces in the current naming without the octave', async () => {
    const { user } = await startGame({ settings: { noteNaming: 'solfege' } })
    await user.click(answerButton('Re'))
    expect(liveRegion()).toHaveTextContent('Wrong, it was Mi')
  })

  it('ignores taps and keys during feedback', async () => {
    const { user, attempts, play } = await startGame()
    const letter = shownLetter()
    await user.click(answerButton(letter))

    await user.click(answerButton(otherLetter(letter)))
    await user.keyboard('c')
    await flushWrites()

    expect(attempts).toHaveLength(1)
    expect(play).toHaveBeenCalledTimes(1)
    expect(answerButton(letter)).toHaveAttribute('aria-disabled', 'true')
    expect(liveRegion()).toHaveTextContent(`Correct, ${letter}`)
  })

  it('keeps playing when storage writes and audio fail', async () => {
    const { user } = await startGame({ failWrites: true }, { throwOnPlay: true })
    await user.click(answerButton(shownLetter()))
    await flushWrites()
    expect(liveRegion()).toHaveTextContent(/^Correct/)
    advance(600)
    await user.click(answerButton(shownLetter()))
    expect(liveRegion()).toHaveTextContent(/^Correct/)
  })
})

describe('Name the note: keyboard', () => {
  it('commits with letter keys, either case', async () => {
    const { user, attempts } = await startGame()
    await user.keyboard(shownLetter().toLowerCase())
    advance(600)
    await user.keyboard(shownLetter())
    await flushWrites()
    expect(attempts.map((attempt) => attempt.isCorrect)).toEqual([true, true])
  })

  it('commits with number keys 1–7 in scale order', async () => {
    const { user, attempts } = await startGame()
    const index = LETTERS.indexOf(shownLetter())
    await user.keyboard(String(index + 1))
    await flushWrites()
    expect(attempts[0]).toMatchObject({ answer: shownLetter(), isCorrect: true })
  })

  it('accepts Shift, and the digit row by physical key (AZERTY)', async () => {
    const { attempts } = await startGame()
    fireEvent.keyDown(document, { key: shownLetter(), shiftKey: true })
    advance(600)
    // AZERTY: the unshifted "1" key types "&".
    fireEvent.keyDown(document, { key: '&', code: 'Digit1' })
    advance(1200)
    // AZERTY: Shift + that key types "1".
    fireEvent.keyDown(document, { key: '2', code: 'Digit2', shiftKey: true })
    await flushWrites()
    expect(attempts.map((attempt) => attempt.answer)).toEqual([
      attempts[0]?.targetNote[0],
      'C',
      'D',
    ])
    expect(attempts[0]?.isCorrect).toBe(true)
  })

  it('a held Enter on an answer button does not repeat the commit', async () => {
    await startGame()
    const button = answerButton(shownLetter())
    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.keyDown(button, { key: 'Enter', repeat: true })).toBe(false)
    expect(fireEvent.keyDown(button, { key: ' ', repeat: true })).toBe(false)
    expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true)
  })

  it('a key and a tap in the same tick commit once', async () => {
    const { attempts, play } = await startGame()
    const letter = shownLetter()
    act(() => {
      fireEvent.keyDown(document, { key: otherLetter(letter) })
      fireEvent.click(answerButton(letter))
    })
    await flushWrites()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.answer).toBe(otherLetter(letter))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('ignores keys with Ctrl, Alt or Meta held, and auto-repeat', async () => {
    const { attempts } = await startGame()
    const key = shownLetter()
    fireEvent.keyDown(document, { key, ctrlKey: true })
    fireEvent.keyDown(document, { key, metaKey: true })
    fireEvent.keyDown(document, { key, altKey: true })
    fireEvent.keyDown(document, { key, repeat: true })
    await flushWrites()
    expect(attempts).toHaveLength(0)
    expect(liveRegion()).toHaveTextContent('')

    fireEvent.keyDown(document, { key })
    await flushWrites()
    expect(attempts).toHaveLength(1)
  })

  it('ignores keys typed into a text field', async () => {
    const { attempts } = await startGame()
    const input = document.createElement('input')
    document.body.append(input)
    fireEvent.keyDown(input, { key: shownLetter() })
    fireEvent.keyDown(input, { key: 'Escape' })
    await flushWrites()
    expect(attempts).toHaveLength(0)
    expect(screen.getByRole('group', { name: 'Answers' })).toBeInTheDocument()
    input.remove()
  })
})

describe('Name the note: top bar and timing', () => {
  it('Round shows progress, score and streak', async () => {
    const { user } = await startGame({ settings: { sessionType: 'round' } })
    expect(stat('Progress')).toBe('0/20')
    expect(stat('Score')).toBe('0')
    expect(stat('Streak')).toBe('0')

    await user.click(answerButton(shownLetter()))
    expect(stat('Progress')).toBe('1/20')
    // Answered at once: 100 points plus the full 50 speed bonus.
    expect(stat('Score')).toBe('150')
    expect(stat('Streak')).toBe('1')

    advance(600)
    await user.click(answerButton(otherLetter(shownLetter())))
    expect(stat('Progress')).toBe('2/20')
    expect(stat('Score')).toBe('150')
    expect(stat('Streak')).toBe('0')
  })

  it('Practice shows notes answered, running accuracy and streak', async () => {
    const { user } = await startGame()
    expect(screen.queryByText('Score', { selector: 'dt' })).not.toBeInTheDocument()
    expect(stat('Answered')).toBe('0')
    expect(stat('Accuracy')).toBe('–')

    await user.click(answerButton(shownLetter()))
    advance(600)
    await user.click(answerButton(otherLetter(shownLetter())))
    expect(stat('Answered')).toBe('2')
    expect(stat('Accuracy')).toBe('50%')
    expect(stat('Streak')).toBe('0')
  })

  it('times the response from the prompt to the commit, paused while the page is hidden', async () => {
    let hidden = false
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const { user, attempts } = await startGame()

    advance(1000)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    advance(5000)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    advance(500)
    await user.click(answerButton(shownLetter()))
    await flushWrites()

    expect(attempts[0]?.responseMs).toBe(1500)
  })

  it('starts the clock only when the page shows, if it was hidden before the first prompt', async () => {
    let hidden = true
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const { user, attempts } = await startGame()

    advance(3000)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    advance(700)
    await user.click(answerButton(shownLetter()))
    await flushWrites()

    expect(attempts[0]?.responseMs).toBe(700)
  })

  it('does not count time hidden during feedback against the next prompt', async () => {
    let hidden = false
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const { user, attempts } = await startGame()
    await user.click(answerButton(shownLetter()))

    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    advance(600) // the next prompt appears while hidden
    advance(2000)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    advance(400)
    await user.click(answerButton(shownLetter()))
    await flushWrites()

    expect(attempts[1]?.responseMs).toBe(400)
  })

  it('marks a re-queued prompt as Review, and it does not move Round progress', async () => {
    const { user } = await startGame({ settings: { sessionType: 'round' } })
    expect(hasReviewMarker()).toBe(false)
    await user.click(answerButton(otherLetter(shownLetter())))
    advance(1200)

    const seen: { review: boolean; progressBefore: string | null | undefined }[] = []
    for (let i = 0; i < 5; i++) {
      seen.push({ review: hasReviewMarker(), progressBefore: stat('Progress') })
      await user.click(answerButton(shownLetter()))
      advance(600)
    }
    const reviewIndex = seen.findIndex((prompt) => prompt.review)
    expect(seen.filter((prompt) => prompt.review)).toHaveLength(1)
    // Answering the review prompt left progress where it was.
    expect(seen[reviewIndex + 1]?.progressBefore).toBe(seen[reviewIndex]?.progressBefore)
  })

  it('shows the Review marker in Practice too', async () => {
    const { user } = await startGame()
    await user.click(answerButton(otherLetter(shownLetter())))
    advance(1200)
    let reviews = 0
    for (let i = 0; i < 5; i++) {
      if (hasReviewMarker()) reviews++
      await user.click(answerButton(shownLetter()))
      advance(600)
    }
    expect(reviews).toBe(1)
  })

  it('the mute toggle mutes the engine and saves the Sound setting', async () => {
    const { user, setMuted, settingsSaves } = await startGame()
    const toggle = screen.getByRole('button', { name: 'Sound' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)
    expect(setMuted).toHaveBeenLastCalledWith(true)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(settingsSaves.at(-1)).toMatchObject({ soundOn: false })

    await user.click(toggle)
    expect(setMuted).toHaveBeenLastCalledWith(false)
    expect(settingsSaves.at(-1)).toMatchObject({ soundOn: true })
  })
})

describe('Name the note: ending', () => {
  it('a Round with one miss ends after 21 prompts, saved as completed', async () => {
    const { user, sessionSaves, attempts, bestQueries } = await startGame({
      settings: { sessionType: 'round' },
      best: 900,
    })
    expect(bestQueries).toContainEqual({ mode: 'name', clef: 'treble', rangePreset: 'full-staff' })

    await user.click(answerButton(otherLetter(shownLetter())))
    advance(1200)
    for (let i = 0; i < 19; i++) {
      await user.click(answerButton(shownLetter()))
      advance(600)
    }
    // 20 answers so far, one of them the re-queued miss: the Round goes on.
    expect(stat('Progress')).toBe('19/20')
    expect(screen.getByRole('group', { name: 'Answers' })).toBeInTheDocument()

    await user.click(answerButton(shownLetter()))
    advance(600)
    await flushWrites()

    expect(screen.getByRole('heading', { name: 'Round complete' })).toHaveFocus()
    expect(attempts).toHaveLength(21)
    expect(attempts.filter((attempt) => attempt.wasRequeued)).toHaveLength(1)
    const final = sessionSaves.at(-1)
    expect(sessionSaves).toHaveLength(2)
    expect(final).toMatchObject({ completed: true, correctCount: 19, totalCount: 20 })
    expect(final?.endedAt).not.toBeNull()
    expect(screen.getByText((final?.score ?? 0).toLocaleString('en-US'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change settings' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('exiting a Round with Escape saves it incomplete and returns to setup', async () => {
    const { user, sessionSaves } = await startGame({ settings: { sessionType: 'round' } })
    await user.click(answerButton(shownLetter()))
    advance(600)

    await user.keyboard('{Escape}')
    await flushWrites()

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(sessionSaves).toHaveLength(2)
    expect(sessionSaves[1]).toMatchObject({
      id: sessionSaves[0]?.id,
      completed: false,
      score: 150,
      correctCount: 1,
      totalCount: 1,
    })
    expect(sessionSaves[1]?.endedAt).not.toBeNull()
  })

  it('exiting during feedback cancels the pending advance', async () => {
    const { user, view } = await startGame({ settings: { sessionType: 'round' } })
    await user.click(answerButton(shownLetter()))
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(jest.getTimerCount()).toBe(0)
    view.unmount()
  })

  it('exiting Practice shows a summary, then returns to setup', async () => {
    const { user, sessionSaves } = await startGame()
    await user.click(answerButton(shownLetter()))
    advance(600)
    await user.click(answerButton(otherLetter(shownLetter())))
    advance(1200)
    await user.click(answerButton(shownLetter()))
    advance(600)

    await user.click(screen.getByRole('button', { name: 'Exit' }))
    await flushWrites()

    expect(screen.getByRole('heading', { name: 'Practice summary' })).toHaveFocus()
    expect(stat('Notes answered')).toBe('3')
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText('2 of 3 right first time')).toBeInTheDocument()
    expect(sessionSaves.at(-1)).toMatchObject({
      sessionType: 'practice',
      completed: true,
      score: null,
      correctCount: 2,
      totalCount: 3,
    })

    await user.click(screen.getByRole('button', { name: 'Back to setup' }))
    expect(screen.getByRole('heading', { name: 'Staff Reading Game' })).toHaveFocus()
  })

  it('unmounting mid-feedback leaves no timer running', async () => {
    const { user, view } = await startGame()
    await user.click(answerButton(shownLetter()))
    expect(jest.getTimerCount()).toBe(1)
    view.unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})

describe('Place the note before it exists', () => {
  it('shows a notice with a way back and starts no session', async () => {
    const { user, sessionSaves } = await startGame({ settings: { mode: 'place' } })
    expect(screen.getByRole('heading', { name: 'Place the note is coming next' })).toHaveFocus()
    expect(sessionSaves).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Back to setup' }))
    expect(screen.getByRole('radio', { name: /Place the note/ })).toBeChecked()
  })
})

describe('iPhone silent-switch hint', () => {
  const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

  it('shows once on iPhone with sound on, and can be dismissed', async () => {
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_UA)
    const { user, hintsMarked } = await startGame()
    expect(
      await screen.findByText("No sound? Check your iPhone's silent switch."),
    ).toBeInTheDocument()
    expect(hintsMarked).toEqual(['ios-silent-switch'])

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/silent switch/)).not.toBeInTheDocument()
  })

  it('stays hidden once seen, with sound off, or off iPhone', async () => {
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_UA)
    const seen = await startGame({ seenHints: ['ios-silent-switch'] })
    expect(screen.queryByText(/silent switch/)).not.toBeInTheDocument()
    seen.view.unmount()

    const muted = await startGame({ settings: { soundOn: false } })
    expect(screen.queryByText(/silent switch/)).not.toBeInTheDocument()
    muted.view.unmount()

    jest.restoreAllMocks()
    await startGame()
    expect(screen.queryByText(/silent switch/)).not.toBeInTheDocument()
  })
})

async function playRound(user: ReturnType<typeof userEvent.setup>, misses = 0) {
  for (let i = 0; i < misses; i++) {
    await user.click(answerButton(otherLetter(shownLetter())))
    advance(1200)
  }
  for (let i = 0; i < 40; i++) {
    if (screen.queryByRole('group', { name: 'Answers' }) === null) break
    await user.click(answerButton(shownLetter()))
    advance(600)
  }
  await flushWrites()
}

describe('Round end screen', () => {
  it('shows the stats and the personal best badge for a first Round', async () => {
    const { user } = await startGame({ settings: { sessionType: 'round' }, liveBest: true })
    await playRound(user)

    expect(screen.getByRole('heading', { name: 'Round complete' })).toHaveFocus()
    expect(screen.getByText('20/20 (100%)')).toBeInTheDocument()
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Results staff/ })).toBeInTheDocument()
  })

  it('shows the previous best quietly, without the badge, when it was not beaten', async () => {
    const { user } = await startGame({ settings: { sessionType: 'round' }, best: 999_999 })
    await playRound(user)

    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument()
    expect(screen.queryByText('New personal best')).not.toBeInTheDocument()
    expect(screen.getByText('Personal best: 999,999')).toBeInTheDocument()
  })

  it('Play again starts a fresh Round with the same settings, audio already unlocked', async () => {
    const { user, calls, sessionSaves } = await startGame({
      settings: { sessionType: 'round', soundOn: false },
      liveBest: true,
    })
    await playRound(user)
    expect(calls.filter((call) => call === 'unlock')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    await flushWrites()

    expect(screen.getByRole('group', { name: 'Answers' })).toBeInTheDocument()
    expect(stat('Progress')).toBe('0/20')
    expect(stat('Score')).toBe('0')
    // Not unlocked again; mute state and samples carry over.
    expect(calls.filter((call) => call === 'unlock')).toHaveLength(1)
    expect(calls.slice(-2)).toEqual(['setMuted:true', 'loadSamples'])
    expect(sessionSaves.at(-1)).toMatchObject({
      mode: 'name',
      sessionType: 'round',
      completed: false,
    })
    expect(new Set(sessionSaves.map((save) => save.id)).size).toBe(2)
  })

  it('a second, better Round shows the badge; Change settings shows the updated best', async () => {
    const { user } = await startGame({ settings: { sessionType: 'round' }, liveBest: true })
    // First Round with two misses (lower score).
    await playRound(user, 2)
    expect(screen.getByText('New personal best')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    await flushWrites()
    await playRound(user)
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    const better = screen.getByText(/^[\d,]+$/, { selector: 'p' }).textContent

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    await flushWrites()
    await playRound(user, 3)
    expect(screen.queryByText('New personal best')).not.toBeInTheDocument()
    expect(screen.getByText(`Personal best: ${better}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change settings' }))
    await flushWrites()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(await screen.findByText(`Personal best: ${better}`)).toBeInTheDocument()
  })

  it('is not shown after exiting a Round', async () => {
    const { user } = await startGame({ settings: { sessionType: 'round' } })
    await user.click(answerButton(shownLetter()))
    advance(600)
    await user.keyboard('{Escape}')
    await flushWrites()

    expect(screen.queryByRole('heading', { name: 'Round complete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('is not shown for Practice, which ends with its own summary', async () => {
    const { user } = await startGame()
    await user.click(answerButton(shownLetter()))
    advance(600)
    await user.click(screen.getByRole('button', { name: 'Exit' }))

    expect(screen.getByRole('heading', { name: 'Practice summary' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Round complete' })).not.toBeInTheDocument()
  })
})
