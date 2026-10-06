/**
 * A Swoop bird in SVG, as the game draws one (scene.ts drawBird), a unit across its body and facing right: the
 * tuft swept back, the body and its lighter belly, the beak, the wing (raised in flight, folded on the hill)
 * and the eye looking ahead. The home row's picture (components/todayPictures.tsx) and the game's picture
 * (components/GameArt.tsx) place it with a transform.
 */
export function BirdMark({ fill, line, wingUp = false }: { fill: string; line: string; wingUp?: boolean }) {
  return (
    <g strokeLinejoin="round" stroke={line}>
      <path d="M0.25 -0.8 Q0.1 -1.35 -0.03 -1.24 M0.25 -0.8 Q0.1 -1.25 -0.16 -1.17" fill="none" strokeWidth="0.1" strokeLinecap="round" />
      <ellipse cx="0" cy="0" rx="1.05" ry="0.88" fill={fill} strokeWidth="0.12" />
      <ellipse cx="0.18" cy="0.32" rx="0.6" ry="0.42" fill="#ffffff" fillOpacity="0.35" stroke="none" />
      <path d="M0.95 -0.12 L1.55 0.06 L0.92 0.24 Z" fill="#f5b942" strokeWidth="0.09" />
      <g transform={`translate(-0.2 -0.05) rotate(${wingUp ? -50 : -23})`}>
        <ellipse cx="-0.25" cy="0" rx="0.75" ry="0.34" transform="rotate(-11 -0.25 0)" fill={fill} strokeWidth="0.12" />
        <ellipse cx="-0.25" cy="0" rx="0.75" ry="0.34" transform="rotate(-11 -0.25 0)" fill="#000000" fillOpacity="0.15" stroke="none" />
      </g>
      <circle cx="0.48" cy="-0.28" r="0.27" fill="#ffffff" strokeWidth="0.07" />
      <circle cx="0.57" cy="-0.28" r="0.14" fill="#1a2b3c" stroke="none" />
    </g>
  )
}
