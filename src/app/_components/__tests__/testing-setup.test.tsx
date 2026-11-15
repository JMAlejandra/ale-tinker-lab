/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

function Toggle() {
  const [on, setOn] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
    >
      {on ? 'On' : 'Off'}
    </button>
  )
}

describe('component test setup', () => {
  it('renders in jsdom and supports jest-dom matchers and user-event', async () => {
    render(<Toggle />)
    const button = screen.getByRole('button', { name: 'Off' })
    expect(button).toBeInTheDocument()
    await userEvent.click(button)
    expect(screen.getByRole('button')).toHaveTextContent('On')
  })
})
