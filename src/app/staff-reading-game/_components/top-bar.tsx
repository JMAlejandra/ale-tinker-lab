import {
  selectAccuracy,
  selectNotesAnswered,
  selectProgress,
  selectScore,
  selectStreak,
  type SessionState,
} from '~/modules/staff-reading-game'

type TopBarProps = {
  state: SessionState
  soundOn: boolean
  onToggleSound: () => void
  onExit: () => void
}

type Stat = { label: string; value: string }

function formatPercent(ratio: number | null): string {
  return ratio === null ? '–' : `${Math.round(ratio * 100)}%`
}

/** Marks a re-queued miss, which does not move progress. Text, not colour only. */
function ReviewMarker() {
  return (
    <span className="bg-accent-soft text-accent border-accent rounded border px-1 text-[11px] leading-4 font-bold">
      Review
    </span>
  )
}

function statsFor(state: SessionState): Stat[] {
  const streak: Stat = { label: 'Streak', value: String(selectStreak(state)) }
  if (state.settings.sessionType === 'round') {
    const { answered, total } = selectProgress(state)
    return [
      { label: 'Progress', value: `${answered}/${total}` },
      { label: 'Score', value: selectScore(state).toLocaleString('en-US') },
      streak,
    ]
  }
  return [
    { label: 'Answered', value: String(selectNotesAnswered(state)) },
    { label: 'Accuracy', value: formatPercent(selectAccuracy(state).ratio) },
    streak,
  ]
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z"
        fill="currentColor"
      />
      {muted ? (
        <path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" />
      ) : (
        <path d="M15.5 9 C16.8 10.4 16.8 13.6 15.5 15 M18 6.5 C20.6 9.3 20.6 14.7 18 17.5" />
      )}
    </svg>
  )
}

const ICON_BUTTON_CLASS =
  'flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-rule bg-card text-ink hover:border-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none'

/** Live stats for the session type, the mute toggle and exit. */
export function TopBar({ state, soundOn, onToggleSound, onExit }: TopBarProps) {
  const reviewing = state.current?.wasRequeued ?? false
  return (
    <header className="border-rule/40 bg-card flex items-center gap-1.5 border-b px-2 py-2 min-[360px]:gap-2 min-[360px]:px-3">
      <dl className="flex min-w-0 flex-1 gap-2 min-[360px]:gap-5">
        {statsFor(state).map((stat, index) => (
          <div
            key={stat.label}
            className="flex min-w-0 flex-col"
          >
            <dt className="text-ink-muted text-xs font-semibold">{stat.label}</dt>
            <dd className="text-ink flex items-center gap-1 text-base leading-tight font-bold tabular-nums min-[360px]:text-lg">
              {stat.value}
              {index === 0 && reviewing ? <ReviewMarker /> : null}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        aria-label="Sound"
        aria-pressed={soundOn}
        title={soundOn ? 'Sound on' : 'Sound off'}
        onClick={onToggleSound}
        className={ICON_BUTTON_CLASS}
      >
        <SpeakerIcon muted={!soundOn} />
      </button>
      <button
        type="button"
        aria-keyshortcuts="Escape"
        onClick={onExit}
        className={`${ICON_BUTTON_CLASS} px-2 text-sm font-bold min-[360px]:px-3`}
      >
        Exit
      </button>
    </header>
  )
}
