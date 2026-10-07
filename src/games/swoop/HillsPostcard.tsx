import { useId, useMemo } from 'react'
import { mixColor } from '../../lib/color'
import { BirdMark } from './BirdMark'
import { SWIFT_LIFT } from './birdShape'
import { hillsColours, hillsView } from './hillsPicture'
import type { Hills } from './sim'

/**
 * A day's hills as a postcard: the biggest hill close in, as Swoop draws its hills at dusk (hillsPicture.ts).
 * It shows the sky and its stars, far hills rolling, and the near hills in the day's colour with their turf,
 * seams and blips. Your bird is just off the top with its trail, and the blue bird is coming up the slope
 * behind. It's the home row's picture of the day, and since 2026-10-06 the picture on Today's Hills, the past
 * hills' cards and the tomorrow tease too. Ramsey picked A from the "Pellets + Swoop pictures" canvas: the
 * whole way from the side (HillsDrawing.tsx, still the Hills Book's) is 50 times longer than it is tall, so a
 * card only ever showed it as a squiggle. `w` by `h` is its own shape; it covers any box it's put in.
 */
export function HillsPostcard({ hills, w = 480, h = 360, className }: { hills: Hills; w?: number; h?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const view = useMemo(() => hillsView(hills, w, h), [hills, w, h])
  const C = hillsColours(hills.hue)
  const { k, bird, blue } = view
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${hills.name}, its biggest hill`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.skyTop} />
          <stop offset="0.75" stopColor={C.skyLow} />
        </linearGradient>
        <linearGradient id={`${id}-earth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor={C.body} />
          <stop offset="1" stopColor={C.deep} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-sky)`} />
      {view.stars.map(([x, y, r, o], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={o} />
      ))}
      <circle cx={w * 0.8} cy={h * 0.18} r={h * 0.07} fill={C.moon} />
      <path d={view.far} fill={C.far} />
      <path d={view.mid} fill={C.mid} />
      <path d={view.ground} fill={`url(#${id}-earth)`} />
      <path d={view.surface} fill="none" stroke={C.turf} strokeWidth={Math.max(3, 1.1 * k)} transform={`translate(0 ${Math.max(2, 0.55 * k)})`} />
      {view.seams.map((d) => (
        <path key={d} d={d} fill="none" stroke={C.seam} strokeWidth={Math.max(1.5, 0.32 * k)} />
      ))}
      {view.blips.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={Math.max(1.4, 0.36 * k)} fill={C.blip} />
      ))}
      <path d={view.surface} fill="none" stroke={C.edge} strokeWidth={Math.max(2.5, 0.42 * k)} strokeLinejoin="round" />
      {/* The blue bird, sitting on the slope behind. */}
      <g transform={`translate(${blue.x} ${blue.y}) rotate(${blue.deg}) translate(0 ${-blue.size * SWIFT_LIFT}) scale(${blue.size})`} opacity="0.7">
        <BirdMark fill={C.blue} line={lineFor(C.blue)} />
      </g>
      {view.trail.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={Math.max(1.2, 0.18 * k)} fill="#ffffff" opacity={0.25 + (i / view.trail.length) * 0.5} />
      ))}
      <g transform={`translate(${bird.x} ${bird.y}) rotate(${bird.deg}) translate(0 ${-bird.size * SWIFT_LIFT}) scale(${bird.size})`}>
        <BirdMark fill={C.bird} line={C.birdLine} wingUp />
      </g>
    </svg>
  )
}

/** A bird's outline at dusk: its own colour, lightened, as the game draws it in the dark. */
const lineFor = (colour: string) => mixColor(colour, '#ffffff', 0.4)
