'use client'

import { useEffect, useRef, useState } from 'react'

import {
  createAudioEngine,
  createBrowserProgressStorage,
  type AudioEngine,
  type GameSettings,
  type Letter,
  type ProgressStorage,
} from '~/modules/staff-reading-game'

import { EndScreen } from './end-screen'
import { GameScreen } from './game-screen'
import { PracticeSummary } from './practice-summary'
import { SetupScreen } from './setup-screen'
import { useGameSession } from './use-game-session'
import { useSilentSwitchHint } from './use-silent-switch-hint'

type Screen = 'setup' | 'game' | 'summary' | 'ended' | 'place-coming-soon'

type StaffReadingGameProps = {
  /** Injected in tests; defaults to browser storage created after mount. */
  storage?: ProgressStorage
  /** Injected in tests; defaults to the Web Audio engine, created on the first Start. */
  audio?: AudioEngine
  /** Injected in tests for deterministic prompts; defaults to `Math.random`. */
  rng?: () => number
}

function safely(action: () => void) {
  try {
    action()
  } catch {
    // Sound is a nicety; never break the game.
  }
}

export function StaffReadingGame({
  storage: injectedStorage,
  audio: injectedAudio,
  rng,
}: StaffReadingGameProps) {
  const [storage, setStorage] = useState<ProgressStorage | null>(injectedStorage ?? null)
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [persisting, setPersisting] = useState(true)
  // Until ticket 09 adds Place mode, starting it shows a notice instead of a session.
  const [placeComingSoon, setPlaceComingSoon] = useState(false)
  // Once the player has left the setup screen, every screen change moves focus to its heading.
  const [hasStarted, setHasStarted] = useState(false)
  const placeHeadingRef = useRef<HTMLHeadingElement>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const audioRef = useRef<AudioEngine | null>(injectedAudio ?? null)

  const session = useGameSession({ storage, rng, getAudio: () => audioRef.current })
  const hint = useSilentSwitchHint(storage)
  const { whenSaved } = session

  const status = session.state.status
  const screen: Screen = placeComingSoon
    ? 'place-coming-soon'
    : status === 'prompting' || status === 'feedback'
      ? 'game'
      : status

  // Browser storage is created after mount so server rendering never touches browser APIs.
  useEffect(() => {
    if (!storage) setStorage(createBrowserProgressStorage())
  }, [storage])

  // The engine this component created is released on unmount; an injected one is the caller's.
  useEffect(() => {
    if (injectedAudio) return
    return () => {
      audioRef.current?.dispose()
      audioRef.current = null
    }
  }, [injectedAudio])

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
    // After the last session's final save, so a Round just finished counts.
    void whenSaved()
      .then(() => storage.getPersonalBest({ mode, clef, rangePreset }))
      .then((best) => {
        if (!cancelled) setPersonalBest(best)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [screen, storage, mode, clef, rangePreset, whenSaved])

  useEffect(() => {
    if (screen === 'place-coming-soon') placeHeadingRef.current?.focus()
  }, [screen])

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

  function handleStart() {
    if (!settings) return
    setHasStarted(true)
    if (settings.mode === 'place') {
      setPlaceComingSoon(true)
      return
    }
    // Inside the Start gesture: browsers only allow audio to start from one.
    safely(() => {
      audioRef.current ??= createAudioEngine()
      const audio = audioRef.current
      audio.setMuted(!settings.soundOn)
      audio.unlock()
      void audio.loadSamples().catch(() => undefined)
    })
    hint.dismiss()
    if (settings.soundOn) hint.offer()
    session.start(settings)
  }

  function handleToggleSound() {
    if (!settings) return
    const soundOn = !settings.soundOn
    handleChange({ ...settings, soundOn })
    safely(() => audioRef.current?.setMuted(!soundOn))
    if (soundOn) hint.offer()
  }

  if (screen === 'game' && settings) {
    return (
      <GameScreen
        state={session.state}
        soundOn={settings.soundOn}
        onToggleSound={handleToggleSound}
        onAnswer={(letter: Letter) => session.commit({ answer: letter })}
        onExit={session.exit}
        showSilentSwitchHint={hint.visible}
        onDismissSilentSwitchHint={hint.dismiss}
      />
    )
  }

  if (screen === 'summary') {
    return (
      <Page>
        <PracticeSummary
          state={session.state}
          onBack={session.exit}
        />
      </Page>
    )
  }

  if (screen === 'ended') {
    return (
      <Page>
        <EndScreen
          state={session.state}
          personalBestBefore={session.personalBestBefore}
          onChangeSettings={session.exit}
        />
      </Page>
    )
  }

  if (screen === 'place-coming-soon') {
    return (
      <Page>
        <div className="flex flex-col gap-6">
          <h1
            ref={placeHeadingRef}
            tabIndex={-1}
            className="text-ink text-3xl font-extrabold tracking-tight focus:outline-none"
          >
            Place the note is coming next
          </h1>
          <p className="text-ink-muted">
            For now, try Name the note: see a note on the staff and name it.
          </p>
          <button
            type="button"
            onClick={() => setPlaceComingSoon(false)}
            className="bg-accent focus-visible:ring-accent min-h-12 touch-manipulation rounded-xl px-6 py-3 text-lg font-bold text-white hover:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Back to setup
          </button>
        </div>
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
          onStart={handleStart}
          focusHeading={hasStarted}
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
