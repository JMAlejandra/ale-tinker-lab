'use client'

import { useEffect, useRef, useState } from 'react'

import {
  createBrowserProgressStorage,
  type GameSettings,
  type ProgressStorage,
} from '~/modules/staff-reading-game'

import { SetupScreen } from './setup-screen'

type Screen = 'setup' | 'game'

type StaffReadingGameProps = {
  /** Injected in tests; defaults to browser storage created after mount. */
  storage?: ProgressStorage
}

export function StaffReadingGame({ storage: injectedStorage }: StaffReadingGameProps) {
  const [screen, setScreen] = useState<Screen>('setup')
  const [storage, setStorage] = useState<ProgressStorage | null>(injectedStorage ?? null)
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [persisting, setPersisting] = useState(true)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

  // Browser storage is created after mount so server rendering never touches browser APIs.
  useEffect(() => {
    if (!storage) setStorage(createBrowserProgressStorage())
  }, [storage])

  useEffect(() => {
    if (!storage) return
    let cancelled = false
    void (async () => {
      const loaded = await storage.getSettings()
      const stillPersisting = await storage.isPersisting()
      if (cancelled) return
      setSettings(loaded)
      setPersisting(stillPersisting)
    })()
    return () => {
      cancelled = true
    }
  }, [storage])

  const mode = settings?.mode
  const clef = settings?.clef
  const rangePreset = settings?.rangePreset
  useEffect(() => {
    if (screen !== 'setup' || !storage || !mode || !clef || !rangePreset) return
    // Never show a previous key's best for the new key.
    setPersonalBest(null)
    let cancelled = false
    void storage.getPersonalBest({ mode, clef, rangePreset }).then((best) => {
      if (!cancelled) setPersonalBest(best)
    })
    return () => {
      cancelled = true
    }
  }, [screen, storage, mode, clef, rangePreset])

  function handleChange(next: GameSettings) {
    setSettings(next)
    if (!storage) return
    // Saves run in order so the last change wins.
    saveQueue.current = saveQueue.current
      .then(() => storage.saveSettings(next))
      .then(() => storage.isPersisting())
      .then(setPersisting)
      .catch(() => setPersisting(false))
  }

  if (screen === 'game') {
    // Placeholder until the game screen arrives.
    return (
      <Page>
        <p>The game screen is coming soon.</p>
        <button
          type="button"
          onClick={() => setScreen('setup')}
          className="border-rule bg-card mt-4 min-h-11 touch-manipulation rounded-xl border px-4"
        >
          Back
        </button>
      </Page>
    )
  }

  return (
    <Page>
      {settings ? (
        <SetupScreen
          settings={settings}
          onChange={handleChange}
          personalBest={personalBest}
          persisting={persisting}
          onStart={() => setScreen('game')}
        />
      ) : (
        <p
          role="status"
          className="text-ink-muted"
        >
          Loading…
        </p>
      )}
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-paper text-ink min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </main>
  )
}
