'use client'

import { useEffect, useRef, useState } from 'react'

import {
  LETTERS,
  MIDDLE_LINE_STEP,
  clampStep,
  isCanonicalNote,
  noteDisplayName,
  noteToStep,
  parseNote,
  stepToNote,
  type AnswerResult,
  type CanonicalNote,
  type Clef,
  type Letter,
  type NoteNaming,
  type SessionState,
} from '~/modules/staff-reading-game'

import { AnswerButtons, type AnswerFeedback } from './answer-buttons'
import { FeedbackIcon } from './feedback-icon'
import { isIgnoredShortcut } from './game-keys'
import { PlaceControls } from './place-controls'
import { PromptCard } from './prompt-card'
import { Staff, type StaffInteraction, type StaffNote } from './staff'
import { TopBar } from './top-bar'
import { useCoarsePointer } from './use-coarse-pointer'
import { useFocusOnMount } from './use-focus-on-mount'

type GameScreenProps = {
  /** A session in `prompting` or `feedback`. */
  state: SessionState
  /** The live Sound setting; it can change during play. */
  soundOn: boolean
  onToggleSound: () => void
  /** Name mode: the chosen letter. */
  onAnswer: (letter: Letter) => void
  /** Place mode: the placed note; `viaConfirm` when committed with the Confirm button (D13). */
  onPlace: (note: CanonicalNote, viaConfirm: boolean) => void
  /** Place mode preview sound: the note the ghost or provisional notehead just moved to (D22). */
  onPreview: (note: CanonicalNote) => void
  onExit: () => void
  /** The one-time iPhone silent-switch hint. */
  showSilentSwitchHint: boolean
  onDismissSilentSwitchHint: () => void
}

/** Screen-reader and visible result, in the current naming; the octave only when it counts. */
function feedbackMessage(result: AnswerResult, naming: NoteNaming, withOctave: boolean): string {
  const name = noteDisplayName(result.correctNote, naming, { withOctave })
  return result.isCorrect ? `Correct, ${name}` : `Wrong, it was ${name}`
}

function nameModeFeedback(result: AnswerResult | null): AnswerFeedback | null {
  const correct = result ? parseNote(result.correctNote)?.letter : undefined
  // Name mode answers are letters (D9).
  const chosen = LETTERS.find((letter) => letter === result?.answer)
  return correct && chosen ? { chosen, correct } : null
}

/**
 * Place mode feedback (D28): the placed notehead green, or red next to the correct note in green.
 * A miss always uses two columns, so the two noteheads never cover each other.
 */
function placeFeedbackNotes(result: AnswerResult, clef: Clef, key: string): StaffNote[] {
  if (!isCanonicalNote(result.answer)) return []
  const placed = noteToStep(result.answer, clef)
  if (result.isCorrect) return [{ step: placed, state: 'correct', key }]
  return [
    { step: placed, state: 'wrong', key: `${key}-placed` },
    { step: noteToStep(result.correctNote, clef), state: 'correct', key: `${key}-correct` },
  ]
}

