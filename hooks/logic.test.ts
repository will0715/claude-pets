import { expect, test } from 'claude-code/testing'
import { act, adopt, ART_WIDTH, cycle, decay, emptyWorld, fit, mood, parseCommand, rename, sprite } from './logic'

test('adopt, feed, play, sleep', () => {
  let w = adopt(emptyWorld(0), 'cat', 0)
  w = adopt(w, 'dog', 0)
  expect(w.pets.map(p => p.kind)).toEqual(['cat', 'dog'])
  expect(w.selected).toBe(1)

  w = act(w, 'play', 10_000)
  expect(w.pets[1].fun).toBe(100)
  expect(mood(w.pets[1], 11_000)).toBe('play')

  w = act(w, 'sleep', 20_000)
  expect(mood(w.pets[1], 21_000)).toBe('sleep')
  expect(act(w, 'feed', 21_000).note).toContain('在睡覺')

  w = cycle(w)
  expect(w.selected).toBe(0)
  for (const m of [0, 1]) {
    for (const line of sprite(w.pets[0], 100_000, m)) expect(line.length).toBe(ART_WIDTH)
  }
  expect(fit('abc', 5)).toBe('abc  ')
  expect(fit('abcdefg', 5)).toBe('abcde')
})

test('stats decay over time and cap at 12h', () => {
  const w = adopt(emptyWorld(0), 'dog', 0)
  const later = decay(w, 10 * 60000)
  expect(later.pets[0].full).toBe(65)
  expect(decay(w, 999 * 3600000).pets[0].full).toBe(0)
})

test('rename the selected pet', () => {
  let w = adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 0)
  w = rename(w, '  阿福 ')
  expect(w.pets[1]?.name).toBe('阿福')
  expect(w.note).toContain('改名叫 阿福')
  expect(rename(w, '咪咪').note).toContain('已經有一隻叫 咪咪')
  expect(rename(w, '   ').pets[1]?.name).toBe('阿福')
  expect(rename(w, 'x'.repeat(13)).note).toContain('最多')
  expect(rename(emptyWorld(0), '阿福').note).toContain('還沒有寵物')
})

test('command line args map to the pane actions', () => {
  const run = (w: ReturnType<typeof emptyWorld>, args: string, now = 0) => {
    const step = parseCommand(args)
    if (typeof step !== 'function') throw new Error(`not a step: ${args}`)
    return step(w, now)
  }
  expect(parseCommand('')).toBe('open')
  expect(parseCommand('  ')).toBe('open')
  expect(parseCommand('dance')).toBeNull()

  let w = run(emptyWorld(0), 'cat')
  w = run(w, '領養狗')
  expect(w.pets.map(p => p.kind)).toEqual(['cat', 'dog'])
  w = run(w, 'FEED', 1000)
  expect(w.note).toContain('啃了骨頭')
  w = run(w, 'next')
  expect(w.selected).toBe(0)
  w = run(w, 'rename 小 黑')
  expect(w.pets[0]?.name).toBe('小 黑')
  w = run(w, 'sleep', 2000)
  expect(w.note).toContain('去睡覺了')
  w = run(w, 'release')
  expect(w.pets.length).toBe(1)
})

test('a trailing name picks the pet', () => {
  const run = (w: ReturnType<typeof emptyWorld>, args: string, now = 0) => {
    const step = parseCommand(args)
    if (typeof step !== 'function') throw new Error(`not a step: ${args}`)
    return step(w, now)
  }
  let w = run(run(emptyWorld(0), 'cat 貓貓'), 'dog')
  expect(w.pets.map(p => p.name)).toEqual(['貓貓', '旺財'])
  expect(w.selected).toBe(1)

  w = run(w, 'feed 貓貓', 1000)
  expect(w.note).toBe('貓貓 吃了小魚乾')
  expect(w.selected).toBe(0)
  w = run(w, 'feed 旺財', 1000)
  expect(w.note).toBe('旺財 啃了骨頭')

  expect(run(w, 'play 小白').note).toBe('沒有叫 小白 的寵物')
  expect(run(w, 'next 貓貓').selected).toBe(0)

  w = run(w, 'rename 阿福 貓貓')
  expect(w.pets.map(p => p.name)).toEqual(['阿福', '旺財'])
  w = run(w, 'rename 小 黑')
  expect(w.pets[0]?.name).toBe('小 黑')
  w = run(w, 'release 旺財')
  expect(w.pets.map(p => p.name)).toEqual(['小 黑'])
  expect(run(w, 'cat 小 黑').note).toContain('已經有一隻叫 小 黑')
})
