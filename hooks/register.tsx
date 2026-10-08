import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Reaction, World } from '../types'
import type { Encounter, Walker } from './logic'
import { act, adopt, merge, parseCommand, rename, USAGE, ART_WIDTH, bar, cycle, befriend, cheer, decay, emptyWorld, encounterOverlay, fit, isTestCommand, meet, MEET_COOLDOWN, migrate, stageName, newWalker, NO_REACTION, overlayFor, react, release, sprite, stepWalker, toyLine } from './logic'

const PANE = 'pets'
const STORE_KEY = 'world'
const world = atom({ plugin: 'pets', key: 'world' } as const, emptyWorld(0))
const renaming = atom({ plugin: 'pets', key: 'renaming' } as const, false)
const reaction = atom({ plugin: 'pets', key: 'reaction' } as const, NO_REACTION)
// Where each pet is and what it is doing; drawing only, so a reload starts it afresh.
const walkers = new Map<string, Walker>()
// The meeting going on, if any, and the frame after which the next may start.
let encounter: Encounter | null = null
let nextMeet = 0

// Every change starts from the store, so one session's actions are not
// overwritten by another session's older copy.
async function change($: EngineInterface, fn: (w: World, now: number) => World) {
  const now = await $.clock.now()
  const saved = (await $.store.get(STORE_KEY)) as World | undefined
  const w = await update($, world, cur => fn(decay(migrate(merge(saved, cur), now), now), now))
  await $.store.set(STORE_KEY, { ...w, frame: 0 })
}

async function petsView($: EngineInterface, e: RenderInput<'Pane'>, bodyColumns: number) {
    // bodyColumns is the pane's inner width; every art line is cut to fit it.
    const width = Math.max(ART_WIDTH, bodyColumns || 34)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    // Mobile draws no text field; there the name is changed with /pets rename.
    const Input = 'Input' in ui ? ui.Input : undefined
    const w = await read($, world)
    const isRenaming = await read($, renaming)
    const mood = await read($, reaction)
    const current = w.pets[w.selected]
    const now = await $.clock.now()

    return (
      <Box flexDirection="column">
        {w.pets.length === 0 && <Text dimColor>還沒有寵物，按 c 領養貓、d 領養狗。</Text>}
        {w.pets.map((p, i) => {
          const room = width - ART_WIDTH
          const overlay = overlayFor(mood, now, w.frame, i === w.selected) ?? encounterOverlay(encounter, p.id, w.frame)
          const pos = stepWalker(walkers.get(p.id) ?? newWalker(room, w.frame, Math.random), p, now, w.frame, room, Math.random, overlay)
          walkers.set(p.id, pos)
          const lines = sprite(p, now, w.frame, pos.right, pos.mode === 'rest', overlay).map(l => fit(' '.repeat(Math.round(pos.x)) + l, width).trimEnd() || ' ')
          const toy = toyLine(p, now, w.frame, width)
          if (toy !== '') lines.push(fit(toy, width).trimEnd())
          const isSel = i === w.selected
          return (
            <Box flexDirection="column">
              <Text bold={isSel} dimColor={!isSel} wrap="truncate-end">
                {isSel ? '> ' : '  '}
                {p.name}（{stageName(p, now)}）
              </Text>
              {lines.map(line => (
                <Text wrap="truncate-end">{line}</Text>
              ))}
              <Text dimColor wrap="truncate-end">
                飽{bar(p.full)} 樂{bar(p.fun)} 精{bar(p.energy)}
              </Text>
            </Box>
          )
        })}
        <Text color="cyan" wrap="truncate-end">{w.note}</Text>
        {isRenaming && current && Input && (
          <Input
            key="name"
            label="新名字："
            value={current.name}
            placeholder="輸入名字"
            submitLabel="改名"
            autoFocus
            onSubmit={(value: string) => {
              void change($, x => rename(x, value))
              void update($, renaming, () => false)
            }}
          />
        )}
        <Box flexDirection="row" columnGap={1}>
          <Button key="feed" hotkey="f" plain onPress={() => void change($, (x, n) => act(x, 'feed', n))}>餵食</Button>
          <Button key="pet" hotkey="t" plain onPress={() => void change($, (x, n) => act(x, 'pet', n))}>摸摸</Button>
          <Button key="play" hotkey="p" plain onPress={() => void change($, (x, n) => act(x, 'play', n))}>玩耍</Button>
          <Button key="sleep" hotkey="s" plain onPress={() => void change($, (x, n) => act(x, 'sleep', n))}>睡覺</Button>
        </Box>
        <Box flexDirection="row" columnGap={1}>
          <Button key="next" hotkey="n" plain onPress={() => void change($, x => cycle(x))}>換一隻</Button>
          <Button key="cat" hotkey="c" plain onPress={() => void change($, (x, n) => adopt(x, 'cat', n))}>領養貓</Button>
          <Button key="dog" hotkey="d" plain onPress={() => void change($, (x, n) => adopt(x, 'dog', n))}>領養狗</Button>
          {Input && <Button key="rename" hotkey="r" plain onPress={() => void update($, renaming, on => !on)}>改名</Button>}
          <Button key="bye" hotkey="x" plain dimColor onPress={() => void change($, x => release(x))}>送養</Button>
        </Box>
      </Box>
    )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    const saved = (await $.store.get(STORE_KEY)) as World | undefined
    await update($, world, () => decay(migrate(saved ?? emptyWorld(now), now), now))

    await update($, renaming, () => false)

    await $.command.register({ name: 'pets', description: '打開寵物 pane，或直接下指令：feed、pet、play、sleep、next、cat、dog、release、rename；最後加寵物名可指定對象', argumentHint: '[指令] [寵物名]' })
    void $.ui.open({ id: PANE, title: 'Pets' })

    $.clock.every(800, async () => {
      const w = await update($, world, cur => ({ ...cur, frame: cur.frame + 1 }))
      // Pets standing together may meet, once the last meeting has worn off.
      if (w.frame < nextMeet || w.pets.length < 2) return
      const at = new Map([...walkers].map(([id, k]) => [id, Math.round(k.x)]))
      const now = await $.clock.now()
      const met = meet(w.pets, at, now, w.frame, Math.random)
      if (!met) return
      encounter = met
      nextMeet = met.until + MEET_COOLDOWN
      await change($, x => befriend(x, met))
    })
    $.clock.every(60000, () => {
      void change($, w => w)
    })
    return result
  })

  on('command.run', { command: 'pets' }, async ($, e) => {
    const step = parseCommand(e.args)
    if (step === null) return { text: USAGE }
    if (step !== 'open') {
      await change($, step)
      return { text: (await read($, world)).note }
    }
    await $.ui.open({ id: PANE, title: 'Pets', focus: true })
    return { text: '寵物 pane 已打開。點 pane 或按 ctrl+x tab 後可用快捷鍵。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => petsView($, e, e.props.bodyColumns))

  // The pets watch the work: tests passing cheer them up, a failed call makes
  // the selected one wince, and they sit and wonder while the model thinks.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const now = await $.clock.now()
    if (ran.isError) {
      await update($, reaction, r => react(r, 'fail', now))
    } else if (e.tool === 'Bash' && isTestCommand(e.command)) {
      await update($, reaction, r => react(r, 'pass', now))
      await change($, w => cheer(w))
    }
    return ran
  })
  on('turn.start', async ($, e, next) => {
    await update($, reaction, r => react(r, 'think', 0))
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) await update($, reaction, r => react(r, 'done', 0))
    return next(e)
  })
}
