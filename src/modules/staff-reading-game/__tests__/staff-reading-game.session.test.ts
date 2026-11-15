import {
  DEFAULT_SETTINGS,
  FEEDBACK_CORRECT_MS,
  FEEDBACK_WRONG_MS,
  ROUND_LENGTH,
  WRONG_NOTE_SOUND_DELAY_MS,
  advanceAction,
  answerAction,
  createSession,
  exitAction,
  selectAccuracy,
  selectAverageResponseMs,
  selectBestStreak,
  selectNoteResults,
  selectNotesAnswered,
  selectProgress,
  selectScore,
  selectSessionTotals,
  selectStreak,
  sessionReducer,
  startAction,
  type GameSettings,
  type Prompt,
  type SessionState,
} from '~/modules/staff-reading-game'

/** An rng that returns the given values in order, then 0. */
function scriptedRng(...values: number[]): () => number {
  const queue = [...values]
  return () => queue.shift() ?? 0
}

function settingsWith(overrides: Partial<GameSettings>): GameSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

// Treble "landmarks" is C4, G4, C5: small enough to steer every draw.
const landmarks = settingsWith({ rangePreset: 'landmarks', sessionType: 'round' })

/** A started session whose first draws use `rolls`. */
function started(settings: GameSettings, ...rolls: number[]): SessionState {
  return sessionReducer(createSession(settings), startAction(settings, scriptedRng(...rolls)))
}

type Commit = { responseMs?: number; viaConfirm?: boolean; requeueRoll?: number }

function commit(state: SessionState, answer: string, options: Commit = {}): SessionState {
  const { responseMs = 500, viaConfirm = false, requeueRoll = 0 } = options
  return sessionReducer(
    state,
    answerAction({ answer, responseMs, viaConfirm }, () => requeueRoll),
  )
}

/** The right Name-mode answer for the current prompt. */
function rightLetter(state: SessionState): string {
  return state.current!.targetNote.charAt(0)
}

/** A wrong Name-mode answer for the current prompt. */
function wrongLetter(state: SessionState): string {
  return rightLetter(state) === 'A' ? 'B' : 'A'
}

/** Answers `count` prompts correctly (advancing after each), starting from prompting. */
function answerRight(state: SessionState, count: number, responseMs = 500): SessionState {
  let current = state
  for (let i = 0; i < count; i++) {
    current = next(commit(current, rightLetter(current), { responseMs }), 0)
  }
  return current
}

/**
 * From feedback, advances and answers right `count` times, drawing every new prompt with
 * `pick`; returns the prompts served and the final state (in feedback).
 */
function playOn(state: SessionState, count: number, pick: number) {
  const prompts: Prompt[] = []
  let current = state
  for (let i = 0; i < count && current.status === 'feedback'; i++) {
    current = next(current, pick)
    if (current.status !== 'prompting') break
    prompts.push(current.current!)
    current = commit(current, rightLetter(current))
  }
  return { prompts, state: current }
}

/** Advances past feedback; `rolls` decide the next new prompt, if one is drawn. */
function next(state: SessionState, ...rolls: number[]): SessionState {
  return sessionReducer(state, advanceAction(scriptedRng(...rolls)))
}

describe('constants for the UI', () => {
  it('match the spec', () => {
    expect(ROUND_LENGTH).toBe(20)
    expect(FEEDBACK_CORRECT_MS).toBe(600)
    expect(FEEDBACK_WRONG_MS).toBe(1200)
    expect(WRONG_NOTE_SOUND_DELAY_MS).toBe(400)
  })
})

