/**
 * The crown at the top of every gauntlet, as a mark for the game's own screens: the last of the HUD's round pips,
 * the crown's split on the cards, and the "Crown!" moment as a run ends. It's the crown the day's pictures draw
 * (gauntletPicture.ts), gold with its jewels; `size` across, in CSS pixels. Looks only: `dim` greys it for a crown
 * still to reach.
 */
export function CrownMark({ size = 18, dim = false, className }: { size?: number; dim?: boolean; className?: string }) {
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
      <path d="M-8 5 L-9.2 -4.6 L-4.2 -0.4 L0 -7.6 L4.2 -0.4 L9.2 -4.6 L8 5 Z" fill={dim ? '#b9b2c8' : '#f4c53e'} stroke="#fff1b0" strokeWidth="1" />
      <rect x="-8.2" y="4.4" width="16.4" height="3.2" rx="1" fill={dim ? '#9a93aa' : '#e0a92a'} stroke="#fff1b0" strokeWidth="0.8" />
      <circle cx="0" cy="1.6" r="1.4" fill={dim ? '#d9d3e3' : '#e85d9a'} />
      <circle cx="-4.6" cy="2.4" r="0.9" fill={dim ? '#d9d3e3' : '#3ec8cf'} />
      <circle cx="4.6" cy="2.4" r="0.9" fill={dim ? '#d9d3e3' : '#3ec8cf'} />
      <circle cx="-9.2" cy="-4.6" r="1.1" fill={dim ? '#b9b2c8' : '#f4c53e'} />
      <circle cx="0" cy="-7.6" r="1.2" fill={dim ? '#b9b2c8' : '#f4c53e'} />
      <circle cx="9.2" cy="-4.6" r="1.1" fill={dim ? '#b9b2c8' : '#f4c53e'} />
    </svg>
  )
}
