'use client'

import { useEffect, useRef } from 'react'

import {
  LETTERS,
  letterDisplayName,
  type Letter,
  type NoteNaming,
} from '~/modules/staff-reading-game'

import { FeedbackIcon } from './feedback-icon'
import { isIgnoredShortcut } from './game-keys'

export type AnswerFeedback = {
  /** The letter the player chose. */
  chosen: Letter
  /** The shown note's letter. */
  correct: Letter
}

type AnswerButtonsProps = {
  naming: NoteNaming
  /** Set during feedback: input is locked and the chosen and correct buttons are marked. */
  feedback: AnswerFeedback | null
  onAnswer: (letter: Letter) => void
}

/**
 * Letter keys C–B, or number keys 1–7 in scale order. Digits are also read from the physical
 * key (`Digit1`–`Digit7`), so layouts whose digit row types other characters (AZERTY) work.
 */
function letterForKey({ key, code }: KeyboardEvent): Letter | null {
  const upper = key.toUpperCase()
  const byLetter = LETTERS.find((letter) => letter === upper)
  if (byLetter) return byLetter
  const digit = /^[1-7]$/.test(key) ? key : /^Digit([1-7])$/.exec(code)?.[1]
  return digit ? (LETTERS[Number(digit) - 1] ?? null) : null
}

/** Below 360 px the row is edge to edge with shared borders, so each button is ≥ 44 px wide at 320 px. */
const BASE_CLASS =
  'relative flex h-14 min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 border text-base font-bold select-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none max-[359px]:border-l-0 max-[359px]:first:border-l min-[360px]:rounded-xl min-[360px]:focus-visible:ring-offset-2'

/**
 * Name mode input: seven answer buttons in scale order, in one row, plus letter and number
 * keys. Buttons stay focusable during feedback (aria-disabled) so keyboard focus is not lost.
 */
export function AnswerButtons({ naming, feedback, onAnswer }: AnswerButtonsProps) {
  const latest = useRef({ feedback, onAnswer })
  useEffect(() => {
    latest.current = { feedback, onAnswer }
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isIgnoredShortcut(event)) return
      const letter = letterForKey(event)
      if (!letter) return
      event.preventDefault()
      if (!latest.current.feedback) latest.current.onAnswer(letter)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      role="group"
      aria-label="Answers"
      className="grid grid-cols-7 min-[360px]:gap-1 min-[400px]:gap-1.5"
    >
      {LETTERS.map((letter, index) => {
        const isCorrect = feedback?.correct === letter
        const isWrong = feedback?.chosen === letter && !isCorrect
        const stateClass = isCorrect
          ? 'border-emerald-700 bg-emerald-700 text-white'
          : isWrong
            ? 'border-red-700 bg-red-700 text-white'
            : feedback
              ? 'border-rule bg-card text-ink-muted'
              : 'border-rule bg-card text-ink hover:border-accent active:bg-accent-soft'
        return (
          <button
            key={letter}
            type="button"
            aria-disabled={feedback ? true : undefined}
            aria-keyshortcuts={`${letter} ${index + 1}`}
            data-state={isCorrect ? 'correct' : isWrong ? 'wrong' : undefined}
            onClick={() => {
              if (!feedback) onAnswer(letter)
            }}
            onKeyDown={(event) => {
              // A held Enter repeats the button's activation; one press is one commit.
              if (event.repeat) event.preventDefault()
            }}
            className={`${BASE_CLASS} ${stateClass}`}
          >
            <span>{letterDisplayName(letter, naming)}</span>
            {isCorrect || isWrong ? (
              <FeedbackIcon
                kind={isCorrect ? 'correct' : 'wrong'}
                className="size-3.5"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
