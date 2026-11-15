/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import { PromptCard } from './prompt-card'

function announcement() {
  return screen.getByRole('status').firstElementChild
}

describe('PromptCard', () => {
  it('shows the name and fills the status region only after mount, so the first prompt is announced', () => {
    // The first render (what mounts) has an empty live region.
    const html = renderToString(
      <PromptCard
        name="G4"
        promptKey={1}
      />,
    )
    expect(html).toContain('role="status" class="sr-only"></div>')

    render(
      <PromptCard
        name="G4"
        promptKey={1}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Place G4')
    expect(screen.getByText('G4')).toHaveAttribute('aria-hidden', 'true')
  })

  it('re-renders the announcement for each prompt, even with the same name, and not otherwise', () => {
    const { rerender } = render(
      <PromptCard
        name="G"
        promptKey={1}
      />,
    )
    const first = announcement()

    rerender(
      <PromptCard
        name="G"
        promptKey={1}
      />,
    )
    expect(announcement()).toBe(first)

    rerender(
      <PromptCard
        name="G"
        promptKey={2}
      />,
    )
    expect(announcement()).not.toBe(first)
    expect(screen.getByRole('status')).toHaveTextContent('Place G')
  })
})
