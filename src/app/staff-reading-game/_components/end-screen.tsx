import { selectScore, type SessionState } from '~/modules/staff-reading-game'

import { useFocusOnMount } from './use-focus-on-mount'

type EndScreenProps = {
  /** The completed Round (`ended`). */
  state: SessionState
  /** The best score for this Round's key before it was saved; for the personal-best badge. */
  personalBestBefore: number | null
  onChangeSettings: () => void
}

/** Placeholder end screen for a completed Round; ticket 10 builds the full one. */
export function EndScreen({ state, onChangeSettings }: EndScreenProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="flex flex-col gap-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-ink text-3xl font-extrabold tracking-tight focus:outline-none"
      >
        Round complete
      </h1>
      <p className="text-ink text-xl">
        Score:{' '}
        <strong className="tabular-nums">{selectScore(state).toLocaleString('en-US')}</strong>
      </p>
      <button
        type="button"
        onClick={onChangeSettings}
        className="bg-accent focus-visible:ring-accent min-h-12 touch-manipulation rounded-xl px-6 py-3 text-lg font-bold text-white hover:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Back to setup
      </button>
    </div>
  )
}
