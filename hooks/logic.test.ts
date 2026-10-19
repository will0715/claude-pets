import { expect, test } from 'claude-code/testing'
import type { Pet, World } from '../types'
import type { Scene, Trait } from './logic'
import type { Overlay } from './logic'
import { alone, NOON, withTrait } from './fixtures'
import { overlayOf, greetOverlay, hasPerk, petLabel, trait, breakOverlay, needsBreak, touchActivity, isNight, sadTransitions, absenceSummary, act, adopt, ageLabel, ageMonths, isBirthday, ART_WIDTH, formatEvent, MAX_EVENTS, record, recentEvents, HUNGRY, TIRED, cycle, release, decay, emptyWorld, befriend, cheer, claimLeader, encounterOverlay, LEADER_TTL, fit, gait, GROWN_AFTER_DAYS, isGrown, meet, migrate, stageName, isTestCommand, merge, mood, need, newWalker, NO_REACTION, overlayFor, parseCommand, react, rename, sprite, stepWalker, TOYS, toyLine, toyOf } from './logic'

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
  const w = alone('dog', 'active')
  const later = decay(w, NOON + 10 * 60000)
  expect(later.pets[0]?.full).toBe(70)
  expect(later.lastTick).toBe(NOON + 10 * 60000)
  // Part of a minute waits for the next tick.
  expect(decay(w, NOON + 10 * 60000 + 30000).lastTick).toBe(NOON + 10 * 60000)
})

test('pets eat and nap on their own', () => {
  const min = 60000
  let w = alone('cat', 'active')
  // full 80 drops 1 a minute: below 25 after 56 minutes, then the cat eats.
  w = decay(w, NOON + 56 * min)
  expect(w.pets[0]?.full).toBe(54)
  expect(w.note).toBe('咪咪 肚子餓，自己去吃飯了')

  // energy 80 drops 1 a minute: below 20 after 61 minutes, then a 10 minute nap.
  w = decay(alone('dog', 'active'), NOON + 61 * min)
  expect(w.pets[0]?.sleepingUntil).toBe(NOON + 71 * min)
  expect(w.note).toBe('旺財 累了，自己去睡覺（10 分鐘）')
  expect(mood(w.pets[0]!, NOON + 61 * min + 1)).toBe('sleep')
  w = decay(w, NOON + 71 * min)
  expect(w.pets[0]?.energy).toBe(79)
})

test('left alone for days, every kind of pet keeps itself fed and rested, minute by minute, day and night', () => {
  const min = 60000
  for (const t of ['glutton', 'active', 'lazy'] as const) {
    const start = new Date(2026, 9, 19, 21).getTime()
    let w = decay(alone('cat', t, start), start + 999 * 3600000)
    expect(w.pets[0]!.full).toBeGreaterThanOrEqual(HUNGRY - 1)
    w = { ...alone('cat', t, start), lastTick: start }
    for (let m = 1; m <= 24 * 60; m++) {
      w = decay(w, start + m * min)
      expect(w.pets[0]!.full).toBeGreaterThanOrEqual(HUNGRY - 1)
      expect(w.pets[0]!.energy).toBeGreaterThanOrEqual(TIRED - 1)
    }
  }
})

test('a pet that would wake from a nap hungry eats first', () => {
  const min = 60000
  const night = new Date(2026, 9, 19, 23).getTime()
  const w = alone('dog', 'glutton', night)
  // Next minute: full 48, energy 19, a 30 minute night nap that costs a glutton 60 full.
  const tired = { ...w, pets: [{ ...w.pets[0]!, full: 50, energy: 20, heartsUntil: 0 }] }
  const napping = decay(tired, night + min)
  expect(napping.events.slice(-2)).toEqual([
    { at: night + min, text: '旺財 肚子餓，自己去吃飯了' },
    { at: night + min, text: '旺財 累了，自己去睡覺（30 分鐘）' },
  ])
  // Asleep it cannot eat, so it must not go hungry before it wakes.
  let x = napping
  for (let m = 2; m <= 31; m++) {
    x = decay(x, night + m * min)
    expect(x.pets[0]!.full).toBeGreaterThanOrEqual(HUNGRY - 1)
  }
  expect(mood(x.pets[0]!, night + 31 * min)).not.toBe('sleep')

  // Fed enough already: just the nap.
  const fed = decay({ ...w, pets: [{ ...w.pets[0]!, full: 90, energy: 20 }] }, night + min)
  expect(fed.events.at(-1)?.text).toBe('旺財 累了，自己去睡覺（30 分鐘）')
  expect(fed.events.filter(e => e.text.includes('吃飯')).length).toBe(0)
})

