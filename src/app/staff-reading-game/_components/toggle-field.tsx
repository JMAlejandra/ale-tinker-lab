type ToggleFieldProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** A native checkbox row. State is shown by a check mark and the words On/Off, not by colour alone. */
export function ToggleField({ label, checked, onChange }: ToggleFieldProps) {
  return (
    <label
      className={`has-[:focus-visible]:ring-accent text-ink relative flex min-h-11 cursor-pointer touch-manipulation items-center justify-between gap-3 rounded-xl border px-4 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
        checked ? 'border-accent bg-accent-soft border-2 font-bold' : 'border-rule bg-card'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span>{label}</span>
      <span
        aria-hidden="true"
        className="flex items-center gap-2 text-sm"
      >
        {checked ? 'On' : 'Off'}
        <span
          className={`flex size-5 items-center justify-center rounded border text-xs ${
            checked ? 'border-accent bg-accent text-white' : 'border-rule'
          }`}
        >
          {checked ? '✓' : ''}
        </span>
      </span>
    </label>
  )
}
