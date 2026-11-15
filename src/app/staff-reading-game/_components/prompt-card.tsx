'use client'

import { useEffect, useState } from 'react'

type PromptCardProps = {
  /** The note to place, in the current naming: "G" / "Sol", or "G4" / "Sol4" with strict octave. */
  name: string
  /** Changes with every prompt (its position), so a repeated name is announced again. */
  promptKey: number
}

/**
 * Place mode: the note the player must place, above the staff. Screen readers get it from a
 * status (polite live) region that starts empty and is filled after mount, then re-rendered for
 * every prompt, so the first prompt and a repeated name are announced too.
 */
export function PromptCard({ name, promptKey }: PromptCardProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="border-rule bg-card flex min-h-14 min-w-28 shrink-0 items-center justify-center rounded-2xl border px-6 py-1 shadow-sm">
      <p
        aria-hidden="true"
        className="text-ink text-4xl leading-none font-extrabold tracking-tight min-[360px]:text-5xl"
      >
        {name}
      </p>
      <div
        role="status"
        className="sr-only"
      >
        {mounted ? <span key={promptKey}>Place {name}</span> : null}
      </div>
    </div>
  )
}
