import { useEffect, useId, useMemo, useRef } from 'react'
import { drawHolePlan } from '../games/acechase/holePlan'
import { dayWanted } from '../games/findbug/daily'
import { BugPortrait } from '../games/findbug/Portrait'
import { dayPlan } from '../games/halffull/plan'
import { pourPlanSvg } from '../games/halffull/planSvg'
import { dailyTrack } from '../games/hotlap/daily'
import { buildTrack } from '../games/hotlap/sim'
import { trackPlan } from '../games/hotlap/trackPlan'
import { marbleDay } from '../games/marblerun/runs'
import { point } from '../games/marblerun/sim'
import { todaysHole } from '../lib/dailyHole'
import type { TodayKey } from '../lib/today'

/*
 * Each daily's own picture of the day, for the home page's Today row (HomeToday.tsx), drawn as the day's
 * share card draws them (scripts/today-cards.mjs): the hole from above, the track in its neon, who's
 * wanted, the glasses on the shelf (empty: nothing gives half away) and the course in its light. Each fills
 * a 4:3 box. They come in a chunk of their own, with the plans and sims they're drawn from, after the row.
 */

const W = 480
const H = 360

/** The hole from above, on a canvas drawn to its box's size, again whenever the box changes size. */
function HolePicture({ day }: { day: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hole = useMemo(() => todaysHole(day), [day])
  useEffect(() => {
    const canvas = ref.current
    const spot = hole.def.spots[0]
    if (!canvas || !spot) return
    let drawn = ''
    const draw = () => {
      const box = canvas.getBoundingClientRect()
      const w = Math.round(box.width)
      const h = Math.round(box.height)
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      if (w < 2 || h < 2 || drawn === `${w}x${h}@${dpr}`) return
      drawn = `${w}x${h}@${dpr}`
      drawHolePlan(canvas, hole.def, spot, w, h, dpr)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [hole])
  return <canvas ref={ref} aria-hidden="true" />
}

/** The track from above: the road dark between edges of light on a faint cyan grid, the line, and the car. */
function TrackPicture({ day }: { day: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const plan = useMemo(() => {
    const track = dailyTrack(day)
    return trackPlan(buildTrack(track.pieces, { heading: track.shape.heading }))
  }, [day])
  const pad = 30
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={`${id}-grid`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="rgba(20, 200, 236, 0.16)" strokeWidth="1" />
        </pattern>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="1.15" r="0.9">
          <stop offset="0" stopColor="#16d8ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#16d8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#01040a" />
      <rect width={W} height={H} fill={`url(#${id}-grid)`} />
      <rect width={W} height={H} fill={`url(#${id}-glow)`} />
      <svg x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet">
        <path d={plan.d} fill="none" stroke="rgba(63, 240, 255, 0.22)" strokeWidth={plan.road * 2.4} strokeLinejoin="round" />
        <path d={plan.d} fill="none" stroke="#3ff0ff" strokeWidth={plan.road * 1.3} strokeLinejoin="round" />
        <path d={plan.d} fill="none" stroke="#04070c" strokeWidth={plan.road} strokeLinejoin="round" />
        <line {...plan.start} stroke="#ffffff" strokeWidth={plan.road * 0.4} />
        <circle cx={plan.car.x} cy={plan.car.y} r={plan.car.r} fill="#f2813a" />
      </svg>
    </svg>
  )
}

/** Who's wanted today, their heads side by side, as Find the Bug draws them. */
function WantedPicture({ day }: { day: string }) {
  const wanted = useMemo(() => dayWanted(day), [day])
  return (
    <span className="home-day__faces" aria-hidden="true">
      {wanted.map((w, i) => (
        <BugPortrait key={`${w.id}-${i}`} look={w.look} size={64} crop="head" className="home-day__face" fluid />
      ))}
    </span>
  )
}

/** The day's glasses on the shelf and the counter, empty. */
function PourPicture({ day }: { day: string }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pourPlanSvg(dayPlan(day), W, H))}`, [day])
  return <img src={src} alt="" />
}

/** The course from above, in magenta light on a faint violet grid, from its start (amber) to its goal (white). */
function CoursePicture({ day }: { day: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const drawing = useMemo(() => {
    const { course } = marbleDay(day)
    const [x0, x1, z0, z1] = course.box
    const pad = 32
    const scale = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (z1 - z0))
    const ox = (W - (x1 - x0) * scale) / 2
    const oz = (H - (z1 - z0) * scale) / 2
    const at = (x: number, z: number): [number, number] => [ox + (x - x0) * scale, oz + (z - z0) * scale]
    const paths: string[] = []
    for (const p of course.pieces) {
      if (p.gap) continue
      const n = Math.max(2, Math.ceil(p.len / 2))
      const pts: string[] = []
      for (let i = 0; i <= n; i++) {
        const [x, z] = at(...point(p, (p.len * i) / n, 0))
        pts.push(`${x.toFixed(1)} ${z.toFixed(1)}`)
      }
      paths.push(`M${pts.join(' L')}`)
    }
    const goal = course.lines[course.lines.length - 1]!
    return {
      d: paths.join(' '),
      road: Math.max(3, 5.5 * scale),
      start: at(...point(course.pieces[0]!, 0, 0)),
      goal: at(...point(goal.p, goal.u, 0)),
    }
  }, [day])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={`${id}-grid`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="rgba(138, 92, 255, 0.18)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#07040f" />
      <rect width={W} height={H} fill={`url(#${id}-grid)`} />
      <path d={drawing.d} fill="none" stroke="rgba(255, 92, 225, 0.25)" strokeWidth={drawing.road * 2.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d={drawing.d} fill="none" stroke="#ff5ce1" strokeWidth={drawing.road} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={drawing.start[0]} cy={drawing.start[1]} r={drawing.road * 1.2} fill="#f5b942" />
      <circle cx={drawing.goal[0]} cy={drawing.goal[1]} r={drawing.road * 1.3} fill="#ffffff" />
    </svg>
  )
}

/** A daily's picture of the day. */
export function DayPicture({ daily, day }: { daily: TodayKey; day: string }) {
  if (daily === 'hole') return <HolePicture day={day} />
  if (daily === 'track') return <TrackPicture day={day} />
  if (daily === 'wanted') return <WantedPicture day={day} />
  if (daily === 'pour') return <PourPicture day={day} />
  return <CoursePicture day={day} />
}
