/**
 * Bracket wins this device has already celebrated.
 *
 * A match can be decided while nobody is looking: if your opponent never plays,
 * the round clock resolves it on whoever loads the page next. The win then
 * happens outside the submit flow that shows the celebration, so without this
 * the player who won is simply never told.
 */

const KEY = 'skermix-seen-wins'
const MAX = 200

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX)))
  } catch {
    // Losing this only costs a repeated celebration, never a result.
  }
}

function key(eventId: string, matchId: string) {
  return `${eventId}:${matchId}`
}

export function isWinSeen(eventId: string, matchId: string): boolean {
  return read().includes(key(eventId, matchId))
}

export function markWinsSeen(eventId: string, matchIds: string[]) {
  if (matchIds.length === 0) return
  const have = new Set(read())
  for (const id of matchIds) have.add(key(eventId, id))
  write([...have])
}
