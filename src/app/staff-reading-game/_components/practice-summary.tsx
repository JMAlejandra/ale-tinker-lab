import {
  selectAccuracy,
  selectNotesAnswered,
  type SessionState,
} from '~/modules/staff-reading-game'

import { useFocusOnMount } from './use-focus-on-mount'

type PracticeSummaryProps = {
  /** The exited Practice session (`summary`). */
  state: SessionState
  onBack: () => void
}

/** Shown when the player exits Practice: notes answered and accuracy. */
export function PracticeSummary({ state, onBack }: PracticeSummaryProps) {
  const answered = selectNotesAnswered(state)
  const { correct, total, ratio } = selectAccuracy(state)
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <div className="flex flex-col gap-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-ink text-3xl font-extrabold tracking-tight focus:outline-none"
      >
        Practice summary
      </h1>
      <dl className="border-rule bg-card grid grid-cols-2 gap-4 rounded-xl border p-4">
        <div>
          <dt className="text-ink-muted text-sm font-semibold">Notes answered</dt>
          <dd className="text-ink text-2xl font-bold tabular-nums">{answered}</dd>
        </div>
        <div>
          <dt className="text-ink-muted text-sm font-semibold">Accuracy</dt>
          <dd className="text-ink text-2xl font-bold tabular-nums">
            {ratio === null ? '–' : `${Math.round(ratio * 100)}%`}
          </dd>
          {ratio === null ? null : (
            <dd className="text-ink-muted text-sm">
              {correct} of {total} right first time
            </dd>
          )}
        </div>
      </dl>
      <button
        type="button"
        onClick={onBack}
        className="bg-accent focus-visible:ring-accent min-h-12 touch-manipulation rounded-xl px-6 py-3 text-lg font-bold text-white hover:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Back to setup
      </button>
    </div>
  )
}