describe('starting a session', () => {
  it('begins in setup with no prompt', () => {
    const state = createSession(landmarks)
    expect(state.status).toBe('setup')
    expect(state.current).toBeNull()
  })

  it('serves the first prompt from the preset on start', () => {
    const state = sessionReducer(createSession(landmarks), startAction(landmarks, scriptedRng(0.5)))
    expect(state.status).toBe('prompting')
    expect(state.current).toEqual({
      targetNote: 'G4',
      letterOnly: false,
      wasRequeued: false,
      position: 1,
    })
  })

  it('ignores start while a session is running', () => {
    const prompting = started(landmarks, 0)
    expect(
      sessionReducer(
        prompting,
        startAction(landmarks, () => 0.5),
      ),
    ).toBe(prompting)
    const feedback = commit(prompting, 'C')
    expect(
      sessionReducer(
        feedback,
        startAction(landmarks, () => 0.5),
      ),
    ).toBe(feedback)
  })

  it('starts afresh from the end screen (play again)', () => {
    const ended = answerRight(started(landmarks, 0), 20)
    const again = sessionReducer(
      ended,
      startAction(landmarks, () => 0.5),
    )
    expect(again.status).toBe('prompting')
    expect(again.current?.position).toBe(1)
    expect(again.attempts).toEqual([])
    expect(again.streak).toBe(0)
  })
})

describe('committing an answer', () => {
  it('shows feedback for a correct Name-mode answer and records the attempt', () => {
    const state = commit(started(landmarks, 0.5), 'G', { responseMs: 500 })
    expect(state.status).toBe('feedback')
    expect(state.lastResult).toEqual({
      isCorrect: true,
      answer: 'G',
      correctNote: 'G4',
      points: 150,
    })
    expect(state.attempts).toEqual([
      {
        position: 1,
        targetNote: 'G4',
        clef: 'treble',
        answer: 'G',
        isCorrect: true,
        responseMs: 500,
        points: 150,
        streakAfter: 1,
        wasRequeued: false,
      },
    ])
  })

  describe('correctness', () => {
    const isCorrect = (state: SessionState) => state.lastResult?.isCorrect

    it('judges Name mode by letter', () => {
      // G4 shown
      expect(isCorrect(commit(started(landmarks, 0.5), 'G'))).toBe(true)
      expect(isCorrect(commit(started(landmarks, 0.5), 'A'))).toBe(false)
    })

    it('judges Place mode with strict octave off by letter, in any octave', () => {
      const place = settingsWith({ mode: 'place', strictOctave: false })
      // letter E, target E4
      expect(isCorrect(commit(started(place, 0, 0), 'E4'))).toBe(true)
      expect(isCorrect(commit(started(place, 0, 0), 'E6'))).toBe(true)
      expect(isCorrect(commit(started(place, 0, 0), 'F4'))).toBe(false)
    })

    it('judges Place mode with strict octave on by exact pitch', () => {
      const strict = settingsWith({ mode: 'place', strictOctave: true, rangePreset: 'landmarks' })
      // G4 prompted
      expect(isCorrect(commit(started(strict, 0.5), 'G4'))).toBe(true)
      expect(isCorrect(commit(started(strict, 0.5), 'G5'))).toBe(false)
      expect(isCorrect(commit(started(strict, 0.5), 'G'))).toBe(false)
    })

    it('reports a wrong answer with the correct note, 0 points and a reset streak', () => {
      // G4 right, then C5 answered "D"
      const state = commit(next(commit(started(landmarks, 0.5), 'G'), 0.9), 'D')
      expect(state.lastResult).toEqual({
        isCorrect: false,
        answer: 'D',
        correctNote: 'C5',
        points: 0,
      })
      expect(state.attempts[1]).toMatchObject({ isCorrect: false, points: 0, streakAfter: 0 })
    })
  })

  it('awards no points in Practice', () => {
    const practice = settingsWith({ rangePreset: 'landmarks', sessionType: 'practice' })
    const state = commit(started(practice, 0.5), 'G', { responseMs: 500 })
    expect(state.lastResult).toMatchObject({ isCorrect: true, points: 0 })
    expect(state.attempts[0]).toMatchObject({ points: 0, streakAfter: 1 })
  })

  it('ignores answers outside prompting', () => {
    const setup = createSession(landmarks)
    expect(commit(setup, 'G')).toBe(setup)
    const feedback = commit(started(landmarks, 0.5), 'G')
    expect(commit(feedback, 'C')).toBe(feedback)
  })
})

