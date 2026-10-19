import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import type { World } from '../types'
import { adopt, ART_WIDTH, emptyWorld } from './logic'
import { alone, NOON } from './fixtures'

test('adopt and play from the pane on terminal and desktop', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pets', surface, component: 'Pane', props: { id: 'pets', title: 'Pets' }, requestId: 'pets', viewport: { columns: 50, rows: 30 } })
    await ui.press({ key: 'cat' })
    expect(await ui.find({ type: 'Text', text: /咪咪（幼貓，0 天，(貪吃|好動|懶散)）/ })).toBeDefined()
    await ui.press({ key: 'feed' })
    expect(await ui.find({ type: 'Text', text: /\d\d\/\d\d \d\d:\d\d 咪咪 吃了小魚乾/ })).toBeDefined()
    await ui.press({ key: 'play' })
    expect(await ui.find({ type: 'Text', text: /毛線球/ })).toBeDefined()
    await ui.press({ key: 'rename' })
    await ui.input({ key: 'name', text: '小黑' })
    expect(await ui.find({ type: 'Text', text: /小黑/ })).toBeDefined()
    await ui.press({ key: 'bye' })
    await ui.unmount()
  }
})

test('pressing in the pane marks the human active', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const store = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => ({ value: void store.set(e.key, e.value) }))
  const ui = await $.ui.mount({ plugin: 'pets', surface: 'terminal', component: 'Pane', props: { title: 'Pets', bodyColumns: 40 } as RenderPropsOf['Pane'], requestId: 'pets', viewport: { columns: 50, rows: 30 } })
  await ui.press({ key: 'cat' })
  expect(store.get('activity')).toEqual({ streakStart: 5000, lastActive: 5000, remindedStreak: 0 })
  await ui.unmount()
})

test('the pane says whether it is day or night', async ($, on) => {
  const clock = mock.clock(on, { now: new Date(2026, 9, 19, 21, 59).getTime() })
  mock.store(on)
  const ui = await $.ui.mount({ plugin: 'pets', surface: 'terminal', component: 'Pane', props: { title: 'Pets', bodyColumns: 40 } as RenderPropsOf['Pane'], requestId: 'pets', viewport: { columns: 50, rows: 30 } })
  expect(await ui.find({ type: 'Text', text: '白天' })).toBeDefined()
  await clock.advance(60000)
  await ui.press({ key: 'cat' })
  expect(await ui.find({ type: 'Text', text: '夜晚' })).toBeDefined()
  await ui.unmount()
})

test('/pets subcommands act without opening the pane', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const say = async (args: string) => ((await $.command.run({ command: 'pets', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })) as { text?: string }).text ?? ''
  expect(await say('cat')).toContain('來到你家了')
  expect(await say('play')).toContain('毛線球')
  expect(await say('rename 阿福')).toContain('改名叫 阿福')
  expect(await say('dance')).toContain('用法')
})

test('an action starts from what another session stored', async ($, on) => {
  mock.clock(on)
  // Another session adopted two pets and wrote the store; this session's own copy is empty.
  mock.store(on, { world: adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 0) })
  const say = async (args: string) => ((await $.command.run({ command: 'pets', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })) as { text?: string }).text ?? ''
  expect(await say('feed 咪咪')).toBe('咪咪 吃了小魚乾')
  expect(await say('next 旺財')).toBe('選了 旺財')
})

test('/pets log lists what happened, oldest first', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const say = async (args: string) => ((await $.command.run({ command: 'pets', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })) as { text?: string }).text ?? ''
  expect(await say('log')).toBe('還沒有任何紀錄')
  await say('cat')
  await say('feed')
  const log = await say('log')
  expect(log).toContain('來到你家了')
  expect(log).toContain('吃了小魚乾')
  expect(log.indexOf('吃了小魚乾')).toBeGreaterThan(log.indexOf('來到你家了'))
})

