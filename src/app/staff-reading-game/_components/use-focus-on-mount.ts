'use client'

import { useEffect, useRef } from 'react'

/**
 * Moves focus to the returned element when it mounts (if `enabled`), so keyboard and
 * screen-reader users land on a screen that just replaced the previous one. Give the element
 * `tabIndex={-1}`.
 */
export function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (enabled) ref.current?.focus()
  }, [enabled])
  return ref
}
