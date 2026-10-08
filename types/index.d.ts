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
  /** When it was adopted; a pet saved before this field existed gets it on load. */
  bornAt?: number
}

export type World = {
  pets: Pet[]
  selected: number
  frame: number
  note: string
  lastTick: number
}

/** How the pets react to the session's work; drawing only, never stored. */
export type Reaction = {
  kind: 'none' | 'cheer' | 'oops'
  until: number
  fails: number
  thinking: boolean
}

declare module 'claude-code' {
  interface PluginState {
    pets: { world: World; renaming: boolean; reaction: Reaction }
  }
}
