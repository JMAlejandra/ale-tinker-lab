/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { MAX_STEP, MIDDLE_LINE_STEP } from '~/modules/staff-reading-game'

import { Staff, type StaffInteraction, type StaffNote } from './staff'
import { stepToY, viewBoxHeight } from './staff-geometry'

// jsdom has no PointerEvent; a MouseEvent subclass carrying pointerType/pointerId
// lets fireEvent.pointer* deliver the fields the staff reads.
class TestPointerEvent extends MouseEvent {
  pointerType: string
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? ''
    this.pointerId = init.pointerId ?? 1
  }
}

const HEIGHT = viewBoxHeight(false)

beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true })
  // Rendered at 1:1 scale: one viewBox unit per pixel.
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: HEIGHT,
    right: 320,
    width: 320,
    height: HEIGHT,
    toJSON: () => ({}),
  })
})

function noteGroups(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGGElement>('g[data-step]'))
}

function ledgerSteps(group: Element) {
  return Array.from(group.querySelectorAll('[data-ledger-step]')).map((el) =>
    Number(el.getAttribute('data-ledger-step')),
  )
}

/** Parent that owns the provisional step, as the game screen will. */
function ControlledStaff(props: Partial<Omit<StaffInteraction, 'value'>> & { initial?: number }) {
  const [value, setValue] = useState<number | null>(props.initial ?? null)
  return (
    <Staff
      clef="treble"
      label="Staff with treble clef. Place the note."
      interaction={{
        value,
        onChange: (step, source) => {
          setValue(step)
          props.onChange?.(step, source)
        },
        onCommit: props.onCommit ?? jest.fn(),
        onStepChange: props.onStepChange,
        disabled: props.disabled,
      }}
    />
  )
}

