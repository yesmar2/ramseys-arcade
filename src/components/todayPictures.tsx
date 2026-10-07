import { useEffect, useId, useMemo, useRef } from 'react'
import { drawHolePlan } from '../games/acechase/holePlan'
import { dayWanted } from '../games/findbug/daily'
import { BugPortrait } from '../games/findbug/Portrait'
import { dayPlan } from '../games/halffull/plan'
import { pourPlanSvg } from '../games/halffull/planSvg'
import { dailyTrack } from '../games/hotlap/daily'
import { CAVE_COLOURS, caveView } from '../games/lander/cavePicture'
import { landerDay } from '../games/lander/runs'
import { HillsPostcard } from '../games/swoop/HillsPostcard'
import { swoopDay } from '../games/swoop/runs'
import { buildTrack } from '../games/hotlap/sim'
import { trackPlan } from '../games/hotlap/trackPlan'
import { todaysHole } from '../lib/dailyHole'
import type { TodayKey } from '../lib/today'
import { GameArt } from './GameArt'

/*
 * Each daily's own picture of the day, for the home page's Today row (HomeToday.tsx): the hole from above, the
 * track in its neon, who's wanted and the glasses on the shelf (empty: nothing gives half away), drawn as the
 * day's share card draws them (scripts/today-cards.mjs); the cave's landing room as Lander draws a cave, with
 * the ship coming down; and Marble Run's own picture, the marble on its glowing road, which Ramsey liked best
 * (2026-10-04). Each fills a 4:3 box. They come in a chunk of their own, with the plans and sims they're drawn
 * from, after the row.
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

/** Marble Run's own picture (GameArt.tsx), the marble on its glowing road: the same every day, the one Ramsey liked best. */
function CoursePicture() {
  return <GameArt slug="marblerun" shape="card" />
}

/** Lander's hull, a ship's length about 2.3 m, its middle at the origin and y down. */
const HULL = 'M0 -1.35 L0.925 0.925 L0 0.375 L-0.925 0.925 Z'

/**
 * The cave's landing room close in, as the game draws a cave (cavePicture.ts): walls lit by depth with their
 * light spilling into the rock, the air's grid, the gates passed, the pad's light rising, and your ship coming
 * down onto the pad on its flame, sparks off the pad, the blue ship just through the door.
 */
