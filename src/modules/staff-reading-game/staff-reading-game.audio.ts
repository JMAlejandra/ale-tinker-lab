import { noteToFrequency, noteToMidi } from './staff-reading-game.notes'
import type { CanonicalNote } from './staff-reading-game.types'

/**
 * Piano sound engine (Decision D23): the Web Audio API used directly. It
 * decodes a subset of the Salamander grand piano samples and pitch-shifts the
 * nearest one by playback rate. Until samples are decoded, or if loading
 * fails, a short oscillator tone is played instead.
 *
 * Nothing here touches `window` or `AudioContext` at import time; the context
 * is created by `unlock()`, which must run inside a user gesture. No public
 * method throws.
 */

// Minimal structural views of the Web Audio objects the engine uses, so tests
// can pass a hand-written fake. A real `AudioContext` satisfies them.
type AudioParamLike = {
  value: number
  setValueAtTime(value: number, time: number): unknown
  linearRampToValueAtTime(value: number, time: number): unknown
  exponentialRampToValueAtTime(value: number, time: number): unknown
}
type AudioNodeLike = {
  connect(destination: unknown): unknown
  disconnect(): void
  onended?: (() => void) | null
}
type GainNodeLike = AudioNodeLike & { gain: AudioParamLike }
type OscillatorNodeLike = AudioNodeLike & {
  type: string
  frequency: AudioParamLike
  start(when: number): void
  stop(when: number): void
}
type BufferSourceNodeLike = AudioNodeLike & {
  buffer: unknown
  playbackRate: AudioParamLike
  start(when: number): void
  stop(when: number): void
}

export type AudioContextLike = {
  readonly currentTime: number
  readonly destination: unknown
  readonly state?: string
  resume(): Promise<void>
  close(): Promise<void>
  createGain(): GainNodeLike
  createOscillator(): OscillatorNodeLike
  createBufferSource(): BufferSourceNodeLike
  // Old iOS Safari only supports the callback form and returns undefined.
  decodeAudioData(
    data: ArrayBuffer,
    onSuccess?: (decoded: unknown) => void,
    onError?: (error: unknown) => void,
  ): Promise<unknown> | undefined
}

export type AudioEngineOptions = {
  createContext?: () => AudioContextLike
  fetchSample?: (url: string) => Promise<ArrayBuffer>
  baseUrl?: string
}

export type AudioEngine = {
  /** Creates and resumes the audio context. Call from a user gesture. */
  unlock(): void
  /** Fetches and decodes the samples in the background. Never rejects. */
  loadSamples(): Promise<void>
  /** Plays a note, optionally after a delay. Silent no-op when it cannot. */
  play(note: CanonicalNote, options?: { delayMs?: number }): void
  setMuted(muted: boolean): void
  dispose(): void
}

const DEFAULT_BASE_URL = '/staff-reading-game/piano'
/** File-name stem for MIDI numbers that are 0, 3, 6, 9 semitones above a C. */
const SAMPLE_NAMES: Record<number, string> = { 0: 'C', 3: 'Ds', 6: 'Fs', 9: 'A' }
/** C2 to C6 in MIDI numbers, one sample every 3 semitones. */
const FIRST_SAMPLE_MIDI = 36
const LAST_SAMPLE_MIDI = 84

type SampleSpec = { midi: number; file: string }

const SAMPLES: readonly SampleSpec[] = Array.from(
  { length: (LAST_SAMPLE_MIDI - FIRST_SAMPLE_MIDI) / 3 + 1 },
  (_, index) => {
    const midi = FIRST_SAMPLE_MIDI + index * 3
    const octave = Math.floor(midi / 12) - 1
    return { midi, file: `${SAMPLE_NAMES[midi % 12] ?? ''}${octave}.mp3` }
  },
)

const SAMPLE_NOTE_SECONDS = 1.8
const SAMPLE_RELEASE_SECONDS = 0.25
const ATTACK_SECONDS = 0.005
/** Leaves headroom for overlapping notes (e.g. preview sound). */
const MASTER_GAIN = 0.8
const TONE_SECONDS = 0.5
const TONE_PEAK_GAIN = 0.35
const TONE_FLOOR_GAIN = 0.001

type WebAudioGlobals = {
  AudioContext?: new () => AudioContextLike
  webkitAudioContext?: new () => AudioContextLike
}

function createDefaultContext(): AudioContextLike {
  const globals = globalThis as unknown as WebAudioGlobals
  const Ctor = globals.AudioContext ?? globals.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio is not supported')
  return new Ctor()
}

