/**
 * The Blip star at the top of every gauntlet, as a mark for the game's own screens: the last of the HUD's round
 * pips, the star at the end of the round chips, and the "Star!" moment as a run ends. It's the star the day's
 * pictures draw (gauntletPicture.ts): mint, a lighter star inside, the glowing white blip at its centre, like the
 * Blipka mark's dot; `size` across, in CSS pixels. Looks only: `dim` greys it for a star still to reach.
 */
export function StarMark({ size = 18, dim = false, className }: { size?: number; dim?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-11 -11 22 22"
      aria-hidden="true"
      focusable="false"
      opacity={dim ? 0.45 : undefined}
      strokeLinejoin="round"
    >
      {dim ? null : <circle r="10" fill="#6ff0d2" opacity="0.22" />}
      <path
        d="M0 -9.4 L2.65 -2.65 L9.88 -2.41 L4.1 1.93 L6.27 9.16 L0 5.06 L-6.27 9.16 L-4.1 1.93 L-9.88 -2.41 L-2.65 -2.65 Z"
        fill={dim ? '#9a93aa' : '#34c6a8'}
        stroke={dim ? '#d9d3e3' : '#bff7ee'}
        strokeWidth="0.8"
      />
      <path d="M0 -6.51 L1.69 -2.17 L6.27 -1.93 L2.65 0.72 L3.86 5.3 L0 2.65 L-3.86 5.3 L-2.65 0.72 L-6.27 -1.93 L-1.69 -2.17 Z" fill={dim ? '#b9b2c8' : '#7ff0d6'} />
      <circle r="1.7" fill={dim ? '#d9d3e3' : '#f2fffb'} />
    </svg>
  )
}
