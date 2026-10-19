import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Activity, Leader, Reaction, World } from '../types'
import type { Encounter, Walker } from './logic'
import { isHuman, overlayOf, petLabel, needsBreak, record, touchActivity, isNight, absenceSummary, act, adopt, formatEvent, merge, need, sadTransitions, parseCommand, recentEvents, rename, USAGE, ART_WIDTH, bar, cycle, befriend, cheer, claimLeader, decay, emptyWorld, fit, isTestCommand, meet, MEET_COOLDOWN, migrate, newWalker, NO_REACTION, react, release, sprite, stepWalker, toyLine } from './logic'

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
// Every open session runs the frame timer; only the leader rolls encounters,
// or N sessions would make the pets meet N times as often.
let isLeader = false
// The shared activity record as of the last heartbeat; rendering reads this, never the store.
let activity: Activity | undefined
// Close pets say hi until then, in this session only: they greet you when you open one.
let greetUntil = 0

// Every change starts from the store, so one session's actions are not
// overwritten by another session's older copy.
async function change($: EngineInterface, fn: (w: World, now: number) => World) {
  const now = await $.clock.now()
  const saved = (await $.store.get(STORE_KEY)) as World | undefined
  const w = await update($, world, cur => fn(decay(migrate(merge(saved, cur), now), now), now))
  await $.store.set(STORE_KEY, { ...w, frame: 0 })
  if (isLeader) await alertSad($, w)
}

// The alerted ids live in the store so a new leader or a reload does not toast them again.
async function alertSad($: EngineInterface, w: World) {
  const before = ((await $.store.get('sadAlerted')) as string[] | undefined) ?? []
  const { toast, alerted } = sadTransitions(w.pets, before)
  for (const p of toast) $.ui.toast(`${p.name} 不開心了（${need(p)}）`)
  if (alerted.length !== before.length || alerted.some((id, i) => id !== before[i])) await $.store.set('sadAlerted', alerted)
}

// The human did something. Every writer says "someone is active now", so
// concurrent writes converge without a lock; 30 s apart at most.
async function touch($: EngineInterface) {
  const now = await $.clock.now()
  const rec = (await $.store.get('activity')) as Activity | undefined
  if (rec && now - rec.lastActive < 30000) return
  activity = touchActivity(rec, now)
  await $.store.set('activity', activity)
}

