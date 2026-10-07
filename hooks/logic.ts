import type { Kind, Pet, World } from '../types'

export const MAX_PETS = 4
const CAT_NAMES = ['咪咪', '橘子', '麻糬', '布丁', '芝麻', '小花']
const DOG_NAMES = ['旺財', '豆豆', '可樂', '饅頭', '黑糖', '小白']

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function emptyWorld(now: number): World {
  return { pets: [], selected: 0, frame: 0, note: '按 c 領養貓、d 領養狗', lastTick: now }
}

export function adopt(world: World, kind: Kind, now: number): World {
  if (world.pets.length >= MAX_PETS) return { ...world, note: `最多養 ${MAX_PETS} 隻` }
  const names = kind === 'cat' ? CAT_NAMES : DOG_NAMES
  const used = new Set(world.pets.map(p => p.name))
  const name = names.find(n => !used.has(n)) ?? `${kind}${world.pets.length + 1}`
  const pet: Pet = {
    id: `${kind}-${now}`, kind, name, full: 80, fun: 80, energy: 80,
    sleepingUntil: 0, playingUntil: 0, heartsUntil: now + 3000, eatingUntil: 0,
  }
  return { ...world, pets: [...world.pets, pet], selected: world.pets.length, note: `${name} 來到你家了！` }
}

/**
 * Another session may have written the store since this one last read it: take
 * the stored world as the base and keep this session's own view on top (which
 * pet is selected, its note, the animation frame).
 */
export function merge(saved: World | undefined, cur: World): World {
  if (!saved) return cur
  const id = cur.pets[cur.selected]?.id
  const i = saved.pets.findIndex(p => p.id === id)
  return { ...saved, frame: cur.frame, note: cur.note, selected: i >= 0 ? i : 0 }
}

/** Stats drift down per elapsed minute; sleeping restores energy. Caps at 12h of absence. */
export function decay(world: World, now: number): World {
  const minutes = Math.min((now - world.lastTick) / 60000, 720)
  if (minutes < 1) return world
  const pets = world.pets.map(p => {
    const asleep = p.sleepingUntil > now - minutes * 60000
    return {
      ...p,
      full: clamp(p.full - 1 * minutes),
      fun: clamp(p.fun - 2 * minutes),
      energy: clamp(asleep ? p.energy + 6 * minutes : p.energy - 1 * minutes),
    }
  })
  return { ...world, pets, lastTick: now }
}

type Action = 'feed' | 'pet' | 'play' | 'sleep'

export function act(world: World, action: Action, now: number): World {
  const p = world.pets[world.selected]
  if (!p) return { ...world, note: '還沒有寵物，按 c 或 d 領養一隻' }
  if (p.sleepingUntil > now && action !== 'sleep') {
    return { ...world, note: `${p.name} 在睡覺，噓～` }
  }
  let next: Pet = p
  let note = ''
  if (action === 'feed') {
    if (p.full >= 95) note = `${p.name} 吃不下了`
    else {
      next = { ...p, full: clamp(p.full + 30), eatingUntil: now + 3000 }
      note = p.kind === 'cat' ? `${p.name} 吃了小魚乾` : `${p.name} 啃了骨頭`
    }
  } else if (action === 'pet') {
    next = { ...p, fun: clamp(p.fun + 10), heartsUntil: now + 3000 }
    note = p.kind === 'cat' ? `${p.name} 呼嚕呼嚕` : `${p.name} 搖尾巴`
  } else if (action === 'play') {
    if (p.energy < 15) note = `${p.name} 太累了，讓牠睡一下`
    else {
      next = { ...p, fun: clamp(p.fun + 25), energy: clamp(p.energy - 15), full: clamp(p.full - 5), playingUntil: now + 6000 }
      note = p.kind === 'cat' ? `${p.name} 撲向毛線球！` : `${p.name} 追著球跑！`
    }
  } else {
    if (p.sleepingUntil > now) {
      next = { ...p, sleepingUntil: 0 }
      note = `${p.name} 醒來了`
    } else {
      next = { ...p, sleepingUntil: now + 5 * 60000 }
      note = `${p.name} 去睡覺了（5 分鐘）`
    }
  }
  const pets = world.pets.map((one, i) => (i === world.selected ? next : one))
  return { ...world, pets, note }
}