describe('new prompts', () => {
  it('advances from feedback to the next prompt', () => {
    const state = next(commit(started(landmarks, 0), 'C'), 0)
    expect(state.status).toBe('prompting')
    expect(state.current).toEqual({
      targetNote: 'G4',
      letterOnly: false,
      wasRequeued: false,
      position: 2,
    })
  })

  it('draws uniformly from the preset, never the note just shown', () => {
    const afterC4 = commit(started(landmarks, 0), 'C')
    const drawn = [0, 0.25, 0.49, 0.5, 0.75, 0.999].map(
      (pick) => next(afterC4, pick).current?.targetNote,
    )
    expect(drawn).toEqual(['G4', 'G4', 'G4', 'C5', 'C5', 'C5'])
  })

  describe('in Place mode with strict octave off', () => {
    // Treble full staff is E4–F5: letters E F G A B C D, with E and F in two octaves.
    const placeLetters = settingsWith({ mode: 'place', strictOctave: false, sessionType: 'round' })

    it('prompts a letter, then draws a concrete target note with that letter', () => {
      expect(started(placeLetters, 0, 0).current).toMatchObject({
        targetNote: 'E4',
        letterOnly: true,
      })
      expect(started(placeLetters, 0, 0.99).current?.targetNote).toBe('E5')
    })

    it('draws the letter uniformly, never the letter just shown', () => {
      const afterE = commit(started(placeLetters, 0, 0.99), 'E4')
      const letters = [0, 0.2, 0.4, 0.55, 0.7, 0.9].map((pick) =>
        next(afterE, pick, 0).current?.targetNote.charAt(0),
      )
      expect(letters).toEqual(['F', 'G', 'A', 'B', 'C', 'D'])
    })
  })

  it('ends a Round after its 20th prompt when nothing was missed', () => {
    const before = answerRight(started(landmarks, 0), 19)
    expect(before.current?.position).toBe(20)
    const feedback = commit(before, rightLetter(before))
    expect(feedback.status).toBe('feedback')
    expect(next(feedback).status).toBe('ended')
  })

  it('never ends Practice on its own', () => {
    const practice = settingsWith({ rangePreset: 'landmarks', sessionType: 'practice' })
    const state = answerRight(started(practice, 0), 100)
    expect(state.status).toBe('prompting')
    expect(state.current?.position).toBe(101)
  })

  it('prompts exact notes in Place mode with strict octave on', () => {
    const strict = settingsWith({ mode: 'place', strictOctave: true, rangePreset: 'landmarks' })
    expect(started(strict, 0.5).current).toMatchObject({ targetNote: 'G4', letterOnly: false })
  })
})