async function heartbeat($: EngineInterface, me: string) {
  const now = await $.clock.now()
  activity = (await $.store.get('activity')) as Activity | undefined
  const claim = claimLeader((await $.store.get('leader')) as Leader | undefined, me, now)
  if (!claim) {
    isLeader = false
    return
  }
  await $.store.set('leader', claim)
  // Two sessions that both claimed a stale record converge: the later write wins.
  isLeader = ((await $.store.get('leader')) as Leader | undefined)?.id === me
  if (!isLeader || !activity || !needsBreak(activity, now) || activity.remindedStreak === activity.streakStart) return
  const seen = await read($, world)
  const name = seen.pets[seen.selected]?.name
  if (name === undefined) return
  activity = { ...activity, remindedStreak: activity.streakStart }
  await $.store.set('activity', activity)
  await change($, (w, n) => record(w, n, `${name} 提醒你休息一下`))
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
    const busy = (fn: () => unknown) => () => {
      void touch($)
      void fn()
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>{isNight(now) ? '夜晚' : '白天'}</Text>
        {w.pets.length === 0 && <Text dimColor>還沒有寵物，按 c 領養貓、d 領養狗。</Text>}
        {w.pets.map((p, i) => {
          const room = width - ART_WIDTH
          const overlay = overlayOf(p, i === w.selected, { reaction: mood, encounter, greetUntil, activity }, now, w.frame)
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
                {petLabel(p, now)}
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
        {recentEvents(w, 2).map(ev => (
          <Text dimColor wrap="truncate-end">{formatEvent(ev)}</Text>
        ))}
        {isRenaming && current && Input && (
          <Input
            key="name"
            label="新名字："
            value={current.name}
            placeholder="輸入名字"
            submitLabel="改名"
            autoFocus
            onSubmit={(value: string) => {
              void touch($)
              void change($, (x, n) => rename(x, value, n))
              void update($, renaming, () => false)
            }}
          />
        )}
        <Box flexDirection="row" columnGap={1}>
          <Button key="feed" hotkey="f" plain onPress={busy(() => change($, (x, n) => act(x, 'feed', n)))}>餵食</Button>
          <Button key="pet" hotkey="t" plain onPress={busy(() => change($, (x, n) => act(x, 'pet', n)))}>摸摸</Button>
          <Button key="play" hotkey="p" plain onPress={busy(() => change($, (x, n) => act(x, 'play', n)))}>玩耍</Button>
          <Button key="sleep" hotkey="s" plain onPress={busy(() => change($, (x, n) => act(x, 'sleep', n)))}>睡覺</Button>
        </Box>
        <Box flexDirection="row" columnGap={1}>
          <Button key="next" hotkey="n" plain onPress={busy(() => change($, x => cycle(x)))}>換一隻</Button>
          <Button key="cat" hotkey="c" plain onPress={busy(() => change($, (x, n) => adopt(x, 'cat', n)))}>領養貓</Button>
          <Button key="dog" hotkey="d" plain onPress={busy(() => change($, (x, n) => adopt(x, 'dog', n)))}>領養狗</Button>
          {Input && <Button key="rename" hotkey="r" plain onPress={busy(() => update($, renaming, on => !on))}>改名</Button>}
          <Button key="bye" hotkey="x" plain dimColor onPress={busy(() => change($, (x, n) => release(x, n)))}>送養</Button>
        </Box>
      </Box>
    )
}

// Earlier versions pinned a status line, which the engine keeps until cleared. A
// plugin reload need not fire session.start again, so the first prompt or /pets
// command after a load clears it too.
let statusCleared = false
function clearOldStatus($: EngineInterface) {
  if (statusCleared) return
  statusCleared = true
  $.ui.status(undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    const saved = (await $.store.get(STORE_KEY)) as World | undefined
    const decayed = decay(migrate(saved ?? emptyWorld(now), now), now)
    if (saved && now - saved.lastTick > 30 * 60000) {
      const summary = absenceSummary(decayed.events, saved.lastTick)
      if (summary !== '') $.ui.toast(summary)
    }
    await update($, world, () => decayed)
    greetUntil = now + 3000
    clearOldStatus($)

    await update($, renaming, () => false)

    await $.command.register({ name: 'pets', description: '打開寵物 pane，或直接下指令：feed、pet、play、sleep、next、cat、dog、release、rename、log（寵物日誌）；最後加寵物名可指定對象', argumentHint: '[指令|log] [寵物名]' })
    void $.ui.open({ id: PANE, title: 'Pets' })

    const me = await $.session.id()
    await heartbeat($, me)
    $.clock.every(2000, () => heartbeat($, me))

    $.clock.every(800, async () => {
      const w = await update($, world, cur => ({ ...cur, frame: cur.frame + 1 }))
      if (!isLeader) return
      // Pets standing together may meet, once the last meeting has worn off.
      if (w.frame < nextMeet || w.pets.length < 2) return
      const at = new Map([...walkers].map(([id, k]) => [id, Math.round(k.x)]))
      const now = await $.clock.now()
      const met = meet(w.pets, at, now, w.frame, Math.random)
      if (!met) return
      encounter = met
      nextMeet = met.until + MEET_COOLDOWN
      await change($, (x, n) => befriend(x, met, n))
    })
    $.clock.every(60000, () => {
      void change($, w => w)
    })
    return result
  })

  on('session.end', async ($, e, next) => {
    if (isLeader) await $.store.delete('leader')
    return next(e)
  })

  // Only the human's own prompts and commands count as being at work, not automation's.
  on('prompt.submit', async ($, e, next) => {
    clearOldStatus($)
    const result = await next(e)
    if (isHuman(e.origin)) await touch($)
    return result
  })

  on('command.run', { command: 'pets' }, async ($, e) => {
    clearOldStatus($)
    if (isHuman(e.origin)) await touch($)
    const step = parseCommand(e.args)
    if (step === null) return { text: USAGE }
    if (step === 'log') {
      // Sync with the store first so the log includes what other sessions recorded.
      await change($, w => w)
      const events = recentEvents(await read($, world), 20)
      return { text: events.length > 0 ? events.map(formatEvent).join('\n') : '還沒有任何紀錄' }
    }
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