test('rename the selected pet', () => {
  let w = adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 0)
  w = rename(w, '  阿福 ', 0)
  expect(w.pets[1]?.name).toBe('阿福')
  expect(w.note).toContain('改名叫 阿福')
  expect(rename(w, '咪咪', 0).note).toContain('已經有一隻叫 咪咪')
  expect(rename(w, '   ', 0).pets[1]?.name).toBe('阿福')
  expect(rename(w, 'x'.repeat(13), 0).note).toContain('最多')
  expect(rename(emptyWorld(0), '阿福', 0).note).toContain('還沒有寵物')
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

test('merge takes the stored world and keeps the session selection', () => {
  const base = adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 1)
  // This session has the cat selected; another one fed the dog and adopted a third.
  const mine = { ...cycle(base), frame: 7, note: 'mine' }
  const theirs = adopt(act(base, 'feed', 1000), 'cat', 2)
  const w = merge(theirs, mine)
  expect(w.pets.length).toBe(3)
  expect(w.pets[1]?.eatingUntil).toBeGreaterThan(0)
  expect(w.pets[w.selected]?.name).toBe('咪咪')
  expect([w.frame, w.note]).toEqual([7, 'mine'])
  // The selected pet was released elsewhere: fall back to the first.
  expect(merge(release({ ...theirs, selected: 1 }, 0), { ...base, selected: 1 }).selected).toBe(0)
  expect(merge(undefined, mine)).toBe(mine)
})

test('pets wander at random inside the pane', () => {
  // A fixed sequence stands in for Math.random so the run is repeatable.
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const w = adopt(adopt(emptyWorld(0), 'cat', 1), 'dog', 2)
  const now = NOON
  const room = 20
  const runs = w.pets.map(p => {
    let walker = newWalker(room, 0, rand)
    const seen = { xs: [] as number[], modes: new Set<string>(), turns: 0 }
    for (let f = 1; f <= 300; f++) {
      const next = stepWalker(walker, p, now, f, room, rand)
      if (next.right !== walker.right) seen.turns++
      walker = next
      seen.xs.push(Math.round(walker.x))
      seen.modes.add(walker.mode)
    }
    return seen
  })
  for (const run of runs) {
    expect(Math.min(...run.xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...run.xs)).toBeLessThanOrEqual(room)
    expect([...run.modes].sort()).toEqual(['rest', 'run', 'walk'])
    expect(run.turns).toBeGreaterThan(5)
  }
  expect(runs[0]!.xs.join()).not.toBe(runs[1]!.xs.join())

  // A sleeping pet stays where it is.
  const asleep = act(w, 'sleep', now).pets[1]!
  const still = stepWalker({ x: 7, right: true, mode: 'walk', left: 3, frame: 0 }, asleep, now + 1000, 10, room, rand)
  expect(still.x).toBe(7)
  expect(gait(w.pets[0]!).speed).toBeGreaterThanOrEqual(0.6)
  expect(gait(w.pets[0]!).speed).toBeLessThanOrEqual(1.4)
})

test('a sad pet shows what it misses', () => {
  const cat = { ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, fun: 3, heartsUntil: 0 }
  expect(need(cat)).toBe('play?')
  expect(sprite(cat, 10, 0)[0]).toContain('play?')
  expect(sprite(cat, 10, 2)[0]).toContain('...')
  expect(sprite(cat, 10, 0).join('\n')).toContain('T.T')
  for (const line of sprite(cat, 10, 0)) expect(line.length).toBe(ART_WIDTH)
  const dog = { ...adopt(emptyWorld(0), 'dog', 0).pets[0]!, full: 5, heartsUntil: 0 }
  expect(sprite(dog, 10, 0)[0]).toContain('food?')
})

test('each play picks one of three toys', () => {
  for (const kind of ['cat', 'dog'] as const) {
    const notes = new Set([0, 1000, 2000].map(t => act(adopt(emptyWorld(0), kind, 0), 'play', t).note))
    expect(notes.size).toBe(3)
    for (const t of [0, 1000, 2000]) {
      const p = act(adopt(emptyWorld(0), kind, 0), 'play', t).pets[0]!
      const toy = TOYS[kind][toyOf(p)]!
      const glyph = toy.glyph
      if (toy.path === 'carry') {
        // Carried in the mouth: on the sprite, facing either way, and no line of its own.
        expect(toyLine(p, t + 1, 0, 40)).toBe('')
        expect(sprite(p, t + 1, 0, true)[2]).toContain(glyph)
        for (const line of sprite(p, t + 1, 0, false)) expect(line.length).toBe(ART_WIDTH)
        continue
      }
      for (let f = 0; f < 10; f++) {
        const line = toyLine(p, t + 1, f, 40)
        expect(line.length).toBeLessThanOrEqual(40)
        expect(line.trim()).toBe(glyph)
      }
    }
  }
})

