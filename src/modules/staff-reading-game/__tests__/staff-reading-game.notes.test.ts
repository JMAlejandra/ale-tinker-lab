import {
  BOTTOM_LINE_STEP,
  CLEFS,
  DEFAULT_SETTINGS,
  MODES,
  NOTE_NAMINGS,
  RANGE_PRESETS,
  SESSION_TYPES,
  TOP_LINE_STEP,
  isCanonicalNote,
  LETTERS,
  MAX_STEP,
  MIDDLE_LINE_STEP,
  MIN_STEP,
  clampStep,
  formatNote,
  getLedgerLineSteps,
  letterDisplayName,
  noteDisplayName,
  noteToFrequency,
  noteToMidi,
  noteToStep,
  notesForPreset,
  parseNote,
  stepToNote,
  visibleNotes,
  type CanonicalNote,
  type Clef,
  type RangePreset,
} from '~/modules/staff-reading-game'

describe('LETTERS', () => {
  it('lists letters in scale order', () => {
    expect([...LETTERS]).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  })
})

describe('parseNote / formatNote', () => {
  it('parses a canonical note', () => {
    expect(parseNote('G4')).toEqual({ letter: 'G', octave: 4 })
    expect(parseNote('C2')).toEqual({ letter: 'C', octave: 2 })
  })

  it('formats letter and octave', () => {
    expect(formatNote('G', 4)).toBe('G4')
  })

  it.each(['', 'G', '4', 'H4', 'g4', 'G-1', 'G44', 'G4 ', 'G#4', 'Sol4'])('rejects %j', (bad) => {
    expect(parseNote(bad)).toBeNull()
  })
})

describe('step constants', () => {
  it('exposes visible-area bounds and the middle line', () => {
    expect(MIN_STEP).toBe(-4)
    expect(MAX_STEP).toBe(12)
    expect(MIDDLE_LINE_STEP).toBe(4)
  })
})

describe('noteToStep / stepToNote', () => {
  it.each<[Clef, CanonicalNote, number]>([
    ['treble', 'E4', 0],
    ['treble', 'F5', 8],
    ['treble', 'A3', -4],
    ['treble', 'C6', 12],
    ['treble', 'B4', 4],
    ['bass', 'G2', 0],
    ['bass', 'A3', 8],
    ['bass', 'C2', -4],
    ['bass', 'E4', 12],
    ['bass', 'D3', 4],
  ])('%s %s is step %i', (clef, note, step) => {
    expect(noteToStep(note, clef)).toBe(step)
    expect(stepToNote(step, clef)).toBe(note)
  })
})

describe('clampStep', () => {
  it('leaves in-range steps alone and snaps others to the visible area', () => {
    expect(clampStep(0)).toBe(0)
    expect(clampStep(-4)).toBe(-4)
    expect(clampStep(12)).toBe(12)
    expect(clampStep(-9)).toBe(-4)
    expect(clampStep(40)).toBe(12)
  })
})

describe('getLedgerLineSteps', () => {
  it.each<[number, number[]]>([
    [0, []],
    [8, []],
    [4, []],
    [-1, []],
    [9, []],
    [-2, [-2]], // C4 treble
    [-3, [-2]],
    [-4, [-2, -4]], // A3 treble
    [10, [10]],
    [11, [10]],
    [12, [10, 12]], // C6 treble
  ])('step %i needs ledger lines at %j', (step, expected) => {
    expect(getLedgerLineSteps(step)).toEqual(expected)
  })
})

describe('visibleNotes', () => {
  it('covers A3-C6 for treble, low to high', () => {
    const notes = visibleNotes('treble')
    expect(notes).toHaveLength(17)
    expect(notes[0]).toBe('A3')
    expect(notes[16]).toBe('C6')
  })

  it('covers C2-E4 for bass, low to high', () => {
    const notes = visibleNotes('bass')
    expect(notes).toHaveLength(17)
    expect(notes[0]).toBe('C2')
    expect(notes[16]).toBe('E4')
  })
})

