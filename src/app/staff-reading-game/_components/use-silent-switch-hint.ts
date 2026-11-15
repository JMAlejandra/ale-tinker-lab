'use client'

import { useCallback, useRef, useState } from 'react'

import { type ProgressStorage } from '~/modules/staff-reading-game'

export const SILENT_SWITCH_HINT = 'ios-silent-switch'

function isIPhone(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('iPhone')
}

/**
 * The one-time iPhone hint that the silent switch mutes the game. `offer()` shows it if this
 * device is an iPhone and the hint was never shown before; showing it records it as seen.
 */
export function useSilentSwitchHint(storage: ProgressStorage | null) {
  const [visible, setVisible] = useState(false)
  const offered = useRef(false)

  const offer = useCallback(() => {
    if (offered.current || !storage || !isIPhone()) return
    offered.current = true
    void (async () => {
      try {
        if (await storage.hasSeenHint(SILENT_SWITCH_HINT)) return
        setVisible(true)
        await storage.markHintSeen(SILENT_SWITCH_HINT)
      } catch {
        // Hint flags are best effort.
      }
    })()
  }, [storage])

  const dismiss = useCallback(() => setVisible(false), [])

  return { visible, offer, dismiss }
}