async function defaultFetchSample(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Sample request failed: ${response.status}`)
  return response.arrayBuffer()
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const createContext = options.createContext ?? createDefaultContext
  const fetchSample = options.fetchSample ?? defaultFetchSample
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')

  let context: AudioContextLike | null = null
  let master: GainNodeLike | null = null
  let muted = false
  let disposed = false
  let loading: Promise<void> | null = null
  const buffers = new Map<number, unknown>()

  function nearestSample(midi: number): number | null {
    let best: number | null = null
    for (const sampleMidi of buffers.keys()) {
      if (best === null || Math.abs(sampleMidi - midi) < Math.abs(best - midi)) {
        best = sampleMidi
      }
    }
    return best
  }

  function releaseWhenEnded(source: AudioNodeLike, envelope: AudioNodeLike) {
    source.onended = () => {
      try {
        source.disconnect()
        envelope.disconnect()
      } catch {
        // already disconnected
      }
    }
  }

  function decode(ctx: AudioContextLike, data: ArrayBuffer): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const result = ctx.decodeAudioData(data, resolve, reject)
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function playSample(
    ctx: AudioContextLike,
    output: GainNodeLike,
    buffer: unknown,
    rate: number,
    when: number,
  ) {
    const source = ctx.createBufferSource()
    const envelope = ctx.createGain()
    source.buffer = buffer
    source.playbackRate.value = rate
    const end = when + SAMPLE_NOTE_SECONDS
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(1, when + ATTACK_SECONDS)
    envelope.gain.setValueAtTime(1, end - SAMPLE_RELEASE_SECONDS)
    envelope.gain.linearRampToValueAtTime(0, end)
    source.connect(envelope)
    envelope.connect(output)
    releaseWhenEnded(source, envelope)
    source.start(when)
    source.stop(end)
  }

  function playTone(ctx: AudioContextLike, output: GainNodeLike, frequency: number, when: number) {
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency
    const end = when + TONE_SECONDS
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(TONE_PEAK_GAIN, when + ATTACK_SECONDS)
    envelope.gain.exponentialRampToValueAtTime(TONE_FLOOR_GAIN, end)
    oscillator.connect(envelope)
    envelope.connect(output)
    releaseWhenEnded(oscillator, envelope)
    oscillator.start(when)
    oscillator.stop(end)
  }

  async function loadOne(ctx: AudioContextLike, spec: SampleSpec) {
    try {
      const data = await fetchSample(`${baseUrl}/${spec.file}`)
      const decoded = await decode(ctx, data)
      if (decoded && !disposed) buffers.set(spec.midi, decoded)
    } catch {
      // A missing sample only means nearby notes use another sample or the
      // fallback tone.
    }
  }

  return {
    unlock() {
      try {
        if (disposed) return
        if (!context) {
          const created = createContext()
          const gain = created.createGain()
          gain.gain.value = muted ? 0 : MASTER_GAIN
          gain.connect(created.destination)
          context = created
          master = gain
        }
        void Promise.resolve(context.resume()).catch(() => undefined)
      } catch {
        // No Web Audio, or it was refused: the game stays silent.
      }
    },

    loadSamples() {
      // Decoding needs the context, so before unlock() this does nothing and
      // can be called again later.
      if (!context || disposed) return Promise.resolve()
      const ctx = context
      loading ??= Promise.all(SAMPLES.map((spec) => loadOne(ctx, spec))).then(() => undefined)
      return loading
    },

    play(note, playOptions) {
      try {
        if (muted || !context || !master) return
        if (context.state !== undefined && context.state !== 'running') {
          // play runs inside a gesture: try again, but never queue notes on a
          // suspended clock, or they would all burst out later.
          void Promise.resolve(context.resume()).catch(() => undefined)
          return
        }
        const delayMs = playOptions?.delayMs ?? 0
        const delaySeconds = Number.isFinite(delayMs) ? Math.max(0, delayMs) / 1000 : 0
        const when = context.currentTime + delaySeconds
        const midi = noteToMidi(note)
        const sampleMidi = nearestSample(midi)
        if (sampleMidi === null) {
          playTone(context, master, noteToFrequency(note), when)
          return
        }
        playSample(context, master, buffers.get(sampleMidi), 2 ** ((midi - sampleMidi) / 12), when)
      } catch {
        // Sound is a nicety; never break the game.
      }
    },

    setMuted(value) {
      try {
        muted = value
        if (master) master.gain.value = value ? 0 : MASTER_GAIN
      } catch {
        // ignore
      }
    },

    dispose() {
      disposed = true
      buffers.clear()
      const ctx = context
      context = null
      master = null
      try {
        if (ctx) void Promise.resolve(ctx.close()).catch(() => undefined)
      } catch {
        // ignore
      }
    },
  }
}
