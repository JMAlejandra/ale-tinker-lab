import { createAudioEngine } from '~/modules/staff-reading-game'

type FakeParam = {
  value: number
  setValueAtTime: jest.Mock<void, [number, number]>
  linearRampToValueAtTime: jest.Mock<void, [number, number]>
  exponentialRampToValueAtTime: jest.Mock<void, [number, number]>
}
type FakeNode = { connect: jest.Mock; disconnect: jest.Mock }
type FakeGain = FakeNode & { gain: FakeParam }
type FakeOscillator = FakeNode & {
  onended?: (() => void) | null
  type: string
  frequency: FakeParam
  start: jest.Mock<void, [number]>
  stop: jest.Mock<void, [number]>
}
type FakeSource = FakeNode & {
  buffer: unknown
  playbackRate: FakeParam
  start: jest.Mock<void, [number]>
  stop: jest.Mock<void, [number]>
}

const param = (value = 1): FakeParam => ({
  value,
  setValueAtTime: jest.fn<void, [number, number]>(),
  linearRampToValueAtTime: jest.fn<void, [number, number]>(),
  exponentialRampToValueAtTime: jest.fn<void, [number, number]>(),
})
const node = (): FakeNode => ({ connect: jest.fn(), disconnect: jest.fn() })

function createFakeContext() {
  const gains: FakeGain[] = []
  const oscillators: FakeOscillator[] = []
  const sources: FakeSource[] = []
  const context = {
    currentTime: 10,
    destination: { kind: 'destination' },
    state: 'suspended' as string,
    resume: jest.fn(() => Promise.resolve()),
    close: jest.fn(() => Promise.resolve()),
    createGain: jest.fn(() => {
      const gain = { ...node(), gain: param() }
      gains.push(gain)
      return gain
    }),
    createOscillator: jest.fn(() => {
      const oscillator = {
        ...node(),
        type: 'sine',
        frequency: param(440),
        start: jest.fn<void, [number]>(),
        stop: jest.fn<void, [number]>(),
      }
      oscillators.push(oscillator)
      return oscillator
    }),
    createBufferSource: jest.fn(() => {
      const source = {
        ...node(),
        buffer: null as unknown,
        playbackRate: param(1),
        start: jest.fn<void, [number]>(),
        stop: jest.fn<void, [number]>(),
      }
      sources.push(source)
      return source
    }),
    // The fake "decodes" a one-byte buffer into { midi } so tests can tell
    // which sample a source was given.
    decodeAudioData: jest.fn<
      Promise<unknown> | undefined,
      [ArrayBuffer, ((decoded: unknown) => void)?, ((error: unknown) => void)?]
    >((data) => Promise.resolve({ midi: new Uint8Array(data)[0], duration: 5 })),
  }
  // Like a real context, resume() moves it to 'running'.
  context.resume.mockImplementation(() => {
    context.state = 'running'
    return Promise.resolve()
  })
  return { context, gains, oscillators, sources }
}

function engineWith(fake: ReturnType<typeof createFakeContext>) {
  return createAudioEngine({
    createContext: () => fake.context,
  })
}

