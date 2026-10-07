import { SWIFT_BEAK, SWIFT_BELLY, SWIFT_BODY, SWIFT_EYE, SWIFT_WING_FOLDED, SWIFT_WING_UP } from './birdShape'

/**
 * A Swoop bird in SVG, as the game draws one (scene.ts drawBird): the swift (birdShape.ts), a unit across its
 * body and facing right, its wing raised in flight or folded on the hill. The pictures (HillsPostcard.tsx,
 * components/GameArt.tsx) place it with a transform; one sitting on a hill sits SWIFT_LIFT over it.
 */
export function BirdMark({ fill, line, wingUp = false }: { fill: string; line: string; wingUp?: boolean }) {
  const wing = wingUp ? SWIFT_WING_UP : SWIFT_WING_FOLDED
  const e = SWIFT_EYE
  return (
    <g strokeLinejoin="round" stroke={line} strokeWidth="0.1">
      <path d={SWIFT_BODY} fill={fill} />
      <path d={SWIFT_BELLY} fill="#ffffff" fillOpacity="0.55" stroke="none" />
      <path d={SWIFT_BEAK} fill="#f5b942" strokeWidth="0.07" />
      <path d={wing} fill={fill} />
      <path d={wing} fill="#000000" fillOpacity="0.18" stroke="none" />
      <circle cx={e.x} cy={e.y} r={e.r} fill="#ffffff" strokeWidth="0.05" />
      <circle cx={e.px} cy={e.y} r={e.pr} fill="#1a2b3c" stroke="none" />
    </g>
  )
}