export function cycle(world: World): World {
  if (world.pets.length === 0) return world
  const selected = (world.selected + 1) % world.pets.length
  return { ...world, selected, note: `選了 ${world.pets[selected].name}` }
}

export const MAX_NAME = 12

export function rename(world: World, raw: string): World {
  const p = world.pets[world.selected]
  if (!p) return { ...world, note: '還沒有寵物，按 c 或 d 領養一隻' }
  const name = raw.trim()
  if (name === '') return { ...world, note: '名字不能空白' }
  if ([...name].length > MAX_NAME) return { ...world, note: `名字最多 ${MAX_NAME} 個字` }
  if (name === p.name) return world
  if (world.pets.some((one, i) => i !== world.selected && one.name === name)) {
    return { ...world, note: `已經有一隻叫 ${name} 了` }
  }
  const pets = world.pets.map((one, i) => (i === world.selected ? { ...one, name } : one))
  return { ...world, pets, note: `${p.name} 改名叫 ${name} 了` }
}

export function release(world: World): World {
  const p = world.pets[world.selected]
  if (!p) return world
  const pets = world.pets.filter((_, i) => i !== world.selected)
  return { ...world, pets, selected: 0, note: `${p.name} 去找新家了，掰掰` }
}

type Step = (world: World, now: number) => World

const COMMANDS: Record<string, Step> = {
  feed: (w, n) => act(w, 'feed', n),
  pet: (w, n) => act(w, 'pet', n),
  play: (w, n) => act(w, 'play', n),
  sleep: (w, n) => act(w, 'sleep', n),
  next: w => cycle(w),
  release: w => release(w),
}
const ALIASES: Record<string, string> = {
  餵食: 'feed', 摸摸: 'pet', 玩耍: 'play', 睡覺: 'sleep', 換一隻: 'next',
  領養貓: 'cat', 領養狗: 'dog', 送養: 'release', 改名: 'rename',
}

export const USAGE = '用法：/pets [feed | pet | play | sleep | next | release] [寵物名]、/pets cat|dog [名字]、/pets rename <新名字> [寵物名]'

/** Selects the pet called `name`; `null` when there is none. */
function select(world: World, name: string): World | null {
  const i = world.pets.findIndex(p => p.name === name)
  return i < 0 ? null : { ...world, selected: i }
}

const missing = (world: World, name: string): World => ({ ...world, note: `沒有叫 ${name} 的寵物` })

/**
 * `/pets <args>`: the step to apply, `'open'` for no args, or `null` when unknown.
 * A pet's name after the verb picks that pet (and selects it) instead of the selected one.
 */
export function parseCommand(args: string): Step | 'open' | null {
  const [head = '', ...rest] = args.trim().split(/\s+/)
  if (head === '') return 'open'
  const verb = ALIASES[head] ?? head.toLowerCase()
  const target = rest.join(' ')

  if (verb === 'rename') {
    return w => {
      // `rename <新名字> [寵物名]`: the longest tail of words naming a pet is the target.
      for (let cut = 1; cut < rest.length; cut++) {
        const picked = select(w, rest.slice(cut).join(' '))
        if (picked) return rename(picked, rest.slice(0, cut).join(' '))
      }
      return rename(w, target)
    }
  }
  if (verb === 'cat' || verb === 'dog') {
    return (w, n) => {
      const born = adopt(w, verb, n)
      if (target === '' || born.pets.length === w.pets.length) return born
      const named = rename(born, target)
      // A refused name keeps the default one and says why.
      return named.pets[named.selected]?.name === target ? { ...named, note: `${target} 來到你家了！` } : named
    }
  }
  const step = COMMANDS[verb]
  if (!step) return null
  if (target === '') return step
  if (verb === 'next') return w => {
    const picked = select(w, target)
    return picked ? { ...picked, note: `選了 ${target}` } : missing(w, target)
  }
  return (w, n) => {
    const picked = select(w, target)
    return picked ? step(picked, n) : missing(w, target)
  }
}

