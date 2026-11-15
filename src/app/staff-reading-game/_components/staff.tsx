'use client'

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  MAX_STEP,
  MIDDLE_LINE_STEP,
  MIN_STEP,
  clampStep,
  getLedgerLineSteps,
  type Clef,
} from '~/modules/staff-reading-game'

import { CLEF_GLYPHS, GLYPH_UNITS_PER_STAFF_SPACE } from './clef-glyphs'
import {
  CLEF_X,
  ICON_ROW_Y,
  STAFF_LINE_STEPS,
  STAFF_SPACE,
  describeStep,
  layoutNotes,
  pointerYToStep,
  staffRightX,
  stepToY,
  viewBoxHeight,
} from './staff-geometry'

export type StaffNoteState = 'neutral' | 'ghost' | 'correct' | 'wrong' | 'amber'

export type StaffNote = { step: number; state: StaffNoteState; key?: string }

/** Inputs that move the provisional notehead (D20: these show the touch controls). */
export type StaffChangeSource = 'touch' | 'pen' | 'keyboard'
/** Inputs that commit from the staff itself. Touch and pen never commit here. */
export type StaffCommitSource = 'mouse' | 'keyboard'

/**
 * Controlled input: the parent owns the provisional step (`value`), so its own
 * up/down buttons can move it. The staff renders it and reports intent.
 */
export type StaffInteraction = {
  value: number | null
  /** Touch/pen tap or drag, or an arrow key: move the provisional notehead here. */
  onChange: (step: number, source: StaffChangeSource) => void
  /** Mouse click, or Enter with a provisional notehead. */
  onCommit: (step: number, source: StaffCommitSource) => void
  /**
   * Fires once each time the ghost or the provisional notehead lands on a new
   * step, whatever moved it (including the parent changing `value`). For the
   * preview sound (D22).
   */
  onStepChange?: (step: number) => void
  /** Input lock, e.g. during feedback. The staff stays focusable. */
  disabled?: boolean
}

export type StaffProps = {
  clef: Clef
  notes?: StaffNote[]
  /** Accessible name. Describe what is shown without naming the note. */
  label: string
  interaction?: StaffInteraction
  /** Narrow note slots with icons in a row under the staff, for many notes. */
  compact?: boolean
  className?: string
}

const NOTEHEAD_RX = 13
const NOTEHEAD_RY = 9.5
const LEDGER_HALF_WIDTH = 20
const ICON_OFFSET_X = 27

/** Ink colour per state, picked for at least 3:1 contrast on the white staff. */
const STATE_CLASS: Record<StaffNoteState, string> = {
  neutral: 'text-neutral-900',
  ghost: 'text-neutral-900 opacity-40',
  correct: 'text-emerald-700',
  wrong: 'text-red-700',
  amber: 'text-amber-700',
}