describe('audio engine', () => {
  describe('before unlock', () => {
    it('does not touch Web Audio at creation and play is a silent no-op', () => {
      const createContext = jest.fn()
      const engine = createAudioEngine({ createContext })

      expect(() => engine.play('C4')).not.toThrow()
      expect(createContext).not.toHaveBeenCalled()
    })
  })

  describe('fallback tone', () => {
    it('plays a short oscillator tone at the note frequency until samples are loaded', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)

      engine.unlock()
      engine.play('A4')

      expect(fake.context.resume).toHaveBeenCalled()
      expect(fake.oscillators).toHaveLength(1)
      const [oscillator] = fake.oscillators
      expect(oscillator?.frequency.value).toBeCloseTo(440, 5)
      expect(oscillator?.start).toHaveBeenCalledWith(10)
      const stopAt = oscillator?.stop.mock.calls[0]?.[0]
      expect(stopAt).toBeGreaterThan(10.3)
      expect(stopAt).toBeLessThan(10.8)
      expect(fake.sources).toHaveLength(0)
    })

    it('uses the right frequency for another note', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.play('C4')
      expect(fake.oscillators[0]?.frequency.value).toBeCloseTo(261.63, 1)
    })

    it('schedules a delayed note relative to the context clock', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.play('C4', { delayMs: 400 })
      expect(fake.oscillators[0]?.start).toHaveBeenCalledWith(10.4)
    })
  })

  describe('samples', () => {
    // File stem -> MIDI number, written out as literals (C4 = 60).
    const SAMPLE_MIDI: Record<string, number> = {
      C2: 36, Ds2: 39, Fs2: 42, A2: 45,
      C3: 48, Ds3: 51, Fs3: 54, A3: 57,
      C4: 60, Ds4: 63, Fs4: 66, A4: 69,
      C5: 72, Ds5: 75, Fs5: 78, A5: 81,
      C6: 84,
    } // prettier-ignore

    function fetchByName(failing: string[] = []) {
      return jest.fn((url: string) => {
        const stem = /\/([A-Za-z]+\d)\.mp3$/.exec(url)?.[1] ?? ''
        const midi = SAMPLE_MIDI[stem]
        if (midi === undefined || failing.includes(stem)) {
          return Promise.reject(new Error(`no sample for ${url}`))
        }
        return Promise.resolve(new Uint8Array([midi]).buffer)
      })
    }

    async function loadedEngine(fake = createFakeContext(), fetchSample = fetchByName()) {
      const engine = createAudioEngine({
        createContext: () => fake.context,
        fetchSample,
        baseUrl: '/piano/',
      })
      engine.unlock()
      await engine.loadSamples()
      return { engine, fake, fetchSample }
    }

    it('requests all 17 samples from the base url, once', async () => {
      const { engine, fetchSample } = await loadedEngine()
      await engine.loadSamples()

      const urls = fetchSample.mock.calls.map(([url]) => url).sort()
      expect(urls).toHaveLength(17)
      expect(urls).toContain('/piano/C2.mp3')
      expect(urls).toContain('/piano/Ds4.mp3')
      expect(urls).toContain('/piano/C6.mp3')
    })

    it('plays an exact sample match at normal rate', async () => {
      const { engine, fake } = await loadedEngine()
      engine.play('C4')

      expect(fake.oscillators).toHaveLength(0)
      expect(fake.sources).toHaveLength(1)
      expect(fake.sources[0]?.buffer).toMatchObject({ midi: 60 })
      expect(fake.sources[0]?.playbackRate.value).toBeCloseTo(1, 10)
      expect(fake.sources[0]?.start).toHaveBeenCalledWith(10)
    })

    it('pitch-shifts the nearest sample down a semitone', async () => {
      const { engine, fake } = await loadedEngine()
      engine.play('D4') // MIDI 62, nearest is D#4 (63)

      expect(fake.sources[0]?.buffer).toMatchObject({ midi: 63 })
      expect(fake.sources[0]?.playbackRate.value).toBeCloseTo(0.943874, 5)
    })

    it('pitch-shifts the nearest sample up a semitone', async () => {
      const { engine, fake } = await loadedEngine()
      engine.play('E4') // MIDI 64, nearest is D#4 (63)

      expect(fake.sources[0]?.buffer).toMatchObject({ midi: 63 })
      expect(fake.sources[0]?.playbackRate.value).toBeCloseTo(1.059463, 5)
    })

    it('picks the closer sample when the note is nearer the upper one', async () => {
      const { engine, fake } = await loadedEngine()
      engine.play('B3') // MIDI 59: A3 (57) is 2 away, C4 (60) is 1 away

      expect(fake.sources[0]?.buffer).toMatchObject({ midi: 60 })
      expect(fake.sources[0]?.playbackRate.value).toBeCloseTo(0.943874, 5)
    })

    it('shifts the highest sample for notes above the sampled range', async () => {
      const { engine, fake } = await loadedEngine()
      engine.play('C7') // MIDI 96

      expect(fake.sources[0]?.buffer).toMatchObject({ midi: 84 })
      expect(fake.sources[0]?.playbackRate.value).toBeCloseTo(2, 10)
    })

    it('shapes the note with a gain envelope that ends at silence', async () => {
      const { engine, fake } = await loadedEngine()
      const gainsBefore = fake.gains.length
      engine.play('C4')

      const envelope = fake.gains[gainsBefore]
      expect(envelope?.gain.setValueAtTime).toHaveBeenCalledWith(0, 10)
      const ramps = envelope?.gain.linearRampToValueAtTime.mock.calls ?? []
      expect(ramps.at(-1)?.[0]).toBe(0)
      expect(fake.sources[0]?.stop).toHaveBeenCalledWith(ramps.at(-1)?.[1])
    })

    it('uses the fallback tone while samples are still decoding', () => {
      const fake = createFakeContext()
      fake.context.decodeAudioData.mockReturnValue(new Promise(() => undefined))
      const engine = createAudioEngine({
        createContext: () => fake.context,
        fetchSample: fetchByName(),
      })
      engine.unlock()
      void engine.loadSamples()
      engine.play('C4')

      expect(fake.sources).toHaveLength(0)
      expect(fake.oscillators).toHaveLength(1)
    })

    it('falls back to the tone and does not reject when every sample fails', async () => {
      const failAll = jest.fn((_url: string) => Promise.reject<ArrayBuffer>(new Error('offline')))
      const { engine, fake } = await loadedEngine(createFakeContext(), failAll)

      engine.play('G4')
      expect(fake.sources).toHaveLength(0)
      expect(fake.oscillators[0]?.frequency.value).toBeCloseTo(392, 0)
    })

    it('uses only the samples that did load when some fail', async () => {
      const { engine, fake } = await loadedEngine(createFakeContext(), fetchByName(['C4', 'Ds4']))
      engine.play('C4') // C4 and D#4 failed; nearest loaded is A3 (57)

      expect(fake.sources[0]?.buffer).toMatchObject({ midi: 57 })
      expect(fake.sources[0]?.playbackRate.value).toBeCloseTo(2 ** (3 / 12), 6)
    })

    it('does not reject when decoding fails', async () => {
      const fake = createFakeContext()
      fake.context.decodeAudioData.mockRejectedValue(new Error('bad data'))
      const { engine } = await loadedEngine(fake)

      expect(() => engine.play('C4')).not.toThrow()
      expect(fake.oscillators).toHaveLength(1)
    })

    it('does nothing when called before unlock, and works once unlocked', async () => {
      const fake = createFakeContext()
      const fetchSample = fetchByName()
      const engine = createAudioEngine({
        createContext: () => fake.context,
        fetchSample,
      })

      await expect(engine.loadSamples()).resolves.toBeUndefined()
      expect(fetchSample).not.toHaveBeenCalled()

      engine.unlock()
      await engine.loadSamples()
      expect(fetchSample).toHaveBeenCalledTimes(17)
    })
  })

  describe('mute', () => {
    it('makes play a silent no-op and silences the master output', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.setMuted(true)
      engine.play('C4')

      expect(fake.oscillators).toHaveLength(0)
      expect(fake.gains[0]?.gain.value).toBe(0)
    })

    it('restores sound when unmuted', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.setMuted(true)
      engine.setMuted(false)
      engine.play('C4')

      expect(fake.gains[0]?.gain.value).toBe(0.8)
      expect(fake.oscillators).toHaveLength(1)
    })

    it('stays muted when muted before unlock', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.setMuted(true)
      engine.unlock()
      engine.play('C4')

      expect(fake.gains[0]?.gain.value).toBe(0)
      expect(fake.oscillators).toHaveLength(0)
    })
  })

  describe('failure paths', () => {
    it('stays silent and does not throw when Web Audio is unavailable', () => {
      const engine = createAudioEngine({
        createContext: () => {
          throw new Error('not supported')
        },
      })

      expect(() => engine.unlock()).not.toThrow()
      expect(() => engine.play('C4')).not.toThrow()
      expect(() => engine.setMuted(true)).not.toThrow()
      expect(() => engine.dispose()).not.toThrow()
    })

    it('does not throw when the default context is unavailable (node)', async () => {
      const engine = createAudioEngine()

      expect(() => engine.unlock()).not.toThrow()
      expect(() => engine.play('C4')).not.toThrow()
      await expect(engine.loadSamples()).resolves.toBeUndefined()
    })

    it('does not throw when creating a node fails during play', () => {
      const fake = createFakeContext()
      fake.context.createOscillator.mockImplementation(() => {
        throw new Error('boom')
      })
      const engine = engineWith(fake)
      engine.unlock()

      expect(() => engine.play('C4')).not.toThrow()
    })

    it('ignores a rejected resume()', async () => {
      const fake = createFakeContext()
      fake.context.resume.mockRejectedValue(new Error('blocked'))
      const engine = engineWith(fake)

      expect(() => engine.unlock()).not.toThrow()
      await Promise.resolve()
    })

    it('creates the context only once across repeated unlocks', () => {
      const fake = createFakeContext()
      const createContext = jest.fn(() => fake.context)
      const engine = createAudioEngine({ createContext })
      engine.unlock()
      engine.unlock()

      expect(createContext).toHaveBeenCalledTimes(1)
      expect(fake.context.resume).toHaveBeenCalledTimes(2)
    })
  })

  describe('robustness', () => {
    it('supports the callback form of decodeAudioData (old iOS Safari)', async () => {
      const fake = createFakeContext()
      fake.context.decodeAudioData.mockImplementation(
        (data: ArrayBuffer, onSuccess?: (d: unknown) => void) => {
          onSuccess?.({ midi: new Uint8Array(data)[0] })
          return undefined
        },
      )
      const engine = createAudioEngine({
        createContext: () => fake.context,
        fetchSample: () => Promise.resolve(new Uint8Array([60]).buffer),
      })
      engine.unlock()
      await engine.loadSamples()
      engine.play('C4')

      expect(fake.sources).toHaveLength(1)
      expect(fake.oscillators).toHaveLength(0)
    })

    it('never stores an empty decode result, so the tone stays in effect', async () => {
      const fake = createFakeContext()
      fake.context.decodeAudioData.mockResolvedValue(undefined)
      const engine = createAudioEngine({
        createContext: () => fake.context,
        fetchSample: () => Promise.resolve(new ArrayBuffer(1)),
      })
      engine.unlock()
      await engine.loadSamples()
      engine.play('C4')

      expect(fake.sources).toHaveLength(0)
      expect(fake.oscillators).toHaveLength(1)
    })

    it.each([NaN, Infinity, -5])('treats delayMs %p as no delay', (delayMs) => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.play('C4', { delayMs })

      expect(fake.oscillators[0]?.start).toHaveBeenCalledWith(10)
    })

    it('resumes again and skips the note while the context is suspended', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      fake.context.state = 'suspended'
      fake.context.resume.mockImplementation(() => Promise.resolve())
      fake.context.resume.mockClear()
      engine.play('C4')

      expect(fake.context.resume).toHaveBeenCalledTimes(1)
      expect(fake.oscillators).toHaveLength(0)
    })

    it('disconnects nodes when a note ends', () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.play('C4')
      const oscillator = fake.oscillators[0]
      const envelope = fake.gains[1]
      oscillator?.onended?.()

      expect(oscillator?.disconnect).toHaveBeenCalled()
      expect(envelope?.disconnect).toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('closes the context and makes later calls no-ops', async () => {
      const fake = createFakeContext()
      const engine = engineWith(fake)
      engine.unlock()
      engine.dispose()
      engine.play('C4')
      engine.unlock()

      expect(fake.context.close).toHaveBeenCalledTimes(1)
      expect(fake.oscillators).toHaveLength(0)
      await expect(engine.loadSamples()).resolves.toBeUndefined()
    })
  })
})