test('pets react to tests, failures and thinking', () => {
  expect(isTestCommand('npm test')).toBe(true)
  expect(isTestCommand('cd x && pytest -q tests/')).toBe(true)
  expect(isTestCommand('claude plugin test .')).toBe(true)
  expect(isTestCommand('npm run build')).toBe(false)
  expect(isTestCommand('git log --oneline')).toBe(false)

  let r = react(NO_REACTION, 'think', 0)
  expect(overlayFor(r, 0, 0, false)).toEqual({ hold: 'still', bubble: '?' })
  expect(overlayFor(r, 0, 2, false)?.bubble).toBe('')
  r = react(r, 'pass', 1000)
  expect(overlayFor(r, 2000, 0, false)).toEqual({ hold: 'spin', bubble: 'yay!' })
  // The cheer is over after 3 s; still thinking underneath.
  expect(overlayFor(r, 4001, 0, false)?.bubble).toBe('?')
  r = react(r, 'done', 5000)
  expect(overlayFor(r, 5000, 0, false)).toBeUndefined()
  r = react(react(react(r, 'fail', 6000), 'fail', 6000), 'fail', 6000)
  expect(overlayFor(r, 6000, 0, true)).toEqual({ hold: 'still', bubble: '...' })
  expect(overlayFor(r, 6000, 0, false)).toBeUndefined()
  expect(react(r, 'pass', 7000).fails).toBe(0)

  const w = cheer(adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 0))
  expect(w.pets.map(p => p.fun)).toEqual([85, 85])
  expect(cheer(emptyWorld(0)).note).toBe(emptyWorld(0).note)

  // Drawn (once the adoption hearts are over): a cheering pet spins in place
  // with its bubble; a sleeping one is left alone.
  const cat = w.pets[0]!
  const t = 10_000
  const spin = { hold: 'spin', bubble: 'yay!' } as const
  const walker = { x: 5, right: true, mode: 'walk', left: 3, frame: 0 } as const
  expect(stepWalker(walker, cat, t, 1, 20, () => 0.5, spin)).toMatchObject({ x: 5, right: false })
  expect(stepWalker(walker, cat, t, 2, 20, () => 0.5, spin)).toMatchObject({ x: 5, right: true })
  expect(sprite(cat, t, 0, true, false, spin)[0]).toContain('yay!')
  for (const line of sprite(cat, t, 0, true, false, spin)) expect(line.length).toBe(ART_WIDTH)
  const asleep = act({ ...w, selected: 0 }, 'sleep', t).pets[0]!
  expect(sprite(asleep, t + 1, 0, true, false, spin).join('')).not.toContain('yay!')
})

test('pets standing together meet', () => {
  const t = 10_000
  const w = adopt(adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 1), 'cat', 2)
  const [cat, dog, cat2] = w.pets as [Pet, Pet, Pet]
  const near = new Map([[cat.id, 10], [dog.id, 12], [cat2.id, 30]])
  // No luck this frame.
  expect(meet(w.pets, near, t, 0, () => 0.9)).toBeNull()
  // Too far apart.
  expect(meet(w.pets, new Map([[cat.id, 0], [dog.id, 20]]), t, 0, () => 0)).toBeNull()
  // Busy pets do not meet.
  expect(meet(act({ ...w, selected: 1 }, 'sleep', t).pets, near, t + 1, 0, () => 0)).toBeNull()

  // Lucky: cat and dog, roll 0.5 -> swat, cat first.
  const rolls = [0.1, 0.5]
  const swat = meet([dog, cat], near, t, 100, () => rolls.shift() ?? 0)
  expect(swat).toEqual({ kind: 'swat', a: cat.id, b: dog.id, until: 106 })
  expect(encounterOverlay(swat, cat.id, 100)?.bubble).toBe('paw!')
  expect(encounterOverlay(swat, dog.id, 100)?.bubble).toBe('!!')
  expect(encounterOverlay(swat, cat2.id, 100)).toBeUndefined()
  expect(encounterOverlay(swat, cat.id, 106)).toBeUndefined()
  expect(befriend(w, swat!, 0).note).toBe('咪咪 拍了 旺財 一下')

  // Two cats: play cheers both up.
  const play = meet([cat, cat2], new Map([[cat.id, 5], [cat2.id, 5]]), t, 0, () => 0.1)!
  expect(play.kind).toBe('play')
  const after = befriend(w, play, 0)
  expect(after.pets.map(p => p.fun)).toEqual([85, 80, 85])
  expect(after.note).toBe('咪咪 和 橘子 玩在一起！')
  expect(encounterOverlay(play, cat.id, 0)?.hold).toBe('still')
})

test('pets start small and grow up after a week', () => {
  const day = 86400000
  const w = adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 0)
  const [cat, dog] = w.pets as [Pet, Pet]
  expect(cat.bornAt).toBe(0)
  expect(isGrown(cat, 6 * day)).toBe(false)
  expect(isGrown(cat, GROWN_AFTER_DAYS * day)).toBe(true)
  expect([stageName(cat, 0), stageName(dog, 0)]).toEqual(['幼貓', '小狗'])
  expect([stageName(cat, 8 * day), stageName(dog, 8 * day)]).toEqual(['貓', '狗'])

  // A pet saved before bornAt existed starts as a baby from now.
  const { bornAt: _, ...old } = cat
  const migrated = migrate({ ...w, pets: [old as Pet] }, 500)
  expect(migrated.pets[0]?.bornAt).toBe(500)
  expect(migrate(w, 500)).toBe(w)

  // Growing up is announced by the tick that crosses the line.
  const grownUp = decay({ ...w, lastTick: 7 * day - 60000 }, 7 * day)
  expect(grownUp.note).toBe('旺財 長大了！')

  // Baby and adult art both fill the frame, every pose and facing.
  for (const p of w.pets) for (const now of [10_000, 8 * day]) for (const f of [0, 1]) for (const right of [true, false]) {
    for (const line of sprite(p, now, f, right)) expect(line.length).toBe(ART_WIDTH)
    for (const line of sprite(p, now, f, right, true)) expect(line.length).toBe(ART_WIDTH)
    const asleep = act({ ...w, selected: w.pets.indexOf(p) }, 'sleep', now).pets[w.pets.indexOf(p)]!
    for (const line of sprite(asleep, now + 1, f, right)) expect(line.length).toBe(ART_WIDTH)
  }
  expect(sprite(cat, 10_000, 0).join('')).not.toBe(sprite(cat, 8 * day, 0).join(''))
  expect(sprite(dog, 10_000, 0).join('\n')).toContain('o\\___')
})

