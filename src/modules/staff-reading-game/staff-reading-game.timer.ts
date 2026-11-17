/**
 * Measures a prompt's response time, from the moment the prompt is shown to the commit,
 * excluding time while paused (page hidden). The clock is injected
 * (e.g. `() => performance.now()`) so tests are deterministic.
 */
export class ResponseTimer {
  /** Time accumulated before the current running stretch. */
  private accumulated = 0
  /** Start of the current running stretch, or null while paused. */
  private runningSince: number | null = null

  constructor(private readonly now: () => number) {}

  /** Starts (or restarts) timing from zero. */
  start(): void {
    this.accumulated = 0
    this.runningSince = this.now()
  }

  pause(): void {
    if (this.runningSince === null) return
    this.accumulated += this.now() - this.runningSince
    this.runningSince = null
  }

  resume(): void {
    if (this.runningSince !== null) return
    this.runningSince = this.now()
  }

  /** Milliseconds timed so far, without stopping. */
  elapsed(): number {
    const running = this.runningSince === null ? 0 : this.now() - this.runningSince
    return this.accumulated + running
  }

  /** Stops timing and returns the response time in milliseconds. */
  stop(): number {
    this.pause()
    return this.accumulated
  }
}
