import { useEffect, useState } from 'react'

/*
 * The first time a player meets something new, it wears a New tag and a line saying what it is, once (A of
 * the "First-run hints" canvas's second row, Ramsey's pick on 2026-10-20). What has been shown is kept on
 * this device: a second device shows it once more, which is no harm.
 */

export type FirstKey = 'tickets'

const KEY = 'skermix-firsts'

function seenFirsts(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function markFirstSeen(key: FirstKey) {
  try {
    const list = seenFirsts()
    if (!list.includes(key)) localStorage.setItem(KEY, JSON.stringify([...list, key]))
  } catch {
    // No storage (a private window): it shows again next time.
  }
}

/**
 * True on the one showing where `key` is met for the first time: never shown here before, and `eligible`
 * (a player who met it before the tag existed, like tickets from earlier runs, isn't). Settled as the
 * showing mounts, so a store catching up underneath doesn't flip it, and counted as shown either way.
 */
export function useFirstTime(key: FirstKey, eligible: boolean): boolean {
  const [first] = useState(() => eligible && !seenFirsts().includes(key))
  useEffect(() => markFirstSeen(key), [key])
  return first
}
