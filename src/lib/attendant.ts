const STORAGE_KEY = 'arcade-attendant-last'
/** Minimum time between appearances. */
const COOLDOWN_MS = 1000 * 60 * 60 * 6 // 6 hours
/** Chance to appear when cooldown has elapsed. */
const APPEAR_CHANCE = 0.22
/** Delay before popping in so the home page settles first. */
export const ATTENDANT_DELAY_MS = import.meta.env.DEV ? 800 : 4500

export const ATTENDANT_LINES = [
  'Don’t tell the machines I said this… you’ve got a shot today.',
  'High scores don’t sleep. Neither do I. Terrible lifestyle.',
  'If Pop feels unfair, that’s because it is. Respect.',
  'The tiles missed you. Or they’re plotting. Hard to say.',
  'Looking confident won’t help. Looking cool still counts.',
  'I saw your last run. We’re not talking about it.',
  'Coin slot’s metaphorical. Your free time isn’t. Go play.',
  'Asteroids called. They want their rocks back.',
  'Patriot tip: cities are emotional support objects. Protect them.',
  'Simon remembers everything. I forget why I walked in here.',
  'Leaderboards lie less than I do. Barely.',
  'You’re early. Or late. In arcade time it’s the same thing.',
  'One more game is a scam I fully endorse.',
  'Stacker looks peaceful. That’s how it gets you.',
  'Snake says hi. Then crashes into itself. Classic.',
  'Rank is temporary. A good groan is forever.',
  'I only appear when the vibe is right. Today qualifies.',
  'Don’t refresh. I’m shy on the second take.',
  'The house always wins… except Tuesdays. Weird rule.',
  'Play something. I’m on break either way.',
] as const

function daySeed() {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function pickAttendantLine(): string {
  const seed = daySeed()
  const idx = seed % ATTENDANT_LINES.length
  // Nudge by hour so two visits the same day can differ if they get lucky twice
  // across the cooldown window on different days mostly — still stable-ish.
  const hourBump = new Date().getHours()
  return ATTENDANT_LINES[(idx + hourBump) % ATTENDANT_LINES.length]
}

export function shouldSummonAttendant(now = Date.now()): boolean {
  // Always show while developing so you can preview without fighting RNG.
  if (import.meta.env.DEV) return true

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const last = raw ? Number(raw) : 0
    if (Number.isFinite(last) && now - last < COOLDOWN_MS) return false
  } catch {
    /* private mode — still allow a rare roll */
  }
  return Math.random() < APPEAR_CHANCE
}

export function markAttendantShown(now = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    /* ignore */
  }
}
