import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import type { World } from '../types'
import { adopt, ART_WIDTH, emptyWorld } from './logic'

test('adopt and play from the pane on terminal and desktop', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pets', surface, component: 'Pane', props: { id: 'pets', title: 'Pets' }, requestId: 'pets', viewport: { columns: 50, rows: 30 } })
    await ui.press({ key: 'cat' })
    expect(await ui.find({ type: 'Text', text: /咪咪（幼貓）/ })).toBeDefined()
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

test('a lone session leads and its pets meet', async ($, on) => {
  expect(await encounters($, on, false)).toBeGreaterThan(0)
})

test('another live session leading stops this one rolling encounters', async ($, on) => {
  expect(await encounters($, on, true)).toBe(0)
})