describe('re-queue of misses', () => {
  // Drawing every new prompt with pick 0.99 after a C4 miss alternates C5, G4, C5…, so the
  // only C4 that comes back is the re-queued one.
  const AVOID_C4 = 0.99

  /** Misses the first prompt (C4) with `requeueRoll`. */
  function missFirst(settings: GameSettings, requeueRoll: number): SessionState {
    return commit(started(settings, 0), 'A', { requeueRoll })
  }

  it.each([
    [0, 3],
    [0.34, 4],
    [0.99, 5],
  ])('with roll %d, brings the missed note back as the %i-th prompt after the miss', (roll, k) => {
    const { prompts } = playOn(missFirst(landmarks, roll), 8, AVOID_C4)
    const requeued = prompts.filter((prompt) => prompt.wasRequeued)
    expect(requeued).toEqual([
      { targetNote: 'C4', letterOnly: false, wasRequeued: true, position: 1 + k },
    ])
  })

  it('awards no points for a re-queued prompt but updates the streak', () => {
    const { state } = playOn(missFirst(landmarks, 0), 3, AVOID_C4)
    expect(
      state.attempts.map(({ wasRequeued, points, streakAfter }) => ({
        wasRequeued,
        points,
        streakAfter,
      })),
    ).toEqual([
      { wasRequeued: false, points: 0, streakAfter: 0 },
      { wasRequeued: false, points: 150, streakAfter: 1 },
      { wasRequeued: false, points: 150, streakAfter: 2 },
      { wasRequeued: true, points: 0, streakAfter: 3 },
    ])
  })

  it('adds the re-queued prompt on top of the 20 new ones', () => {
    const { prompts, state } = playOn(missFirst(landmarks, 0), 30, AVOID_C4)
    expect(prompts).toHaveLength(20)
    expect(state.attempts).toHaveLength(21)
    expect(next(state).status).toBe('ended')
  })

  it('appends the missed note at the end of a Round when fewer than k prompts remain', () => {
    const eighteenth = answerRight(started(landmarks, 0), 17)
    // k = 5, but only prompts 19 and 20 remain
    const missed = commit(eighteenth, wrongLetter(eighteenth), { requeueRoll: 0.99 })
    const { prompts, state } = playOn(missed, 10, 0)
    expect(prompts.map((prompt) => [prompt.position, prompt.wasRequeued])).toEqual([
      [19, false],
      [20, false],
      [21, true],
    ])
    expect(prompts[2]?.targetNote).toBe(eighteenth.current?.targetNote)
    expect(next(state).status).toBe('ended')
  })

  it('re-queues a miss on the final prompt as one extra prompt, then ends', () => {
    const last = answerRight(started(landmarks, 0), 19)
    const missed = commit(last, wrongLetter(last))
    const extra = next(missed)
    expect(extra.current).toEqual({
      targetNote: last.current?.targetNote,
      letterOnly: false,
      wasRequeued: true,
      position: 21,
    })
    expect(next(commit(extra, rightLetter(extra))).status).toBe('ended')
  })

  /** Plays `count` prompts after a first-prompt C4 miss, missing C4 every time it comes back. */
  function keepMissingC4(settings: GameSettings, count: number): Prompt[] {
    const prompts: Prompt[] = []
    let state = missFirst(settings, 0)
    for (let i = 0; i < count && state.status === 'feedback'; i++) {
      state = next(state, AVOID_C4)
      if (state.status !== 'prompting') break
      prompts.push(state.current!)
      const missC4 = state.current?.targetNote === 'C4'
      state = commit(state, missC4 ? wrongLetter(state) : rightLetter(state))
    }
    return prompts
  }

  it('swaps a re-queued note with the following prompt when it would follow the same note', () => {
    // With pick 0: G4, then a new C4 at position 3, right before the re-queued C4.
    const { prompts } = playOn(missFirst(landmarks, 0), 4, 0)
    expect(
      prompts.map(({ position, targetNote, wasRequeued }) => [position, targetNote, wasRequeued]),
    ).toEqual([
      [2, 'G4', false],
      [3, 'C4', false],
      [4, 'G4', false],
      [5, 'C4', true],
    ])
  })

  it('compares letters for letter prompts, and keeps the missed target note', () => {
    const placeLetters = settingsWith({ mode: 'place', strictOctave: false, sessionType: 'round' })
    // Letter E with target E5 missed; then F4, then a new E4 right before the re-queued E.
    let state = commit(started(placeLetters, 0, 0.99), 'F4', { requeueRoll: 0 })
    const prompts: Prompt[] = []
    for (const [pick, variant] of [
      [0, 0],
      [0, 0],
      [0.99, 0],
      [0, 0],
    ] as const) {
      state = next(state, pick, variant)
      prompts.push(state.current!)
      state = commit(state, state.current!.targetNote)
    }
    expect(
      prompts.map(({ position, targetNote, wasRequeued }) => [position, targetNote, wasRequeued]),
    ).toEqual([
      [2, 'F4', false],
      [3, 'E4', false],
      [4, 'D5', false],
      [5, 'E5', true],
    ])
    expect(prompts[3]?.letterOnly).toBe(true)
  })

  /** Attempts as "position:note", with "*" marking re-queued prompts. */
  function sequenceOf(state: SessionState): string[] {
    return state.attempts.map(
      ({ position, targetNote, wasRequeued }) =>
        `${position}:${targetNote}${wasRequeued ? '*' : ''}`,
    )
  }

  /** `count` correct prompts drawn with pick 0, which alternates C4 (odd) and G4 (even). */
  const alternating = (count: number): Step[] =>
    Array.from({ length: count }, () => ({ pick: 0, right: true }))

  it('moves a repeating re-queue behind a new prompt, not behind another re-queue of the same note', () => {
    const state = playScript(landmarks, [
      { pick: 0, right: false, requeueRoll: 0.99 }, // 1 C4, back at 6
      { pick: 0, right: true }, // 2 G4
      { pick: 0, right: false, requeueRoll: 0 }, // 3 C4, back at 6 (pushes the first to 7)
      { pick: 0.99, right: true }, // 4 C5
      { pick: 0, right: true }, // 5 C4 (new)
      { pick: 0, right: true }, // 6 a new prompt moves ahead of both re-queued C4s
      { pick: 0, right: true }, // 7
      { pick: 0, right: true }, // 8
      { pick: 0, right: true }, // 9
    ])
    expect(sequenceOf(state)).toEqual([
      '1:C4',
      '2:G4',
      '3:C4',
      '4:C5',
      '5:C4',
      '6:G4',
      '7:C4*',
      '8:G4',
      '9:C4*',
    ])
  })

  it('never pulls a re-queue forward to earlier than the 3rd prompt after its miss (D29)', () => {
    const state = playScript(landmarks, [
      ...alternating(17),
      { pick: 0, right: false, requeueRoll: 0 }, // 18 G4, back at the end
      { pick: 0.99, right: false, requeueRoll: 0 }, // 19 C5, back at the end
      { pick: 0.99, right: true }, // 20 G4
      { pick: 0, right: true }, // 21 G4 re-queued, shown again: C5 would only be 2nd after 19
      { pick: 0, right: true }, // 22 C5 re-queued
    ])
    expect(sequenceOf(state).slice(17)).toEqual(['18:G4', '19:C5', '20:G4', '21:G4*', '22:C5*'])
    expect(next(state).status).toBe('ended')
  })

  it('pulls a re-queue of another note forward when it is still 3rd or later after its miss', () => {
    const state = playScript(landmarks, [
      ...alternating(16),
      { pick: 0, right: false, requeueRoll: 0.99 }, // 17 C4, back at the end
      { pick: 0, right: false, requeueRoll: 0 }, // 18 G4, back at 21
      { pick: 0.99, right: true }, // 19 C5
      { pick: 0.99, right: true }, // 20 G4
      { pick: 0, right: true }, // 21 C4 re-queued, 4th after its miss
      { pick: 0, right: true }, // 22 G4 re-queued
    ])
    expect(sequenceOf(state).slice(16)).toEqual([
      '17:C4',
      '18:G4',
      '19:C5',
      '20:G4',
      '21:C4*',
      '22:G4*',
    ])
  })

  it('re-queues a note at most twice per Round', () => {
    const c4Positions = keepMissingC4(landmarks, 30)
      .filter((prompt) => prompt.targetNote === 'C4')
      .map((prompt) => prompt.position)
    expect(c4Positions).toEqual([4, 7])
  })

  it('has no re-queue cap in Practice', () => {
    const practice = settingsWith({ rangePreset: 'landmarks', sessionType: 'practice' })
    const c4Positions = keepMissingC4(practice, 15)
      .filter((prompt) => prompt.targetNote === 'C4')
      .map((prompt) => prompt.position)
    expect(c4Positions).toEqual([4, 7, 10, 13, 16])
  })
})

