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
  /** How close it is to you, 0 to 100; filled on load for older saves. */
  bond?: number
  /** When you last fed, petted or played with it (epoch ms). */
  bondAt?: number
}

/** Something that happened, for the log; `at` is epoch ms. */
export type PetEvent = { at: number; text: string }

export type World = {
  pets: Pet[]
  selected: number
  frame: number
  note: string
  lastTick: number
  /** Oldest first, at most `MAX_EVENTS`. */
  events: PetEvent[]
}

/** The session that rolls pet encounters, and its last heartbeat (epoch ms). */
export type Leader = { id: string; beat: number }

/**
 * The human's current run of activity, shared by every session in the store
 * (`'activity'`): it starts at `streakStart`, was last seen at `lastActive`,
 * and `remindedStreak` is the `streakStart` already reminded about (epoch ms).
 */
export type Activity = { streakStart: number; lastActive: number; remindedStreak: number }

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
