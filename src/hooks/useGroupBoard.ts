import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  fetchGroupRecords,
  fetchGroupTable,
  type GroupPeriod,
  type GroupRecord,
  type GroupTable,
} from '../lib/groupPages'

type Cached<T> = { at: number; value: T }

const TTL = 60_000
const tables = new Map<string, Cached<GroupTable>>()
const records = new Map<string, Cached<GroupRecord[]>>()

function fresh<T>(hit: Cached<T> | undefined): T | null {
  return hit && Date.now() - hit.at < TTL ? hit.value : null
}

/* Bumped when a group's kept boards are forgotten, so a page showing them asks again. */
const ASK_AGAIN = 'arcade-group-board'
let asked = 0

function subscribeAsked(onChange: () => void) {
  window.addEventListener(ASK_AGAIN, onChange)
  return () => window.removeEventListener(ASK_AGAIN, onChange)
}

function getAsked() {
  return asked
}

/**
 * Forget a group's kept table and records, and have any page showing them ask again: your friends change
 * the moment you add or remove one (useFriends).
 */
export function forgetGroupBoard(groupId: string) {
  for (const key of [...tables.keys()]) if (key.startsWith(`${groupId}:`)) tables.delete(key)
  records.delete(groupId)
  asked += 1
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ASK_AGAIN))
}

export type GroupBoard = {
  table: GroupTable | null
  records: GroupRecord[] | null
  /** Set when the boards could not be read: most often, a visitor who is not a member. */
  failed: boolean
}

/**
 * One group's table for a period and its records, for its members. A minute's
 * cache keeps switching periods, or going back to the groups page, instant.
 * Pass enabled false for someone who may not see the group's boards. Asked
 * again for the same group, what's shown stays until the new answer comes.
 */
export function useGroupBoard(groupId: string | null, period: GroupPeriod, enabled = true): GroupBoard {
  const tableKey = `${groupId}:${period}`
  const [table, setTable] = useState<GroupTable | null>(() => (groupId ? fresh(tables.get(tableKey)) : null))
  const [recs, setRecs] = useState<GroupRecord[] | null>(() => (groupId ? fresh(records.get(groupId)) : null))
  const [failed, setFailed] = useState(false)
  const again = useSyncExternalStore(subscribeAsked, getAsked, getAsked)
  const shownTable = useRef(tableKey)
  const shownRecords = useRef(groupId)

  useEffect(() => {
    if (!groupId || !enabled) return
    let cancelled = false
    const cached = fresh(tables.get(tableKey))
    if (cached || shownTable.current !== tableKey) setTable(cached)
    shownTable.current = tableKey
    if (!cached) {
      fetchGroupTable(groupId, period)
        .then((value) => {
          tables.set(tableKey, { at: Date.now(), value })
          if (!cancelled) setTable(value)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }
    return () => {
      cancelled = true
    }
  }, [groupId, period, enabled, tableKey, again])

  useEffect(() => {
    if (!groupId || !enabled) return
    let cancelled = false
    const cached = fresh(records.get(groupId))
    if (cached || shownRecords.current !== groupId) setRecs(cached)
    shownRecords.current = groupId
    if (!cached) {
      fetchGroupRecords(groupId)
        .then((value) => {
          records.set(groupId, { at: Date.now(), value })
          if (!cancelled) setRecs(value)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }
    return () => {
      cancelled = true
    }
  }, [groupId, enabled, again])

  return { table, records: recs, failed }
}
