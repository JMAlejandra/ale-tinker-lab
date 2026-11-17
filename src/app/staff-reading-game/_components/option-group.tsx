import { useId } from 'react'

export type Option<T extends string> = {
  value: T
  label: string
  description?: string
}

type OptionGroupProps<T extends string> = {
  legend: string
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  /** `cards` stacks large options; `segments` lays them out as wrapping chips. */
  variant?: 'cards' | 'segments'
}

/** A native radio group styled as selectable cards. The selected option shows a check mark and a thick border. */
export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  variant = 'segments',
}: OptionGroupProps<T>) {
  const name = useId()
  const layout = variant === 'cards' ? 'grid grid-cols-1 gap-3' : 'flex flex-wrap gap-2'

  return (
    <fieldset className="min-w-0">
      <legend className="text-ink mb-2 text-sm font-semibold">{legend}</legend>
      <div className={layout}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={option.value}
              className={`has-[:focus-visible]:ring-accent relative flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-xl border px-3 py-2 text-base has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
                variant === 'cards' ? 'min-h-20 px-4' : ''
              } ${
                selected
                  ? 'border-accent bg-accent-soft text-ink border-2 font-bold'
                  : 'border-rule bg-card text-ink hover:border-ink-muted'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  selected ? 'border-accent bg-accent text-white' : 'border-rule'
                }`}
              >
                {selected ? '✓' : ''}
              </span>
              <span className="flex flex-col">
                <span>{option.label}</span>
                {option.description ? (
                  <span className="text-ink-muted text-sm font-normal">{option.description}</span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