/** Focuses the staff's placement slider inside `frame`. */
function focusStaff(frame: HTMLElement | null) {
  frame?.querySelector<SVGSVGElement>('svg[role="slider"]')?.focus({ preventScroll: true })
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
  onPlace,
  onPreview,
  onExit,
  showSilentSwitchHint,
  onDismissSilentSwitchHint,
}: GameScreenProps) {
  const { settings, current } = state
  const isPlace = settings.mode === 'place'
  const result = state.status === 'feedback' ? state.lastResult : null
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const staffFrameRef = useRef<HTMLDivElement>(null)

  // The provisional step belongs to one prompt: a new prompt starts with no notehead.
  const position = current?.position ?? null
  const [placed, setPlaced] = useState<{ position: number | null; step: number } | null>(null)
  const placedStep = placed?.position === position ? (placed?.step ?? null) : null
  // D20: the buttons show on coarse pointers and after any touch, pen or keyboard placement.
  const coarsePointer = useCoarsePointer()
  const [nonMousePlacement, setNonMousePlacement] = useState(false)

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

  const clefName = settings.clef === 'treble' ? 'Treble' : 'Bass'
  const promptName =
    isPlace && current
      ? noteDisplayName(current.targetNote, settings.noteNaming, {
          withOctave: !current.letterOnly,
        })
      : ''

  let notes: StaffNote[] = []
  if (isPlace) {
    notes = result && current ? placeFeedbackNotes(result, settings.clef, String(position)) : []
  } else if (current) {
    notes = [
      {
        step: noteToStep(current.targetNote, settings.clef),
        state: result ? (result.isCorrect ? 'correct' : 'wrong') : 'neutral',
        key: String(current.position),
      },
    ]
  }

  function place(step: number) {
    setPlaced({ position, step })
  }

  function moveBy(delta: 1 | -1) {
    place(placedStep === null ? MIDDLE_LINE_STEP : clampStep(placedStep + delta))
  }

  // Place mode: an arrow key pressed outside the staff (e.g. on the heading, which has focus on
  // entry) moves focus to the staff and the notehead with it, so arrows work straight away.
  const arrowKeyRef = useRef<(delta: 1 | -1) => void>(() => undefined)
  useEffect(() => {
    arrowKeyRef.current = (delta) => {
      focusStaff(staffFrameRef.current)
      if (result !== null) return
      setNonMousePlacement(true)
      moveBy(delta)
    }
  })
  useEffect(() => {
    if (!isPlace) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      // The staff handles its own arrows (and prevents their default).
      if (event.defaultPrevented || isIgnoredShortcut(event)) return
      event.preventDefault()
      arrowKeyRef.current(event.key === 'ArrowUp' ? 1 : -1)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPlace])

  const placement: StaffInteraction | undefined = isPlace
    ? {
        // During feedback the result notes replace the provisional notehead.
        value: result ? null : placedStep,
        disabled: result !== null,
        onChange: (step) => {
          setNonMousePlacement(true)
          place(step)
        },
        onCommit: (step) => onPlace(stepToNote(step, settings.clef), false),
        onStepChange:
          settings.previewSound && soundOn
            ? (step) => onPreview(stepToNote(step, settings.clef))
            : undefined,
      }
    : undefined

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
        {/* Short landscape screens (phones) put the prompt card beside the staff. */}
        <div
          className={
            isPlace
              ? 'flex w-full flex-col items-center gap-2 [@media(orientation:landscape)_and_(max-height:500px)]:flex-row [@media(orientation:landscape)_and_(max-height:500px)]:justify-center'
              : 'contents'
          }
        >
          {isPlace && current ? (
            <PromptCard
              name={promptName}
              promptKey={current.position}
            />
          ) : null}
          {/* Leaves room for the top bar, prompt card, feedback line and input in a landscape phone. */}
          <div
            ref={staffFrameRef}
            className={
              isPlace
                ? 'w-full max-w-[min(640px,calc((100dvh-16rem)*4/3))] [@media(orientation:landscape)_and_(max-height:500px)]:max-w-[min(640px,calc((100dvh-12rem)*4/3))]'
                : 'w-full max-w-[min(640px,calc((100dvh-12rem)*4/3))]'
            }
          >
            <Staff
              clef={settings.clef}
              notes={notes}
              label={
                isPlace
                  ? `${clefName} staff. Place ${promptName}.`
                  : `${clefName} staff with one note`
              }
              interaction={placement}
            />
          </div>
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
              {feedbackMessage(
                result,
                settings.noteNaming,
                isPlace && current !== null && !current.letterOnly,
              )}
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
        ) : (
          <PlaceControls
            visible={coarsePointer || nonMousePlacement}
            canConfirm={placedStep !== null}
            locked={result !== null}
            onUp={() => moveBy(1)}
            onDown={() => moveBy(-1)}
            onConfirm={() => {
              if (placedStep !== null) onPlace(stepToNote(placedStep, settings.clef), true)
            }}
          />
        )}
      </div>
    </div>
  )
}
