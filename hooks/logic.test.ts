import { expect, test } from 'claude-code/testing'
import type { Pet } from '../types'
import { absenceSummary, act, adopt, ageLabel, ageMonths, isBirthday, ART_WIDTH, formatEvent, MAX_EVENTS, record, recentEvents, HUNGRY, TIRED, cycle, release, decay, emptyWorld, befriend, cheer, claimLeader, encounterOverlay, LEADER_TTL, fit, gait, GROWN_AFTER_DAYS, isGrown, meet, migrate, stageName, isTestCommand, merge, mood, need, newWalker, NO_REACTION, overlayFor, parseCommand, react, rename, sprite, stepWalker, TOYS, toyLine, toyOf } from './logic'

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
  expect(later.pets[0]?.full).toBe(70)
  expect(later.lastTick).toBe(10 * 60000)
  // Part of a minute waits for the next tick.
  expect(decay(w, 10 * 60000 + 30000).lastTick).toBe(10 * 60000)
})

test('pets eat and nap on their own', () => {
  let w = adopt(emptyWorld(0), 'cat', 0)
  // full 80 drops 1 a minute: below 25 after 56 minutes, then the cat eats.
  w = decay(w, 56 * 60000)
  expect(w.pets[0]?.full).toBe(54)
  expect(w.note).toBe('咪咪 肚子餓，自己去吃飯了')

  // energy 80 drops 1 a minute: below 20 after 61 minutes, then a 10 minute nap.
  w = decay(adopt(emptyWorld(0), 'dog', 0), 61 * 60000)
  expect(w.pets[0]?.sleepingUntil).toBe(71 * 60000)
  expect(w.note).toBe('旺財 累了，自己去睡覺（10 分鐘）')
  expect(mood(w.pets[0]!, 61 * 60000 + 1)).toBe('sleep')
  w = decay(w, 71 * 60000)
  expect(w.pets[0]?.energy).toBe(79)

  // Left alone for days, a pet keeps itself fed and rested.
  const away = decay(adopt(emptyWorld(0), 'cat', 0), 999 * 3600000).pets[0]!
  expect(away.full).toBeGreaterThanOrEqual(HUNGRY - 1)
  expect(away.energy).toBeGreaterThanOrEqual(TIRED - 1)
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
  const now = 100_000
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
  const w = decay(adopt(emptyWorld(0), 'dog', 0), 61 * 60000)
  expect(w.events).toEqual([
    { at: 0, text: '旺財 來到你家了！' },
    { at: 56 * 60000, text: '旺財 肚子餓，自己去吃飯了' },
    { at: 61 * 60000, text: '旺財 累了，自己去睡覺（10 分鐘）' },
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