const ICON_PATH: Partial<Record<StaffNoteState, string>> = {
  correct: 'M-6 0.5 L-2 4.5 L6 -5',
  wrong: 'M-5 -5 L5 5 M5 -5 L-5 5',
  // A tilde ("mixed"), not a dash, so it never reads as a ledger line.
  amber: 'M-6 2 C-4 -4 -1 -4 0 0 C1 4 4 4 6 -2',
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/** Calls `onNewStep` when `step` becomes a non-null step different from before. */
function useStepChange(step: number | null, onNewStep: (step: number) => void) {
  const previous = useRef(step)
  const callback = useLatest(onNewStep)
  useEffect(() => {
    if (step !== null && step !== previous.current) callback.current(step)
    previous.current = step
  }, [step, callback])
}

function Note({
  step,
  state,
  x,
  compact,
}: {
  step: number
  state: StaffNoteState
  x: number
  compact: boolean
}) {
  const y = stepToY(step)
  const icon = ICON_PATH[state]
  return (
    <g
      className={STATE_CLASS[state]}
      data-step={step}
      data-state={state}
    >
      {getLedgerLineSteps(step).map((ledgerStep) => (
        <line
          key={ledgerStep}
          data-ledger-step={ledgerStep}
          x1={x - LEDGER_HALF_WIDTH}
          x2={x + LEDGER_HALF_WIDTH}
          y1={stepToY(ledgerStep)}
          y2={stepToY(ledgerStep)}
          stroke="currentColor"
          strokeWidth={2.4}
        />
      ))}
      <ellipse
        data-notehead=""
        cx={x}
        cy={y}
        rx={NOTEHEAD_RX}
        ry={NOTEHEAD_RY}
        transform={`rotate(-20 ${x} ${y})`}
        fill="currentColor"
      />
      {icon && (
        <path
          data-icon={state}
          d={icon}
          transform={
            compact ? `translate(${x} ${ICON_ROW_Y})` : `translate(${x + ICON_OFFSET_X} ${y})`
          }
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  )
}

function ClefGlyph({ clef }: { clef: Clef }) {
  const glyph = CLEF_GLYPHS[clef]
  const scale = STAFF_SPACE / GLYPH_UNITS_PER_STAFF_SPACE
  const x = CLEF_X - glyph.bbox.x1 * scale
  return (
    <path
      data-clef={clef}
      d={glyph.d}
      transform={`translate(${x} ${stepToY(glyph.originStep)}) scale(${scale})`}
      fill="currentColor"
    />
  )
}

/**
 * SVG staff with clef, notes and optional note placement. Holds no game rules:
 * it draws steps and reports steps.
 */
export function Staff({
  clef,
  notes = [],
  label,
  interaction,
  compact = false,
  className,
}: StaffProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragPointer = useRef<number | null>(null)
  /** Mouse pointer pressed on the staff; a click commits only on its own release. */
  const mousePress = useRef<number | null>(null)
  const [hoverStep, setHoverStep] = useState<number | null>(null)

  const disabled = interaction?.disabled ?? false
  // Locking drops the ghost, so unlocking does not bring back a stale one (and
  // its preview sound); it reappears on the next pointer move.
  if (disabled && hoverStep !== null) setHoverStep(null)
  useEffect(() => {
    if (disabled) mousePress.current = null
  }, [disabled])
  const value = interaction?.value ?? null
  const ghostStep = interaction && !disabled ? hoverStep : null

  const noop = () => undefined
  useStepChange(ghostStep, interaction?.onStepChange ?? noop)
  useStepChange(value, interaction?.onStepChange ?? noop)

  const layout = layoutNotes(Math.max(1, notes.length), compact)
  const width = layout.width
  const height = viewBoxHeight(compact)
  const placementX = layoutNotes(1, compact).xs[0] ?? width / 2

  const drawing: ReactNode = (
    <>
      {STAFF_LINE_STEPS.map((step) => (
        <line
          key={step}
          data-staff-line={step}
          x1={4}
          x2={staffRightX(width)}
          y1={stepToY(step)}
          y2={stepToY(step)}
          stroke="currentColor"
          strokeWidth={1.6}
        />
      ))}
      <ClefGlyph clef={clef} />
      {notes.map((note, i) => (
        <Note
          key={note.key ?? i}
          step={note.step}
          state={note.state}
          x={layout.xs[i] ?? placementX}
          compact={compact}
        />
      ))}
      {value !== null && (
        <Note
          step={clampStep(value)}
          state="neutral"
          x={placementX}
          compact={compact}
        />
      )}
      {ghostStep !== null && ghostStep !== value && (
        <Note
          step={ghostStep}
          state="ghost"
          x={placementX}
          compact={compact}
        />
      )}
    </>
  )

  const svgProps = {
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    className: 'block h-auto w-full',
  }
  // Non-compact viewBox is 4:3; cap the width so the staff fits 85% of a
  // landscape phone's height.
  const sizeClass = compact ? 'max-w-[640px]' : 'max-w-[min(640px,calc(85svh*4/3))]'
  const frameClass = `mx-auto w-full ${sizeClass} rounded-lg bg-white text-neutral-900 ${className ?? ''}`

  if (!interaction) {
    return (
      <div className={frameClass}>
        <svg
          {...svgProps}
          role="img"
          aria-label={label}
        >
          {drawing}
        </svg>
      </div>
    )
  }

  const { onChange, onCommit } = interaction

  function stepAt(event: PointerEvent<SVGSVGElement>): number | null {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect ? pointerYToStep(event.clientY, rect, height) : null
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (disabled) return
    if (event.pointerType === 'mouse') {
      mousePress.current = event.button === 0 ? event.pointerId : null
      return
    }
    const step = stepAt(event)
    if (step === null) return
    event.preventDefault()
    dragPointer.current = event.pointerId
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best effort (unsupported in some environments).
    }
    onChange(step, event.pointerType === 'pen' ? 'pen' : 'touch')
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (disabled) return
    const step = stepAt(event)
    if (step === null) return
    if (event.pointerType === 'mouse') {
      setHoverStep(step)
    } else if (dragPointer.current === event.pointerId && step !== value) {
      onChange(step, event.pointerType === 'pen' ? 'pen' : 'touch')
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType !== 'mouse') {
      if (dragPointer.current === event.pointerId) dragPointer.current = null
      return
    }
    const pressed = mousePress.current === event.pointerId
    mousePress.current = null
    if (disabled || event.button !== 0 || !pressed) return
    const step = stepAt(event)
    if (step !== null) onCommit(step, 'mouse')
  }

  function handlePointerCancel(event: PointerEvent<SVGSVGElement>) {
    if (dragPointer.current === event.pointerId) dragPointer.current = null
    if (mousePress.current === event.pointerId) mousePress.current = null
  }

  function handlePointerLeave(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType !== 'mouse') return
    setHoverStep(null)
    mousePress.current = null
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (disabled) return
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = event.key === 'ArrowUp' ? 1 : -1
      const next = value === null ? MIDDLE_LINE_STEP : clampStep(value + delta)
      if (next !== value) onChange(next, 'keyboard')
    } else if (event.key === 'Enter' && value !== null) {
      event.preventDefault()
      onCommit(value, 'keyboard')
    }
  }

  return (
    <div className={frameClass}>
      <svg
        {...svgProps}
        className={`${svgProps.className} touch-none rounded-lg select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${disabled ? '' : 'cursor-pointer'}`}
        style={{ touchAction: 'none', userSelect: 'none' }}
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={MIN_STEP}
        aria-valuemax={MAX_STEP}
        aria-valuenow={value ?? MIDDLE_LINE_STEP}
        aria-valuetext={value === null ? 'No note placed' : describeStep(value)}
        aria-disabled={disabled || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      >
        {drawing}
      </svg>
    </div>
  )
}