function CavePicture({ day }: { day: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const view = useMemo(() => caveView(landerDay(day).cave, W, H), [day])
  const C = CAVE_COLOURS
  const { k, pad, ship, ghost } = view
  const wall = `url(#${id}-wall)`
  const lights = 6
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-wall`} gradientUnits="userSpaceOnUse" x1="0" y1={view.wallTop} x2="0" y2={view.wallBottom}>
          <stop offset="0" stopColor={`rgb(${C.wallTop.join(' ')})`} />
          <stop offset="1" stopColor={`rgb(${C.wallDeep.join(' ')})`} />
        </linearGradient>
        <pattern id={`${id}-fleck`} width="44" height="44" patternUnits="userSpaceOnUse">
          {[
            [5, 7, 2.2],
            [21, 3, 1.4],
            [34, 12, 2],
            [12, 22, 1.6],
            [28, 26, 2.4],
            [40, 33, 1.4],
            [7, 37, 2],
            [19, 40, 1.2],
          ].map(([x, y, s]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} fill="rgb(120 90 200 / 0.16)" />
          ))}
        </pattern>
        <clipPath id={`${id}-air`}>
          {view.air.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
        <linearGradient id={`${id}-wash`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={C.pad} stopOpacity="0.38" />
          <stop offset="1" stopColor={C.pad} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-burn`}>
          <stop offset="0" stopColor="#ff9f45" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff9f45" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={C.rock} />
      <rect width={W} height={H} fill={`url(#${id}-fleck)`} />
      {/* The walls' light spilling into the rock and their lit edge; the air then covers their inner halves. */}
      {(
        [
          [4.4, 0.035],
          [3.3, 0.04],
          [2.3, 0.05],
          [1.4, 0.07],
          [0.44, 1],
        ] as const
      ).map(([width, alpha]) => (
        <g key={width} fill="none" stroke={wall} strokeWidth={Math.max(1.5, width * k)} strokeLinejoin="round" opacity={alpha}>
          {view.air.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ))}
      <g fill={C.air}>
        {view.air.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d={view.grid} clipPath={`url(#${id}-air)`} fill="none" stroke="rgb(138 92 255 / 0.16)" strokeWidth="1" />
      {view.pillars.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={p.r} fill={wall} />
          <circle cx={p.x} cy={p.y} r={Math.max(0, p.r - 0.22 * k)} fill={C.rock} />
        </g>
      ))}
      {/* The gates the ship has come through: green. */}
      <path d={view.gates} fill="none" stroke={C.passed} strokeWidth={Math.max(1.5, 0.16 * k)} strokeLinecap="round" strokeDasharray={`${0.9 * k} ${0.7 * k}`} opacity="0.75" />
      {view.gateEnds.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={Math.max(2.5, 0.28 * k)} fill={C.passed} opacity="0.75" />
      ))}
      {/* The landing pad, its light rising, and its lights running toward its middle. */}
      <rect x={pad.x0} y={pad.y - 3 * k} width={pad.x1 - pad.x0} height={3 * k} fill={`url(#${id}-wash)`} />
      <rect x={pad.x0} y={pad.y - 0.3 * k} width={pad.x1 - pad.x0} height={0.3 * k} fill={C.pad} />
      {Array.from({ length: lights }, (_, i) => {
        const f = (i + 0.5) / lights
        const on = Math.abs(f - 0.5) < 0.2
        return <circle key={i} cx={pad.x0 + (pad.x1 - pad.x0) * f} cy={pad.y - 0.3 * k - Math.max(2, 0.18 * k)} r={Math.max(1.6, 0.13 * k)} fill={on ? '#fff4d6' : 'rgb(255 179 71 / 0.35)'} />
      })}
      {/* The blue ship, just through the door. */}
      <g transform={`translate(${ghost.x} ${ghost.y}) rotate(${ghost.deg}) scale(${ghost.scale})`}>
        <path d={HULL} fill={C.ghost} fillOpacity="0.14" stroke={C.ghost} strokeWidth={2 / ghost.scale} strokeLinejoin="round" />
      </g>
      {/* Your ship over the pad on its flame, its engine's light on the pad, sparks thrown off it. */}
      <circle cx={ship.x} cy={pad.y - 0.6 * k} r={4.5 * k} fill={`url(#${id}-burn)`} />
      <g transform={`translate(${ship.x} ${ship.y}) rotate(${ship.deg}) scale(${ship.scale})`}>
        <path d="M-0.46 0.42 L0 2.2 L0.46 0.42 Z" fill="#ff8c32" opacity="0.92" />
        <path d="M-0.24 0.42 L0 1.4 L0.24 0.42 Z" fill="#ffecaa" />
        <path d={HULL} fill="#ff9f45" fillOpacity="0.22" stroke="#ff9f45" strokeOpacity="0.2" strokeWidth={7 / ship.scale} strokeLinejoin="round" />
        <path d={HULL} fill="#1a1030" fillOpacity="0.5" stroke={C.ship} strokeWidth={2.6 / ship.scale} strokeLinejoin="round" />
        <circle cx="0" cy="-0.35" r="0.17" fill={C.ship} />
      </g>
      {view.sparks.map(([x, y, size, opacity], i) => (
        <rect key={i} x={x} y={y} width={size} height={size} fill={C.spark} opacity={opacity} />
      ))}
    </svg>
  )
}

/** The day's biggest hill close in, the hills' postcard (swoop/HillsPostcard.tsx). */
function HillsPicture({ day }: { day: string }) {
  return <HillsPostcard hills={swoopDay(day).hills} w={W} h={H} />
}

/** A daily's picture of the day. */
export function DayPicture({ daily, day }: { daily: TodayKey; day: string }) {
  if (daily === 'hole') return <HolePicture day={day} />
  if (daily === 'track') return <TrackPicture day={day} />
  if (daily === 'wanted') return <WantedPicture day={day} />
  if (daily === 'pour') return <PourPicture day={day} />
  if (daily === 'cave') return <CavePicture day={day} />
  if (daily === 'hills') return <HillsPicture day={day} />
  return <CoursePicture />
}
