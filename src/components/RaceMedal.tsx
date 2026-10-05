import { MEDAL_NAMES, MEDALS, medalBeats, medalFor, medalTimes, nextMedal, type Medal } from '../lib/raceMedals'
import '../styles/raceMedals.css'

/*
 * A racing daily's medal (lib/raceMedals.ts): a disc on a ribbon, in its metal. Platinum has a sparkle on it,
 * so the four differ in more than their colour. Unwon, it's an outline only.
 */

const METAL: Record<Medal, { face: string; rim: string }> = {
  bronze: { face: '#d08a4c', rim: '#8f5426' },
  silver: { face: '#d3dbe2', rim: '#8794a0' },
  gold: { face: '#f4c53e', rim: '#a87c0c' },
  platinum: { face: '#b9f1fb', rim: '#3e9fb3' },
}

export function MedalIcon({ medal, size = 18, dim = false, className }: { medal: Medal; size?: number; dim?: boolean; className?: string }) {
  const m = METAL[medal]
  return (
    <svg
      className={`race-medal${dim ? ' race-medal--dim' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.2 1h4.1l3 8.6H9.2z" fill={dim ? 'none' : '#3d63b8'} stroke={dim ? 'currentColor' : 'none'} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M17.8 1h-4.1l-3 8.6h4.1z" fill={dim ? 'none' : '#2b4687'} stroke={dim ? 'currentColor' : 'none'} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="15.6" r="6.6" fill={dim ? 'none' : m.face} stroke={dim ? 'currentColor' : m.rim} strokeWidth="1.4" />
      <circle cx="12" cy="15.6" r="4.3" fill="none" stroke={dim ? 'currentColor' : m.rim} strokeWidth="1" opacity={dim ? 0.6 : 0.55} />
      {medal === 'platinum' ? (
        <path d="M12 12.4c.3 2.1 1 2.8 3.1 3.2-2.1.3-2.8 1-3.1 3.1-.3-2.1-1-2.8-3.1-3.1 2.1-.4 2.8-1.1 3.1-3.2z" fill={dim ? 'currentColor' : '#ffffff'} />
      ) : null}
    </svg>
  )
}

/**
 * A racing daily's medals on its start card: the four, those won today lit, and the time the next one takes.
 * `format` says a time (in seconds) the way the game does.
 */
export function MedalRow({ paceMs, bestMs, format }: { paceMs: number; bestMs: number | null; format: (seconds: number) => string }) {
  const held = medalFor(paceMs, bestMs)
  const next = nextMedal(paceMs, held)
  const won = held ? MEDALS.indexOf(held) : -1
  const said = `${held ? `${MEDAL_NAMES[held]} won today. ` : ''}${next ? `Next, ${MEDAL_NAMES[next.medal]}: ${format(next.ms / 1000)}` : 'All four won today'}`
  // A tile on the start card: what's next in its label, the time it takes as its figure, the four under it.
  return (
    <div className="game-pause-meta__row race-medals-row" title={medalTitle(paceMs, format)}>
      <span aria-hidden="true">{next ? `Next medal · ${MEDAL_NAMES[next.medal]}` : 'Medals'}</span>
      <strong aria-label={said}>{next ? format(next.ms / 1000) : 'All four'}</strong>
      <div className="race-medals__icons" aria-hidden="true">
        {MEDALS.map((m, i) => (
          <MedalIcon key={m} medal={m} dim={i > won} size={17} />
        ))}
      </div>
    </div>
  )
}

/**
 * A racing daily's run on its report: the medal it won, and whether that's new today, or the day's medal so far,
 * and the time the next one takes. `previousMs` is the day's best before this run.
 */
export function RunMedalLine({
  paceMs,
  ms,
  previousMs,
  format,
}: {
  paceMs: number
  ms: number
  previousMs: number | null
  format: (seconds: number) => string
}) {
  const now = medalFor(paceMs, ms)
  const before = medalFor(paceMs, previousMs)
  const fresh = now != null && medalBeats(now, before)
  const best = fresh ? now : before
  const next = nextMedal(paceMs, best)
  const then = next ? `${MEDAL_NAMES[next.medal]} at ${format(next.ms / 1000)}` : null
  let said: string
  if (!best) said = `No medal yet. ${then}.`
  else if (fresh) said = then ? `${MEDAL_NAMES[best]} medal! Next: ${then}.` : `${MEDAL_NAMES[best]} medal! That’s all four today.`
  else said = then ? `${MEDAL_NAMES[best]} medal today. Next: ${then}.` : `${MEDAL_NAMES[best]} medal today: all four.`
  return (
    <p className={`run-medal${fresh ? ' run-medal--new' : ''}`}>
      <MedalIcon medal={best ?? 'bronze'} dim={!best} size={26} />
      <span>{said}</span>
    </p>
  )
}

/** Every medal's time, for the row's tip: "Bronze 59.51s · Silver 58.33s · Gold 56.59s · Platinum 54.84s". */
function medalTitle(paceMs: number, format: (seconds: number) => string): string {
  const times = medalTimes(paceMs)
  return MEDALS.map((m) => `${MEDAL_NAMES[m]} ${format(times[m] / 1000)}`).join(' · ')
}