type Step = { pick: number; right: boolean; responseMs?: number; requeueRoll?: number }

/**
 * Plays scripted prompts: each step draws its prompt with `pick` (if it is a new prompt) and
 * answers it right or wrong. Ends in feedback after the last step.
 */
function playScript(settings: GameSettings, steps: readonly Step[]): SessionState {
  let state = createSession(settings)
  for (const [index, { pick, right, responseMs, requeueRoll }] of steps.entries()) {
    state =
      index === 0
        ? sessionReducer(
            state,
            startAction(settings, () => pick),
          )
        : next(state, pick)
    state = commit(state, right ? rightLetter(state) : wrongLetter(state), {
      responseMs,
      requeueRoll,
    })
  }
  return state
}

describe('derived stats', () => {
  it('scores a Round of 20 fast correct answers at 5,025', () => {
    const ended = answerRight(started(landmarks, 0), 20, 900)
    expect(selectScore(ended)).toBe(5025)
    const points = ended.attempts.map((attempt) => attempt.points)
    // ×1 up to streak 4, ×1.5 from 5, ×2 from 10
    expect(points.slice(3, 5)).toEqual([150, 225])
    expect(points.slice(8, 10)).toEqual([225, 300])
  })

  it('shifts the speed window for a Confirm commit in Place mode (D13)', () => {
    const strict = settingsWith({
      mode: 'place',
      strictOctave: true,
      rangePreset: 'landmarks',
      sessionType: 'round',
    })
    const viaConfirm = commit(started(strict, 0.5), 'G4', { responseMs: 2000, viaConfirm: true })
    expect(viaConfirm.lastResult?.points).toBe(150)
    const viaClick = commit(started(strict, 0.5), 'G4', { responseMs: 2000, viaConfirm: false })
    expect(viaClick.lastResult?.points).toBe(138)
  })

  // Treble full staff, pick 0 alternates E4 and F4.
  const fullStaffRound = settingsWith({ sessionType: 'round' })
  const played = playScript(fullStaffRound, [
    { pick: 0, right: true, responseMs: 1000 }, // 1 E4
    { pick: 0, right: false, responseMs: 2000, requeueRoll: 0.5 }, // 2 F4, back at 6
    { pick: 0, right: true, responseMs: 3000 }, // 3 E4
    { pick: 0, right: true, responseMs: 500 }, // 4 F4
    { pick: 0, right: false, responseMs: 1000, requeueRoll: 0.99 }, // 5 E4, back at 10
    { pick: 0, right: true, responseMs: 2500 }, // 6 F4 re-queued
  ])

  it('tracks the streak and the best streak', () => {
    expect(played.attempts[5]?.wasRequeued).toBe(true)
    expect(selectStreak(played)).toBe(1)
    expect(selectBestStreak(played)).toBe(2)
  })

  it('counts progress over new prompts and notes answered over all attempts', () => {
    expect(selectProgress(played)).toEqual({ answered: 5, total: 20 })
    expect(selectNotesAnswered(played)).toBe(6)
  })

  it('measures accuracy on first-time prompts only (D14)', () => {
    expect(selectAccuracy(played)).toEqual({ correct: 3, total: 5, ratio: 0.6 })
  })

  it('averages the response time over all attempts, re-queued ones included', () => {
    expect(selectAverageResponseMs(played)).toBeCloseTo(10000 / 6)
  })

  it('gives each prompted note its result for the end screen, in order of first appearance', () => {
    const state = playScript(landmarks, [
      { pick: 0, right: true }, // 1 C4
      { pick: 0.99, right: false, requeueRoll: 0.99 }, // 2 C5, back at 7
      { pick: 0, right: true }, // 3 C4
      { pick: 0, right: false, requeueRoll: 0.99 }, // 4 G4, back at 9
      { pick: 0, right: true }, // 5 C4
      { pick: 0, right: true }, // 6 G4
      { pick: 0, right: false }, // 7 C5 re-queued
      { pick: 0, right: true }, // 8 C4
      { pick: 0, right: true }, // 9 G4 re-queued
    ])
    expect(state.attempts.map((attempt) => attempt.targetNote)).toEqual([
      'C4',
      'C5',
      'C4',
      'G4',
      'C4',
      'G4',
      'C5',
      'C4',
      'G4',
    ])
    expect(selectNoteResults(state)).toEqual([
      { note: 'C4', result: 'always-correct' },
      { note: 'C5', result: 'always-missed' },
      { note: 'G4', result: 'mixed' },
    ])
  })

  describe('session totals', () => {
    const exit = (state: SessionState) => sessionReducer(state, exitAction())

    it('marks a finished Round completed, with its score and first-time counts', () => {
      const ended = answerRight(started(landmarks, 0), 20, 900)
      expect(selectSessionTotals(ended)).toEqual({
        completed: true,
        score: 5025,
        correctCount: 20,
        totalCount: 20,
        bestStreak: 20,
      })
    })

    it('marks an exited Round incomplete', () => {
      const exited = exit(played)
      expect(exited.status).toBe('setup')
      expect(selectSessionTotals(exited)).toEqual({
        completed: false,
        // 150 (1 s) + 125 (3 s) + 150 (0.5 s); the re-queued prompt scores 0
        score: 425,
        correctCount: 3,
        totalCount: 5,
        bestStreak: 2,
      })
    })

    it('is incomplete while a session is running', () => {
      expect(selectSessionTotals(played).completed).toBe(false)
    })

    it('gives Practice a null score and counts first-time prompts (D14, D15)', () => {
      const practice = settingsWith({ sessionType: 'practice' })
      const summary = exit(
        playScript(practice, [
          { pick: 0, right: true }, // 1 E4
          { pick: 0, right: false, requeueRoll: 0.5 }, // 2 F4, back at 6
          { pick: 0, right: true }, // 3 E4
          { pick: 0, right: true }, // 4 F4
          { pick: 0, right: true }, // 5 E4
          { pick: 0, right: true }, // 6 F4 re-queued
        ]),
      )
      expect(summary.attempts[5]?.wasRequeued).toBe(true)
      expect(summary.status).toBe('summary')
      expect(selectSessionTotals(summary)).toEqual({
        completed: true,
        score: null,
        correctCount: 4,
        totalCount: 5,
        bestStreak: 4,
      })
    })
  })

  it('has no accuracy or average before the first answer', () => {
    const fresh = started(fullStaffRound, 0)
    expect(selectAccuracy(fresh)).toEqual({ correct: 0, total: 0, ratio: null })
    expect(selectAverageResponseMs(fresh)).toBeNull()
    expect(selectBestStreak(fresh)).toBe(0)
  })
})

