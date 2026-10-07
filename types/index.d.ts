export type Kind = 'cat' | 'dog'

export type Pet = {
  id: string
  kind: Kind
  name: string
  full: number
  fun: number
  energy: number
  sleepingUntil: number
  playingUntil: number
  heartsUntil: number
  eatingUntil: number
}

export type World = {
  pets: Pet[]
  selected: number
  frame: number
  note: string
  lastTick: number
}

declare module 'claude-code' {
  interface PluginState {
    pets: { world: World; renaming: boolean }
  }
}