// Two idle pets in a pane too narrow to walk apart, so they stand together
// and meet when luck allows, in a session whose id is 'me'.
async function encounters($: Engine, on: On, otherLeads: boolean) {
  const clock = mock.clock(on, { now: 10_000 })
  const store = new Map<string, unknown>([['world', adopt(adopt(emptyWorld(0), 'cat', 0), 'dog', 0)]])
  // A live leader elsewhere keeps its beat fresh.
  on('store.get', ($, e) => ({ value: otherLeads && e.key === 'leader' ? { id: 'other', beat: clock.now() } : store.get(e.key) }))
  on('store.set', ($, e) => ({ value: void store.set(e.key, e.value) }))
  on('store.delete', ($, e) => ({ value: void store.delete(e.key) }))
  on('session.id', () => ({ value: 'me' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'pets', surface: 'terminal', component: 'Pane', props: { title: 'Pets', bodyColumns: ART_WIDTH } as RenderPropsOf['Pane'], requestId: 'pets', viewport: { columns: 50, rows: 30 } })
  await clock.advance(100 * 800)
  await ui.unmount()
  return ((store.get('world') as World).events).filter(ev => /玩在一起|拍了|嗅嗅/.test(ev.text)).length
}

// A session whose id is 'me' started over `entries`, recording what it shows.
async function started($: Engine, on: On, entries: Record<string, unknown>, now = NOON) {
  const clock = mock.clock(on, { now })
  const store = new Map<string, unknown>(Object.entries(entries))
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  const writes: string[] = []
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => ({ value: void (writes.push(e.key), store.set(e.key, e.value)) }))
  on('store.delete', ($, e) => ({ value: void store.delete(e.key) }))
  on('session.id', () => ({ value: 'me' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', ($, e) => ({ value: void toasts.push(e.text) }))
  on('ui.status', ($, e) => ({ value: void statuses.push(e.text) }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  return { clock, store, toasts, statuses, writes }
}

const sadSoon = () => {
  const w = alone('cat', 'lazy')
  // A lazy pet's fun drops 2 a minute: 30 -> 24 on the third minute.
  return { ...w, pets: [{ ...w.pets[0]!, name: '貓貓', fun: 30 }] }
}

const funOf = (s: { store: Map<string, unknown> }) => (s.store.get('world') as World).pets[0]!.fun

test('the leader toasts a pet turning sad once', async ($, on) => {
  const s = await started($, on, { world: sadSoon() })
  await s.clock.advance(2 * 60000)
  expect(s.toasts).toEqual([])
  await s.clock.advance(60000)
  expect(funOf(s)).toBe(24)
  expect(s.toasts).toEqual(['貓貓 不開心了（play?）'])
  await s.clock.advance(5 * 60000)
  expect(s.toasts.length).toBe(1)
  expect(s.store.get('sadAlerted')).toEqual([sadSoon().pets[0]!.id])
  // Stored when the list changed, not on every tick.
  expect(s.writes.filter(k => k === 'sadAlerted').length).toBe(1)
})

test('a pet already alerted in the store is not toasted again', async ($, on) => {
  const w = sadSoon()
  const s = await started($, on, { world: { ...w, pets: [{ ...w.pets[0]!, fun: 10 }] }, sadAlerted: [w.pets[0]!.id] })
  await s.clock.advance(3 * 60000)
  expect(s.toasts).toEqual([])
})

test('a session that does not lead never toasts', async ($, on) => {
  // Another session leads with a beat that never goes stale.
  const s = await started($, on, { world: sadSoon(), leader: { id: 'other', beat: Number.MAX_SAFE_INTEGER } })
  await s.clock.advance(3 * 60000)
  expect(funOf(s)).toBe(24)
  expect(s.toasts).toEqual([])
})

test('after 2 hours at work the leader logs one reminder per streak, and the selected pet asks for a break', async ($, on) => {
  const t = NOON
  const streakStart = t - 2 * 3600000 - 60000
  const s = await started($, on, { world: sadSoon(), activity: { streakStart, lastActive: t - 60000, remindedStreak: 0 } }, t)
  await s.clock.advance(12_000)
  const reminders = (s.store.get('world') as World).events.filter(ev => ev.text.includes('休息'))
  expect(reminders.map(ev => ev.text)).toEqual(['貓貓 提醒你休息一下'])
  expect((s.store.get('activity') as { remindedStreak: number }).remindedStreak).toBe(streakStart)
  // The bubble blinks: frame 15 is in its off half, frame 16 in its on half.
  await s.clock.advance(800)
  const ui = await $.ui.mount({ plugin: 'pets', surface: 'terminal', component: 'Pane', props: { title: 'Pets', bodyColumns: 40 } as RenderPropsOf['Pane'], requestId: 'pets', viewport: { columns: 50, rows: 30 } })
  expect(await ui.find({ type: 'Text', text: /break\?/ })).toBeDefined()
  await ui.unmount()
})

test('prompts and /pets mark the human active, at most every 30 s', async ($, on) => {
  const t = 10_000_000
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const s = await started($, on, {}, t)
  const lastActive = () => (s.store.get('activity') as { lastActive: number } | undefined)?.lastActive
  expect(lastActive()).toBeUndefined()
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  expect(s.store.get('activity')).toEqual({ streakStart: t, lastActive: t, remindedStreak: 0 })
  await s.clock.advance(29_999)
  await $.command.run({ command: 'pets', args: 'log', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(lastActive()).toBe(t)
  await s.clock.advance(1)
  await $.command.run({ command: 'pets', args: 'log', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(lastActive()).toBe(t + 30_000)
})

test('prompts from automation do not count as the human at work', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const s = await started($, on, {})
  await $.prompt.submit({ text: 'tick', wait: false, origin: { kind: 'scheduled-trigger' } })
  await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'task-notification' } })
  await $.command.run({ command: 'pets', args: 'log', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(s.store.get('activity')).toBeUndefined()
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  expect(s.store.get('activity')).toEqual({ streakStart: NOON, lastActive: NOON, remindedStreak: 0 })
  await s.clock.advance(30_000)
  await $.prompt.submit({ text: 'from my phone', wait: false, origin: { kind: 'bridge' } })
  expect(s.store.get('activity')).toEqual({ streakStart: NOON, lastActive: NOON + 30_000, remindedStreak: 0 })
})

const close = (bond: number) => {
  const w = sadSoon()
  return { ...w, pets: [{ ...w.pets[0]!, fun: 80, bond, heartsUntil: 0 }] }
}
const mountPane = ($: Engine) => $.ui.mount({ plugin: 'pets', surface: 'terminal', component: 'Pane', props: { title: 'Pets', bodyColumns: 40 } as RenderPropsOf['Pane'], requestId: 'pets', viewport: { columns: 50, rows: 30 } })

test('a close pet says hi for the first 3 s of a session', async ($, on) => {
  const s = await started($, on, { world: close(50) })
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Text', text: /hi!/ })).toBeDefined()
  await s.clock.advance(3000)
  await ui.press({ key: 'next' })
  expect(await ui.find({ type: 'Text', text: /hi!/ })).toBeUndefined()
  await ui.unmount()
})

test('a pet not yet close does not greet', async ($, on) => {
  await started($, on, { world: close(49) })
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Text', text: /hi!/ })).toBeUndefined()
  await ui.unmount()
})

for (const [bond, bubble] of [[80, '*pat*'], [79, 'oops']] as const) {
  test(`a failed call shows ${bubble} on a pet with bond ${bond}`, async ($, on) => {
    on('tool.call', () => ({ isError: true, result: null, text: 'boom' }))
    const s = await started($, on, { world: close(bond) })
    await s.clock.advance(3000)
    await $.tool.call({ tool: 'Read', file_path: '/nope' } as never)
    const ui = await mountPane($)
    expect(await ui.find({ type: 'Text', text: new RegExp(bubble.replace(/\*/g, '\\*')) })).toBeDefined()
    await ui.unmount()
  })
}

test('a session start clears the status line older versions pinned, and pins none', async ($, on) => {
  const s = await started($, on, { world: sadSoon() })
  expect(s.statuses).toEqual([undefined])
  await s.clock.advance(3 * 60000)
  await $.command.run({ command: 'pets', args: 'feed', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(s.statuses).toEqual([undefined])
})

test('a lone session leads and its pets meet', async ($, on) => {
  expect(await encounters($, on, false)).toBeGreaterThan(0)
})

test('another live session leading stops this one rolling encounters', async ($, on) => {
  expect(await encounters($, on, true)).toBe(0)
})
