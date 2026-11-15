import {
  type Clef,
  type GameSettings,
  type Mode,
  type NoteNaming,
  type RangePreset,
  type SessionType,
} from '~/modules/staff-reading-game'

import { OptionGroup, type Option } from './option-group'
import { ToggleField } from './toggle-field'

const MODE_OPTIONS: readonly Option<Mode>[] = [
  { value: 'place', label: 'Place the note', description: 'See a note name, put it on the staff.' },
  { value: 'name', label: 'Name the note', description: 'See a note on the staff, name it.' },
]

const SESSION_TYPE_OPTIONS: readonly Option<SessionType>[] = [
  { value: 'practice', label: 'Practice' },
  { value: 'round', label: 'Round (20 notes)' },
]

const CLEF_OPTIONS: readonly Option<Clef>[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
]

const RANGE_PRESET_OPTIONS: readonly Option<RangePreset>[] = [
  { value: 'landmarks', label: 'Landmarks' },
  { value: 'lines', label: 'Lines' },
  { value: 'spaces', label: 'Spaces' },
  { value: 'full-staff', label: 'Full staff' },
  { value: 'extended', label: 'Extended' },
]

const NOTE_NAMING_OPTIONS: readonly Option<NoteNaming>[] = [
  { value: 'letters', label: 'Letters (C D E)' },
  { value: 'solfege', label: 'Solfège (Do Re Mi)' },
]

type SetupScreenProps = {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  personalBest: number | null
  /** False when progress only lives in memory on this device. */
  persisting: boolean
  onStart: () => void
}

export function SetupScreen({
  settings,
  onChange,
  personalBest,
  persisting,
  onStart,
}: SetupScreenProps) {
  const update = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch })

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-ink text-3xl font-extrabold tracking-tight">Staff Reading Game</h1>
        <p className="text-ink-muted mt-1">Choose how you want to practise.</p>
      </header>

      <OptionGroup
        legend="Mode"
        variant="cards"
        options={MODE_OPTIONS}
        value={settings.mode}
        onChange={(mode) => update({ mode })}
      />
      <OptionGroup
        legend="Session type"
        options={SESSION_TYPE_OPTIONS}
        value={settings.sessionType}
        onChange={(sessionType) => update({ sessionType })}
      />
      <OptionGroup
        legend="Clef"
        options={CLEF_OPTIONS}
        value={settings.clef}
        onChange={(clef) => update({ clef })}
      />
      <OptionGroup
        legend="Range"
        options={RANGE_PRESET_OPTIONS}
        value={settings.rangePreset}
        onChange={(rangePreset) => update({ rangePreset })}
      />
      <OptionGroup
        legend="Note naming"
        options={NOTE_NAMING_OPTIONS}
        value={settings.noteNaming}
        onChange={(noteNaming) => update({ noteNaming })}
      />

      <div className="flex flex-col gap-2">
        {settings.mode === 'place' ? (
          <ToggleField
            label="Strict octave"
            checked={settings.strictOctave}
            onChange={(strictOctave) => update({ strictOctave })}
          />
        ) : null}
        <ToggleField
          label="Sound"
          checked={settings.soundOn}
          onChange={(soundOn) => update({ soundOn })}
        />
        {settings.mode === 'place' ? (
          <ToggleField
            label="Preview sound while placing"
            checked={settings.previewSound}
            onChange={(previewSound) => update({ previewSound })}
          />
        ) : null}
      </div>

      {personalBest !== null ? (
        <p className="text-ink font-semibold">
          Personal best: {personalBest.toLocaleString('en-US')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onStart}
        className="bg-accent focus-visible:ring-accent min-h-12 touch-manipulation rounded-xl px-6 py-3 text-lg font-bold text-white hover:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Start
      </button>

      {!persisting ? (
        <p
          role="status"
          className="text-ink-muted text-sm"
        >
          Progress isn&apos;t being saved on this device.
        </p>
      ) : null}
    </div>
  )
}
