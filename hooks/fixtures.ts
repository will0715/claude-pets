import type { Pet, World } from '../types'
import type { Trait } from './logic'
import { adopt, emptyWorld, trait } from './logic'

/** Local noon, so nothing that depends on night happens by accident. */
export const NOON = new Date(2026, 9, 19, 12).getTime()

/** The pet under an id that gives it trait `t`. */
export function withTrait(p: Pet, t: Trait): Pet {
  for (let i = 0; ; i++) {
    const q = { ...p, id: `${p.id}-${i}` }
    if (trait(q) === t) return q
  }
}

/** A world of one pet, adopted at `at`, with trait `t`. */
export function alone(kind: Pet['kind'], t: Trait, at = NOON): World {
  const w = adopt(emptyWorld(at), kind, at)
  return { ...w, pets: [withTrait(w.pets[0]!, t)] }
}
