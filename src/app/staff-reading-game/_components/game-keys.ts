/** Input types that take no typed text, so game shortcuts still apply while they have focus. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)
}

/**
 * True when a document-level game shortcut must leave this key press alone: Ctrl, Alt or Meta
 * held (browser and OS shortcuts), key auto-repeat, or typing in a text field. Shift is allowed:
 * some layouts (e.g. AZERTY) need it for the digits.
 */
export function isIgnoredShortcut(event: KeyboardEvent): boolean {
  if (event.repeat) return true
  if (event.altKey || event.ctrlKey || event.metaKey) return true
  return isTextEntry(event.target)
}
