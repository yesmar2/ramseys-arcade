import { useSyncExternalStore } from 'react'
import {
  getPersonalBest,
  subscribePersonalBests,
} from '../lib/personalBest'

export function usePersonalBest(slug: string): number {
  return useSyncExternalStore(
    subscribePersonalBests,
    () => getPersonalBest(slug),
    () => 0,
  )
}
