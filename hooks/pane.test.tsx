import { expect, mock, test } from 'claude-code/testing'

test('adopt and play from the pane on terminal and desktop', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pets', surface, component: 'Pane', props: { id: 'pets', title: 'Pets' }, requestId: 'pets', viewport: { columns: 50, rows: 30 } })
    await ui.press({ key: 'cat' })
    expect(await ui.find({ type: 'Text', text: /咪咪/ })).toBeDefined()
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