describe('notesForPreset', () => {
  const table: Record<RangePreset, Record<Clef, string[]>> = {
    landmarks: { treble: ['C4', 'G4', 'C5'], bass: ['C3', 'F3', 'C4'] },
    lines: {
      treble: ['E4', 'G4', 'B4', 'D5', 'F5'],
      bass: ['G2', 'B2', 'D3', 'F3', 'A3'],
    },
    spaces: {
      treble: ['F4', 'A4', 'C5', 'E5'],
      bass: ['A2', 'C3', 'E3', 'G3'],
    },
    'full-staff': {
      treble: ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'],
      bass: ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'],
    },
    extended: {
      treble: [
        'A3',
        'B3',
        'C4',
        'D4',
        'E4',
        'F4',
        'G4',
        'A4',
        'B4',
        'C5',
        'D5',
        'E5',
        'F5',
        'G5',
        'A5',
        'B5',
        'C6',
      ],
      bass: [
        'C2',
        'D2',
        'E2',
        'F2',
        'G2',
        'A2',
        'B2',
        'C3',
        'D3',
        'E3',
        'F3',
        'G3',
        'A3',
        'B3',
        'C4',
        'D4',
        'E4',
      ],
    },
  }

  for (const preset of Object.keys(table) as RangePreset[]) {
    for (const clef of ['treble', 'bass'] as const) {
      it(`${preset} / ${clef}`, () => {
        expect(notesForPreset(preset, clef)).toEqual(table[preset][clef])
      })
    }
  }
})

describe('display names', () => {
  it('names notes in letters', () => {
    expect(noteDisplayName('G4', 'letters')).toBe('G')
    expect(noteDisplayName('G4', 'letters', { withOctave: true })).toBe('G4')
  })

  it('names notes in Spanish solfege', () => {
    expect(noteDisplayName('G4', 'solfege')).toBe('Sol')
    expect(noteDisplayName('G4', 'solfege', { withOctave: true })).toBe('Sol4')
  })

  it('maps every letter to its solfege name', () => {
    expect(LETTERS.map((l) => letterDisplayName(l, 'solfege'))).toEqual([
      'Do',
      'Re',
      'Mi',
      'Fa',
      'Sol',
      'La',
      'Si',
    ])
    expect(LETTERS.map((l) => letterDisplayName(l, 'letters'))).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
    ])
  })
})

describe('noteToMidi / noteToFrequency', () => {
  it('converts to MIDI numbers', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A4')).toBe(69)
    expect(noteToMidi('C2')).toBe(36)
    expect(noteToMidi('C6')).toBe(84)
  })

  it('converts to frequency with A4 = 440 Hz', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 6)
    expect(noteToFrequency('A3')).toBeCloseTo(220, 6)
    expect(noteToFrequency('C4')).toBeCloseTo(261.6256, 3)
  })
})

describe('isCanonicalNote', () => {
  it('accepts canonical notes and rejects other strings', () => {
    expect(isCanonicalNote('G4')).toBe(true)
    expect(isCanonicalNote('G')).toBe(false)
    expect(isCanonicalNote('H4')).toBe(false)
  })
})

describe('line step constants', () => {
  it('marks the bottom and top lines', () => {
    expect(BOTTOM_LINE_STEP).toBe(0)
    expect(TOP_LINE_STEP).toBe(8)
  })
})

describe('option lists', () => {
  it('lists every option of each union', () => {
    expect(CLEFS).toEqual(['treble', 'bass'])
    expect(MODES).toEqual(['place', 'name'])
    expect(SESSION_TYPES).toEqual(['practice', 'round'])
    expect(NOTE_NAMINGS).toEqual(['letters', 'solfege'])
    expect(RANGE_PRESETS).toEqual(['landmarks', 'lines', 'spaces', 'full-staff', 'extended'])
  })
})

describe('DEFAULT_SETTINGS', () => {
  it("matches the spec's Settings table", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      mode: 'name',
      sessionType: 'practice',
      clef: 'treble',
      rangePreset: 'full-staff',
      noteNaming: 'letters',
      strictOctave: false,
      soundOn: true,
      previewSound: false,
    })
  })
})