test('things that happen go in the log; refusals do not', () => {
  const texts = (w: { events: { text: string }[] }) => w.events.map(e => e.text)
  let w = adopt(emptyWorld(0), 'cat', 1000)
  expect(w.events).toEqual([{ at: 1000, text: '咪咪 來到你家了！' }])
  w = act(w, 'feed', 2000)
  expect(w.events.at(-1)).toEqual({ at: 2000, text: '咪咪 吃了小魚乾' })
  w = rename(w, '阿福', 3000)
  expect(w.events.at(-1)).toEqual({ at: 3000, text: '咪咪 改名叫 阿福 了' })
  expect(w.events.length).toBe(3)

  // Refusals and selection changes only set the note.
  const full = act(w, 'feed', 4000)
  expect(full.note).toContain('吃不下了')
  expect(full.events).toEqual(w.events)
  expect(rename(w, '  ', 5000).events).toEqual(w.events)
  expect(act(act(w, 'sleep', 5000), 'feed', 5001).events.length).toBe(4)
  const two = adopt(w, 'dog', 6000)
  expect(cycle(two).events).toEqual(two.events)

  w = release(w, 7000)
  expect(w.events.at(-1)).toEqual({ at: 7000, text: '阿福 去找新家了，掰掰' })
  expect(texts(w)).toEqual(['咪咪 來到你家了！', '咪咪 吃了小魚乾', '咪咪 改名叫 阿福 了', '阿福 去找新家了，掰掰'])

  // Adopting under a name logs one arrival under that name.
  const named = parseCommand('cat 小黑')
  if (typeof named !== 'function') throw new Error('not a step')
  expect(texts(named(emptyWorld(0), 10))).toEqual(['小黑 來到你家了！'])
})

test('what pets do on their own is logged at the minute it happened', () => {
  const w = decay(alone('dog', 'active'), NOON + 61 * 60000)
  expect(w.events).toEqual([
    { at: NOON, text: '旺財 來到你家了！' },
    { at: NOON + 56 * 60000, text: '旺財 肚子餓，自己去吃飯了' },
    { at: NOON + 61 * 60000, text: '旺財 累了，自己去睡覺（10 分鐘）' },
  ])

  const day = 86400000
  const grown = decay({ ...adopt(emptyWorld(0), 'dog', 0), lastTick: 7 * day - 60000 }, 7 * day)
  expect(grown.events.at(-1)).toEqual({ at: 7 * day, text: '旺財 長大了！' })
})

test('meetings are logged', () => {
  const w = adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 1)
  const [cat, dog] = w.pets as [Pet, Pet]
  const after = befriend(w, { kind: 'sniff', a: cat.id, b: dog.id, until: 6 }, 5000)
  expect(after.events.at(-1)).toEqual({ at: 5000, text: '咪咪 和 旺財 互相嗅嗅' })
})

test('the log keeps the newest entries', () => {
  let w = emptyWorld(0)
  for (let i = 0; i < 35; i++) w = record(w, i, `e${i}`)
  expect(w.events.length).toBe(MAX_EVENTS)
  expect(w.events[0]).toEqual({ at: 5, text: 'e5' })
  expect(w.events.at(-1)).toEqual({ at: 34, text: 'e34' })
  expect(recentEvents(w, 2).map(e => e.text)).toEqual(['e33', 'e34'])
})

test('saves from before the log get an empty one', () => {
  const { events: _, ...old } = adopt(emptyWorld(0), 'cat', 0)
  expect(migrate(old as ReturnType<typeof emptyWorld>, 500).events).toEqual([])
  const current = adopt(emptyWorld(0), 'cat', 0)
  expect(migrate(current, 500)).toBe(current)
})

test('log lines show local month, day and time, zero-padded', () => {
  const at = new Date(2026, 9, 16, 9, 5).getTime()
  expect(formatEvent({ at, text: '咪咪 吃了小魚乾' })).toBe('10/16 09:05 咪咪 吃了小魚乾')
  expect(formatEvent({ at: new Date(2026, 0, 2, 3, 4).getTime(), text: 'x' })).toBe('01/02 03:04 x')
})

test('the absence summary counts what happened after you left', () => {
  const events = [
    { at: 1, text: '咪咪 肚子餓，自己去吃飯了' },
    { at: 10, text: '咪咪 肚子餓，自己去吃飯了' },
    { at: 11, text: '旺財 肚子餓，自己去吃飯了' },
    { at: 12, text: '旺財 累了，自己去睡覺（10 分鐘）' },
    { at: 13, text: '咪咪 拍了 旺財 一下' },
    { at: 14, text: '咪咪 吃了小魚乾' },
    { at: 15, text: '旺財 長大了！' },
  ]
  expect(absenceSummary(events, 5)).toBe('你不在的時候：自己吃了 2 次飯、自己睡了 1 次、互動 1 次、旺財 長大了')
  expect(absenceSummary(events, 15)).toBe('')
  expect(absenceSummary([{ at: 20, text: '咪咪 吃了小魚乾' }], 0)).toBe('')
})

