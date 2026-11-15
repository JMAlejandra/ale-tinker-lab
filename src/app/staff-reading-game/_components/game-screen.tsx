'use client'

import { useEffect, useRef } from 'react'

import {
  LETTERS,
  noteDisplayName,
  noteToStep,
  parseNote,
  type AnswerResult,
  type Letter,
  type NoteNaming,
  type SessionState,
} from '~/modules/staff-reading-game'

import { AnswerButtons, type AnswerFeedback } from './answer-buttons'
import { FeedbackIcon } from './feedback-icon'
import { isIgnoredShortcut } from './game-keys'
import { Staff, type StaffNote } from './staff'
import { TopBar } from './top-bar'
import { useFocusOnMount } from './use-focus-on-mount'

type GameScreenProps = {
  /** A session in `prompting` or `feedback`. */
  state: SessionState
  /** The live Sound setting; it can change during play. */
  soundOn: boolean
  onToggleSound: () => void
  /** Name mode: the chosen letter. */
  onAnswer: (letter: Letter) => void
  onExit: () => void
  /** The one-time iPhone silent-switch hint. */
  showSilentSwitchHint: boolean
  onDismissSilentSwitchHint: () => void
}

/** Screen-reader and visible result, in the current naming without the octave. */
function feedbackMessage(result: AnswerResult, naming: NoteNaming): string {
  const name = noteDisplayName(result.correctNote, naming)
  return result.isCorrect ? `Correct, ${name}` : `Wrong, it was ${name}`
}

function nameModeFeedback(result: AnswerResult | null): AnswerFeedback | null {
  const correct = result ? parseNote(result.correctNote)?.letter : undefined
  // Name mode answers are letters (D9).
  const chosen = LETTERS.find((letter) => letter === result?.answer)
  return correct && chosen ? { chosen, correct } : null
}

/**
 * The game screen: top bar, the staff in the middle and the mode's input pinned to the bottom
 * in thumb reach. Escape exits.
 */
export function GameScreen({
  state,
  soundOn,
  onToggleSound,
  onAnswer,
  onExit,
  showSilentSwitchHint,
  onDismissSilentSwitchHint,
}: GameScreenProps) {
  const { settings, current } = state
  const result = state.status === 'feedback' ? state.lastResult : null
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  const exitRef = useRef(onExit)
  useEffect(() => {
    exitRef.current = onExit
  })
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isIgnoredShortcut(event)) return
      event.preventDefault()
      exitRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const notes: StaffNote[] = current
    ? [
        {
          step: noteToStep(current.targetNote, settings.clef),
          state: result ? (result.isCorrect ? 'correct' : 'wrong') : 'neutral',
          key: String(current.position),
        },
      ]
    : []

  return (
    <div className="bg-paper text-ink flex min-h-dvh flex-col">
      <TopBar
        state={state}
        soundOn={soundOn}
        onToggleSound={onToggleSound}
        onExit={onExit}
      />

      {showSilentSwitchHint && soundOn ? (
        <div className="border-rule bg-accent-soft mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-lg items-center gap-3 rounded-xl border px-3 py-2 text-sm">
          <p className="flex-1">No sound? Check your iPhone&apos;s silent switch.</p>
          <button
            type="button"
            onClick={onDismissSilentSwitchHint}
            className="border-rule bg-card focus-visible:ring-accent min-h-11 shrink-0 touch-manipulation rounded-lg border px-3 font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="flex flex-1 flex-col items-center justify-center gap-2 py-3 min-[360px]:px-3">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="sr-only"
        >
          {settings.mode === 'name' ? 'Name the note' : 'Place the note'}
        </h1>
        {/* Leaves room for the top bar, feedback line and answer buttons in a landscape phone. */}
        <div className="w-full max-w-[min(640px,calc((100dvh-12rem)*4/3))]">
          <Staff
            clef={settings.clef}
            notes={notes}
            label={`${settings.clef === 'treble' ? 'Treble' : 'Bass'} staff with one note`}
          />
        </div>
        <p
          aria-live="polite"
          className={`flex min-h-7 items-center gap-1.5 text-lg font-bold ${
            result?.isCorrect ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {result ? (
            <>
              <FeedbackIcon
                kind={result.isCorrect ? 'correct' : 'wrong'}
                className="size-5"
              />
              {feedbackMessage(result, settings.noteNaming)}
            </>
          ) : null}
        </p>
      </main>

      <div className="mx-auto w-full max-w-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))] min-[360px]:px-2">
        {settings.mode === 'name' ? (
          <AnswerButtons
            naming={settings.noteNaming}
            feedback={nameModeFeedback(result)}
            onAnswer={onAnswer}
          />
        ) : null}
      </div>
    </div>
  )
}
