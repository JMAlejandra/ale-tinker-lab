import { ResponseTimer } from '~/modules/staff-reading-game'

function fakeClock(start = 10_000) {
  let time = start
  return {
    now: () => time,
    tick: (ms: number) => {
      time += ms
    },
  }
}

describe('ResponseTimer', () => {
  it('measures from start to stop', () => {
    const clock = fakeClock()
    const timer = new ResponseTimer(clock.now)
    timer.start()
    clock.tick(1234)
    expect(timer.stop()).toBe(1234)
  })

  it('excludes time while paused (page hidden)', () => {
    const clock = fakeClock()
    const timer = new ResponseTimer(clock.now)
    timer.start()
    clock.tick(1000)
    timer.pause()
    clock.tick(30_000)
    timer.resume()
    clock.tick(500)
    timer.pause()
    clock.tick(5000)
    timer.resume()
    clock.tick(250)
    expect(timer.stop()).toBe(1750)
  })

  it('ignores a repeated pause or a resume without a pause', () => {
    const clock = fakeClock()
    const timer = new ResponseTimer(clock.now)
    timer.start()
    timer.resume()
    clock.tick(100)
    timer.pause()
    clock.tick(1000)
    timer.pause()
    clock.tick(1000)
    timer.resume()
    clock.tick(100)
    expect(timer.stop()).toBe(200)
  })

  it('reports elapsed time without stopping, and stops while paused', () => {
    const clock = fakeClock()
    const timer = new ResponseTimer(clock.now)
    timer.start()
    clock.tick(400)
    expect(timer.elapsed()).toBe(400)
    timer.pause()
    clock.tick(9000)
    expect(timer.elapsed()).toBe(400)
    expect(timer.stop()).toBe(400)
  })

  it('restarts from zero on start', () => {
    const clock = fakeClock()
    const timer = new ResponseTimer(clock.now)
    timer.start()
    clock.tick(700)
    timer.pause()
    timer.start()
    clock.tick(300)
    expect(timer.stop()).toBe(300)
  })
})