test('/pets log is its own command', () => {
  expect(parseCommand('log')).toBe('log')
})

test('a session claims leadership when none leads, renews its own, and takes over a stale one', () => {
  expect(claimLeader(undefined, 'a', 1000)).toEqual({ id: 'a', beat: 1000 })
  expect(claimLeader({ id: 'a', beat: 900 }, 'a', 1000)).toEqual({ id: 'a', beat: 1000 })
  expect(claimLeader({ id: 'b', beat: 1000 }, 'a', 1000 + LEADER_TTL - 1)).toBeNull()
  expect(claimLeader({ id: 'b', beat: 1000 }, 'a', 1000 + LEADER_TTL + 1)).toEqual({ id: 'a', beat: 1000 + LEADER_TTL + 1 })
})

test('a leader whose beat is exactly LEADER_TTL old counts as stale', () => {
  expect(claimLeader({ id: 'b', beat: 0 }, 'a', LEADER_TTL)).toEqual({ id: 'a', beat: LEADER_TTL })
})

test('pets show their age and have a birthday every 30 days', () => {
  const day = 86400000
  const cat = adopt(emptyWorld(0), 'cat', 0).pets[0]!
  expect([ageLabel(cat, 0), ageLabel(cat, 11 * day + 5), ageLabel(cat, 29 * day)]).toEqual(['0 天', '11 天', '29 天'])
  expect([ageLabel(cat, 30 * day), ageLabel(cat, 95 * day)]).toEqual(['1 個月', '3 個月'])
  expect([isBirthday(cat, 29 * day), isBirthday(cat, 30 * day + 3600000), isBirthday(cat, 31 * day), isBirthday(cat, 60 * day)]).toEqual([false, true, false, true])
  expect(ageMonths(cat, 61 * day)).toBe(2)

  // The tick that crosses day 30 logs the birthday at the anniversary itself.
  const w = { ...adopt(emptyWorld(0), 'cat', 0), lastTick: 30 * day - 60000 }
  const after = decay(w, 30 * day)
  expect(after.events.at(-1)).toEqual({ at: 30 * day, text: '咪咪 滿 1 個月了！' })
  expect(decay(after, 30 * day + 60000).events.filter(e => e.text.includes('個月')).length).toBe(1)
  expect(absenceSummary(after.events, 30 * day - 1)).toContain('咪咪 滿 1 個月')

  // The birthday bubble shows on an idle pet and keeps the art width.
  const bday = sprite({ ...cat, heartsUntil: 0 }, 30 * day + 1000, 0)
  expect(bday[0]).toContain('bday!')
  for (const line of bday) expect(line.length).toBe(ART_WIDTH)
  expect(sprite({ ...cat, heartsUntil: 0 }, 31 * day, 0)[0]).not.toContain('bday!')
})

test('a pet that needs you is alerted once, and again only after it recovers', () => {
  const cat = adopt(emptyWorld(0), 'cat', 0).pets[0]!
  const sad = { ...cat, fun: 24 }
  const fine = { ...cat, fun: 25 }
  expect(sadTransitions([fine], [])).toEqual({ toast: [], alerted: [] })
  expect(sadTransitions([sad], [])).toEqual({ toast: [sad], alerted: [cat.id] })
  expect(sadTransitions([sad], [cat.id])).toEqual({ toast: [], alerted: [cat.id] })
  const recovered = sadTransitions([fine], [cat.id])
  expect(recovered.alerted).toEqual([])
  expect(sadTransitions([sad], recovered.alerted).toast).toEqual([sad])
  // Hunger and boredom need you; low energy alone the pet sleeps off.
  expect(sadTransitions([{ ...cat, full: 10 }, { ...cat, id: 'x', fun: 20 }], []).alerted).toEqual([cat.id, 'x'])
  expect(sadTransitions([{ ...cat, energy: 22 }], [])).toEqual({ toast: [], alerted: [] })
  expect(mood({ ...cat, energy: 22, heartsUntil: 0 }, 10)).toBe('sad')
})

test('night is from 22:00 to before 07:00 local time', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m).getTime()
  expect([at(21, 59), at(22), at(23, 59), at(0), at(6, 59), at(7), at(12)].map(isNight)).toEqual([false, true, true, true, true, false, false])
})

test('a tired pet naps 30 minutes at night instead of 10', () => {
  const base = new Date(2026, 9, 19, 22, 0).getTime()
  // energy 80 drops 1 a minute: below 20 after 61 minutes.
  const w = decay(alone('dog', 'active', base), base + 61 * 60000)
  expect(w.note).toBe('旺財 累了，自己去睡覺（30 分鐘）')
  expect(w.pets[0]?.sleepingUntil).toBe(base + 91 * 60000)
})

