import {
  noteDisplayName,
  noteToMidi,
  noteToStep,
  selectAccuracy,
  selectAverageResponseMs,
  selectBestStreak,
  selectNoteResults,
  selectScore,
  type NoteResult,
  type SessionState,
} from '~/modules/staff-reading-game'

import { FeedbackIcon } from './feedback-icon'
import { Staff, type StaffNoteState } from './staff'
import { useFocusOnMount } from './use-focus-on-mount'

type EndScreenProps = {
  /** The completed Round (`ended`). */
  state: SessionState
  /** The best score for this Round's key before it was saved; for the personal-best badge. */
  personalBestBefore: number | null
  onPlayAgain: () => void
  onChangeSettings: () => void
}

const RESULT_STATE: Record<NoteResult['result'], StaffNoteState> = {
  'always-correct': 'correct',
  mixed: 'amber',
  'always-missed': 'wrong',
}

const RESULT_TEXT: Record<NoteResult['result'], string> = {
  'always-correct': 'always correct',
  mixed: 'mixed',
  'always-missed': 'always missed',
}

const BUTTON_BASE =
  'focus-visible:ring-accent min-h-12 touch-manipulation rounded-xl px-6 py-3 text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'

const format = (n: number) => n.toLocaleString('en-US')

/** Shown when a Round is played to its end: score, personal best, stats and a results staff. */
export function EndScreen({
  state,
  personalBestBefore,
  onPlayAgain,
  onChangeSettings,
}: EndScreenProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const { clef, noteNaming } = state.settings
  const score = selectScore(state)
  const { correct, total, ratio } = selectAccuracy(state)
  const averageMs = selectAverageResponseMs(state)
  const bestStreak = selectBestStreak(state)

  const results = [...selectNoteResults(state)].sort(
    (a, b) => noteToMidi(a.note) - noteToMidi(b.note),
  )
  const countOf = (result: NoteResult['result']) =>
    results.filter((r) => r.result === result).length
  const staffLabel = `Results staff, ${results.length} ${results.length === 1 ? 'note' : 'notes'} from low to high: ${countOf('always-correct')} always correct, ${countOf('mixed')} mixed, ${countOf('always-missed')} always missed`

  return (
    <div className="flex flex-col gap-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-ink text-3xl font-extrabold tracking-tight focus:outline-none"
      >
        Round complete
      </h1>

      <section
        aria-label="Score"
        className="flex flex-col items-start gap-2"
      >
        <p className="text-ink text-6xl font-extrabold tracking-tight tabular-nums">
          {format(score)}
        </p>
        {personalBestBefore === null || score > personalBestBefore ? (
          <p className="bg-accent-soft text-accent border-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-base font-bold">
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-4"
              fill="currentColor"
            >
              <path d="M8 1 L10.1 5.7 L15 6.2 L11.3 9.5 L12.4 14.4 L8 11.8 L3.6 14.4 L4.7 9.5 L1 6.2 L5.9 5.7 Z" />
            </svg>
            New personal best
          </p>
        ) : (
          <p className="text-ink-muted text-sm">Personal best: {format(personalBestBefore)}</p>
        )}
      </section>

      <dl className="border-rule bg-card grid grid-cols-3 gap-3 rounded-xl border p-4">
        <div>
          <dt className="text-ink-muted text-sm font-semibold">Accuracy</dt>
          <dd className="text-ink text-xl font-bold tabular-nums">
            {correct}/{total}
            {ratio === null ? null : ` (${Math.round(ratio * 100)}%)`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted text-sm font-semibold">Avg. response</dt>
          <dd className="text-ink text-xl font-bold tabular-nums">
            {averageMs === null ? '–' : `${(averageMs / 1000).toFixed(1)} s`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted text-sm font-semibold">Best streak</dt>
          <dd className="text-ink text-xl font-bold tabular-nums">{bestStreak}</dd>
        </div>
      </dl>

      <section
        aria-labelledby="end-results-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="end-results-heading"
          className="text-ink text-lg font-bold"
        >
          Notes in this Round
        </h2>
        <Staff
          clef={clef}
          compact
          label={staffLabel}
          notes={results.map(({ note, result }) => ({
            step: noteToStep(note, clef),
            state: RESULT_STATE[result],
            key: note,
          }))}
        />
        <ul
          aria-label="Result for each note"
          className="sr-only"
        >
          {results.map(({ note, result }) => (
            <li key={note}>
              {noteDisplayName(note, noteNaming, { withOctave: true })}: {RESULT_TEXT[result]}
            </li>
          ))}
        </ul>
        <ul
          aria-hidden="true"
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold"
        >
          <li className="inline-flex items-center gap-1.5 text-emerald-700">
            <FeedbackIcon kind="correct" />
            <span className="text-ink">Always correct</span>
          </li>
          <li className="inline-flex items-center gap-1.5 text-amber-700">
            <FeedbackIcon kind="mixed" />
            <span className="text-ink">Mixed</span>
          </li>
          <li className="inline-flex items-center gap-1.5 text-red-700">
            <FeedbackIcon kind="wrong" />
            <span className="text-ink">Always missed</span>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className={`${BUTTON_BASE} bg-accent text-white hover:bg-indigo-800`}
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onChangeSettings}
          className={`${BUTTON_BASE} border-accent text-accent bg-card border-2 hover:bg-indigo-50`}
        >
          Change settings
        </button>
      </div>
    </div>
  )
}
