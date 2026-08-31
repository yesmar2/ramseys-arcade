/** Calendar day in America/New_York — matches API tournament boards. */
export const SPOTTER_TZ = 'America/New_York'

export function spotterDayKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SPOTTER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Days since launch — shown as “Spotter #N”. */
const LAUNCH_YMD = { y: 2026, m: 1, d: 1 }

export function spotterHuntNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  const launch = Date.UTC(LAUNCH_YMD.y, LAUNCH_YMD.m - 1, LAUNCH_YMD.d)
  const current = Date.UTC(y, m - 1, d)
  return Math.max(1, Math.floor((current - launch) / 86_400_000) + 1)
}

export function hashDayKey(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