test('at night a wandering pet rests twice as often', () => {
  const pick = (h: number, r: number) => {
    const base = new Date(2026, 9, 19, h, 0).getTime()
    const p = alone('cat', 'glutton', base).pets[0]!
    return stepWalker({ x: 5, right: true, mode: 'walk', left: 0, frame: 0 }, p, base + 10_000, 1, 20, () => r).mode
  }
  // By day: rest under 0.25, run under 0.40. By night: rest under 0.50.
  expect([pick(12, 0.24), pick(12, 0.3), pick(12, 0.45)]).toEqual(['rest', 'run', 'walk'])
  expect([pick(23, 0.3), pick(23, 0.49), pick(23, 0.6), pick(23, 0.7)]).toEqual(['rest', 'rest', 'run', 'walk'])
})

test('a gap of 10 minutes or more starts a new activity streak', () => {
  const min = 60000
  expect(touchActivity(undefined, 5 * min)).toEqual({ streakStart: 5 * min, lastActive: 5 * min, remindedStreak: 0 })
  const rec = { streakStart: 0, lastActive: 20 * min, remindedStreak: 0 }
  expect(touchActivity(rec, 30 * min - 1)).toEqual({ streakStart: 0, lastActive: 30 * min - 1, remindedStreak: 0 })
  expect(touchActivity(rec, 30 * min)).toEqual({ streakStart: 30 * min, lastActive: 30 * min, remindedStreak: 0 })
})

test('a break is due after 2 hours of activity, while still active', () => {
  const min = 60000, hour = 60 * min
  const rec = (streak: number) => ({ streakStart: 0, lastActive: streak, remindedStreak: 0 })
  expect(needsBreak(undefined, 0)).toBe(false)
  expect(needsBreak(rec(2 * hour - 1), 2 * hour)).toBe(false)
  expect(needsBreak(rec(2 * hour), 2 * hour)).toBe(true)
  expect(needsBreak(rec(2 * hour), 2 * hour + 10 * min - 1)).toBe(true)
  expect(needsBreak(rec(2 * hour), 2 * hour + 10 * min)).toBe(false)
})

test('the selected pet asks for a break, blinking', () => {
  const hour = 3600000
  const due = { streakStart: 0, lastActive: 2 * hour, remindedStreak: 0 }
  const cat = { ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, heartsUntil: 0 }
  expect(sprite(cat, 2 * hour, 0, true, false, breakOverlay(due, 2 * hour, 0))[0]).toContain('break?')
  expect(sprite(cat, 2 * hour, 4, true, false, breakOverlay(due, 2 * hour, 4))[0]).not.toContain('break?')
  expect(breakOverlay({ ...due, lastActive: hour }, hour, 0)).toBeUndefined()
})

test('a due break wins every other bubble on the selected pet, whatever its mood', () => {
  const hour = 3600000, now = 2 * hour
  const due = { streakStart: 0, lastActive: now, remindedStreak: 0 }
  const cat = { ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, id: 'a', heartsUntil: 0, bond: 80 }
  const busy: Scene = {
    reaction: react(react(NO_REACTION, 'think', 0), 'fail', now),
    encounter: { kind: 'swat', a: 'a', b: 'b', until: 9 },
    greetUntil: now + 1,
    activity: due,
  }
  const bubble = (s: Scene, selected = true, frame = 0) => overlayOf(cat, selected, s, now, frame)?.bubble
  expect(bubble(busy)).toBe('break?')
  // The blink's off half shows nothing, not what the break covers.
  expect(overlayOf(cat, true, busy, now, 4)).toBeUndefined()
  // Not selected, or not due: the reaction, then the meeting, then the greeting.
  expect(bubble(busy, false)).toBe('?')
  const idle = { ...busy, activity: undefined }
  expect(bubble(idle)).toBe('*pat*')
  expect(bubble({ ...idle, reaction: NO_REACTION })).toBe('paw!')
  expect(bubble({ ...idle, reaction: NO_REACTION, encounter: null })).toBe('hi!')
  expect(bubble({ ...idle, reaction: NO_REACTION, encounter: null, greetUntil: 0 })).toBeUndefined()

  // Drawn over a sad, sleeping, eating or loved pet too.
  const o = overlayOf(cat, true, busy, now, 0)
  const w = { ...emptyWorld(0), pets: [{ ...cat, full: 50 }] }
  const pets = [{ ...cat, fun: 5 }, act(w, 'sleep', now).pets[0]!, act(w, 'feed', now).pets[0]!, { ...cat, heartsUntil: now + 2 }]
  expect(pets.map(p => mood(p, now + 1))).toEqual(['sad', 'sleep', 'eat', 'love'])
  for (const p of pets) expect(sprite(p, now + 1, 0, true, false, o)[0]).toContain('break?')
})

test('a pet asking for a break keeps walking', () => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const hour = 3600000, now = NOON + 2 * hour
  const cat = { ...alone('cat', 'active').pets[0]!, heartsUntil: 0 }
  const scene: Scene = { reaction: react(NO_REACTION, 'think', 0), encounter: null, greetUntil: 0, activity: { streakStart: NOON, lastActive: now, remindedStreak: 0 } }
  let walker = { x: 10, right: true, mode: 'walk' as const, left: 0, frame: 0 } as ReturnType<typeof newWalker>
  const xs = new Set<number>()
  for (let f = 1; f <= 16; f++) {
    walker = stepWalker(walker, cat, now, f, 20, rand, overlayOf(cat, true, scene, now, f))
    xs.add(Math.round(walker.x))
  }
  expect(xs.size).toBeGreaterThan(3)
  // Facing left it still reads the right way round.
  expect(sprite(cat, now, 0, false, false, overlayOf(cat, true, scene, now, 0))[0]).toContain('break?')
})