export type Mood = 'sleep' | 'eat' | 'play' | 'love' | 'sad' | 'idle'

export function mood(p: Pet, now: number): Mood {
  if (p.sleepingUntil > now) return 'sleep'
  if (p.eatingUntil > now) return 'eat'
  if (p.playingUntil > now) return 'play'
  if (p.heartsUntil > now) return 'love'
  if (Math.min(p.full, p.fun, p.energy) < 25) return 'sad'
  return 'idle'
}

// ASCII only: no East Asian ambiguous-width glyphs (♥, █, ░ ...), which some
// terminals draw two cells wide and which break the alignment. Sprites face
// right; `mirror` flips them for walking left. FACE / EYE are swapped per mood.
const CAT_ART: Record<string, string[]> = {
  walkA: [
    String.raw`           /\_/\ `,
    String.raw`  .-------( FACE )`,
    String.raw`~(         > ^ < `,
    String.raw`  ` + '`' + String.raw`-/-/----\-\-' `,
    String.raw`   / /      \ \  `,
  ],
  walkB: [
    String.raw`           /\_/\ `,
    String.raw`  .-------( FACE )`,
    String.raw`~(         > ^ < `,
    String.raw`  ` + '`' + String.raw`-|-|----|-|-' `,
    String.raw`    | |    | |   `,
  ],
  sit: [
    String.raw`      /\_/\  `,
    String.raw`     ( FACE ) `,
    String.raw`     (> ^ <)  `,
    String.raw`    /|     |\ `,
    String.raw`   (_|_____|_)~`,
  ],
  sleep: [
    String.raw`              ZZ`,
    String.raw`    .-------./\_/\ `,
    String.raw` ~ (         FACE )`,
    String.raw`    ` + '`' + String.raw`--------'----'`,
    '',
  ],
}

const DOG_ART: Record<string, string[]> = {
  walkA: [
    String.raw`              __    `,
    String.raw`  \__________/ E\___ `,
    String.raw`   (            ____)`,
    String.raw`    \__ ______ /     `,
    String.raw`    /_/      \_\     `,
  ],
  walkB: [
    String.raw`              __    `,
    String.raw`  \__________/ E\___ `,
    String.raw`   (            ____)`,
    String.raw`    \__ ______ /     `,
    String.raw`     |_|    |_|      `,
  ],
  sit: [
    String.raw`       __     `,
    String.raw`      / E\___ `,
    String.raw`     /    ___)`,
    String.raw`    /  __/    `,
    String.raw`   (__/_|_|  ~`,
  ],
  sleep: [
    String.raw`                ZZ`,
    String.raw`    ___________ __  `,
    String.raw` ~ (          (E  \___`,
    String.raw`    ` + '`' + String.raw`----------------'`,
    '',
  ],
}

export const ART_WIDTH = 22
export const ART_HEIGHT = 5

const CAT_FACE: Record<Mood, string> = { idle: 'o.o', love: '^.^', eat: 'o.o', play: 'O.O', sleep: '-.-', sad: ';.;' }
const DOG_EYE: Record<Mood, string> = { idle: 'o', love: '^', eat: 'o', play: 'O', sleep: '-', sad: ';' }