describe('exit', () => {
  const practice = settingsWith({ rangePreset: 'landmarks', sessionType: 'practice' })
  const exit = (state: SessionState) => sessionReducer(state, exitAction())

  it('returns from a Round straight to setup, while prompting or in feedback', () => {
    const prompting = answerRight(started(landmarks, 0), 3)
    expect(exit(prompting).status).toBe('setup')
    expect(exit(commit(prompting, 'C')).status).toBe('setup')
  })

  it('goes from Practice to the summary', () => {
    const prompting = answerRight(started(practice, 0), 3)
    expect(exit(prompting).status).toBe('summary')
    expect(exit(commit(prompting, 'C')).status).toBe('summary')
  })

  it('keeps the attempts so the session can be saved and summarised', () => {
    const exited = exit(answerRight(started(practice, 0), 3))
    expect(exited.attempts).toHaveLength(3)
    expect(exited.current).toBeNull()
  })

  it('completes a Round exited during the final answer’s feedback', () => {
    const last = answerRight(started(landmarks, 0), 19, 900)
    const exited = exit(commit(last, rightLetter(last), { responseMs: 900 }))
    expect(exited.status).toBe('ended')
    expect(selectSessionTotals(exited)).toEqual({
      completed: true,
      score: 5025,
      correctCount: 20,
      totalCount: 20,
      bestStreak: 20,
    })
  })

  it('leaves a Round incomplete when exited during feedback with a re-queue still to come', () => {
    const last = answerRight(started(landmarks, 0), 19)
    const exited = exit(commit(last, wrongLetter(last)))
    expect(exited.status).toBe('setup')
    expect(selectSessionTotals(exited).completed).toBe(false)
  })

  it('leaves the summary and end screen for setup', () => {
    expect(exit(exit(started(practice, 0))).status).toBe('setup')
    const ended = answerRight(started(landmarks, 0), 20)
    expect(ended.status).toBe('ended')
    expect(exit(ended).status).toBe('setup')
  })

  it('ignores advance outside feedback', () => {
    const prompting = started(landmarks, 0)
    expect(next(prompting)).toBe(prompting)
  })
})