test('a pet keeps the trait it was born with: ids map to the same traits as when traits shipped', () => {
  const traitOf = (id: string) => trait({ ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, id })
  expect(['cat-0', 'dog-0', 'cat-1', 'dog-1', 'cat-1000'].map(traitOf)).toEqual(['lazy', 'glutton', 'glutton', 'active', 'lazy'])
})

test('each pet has a fixed trait from its id, independent of its speed', () => {
  const pets = Array.from({ length: 600 }, (_, i) => ({ ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, id: `cat-${1760000000000 + i * 7919}` }))
  expect(trait(pets[0]!)).toBe(trait({ ...pets[0]!, name: 'other' }))
  for (const t of ['glutton', 'active', 'lazy'] as const) {
    const speeds = pets.filter(p => trait(p) === t).map(p => gait(p).speed)
    expect(speeds.length).toBeGreaterThan(150)
    // Every trait has slow and fast walkers alike.
    expect(speeds.filter(s => s < 1).length).toBeGreaterThan(speeds.length / 3)
    expect(speeds.filter(s => s >= 1).length).toBeGreaterThan(speeds.length / 3)
  }
})

test('a trait sets how fast stats drop and how long a self-nap lasts', () => {
  const after10 = (t: Trait) => decay(alone('cat', t), NOON + 10 * 60000).pets[0]!
  expect([after10('glutton').full, after10('glutton').fun]).toEqual([60, 60])
  expect([after10('active').full, after10('active').fun]).toEqual([70, 70])
  expect([after10('lazy').full, after10('lazy').fun]).toEqual([70, 60])

  // energy 80 drops 1 a minute: below 20 after 61 minutes.
  const day = new Date(2026, 9, 19, 12).getTime(), night = new Date(2026, 9, 19, 22).getTime()
  expect(decay(alone('dog', 'lazy', day), day + 61 * 60000).note).toBe('旺財 累了，自己去睡覺（15 分鐘）')
  expect(decay(alone('dog', 'lazy', night), night + 61 * 60000).note).toBe('旺財 累了，自己去睡覺（35 分鐘）')
})

test('an active pet runs twice as often; a lazy one rests twice as often, and more at night but not always', () => {
  const pick = (t: Trait, h: number, r: number) => {
    const base = new Date(2026, 9, 19, h).getTime()
    return stepWalker({ x: 5, right: true, mode: 'walk', left: 0, frame: 0 }, alone('cat', t, base).pets[0]!, base + 10_000, 1, 20, () => r).mode
  }
  // Active by day: rest under 0.25, run under 0.55.
  expect([pick('active', 12, 0.24), pick('active', 12, 0.5), pick('active', 12, 0.56)]).toEqual(['rest', 'run', 'walk'])
  // Lazy by day: rest under 0.50, run under 0.65; by night rest is capped at 0.80, so it still gets up.
  expect([pick('lazy', 12, 0.49), pick('lazy', 12, 0.6), pick('lazy', 12, 0.66)]).toEqual(['rest', 'run', 'walk'])
  expect([pick('lazy', 23, 0.79), pick('lazy', 23, 0.81), pick('lazy', 23, 0.96)]).toEqual(['rest', 'run', 'walk'])
})

test('feeding, petting and playing build the bond; refusals and sleep do not', () => {
  const w = alone('cat', 'active', 0)
  const bond = (x: World) => [x.pets[0]!.bond, x.pets[0]!.bondAt]
  expect(bond(w)).toEqual([0, 0])
  expect(bond(act({ ...w, pets: [{ ...w.pets[0]!, full: 50 }] }, 'feed', 1000))).toEqual([2, 1000])
  expect(bond(act(w, 'pet', 1000))).toEqual([1, 1000])
  expect(bond(act(w, 'play', 1000))).toEqual([3, 1000])
  expect(bond(act(w, 'sleep', 1000))).toEqual([0, 0])
  // Refused: too full, too tired, asleep.
  expect(bond(act({ ...w, pets: [{ ...w.pets[0]!, full: 95 }] }, 'feed', 1000))).toEqual([0, 0])
  expect(bond(act({ ...w, pets: [{ ...w.pets[0]!, energy: 10 }] }, 'play', 1000))).toEqual([0, 0])
  expect(bond(act(act(w, 'sleep', 1000), 'pet', 2000))).toEqual([0, 0])
  expect(act({ ...w, pets: [{ ...w.pets[0]!, bond: 99 }] }, 'play', 1000).pets[0]!.bond).toBe(100)
})

test('saves from before the bond start with none from now', () => {
  const w = adopt(emptyWorld(0), 'cat', 0)
  const { bond: _b, bondAt: _a, ...old } = w.pets[0]!
  expect(migrate({ ...w, pets: [old as Pet] }, 500).pets[0]).toMatchObject({ bond: 0, bondAt: 500, bornAt: 0 })
  expect(migrate(w, 500)).toBe(w)
})

