import { type ReactNode } from 'react'

type PlaceControlsProps = {
  /**
   * Shown on coarse-pointer devices and after a touch, pen or keyboard placement (D20). When
   * hidden the controls still take their space, so the staff never moves under the pointer.
   */
  visible: boolean
  /** A notehead is placed, so Confirm can commit. */
  canConfirm: boolean
  /** Input is locked (feedback). */
  locked: boolean
  onUp: () => void
  onDown: () => void
  onConfirm: () => void
}

const BUTTON_CLASS =
  'flex h-14 touch-manipulation items-center justify-center gap-2 rounded-xl border text-lg font-bold select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none'
const ENABLED_CLASS = 'border-rule bg-card text-ink hover:border-accent active:bg-accent-soft'
const DISABLED_CLASS = 'border-rule bg-card text-ink-muted opacity-60'

function Chevron({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === 'up' ? 'M5 15 L12 8 L19 15' : 'M5 9 L12 16 L19 9'} />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5 L10 17.5 L19 7" />
    </svg>
  )
}

function ControlButton({
  label,
  disabled,
  onPress,
  className,
  children,
}: {
  label?: string
  disabled: boolean
  onPress: () => void
  className: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      // aria-disabled, not disabled: a focused button keeps focus when it locks.
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onPress()
      }}
      onKeyDown={(event) => {
        // A held Enter or Space repeats the activation; one press is one move or commit.
        if (event.repeat) event.preventDefault()
      }}
      className={`${BUTTON_CLASS} ${disabled ? DISABLED_CLASS : ENABLED_CLASS} ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * Place mode buttons in thumb reach: move the provisional notehead one step up or down, and
 * Confirm to commit it. Each is at least 44 × 44 px.
 */
export function PlaceControls({
  visible,
  canConfirm,
  locked,
  onUp,
  onDown,
  onConfirm,
}: PlaceControlsProps) {
  return (
    <div
      role="group"
      aria-label="Place controls"
      className={`flex gap-2 px-3 ${visible ? '' : 'invisible'}`}
    >
      <ControlButton
        label="Move note up"
        disabled={locked}
        onPress={onUp}
        className="w-16"
      >
        <Chevron direction="up" />
      </ControlButton>
      <ControlButton
        label="Move note down"
        disabled={locked}
        onPress={onDown}
        className="w-16"
      >
        <Chevron direction="down" />
      </ControlButton>
      <ControlButton
        disabled={locked || !canConfirm}
        onPress={onConfirm}
        className="min-w-0 flex-1"
      >
        <CheckIcon />
        Confirm
      </ControlButton>
    </div>
  )
}
