import { useId, useMemo } from 'react'
import { mixColor } from '../../lib/color'
import { svgAddress } from '../../lib/svgAddress'
import { useDarkTheme } from '../../lib/useDarkTheme'
import { BirdMark } from './BirdMark'
import { SWIFT_LIFT } from './birdShape'
import { hillsColours, hillsView } from './hillsPicture'
import { newLookFor } from './newLook'
import type { Hills } from './sim'
import { dayPictureSvg } from './vistaPicture'

type Props = { hills: Hills; w?: number; h?: number; className?: string }

/**
 * A day's hills as a postcard: the home row's picture of the day, and the picture on Today's Hills, the past
 * hills' cards and the tomorrow tease. `day` is the day the hills are, which says how they're drawn: as they
 * were flown (newLook.ts). `w` by `h` is its own shape; it covers any box it's put in.
 *
 * The hills from the new look's first day on are drawn in it (vistaPicture.ts): the hill the day's first kite is
 * on, your bird off its top with the flock behind and the kite ahead, under the day's own sky, by day on the
 * light theme and by night on the dark, as the game is. Ramsey picked that, "B, flock and kite", from three
 * ways shown on the home page's own row (2026-11-18).
 *
 * The hills before it keep the postcard they had: their biggest hill close in at dusk (hillsPicture.ts), the old
 * swift off the top with its dotted trail and the blue bird coming up the slope behind. Ramsey picked that one,
 * A, from the "Pellets + Swoop pictures" canvas (2026-10-06): the whole way from the side (HillsDrawing.tsx,
 * still the Hills Book's) is 50 times longer than it is tall, so a card only ever showed it as a squiggle.
 */
export function HillsPostcard({ day, ...props }: Props & { day: string }) {
  return newLookFor(day) ? <VistaPostcard {...props} /> : <DuskPostcard {...props} />
}

function VistaPostcard({ hills, w = 480, h = 360, className }: Props) {
  const dark = useDarkTheme()
  const src = useMemo(() => svgAddress(dayPictureSvg(hills, w, h, dark)), [hills, w, h, dark])
  return <img className={className} src={src} width={w} height={h} alt={`${hills.name}: a kite on its hill`} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
}

function DuskPostcard({ hills, w = 480, h = 360, className }: Props) {
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