const MIRROR: Record<string, string> = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<', '`': "'", "'": '`', '[': ']', ']': '[', '{': '}', '}': '{' }

export function mirror(line: string, width: number): string {
  return [...line.padEnd(width)].reverse().map(c => MIRROR[c] ?? c).join('')
}

/** Each pet's own walking speed, 0.6x to 1.4x, fixed by its id so it is the same in every session. */
export function gait(p: Pet): { speed: number } {
  let h = 2166136261
  for (const c of p.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return { speed: 0.6 + (h % 81) / 100 }
}

/**
 * Where a pet is on screen and what it is doing: walking, running or resting
 * for `left` more frames, then it picks again at random. Only for drawing, so
 * it lives in the session and is never stored.
 */
export type Walker = { x: number; right: boolean; mode: 'walk' | 'run' | 'rest'; left: number; frame: number }

export function newWalker(room: number, frame: number, rand: () => number): Walker {
  return { x: Math.floor(rand() * Math.max(0, room)), right: rand() < 0.5, mode: 'walk', left: 0, frame }
}

/** Moves the walker one step per frame since it last moved (at most 20, after a pause). */
export function stepWalker(w: Walker, p: Pet, now: number, frame: number, room: number, rand: () => number): Walker {
  const max = Math.max(0, room)
  const m = mood(p, now)
  if (m === 'sleep' || m === 'eat' || m === 'love' || m === 'sad') return { ...w, x: Math.min(w.x, max), frame }
  const playing = m === 'play'
  const { speed } = gait(p)
  const next = { ...w, x: Math.min(w.x, max), frame }
  for (let i = Math.min(frame - w.frame, 20); i > 0; i--) {
    if (next.left <= 0) {
      const r = rand()
      // Playing pets rest less and run more.
      next.mode = r < (playing ? 0.05 : 0.25) ? 'rest' : r < (playing ? 0.6 : 0.4) ? 'run' : 'walk'
      next.left = next.mode === 'walk' ? 4 + Math.floor(rand() * 8) : 3 + Math.floor(rand() * 5)
      if (rand() < 0.4) next.right = !next.right
    }
    const move = next.mode === 'rest' ? 0 : next.mode === 'run' ? speed * 3 : speed
    next.x += next.right ? move : -move
    if (next.x <= 0) [next.x, next.right] = [0, true]
    if (next.x >= max) [next.x, next.right] = [max, false]
    next.left--
  }
  return next
}

export function sprite(p: Pet, now: number, frame: number, right = true, resting = false): string[] {
  const m = mood(p, now)
  const art = p.kind === 'cat' ? CAT_ART : DOG_ART
  const pose = m === 'sleep' ? 'sleep' : m === 'love' || m === 'eat' || m === 'sad' || resting ? 'sit' : frame % 2 === 0 ? 'walkA' : 'walkB'
  let face = p.kind === 'cat' ? CAT_FACE[m] : DOG_EYE[m]
  if (m === 'idle' && frame % 7 === 6) face = p.kind === 'cat' ? '-.-' : '-'
  const zz = frame % 2 === 0 ? 'z ' : 'Zz'
  let lines = art[pose].map(l => l.replace('FACE', face).replace('E\\', face + '\\').replace('(E', '(' + face).replace('ZZ', zz))
  if (m === 'love') lines[0] = lines[0].replace(/\s*$/, '') + (frame % 2 === 0 ? '  <3' : ' <3')
  if (m === 'eat') lines[4] = lines[4].padEnd(15) + (frame % 2 === 0 ? '\\_/' : '\\~/')
  lines = lines.map(l => l.padEnd(ART_WIDTH).slice(0, ART_WIDTH))
  if (!right && pose !== 'sit' && pose !== 'sleep') lines = lines.map(l => mirror(l, ART_WIDTH))
  return lines
}

export function toyLine(p: Pet, now: number, frame: number, width: number): string {
  if (mood(p, now) !== 'play' || width < 4) return ''
  const span = width - 1
  const t = (frame * 3) % (span * 2)
  const x = t < span ? t : span * 2 - t
  return ' '.repeat(x) + (p.kind === 'cat' ? '@' : 'o')
}

export function bar(n: number, width = 6): string {
  const filled = Math.round((n / 100) * width)
  return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']'
}

/** Pads or cuts a line to exactly `width` columns so nothing wraps. */
export function fit(line: string, width: number): string {
  return line.length > width ? line.slice(0, width) : line.padEnd(width)
}
