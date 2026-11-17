type FeedbackIconProps = {
  kind: 'correct' | 'wrong' | 'mixed'
  className?: string
}

const PATHS = {
  correct: 'M3 8.5 L6.5 12 L13 4.5',
  wrong: 'M4 4 L12 12 M12 4 L4 12',
  mixed: 'M2 9.5 C4 3.5 7 3.5 8 8 C9 12.5 12 12.5 14 6.5',
} as const

/** Check (correct), cross (wrong) or tilde (mixed), drawn in the current text colour. Decorative. */
export function FeedbackIcon({ kind, className }: FeedbackIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      data-icon={kind}
      className={className ?? 'size-4'}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[kind]} />
    </svg>
  )
}