describe('Staff display', () => {
  it('draws the five staff lines and the requested clef, with an accessible name', () => {
    const { container, rerender } = render(
      <Staff
        clef="treble"
        label="Staff with treble clef and one note"
        notes={[{ step: 3, state: 'neutral' }]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Staff with treble clef and one note' })).toBeVisible()
    expect(container.querySelectorAll('[data-staff-line]')).toHaveLength(5)
    expect(container.querySelector('[data-clef="treble"]')).toHaveAttribute('d')

    rerender(
      <Staff
        clef="bass"
        label="Staff with bass clef"
      />,
    )
    expect(container.querySelector('[data-clef="bass"]')).toBeInTheDocument()
    expect(container.querySelector('[data-clef="treble"]')).not.toBeInTheDocument()
  })

  it('does not name the note in the accessible tree', () => {
    render(
      <Staff
        clef="treble"
        label="Staff with treble clef and one note"
        notes={[{ step: 2, state: 'neutral' }]}
      />,
    )
    const staff = screen.getByRole('img')
    expect(staff).toHaveAccessibleName('Staff with treble clef and one note')
    expect(staff.textContent).toBe('')
  })

  it.each([
    [4, []],
    [8, []],
    [-1, []],
    [9, []],
    [-2, [-2]],
    [-3, [-2]],
    [-4, [-2, -4]],
    [10, [10]],
    [11, [10]],
    [12, [10, 12]],
  ])('draws ledger lines for a note at step %i: %j', (step, expected) => {
    const { container } = render(
      <Staff
        clef="treble"
        label="Staff"
        notes={[{ step, state: 'neutral' }]}
      />,
    )
    const [group] = noteGroups(container)
    expect(ledgerSteps(group!)).toEqual(expected)
    expect(group!.querySelector('[data-notehead]')).toHaveAttribute('cy', String(stepToY(step)))
  })

  it('styles each state, with check and cross icons for correct and wrong', () => {
    const notes: StaffNote[] = [
      { step: 0, state: 'neutral', key: 'a' },
      { step: 1, state: 'ghost', key: 'b' },
      { step: 2, state: 'correct', key: 'c' },
      { step: 3, state: 'wrong', key: 'd' },
      { step: 4, state: 'amber', key: 'e' },
    ]
    const { container } = render(
      <Staff
        clef="treble"
        label="Staff"
        notes={notes}
      />,
    )
    const groups = noteGroups(container)
    expect(groups.map((g) => g.getAttribute('data-state'))).toEqual([
      'neutral',
      'ghost',
      'correct',
      'wrong',
      'amber',
    ])
    const byState: Partial<Record<string, SVGGElement>> = Object.fromEntries(
      groups.map((g) => [g.getAttribute('data-state') ?? '', g] as const),
    )
    expect(byState.ghost).toHaveClass('opacity-40')
    expect(byState.correct).toHaveClass('text-emerald-700')
    expect(byState.wrong).toHaveClass('text-red-700')
    expect(byState.amber).toHaveClass('text-amber-700')
    expect(byState.correct!.querySelector('[data-icon="correct"]')).toBeInTheDocument()
    expect(byState.wrong!.querySelector('[data-icon="wrong"]')).toBeInTheDocument()
    expect(byState.neutral!.querySelector('[data-icon]')).not.toBeInTheDocument()
    expect(byState.ghost!.querySelector('[data-icon]')).not.toBeInTheDocument()
  })

  it('lays several notes out left to right', () => {
    const notes = Array.from({ length: 17 }, (_, i) => ({
      step: i - 4,
      state: 'correct' as const,
      key: String(i),
    }))
    const { container } = render(
      <Staff
        clef="treble"
        label="Round notes"
        notes={notes}
        compact
      />,
    )
    const xs = noteGroups(container).map((g) =>
      Number(g.querySelector('[data-notehead]')!.getAttribute('cx')),
    )
    expect(xs).toHaveLength(17)
    xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(xs[i]!))
  })
})

describe('Staff interaction', () => {
  it('is a focusable slider that never scrolls the page', () => {
    render(<ControlledStaff />)
    const staff = screen.getByRole('slider', { name: 'Staff with treble clef. Place the note.' })
    expect(staff).toHaveAttribute('tabindex', '0')
    expect(staff).toHaveClass('touch-none', 'select-none')
    expect(staff).toHaveAttribute('aria-valuetext', 'No note placed')
    expect(staff).toHaveAttribute('aria-valuenow', String(MIDDLE_LINE_STEP))
  })

  it('keyboard: first arrow starts on the middle line, arrows move one step, Enter commits', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    const onCommit = jest.fn()
    const onStepChange = jest.fn()
    const { container } = render(
      <ControlledStaff
        onChange={onChange}
        onCommit={onCommit}
        onStepChange={onStepChange}
      />,
    )
    const staff = screen.getByRole('slider')

    staff.focus()
    await user.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()

    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith(MIDDLE_LINE_STEP, 'keyboard')
    expect(staff).toHaveAttribute('aria-valuetext', 'third line')
    expect(noteGroups(container).map((g) => g.getAttribute('data-step'))).toEqual(['4'])

    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith(MIDDLE_LINE_STEP + 2, 'keyboard')
    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith(MIDDLE_LINE_STEP + 1, 'keyboard')
    expect(onStepChange.mock.calls.map(([s]: [number]) => s)).toEqual([4, 5, 6, 5])

    await user.keyboard('{Enter}')
    expect(onCommit.mock.calls).toEqual([[MIDDLE_LINE_STEP + 1, 'keyboard']])
  })

  it('keyboard: stops at the edge of the visible area', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(
      <ControlledStaff
        initial={MAX_STEP}
        onChange={onChange}
      />,
    )
    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowUp}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled: stays focusable but ignores keys and pointers', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    const onCommit = jest.fn()
    const { container } = render(
      <ControlledStaff
        initial={3}
        onChange={onChange}
        onCommit={onCommit}
        disabled
      />,
    )
    const staff = screen.getByRole('slider')
    expect(staff).toHaveAttribute('aria-disabled', 'true')
    staff.focus()
    expect(staff).toHaveFocus()
    await user.keyboard('{ArrowUp}{Enter}')
    fireEvent.pointerDown(staff, { pointerType: 'touch', clientY: stepToY(6) })
    fireEvent.pointerMove(staff, { pointerType: 'mouse', clientY: stepToY(6) })
    fireEvent.pointerUp(staff, { pointerType: 'mouse', clientY: stepToY(6), button: 0 })
    expect(onChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    expect(container.querySelector('g[data-state="ghost"]')).not.toBeInTheDocument()
  })

  it('mouse: a snapped ghost follows the pointer and a click commits there', () => {
    const onChange = jest.fn()
    const onCommit = jest.fn()
    const onStepChange = jest.fn()
    const { container } = render(
      <ControlledStaff
        onChange={onChange}
        onCommit={onCommit}
        onStepChange={onStepChange}
      />,
    )
    const staff = screen.getByRole('slider')

    fireEvent.pointerMove(staff, { pointerType: 'mouse', clientY: stepToY(2) + 3 })
    const ghost = () => container.querySelector('g[data-state="ghost"]')
    expect(ghost()).toHaveAttribute('data-step', '2')
    fireEvent.pointerMove(staff, { pointerType: 'mouse', clientY: stepToY(2) - 2 })
    fireEvent.pointerMove(staff, { pointerType: 'mouse', clientY: -500 })
    expect(ghost()).toHaveAttribute('data-step', String(MAX_STEP))
    expect(onStepChange.mock.calls).toEqual([[2], [MAX_STEP]])

    fireEvent.pointerDown(staff, { pointerType: 'mouse', clientY: stepToY(7), button: 0 })
    fireEvent.pointerUp(staff, { pointerType: 'mouse', clientY: stepToY(7), button: 0 })
    expect(onCommit).toHaveBeenCalledWith(7, 'mouse')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.pointerLeave(staff, { pointerType: 'mouse' })
    expect(ghost()).not.toBeInTheDocument()
  })

  it('mouse: releasing on the staff without pressing on it does not commit', () => {
    const onCommit = jest.fn()
    render(<ControlledStaff onCommit={onCommit} />)
    const staff = screen.getByRole('slider')
    // Pressed elsewhere on the page, released over the staff.
    fireEvent.pointerUp(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    // Pressed on the staff, left it, came back and released.
    fireEvent.pointerDown(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    fireEvent.pointerLeave(staff, { pointerType: 'mouse' })
    fireEvent.pointerUp(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('mouse: a press during the input lock does not commit after the lock lifts', () => {
    const onCommit = jest.fn()
    const { rerender } = render(
      <ControlledStaff
        onCommit={onCommit}
        disabled
      />,
    )
    const staff = screen.getByRole('slider')
    fireEvent.pointerDown(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    rerender(<ControlledStaff onCommit={onCommit} />)
    fireEvent.pointerUp(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('mouse: a press before the lock does not commit after the lock lifts', () => {
    const onCommit = jest.fn()
    const { rerender } = render(<ControlledStaff onCommit={onCommit} />)
    const staff = screen.getByRole('slider')
    fireEvent.pointerDown(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    rerender(
      <ControlledStaff
        onCommit={onCommit}
        disabled
      />,
    )
    rerender(<ControlledStaff onCommit={onCommit} />)
    fireEvent.pointerUp(staff, { pointerType: 'mouse', clientY: stepToY(3), button: 0 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('touch: a drag held through the lock does not move the notehead after it lifts', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ControlledStaff onChange={onChange} />)
    const staff = screen.getByRole('slider')
    fireEvent.pointerDown(staff, { pointerType: 'touch', pointerId: 5, clientY: stepToY(3) })
    expect(onChange).toHaveBeenCalledTimes(1)
    rerender(
      <ControlledStaff
        onChange={onChange}
        disabled
      />,
    )
    rerender(<ControlledStaff onChange={onChange} />)
    fireEvent.pointerMove(staff, { pointerType: 'touch', pointerId: 5, clientY: stepToY(6) })
    expect(onChange).toHaveBeenCalledTimes(1)

    // A fresh tap places again.
    fireEvent.pointerUp(staff, { pointerType: 'touch', pointerId: 5, clientY: stepToY(6) })
    fireEvent.pointerDown(staff, { pointerType: 'touch', pointerId: 6, clientY: stepToY(6) })
    expect(onChange).toHaveBeenLastCalledWith(6, 'touch')
  })

  it('locking clears the ghost; unlocking shows it again only on the next move', () => {
    const onStepChange = jest.fn()
    const { container, rerender } = render(<ControlledStaff onStepChange={onStepChange} />)
    const staff = screen.getByRole('slider')
    const ghost = () => container.querySelector('g[data-state="ghost"]')

    fireEvent.pointerMove(staff, { pointerType: 'mouse', clientY: stepToY(5) })
    expect(ghost()).toHaveAttribute('data-step', '5')
    rerender(
      <ControlledStaff
        onStepChange={onStepChange}
        disabled
      />,
    )
    expect(ghost()).not.toBeInTheDocument()
    rerender(<ControlledStaff onStepChange={onStepChange} />)
    expect(ghost()).not.toBeInTheDocument()
    expect(onStepChange.mock.calls).toEqual([[5]])

    fireEvent.pointerMove(staff, { pointerType: 'mouse', clientY: stepToY(5) })
    expect(ghost()).toHaveAttribute('data-step', '5')
    expect(onStepChange.mock.calls).toEqual([[5], [5]])
  })

  it.each(['touch', 'pen'] as const)(
    '%s: a tap places a provisional note, dragging moves it, nothing commits',
    (pointerType) => {
      const onChange = jest.fn()
      const onCommit = jest.fn()
      const onStepChange = jest.fn()
      const { container } = render(
        <ControlledStaff
          onChange={onChange}
          onCommit={onCommit}
          onStepChange={onStepChange}
        />,
      )
      const staff = screen.getByRole('slider')

      fireEvent.pointerDown(staff, { pointerType, pointerId: 7, clientY: stepToY(1) })
      expect(onChange).toHaveBeenLastCalledWith(1, pointerType)
      expect(container.querySelector('g[data-state="neutral"]')).toHaveAttribute('data-step', '1')

      fireEvent.pointerMove(staff, { pointerType, pointerId: 7, clientY: stepToY(1) + 2 })
      fireEvent.pointerMove(staff, { pointerType, pointerId: 7, clientY: stepToY(-1) })
      fireEvent.pointerUp(staff, { pointerType, pointerId: 7, clientY: stepToY(-1) })
      expect(onChange.mock.calls).toEqual([
        [1, pointerType],
        [-1, pointerType],
      ])
      expect(onStepChange.mock.calls).toEqual([[1], [-1]])

      // After lift-off, moving without a press does nothing.
      fireEvent.pointerMove(staff, { pointerType, pointerId: 7, clientY: stepToY(5) })
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onCommit).not.toHaveBeenCalled()
      expect(container.querySelector('g[data-state="ghost"]')).not.toBeInTheDocument()
    },
  )

  it('fires the step-change callback when the parent moves the note', () => {
    const onStepChange = jest.fn()
    const interaction = (value: number | null): StaffInteraction => ({
      value,
      onChange: jest.fn(),
      onCommit: jest.fn(),
      onStepChange,
    })
    const { rerender } = render(
      <Staff
        clef="bass"
        label="Staff"
        interaction={interaction(null)}
      />,
    )
    rerender(
      <Staff
        clef="bass"
        label="Staff"
        interaction={interaction(3)}
      />,
    )
    rerender(
      <Staff
        clef="bass"
        label="Staff"
        interaction={interaction(3)}
      />,
    )
    rerender(
      <Staff
        clef="bass"
        label="Staff"
        interaction={interaction(4)}
      />,
    )
    expect(onStepChange.mock.calls).toEqual([[3], [4]])
  })
})