test('the bond fades 5 a day once 3 days pass without care', () => {
  const day = 86400000
  const w = { ...alone('cat', 'active', 0), pets: [{ ...alone('cat', 'active', 0).pets[0]!, bond: 50 }] }
  const at = (from: number, to: number) => decay({ ...w, lastTick: from }, to).pets[0]!.bond
  expect(at(3 * day - 60000, 3 * day)).toBe(50)
  expect(at(4 * day - 60000, 4 * day)).toBe(45)
  expect(at(4 * day, 4 * day + 60000)).toBe(50)
  // Away for 10 days: days 4 to 10 each take 5.
  expect(at(0, 10 * day)).toBe(15)
  expect(at(0, 30 * day)).toBe(0)
})

test('perks come with the bond', () => {
  const cat = adopt(emptyWorld(0), 'cat', 0).pets[0]!
  const perks = (bond: number) => (['greet', 'comfort'] as const).filter(k => hasPerk({ ...cat, bond }, k))
  expect([perks(49), perks(50), perks(79), perks(80)]).toEqual([[], ['greet'], ['greet'], ['greet', 'comfort']])
})

test('a close pet says hi for 3 s and pats you when a call fails', () => {
  const cat = { ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, heartsUntil: 0 }
  expect(greetOverlay({ ...cat, bond: 50 }, 2999, 3000)).toEqual({ hold: 'still', bubble: 'hi!' })
  expect(greetOverlay({ ...cat, bond: 50 }, 3000, 3000)).toBeUndefined()
  expect(greetOverlay({ ...cat, bond: 49 }, 0, 3000)).toBeUndefined()
  expect(sprite(cat, 10, 0, true, false, greetOverlay({ ...cat, bond: 50 }, 0, 3000))[0]).toContain('hi!')

  const failed = react(NO_REACTION, 'fail', 0)
  expect(overlayFor(failed, 0, 0, true, hasPerk({ ...cat, bond: 80 }, 'comfort'))?.bubble).toBe('*pat*')
  expect(overlayFor(failed, 0, 0, true, hasPerk({ ...cat, bond: 79 }, 'comfort'))?.bubble).toBe('oops')
})

test('the name label shows stage, age, trait and a heart per 25 bond', () => {
  const cat = withTrait({ ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, name: '貓貓' }, 'glutton')
  const day = 86400000
  expect(petLabel({ ...cat, bond: 24 }, 11 * day)).toBe('貓貓（貓，11 天，貪吃）')
  expect(petLabel({ ...cat, bond: 50 }, 11 * day)).toBe('貓貓（貓，11 天，貪吃，<3<3）')
  expect(petLabel({ ...cat, bond: 100 }, 0)).toBe('貓貓（幼貓，0 天，貪吃，<3<3<3<3）')
})

test('every bubble on every kind, stage, pose and facing keeps the art width', () => {
  const day = 86400000
  const fail3 = react(react(react(NO_REACTION, 'fail', 0), 'fail', 0), 'fail', 0)
  const overlays: Overlay[] = [
    overlayFor(react(NO_REACTION, 'pass', 0), 0, 0, true)!,
    overlayFor(react(NO_REACTION, 'fail', 0), 0, 0, true)!,
    overlayFor(react(NO_REACTION, 'fail', 0), 0, 0, true, true)!,
    overlayFor(fail3, 0, 0, true)!,
    overlayFor(react(NO_REACTION, 'think', 0), 0, 0, true)!,
    ...(['play', 'swat', 'sniff'] as const).flatMap(kind => [0, 1].flatMap(f => ['a', 'b'].map(id => encounterOverlay({ kind, a: 'a', b: 'b', until: 9 }, id, f)!))),
    greetOverlay({ ...adopt(emptyWorld(0), 'cat', 0).pets[0]!, bond: 50 }, 0, 1)!,
    breakOverlay({ streakStart: 0, lastActive: 2 * 3600000, remindedStreak: 0 }, 2 * 3600000, 0)!,
  ]
  const bubbles = new Set(overlays.map(o => o.bubble))
  expect([...bubbles].sort()).toEqual(['!', '!!', '*pat*', '...', '..?', '?', 'break?', 'fun!', 'hi!', 'oops', 'paw!', 'yay!'].sort())
  for (const kind of ['cat', 'dog'] as const) for (const now of [10_000, 8 * day, 30 * day + 1000]) {
    const p = { ...adopt(emptyWorld(0), kind, 0).pets[0]!, heartsUntil: 0 }
    const one = { ...emptyWorld(0), pets: [{ ...p, full: 50 }] }
    const moods = [p, { ...p, heartsUntil: now + 1 }, { ...p, full: 5 }, { ...p, fun: 5 }, { ...p, energy: 5 }, act({ ...emptyWorld(0), pets: [p] }, 'play', now).pets[0]!, act(one, 'sleep', now).pets[0]!, act(one, 'feed', now).pets[0]!]
    for (const pet of moods) for (const f of [0, 1, 2, 3]) for (const right of [true, false]) for (const resting of [true, false]) {
      for (const o of [undefined, ...overlays]) {
        const lines = sprite(pet, now + 1, f, right, resting, o)
        for (const line of lines) expect(line.length).toBe(ART_WIDTH)
        // An idle pet shows every bubble facing either way; a break shows on every mood.
        if (o && o.bubble && (pet === p || o.hold === 'none')) expect(lines[0]).toContain(o.bubble)
      }
    }
  }
})
