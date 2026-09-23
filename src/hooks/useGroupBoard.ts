import { useEffect, useState } from 'react'
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

export type GroupBoard = {
  table: GroupTable | null
  records: GroupRecord[] | null
  /** Set when the boards could not be read: most often, a visitor who is not a member. */
  failed: boolean
}

/**
 * One group's table for a period and its records, for its members. A minute's
 * cache keeps switching periods, or going back to the groups page, instant.
 * Pass enabled false for someone who may not see the group's boards.
 */
export function useGroupBoard(groupId: string | null, period: GroupPeriod, enabled = true): GroupBoard {
  const tableKey = `${groupId}:${period}`
  const [table, setTable] = useState<GroupTable | null>(() => (groupId ? fresh(tables.get(tableKey)) : null))
  const [recs, setRecs] = useState<GroupRecord[] | null>(() => (groupId ? fresh(records.get(groupId)) : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!groupId || !enabled) return
    let cancelled = false
    const cached = fresh(tables.get(tableKey))
    setTable(cached)
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
  }, [groupId, period, enabled, tableKey])

  useEffect(() => {
    if (!groupId || !enabled) return
    let cancelled = false
    const cached = fresh(records.get(groupId))
    setRecs(cached)
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
  }, [groupId, enabled])

  return { table, records: recs, failed }
}
