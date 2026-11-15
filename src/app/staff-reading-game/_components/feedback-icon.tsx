type FeedbackIconProps = {
  kind: 'correct' | 'wrong'
  className?: string
}

/** Check (correct) or cross (wrong), drawn in the current text colour. Decorative. */
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
      <path d={kind === 'correct' ? 'M3 8.5 L6.5 12 L13 4.5' : 'M4 4 L12 12 M12 4 L4 12'} />
    </svg>
  )
}
