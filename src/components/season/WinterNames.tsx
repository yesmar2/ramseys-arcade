/*
 * Season 2's name styles (Cold Snap) as SVG, for the prize shelf's little board-row sign (prizes/PrizeArt.tsx
 * StyledTag), in their dark-board colours. The boards' own CSS is in styles/prizes.css.
 */

export const WINTER_NAMES = ['nm-frost', 'nm-frostbite', 'nm-glacier', 'nm-hoarfrost', 'nm-polar', 'nm-crystal'] as const

export function isWinterName(style: string): boolean {
  return (WINTER_NAMES as readonly string[]).includes(style)
}

const FONT = 'Outfit, system-ui, sans-serif'

export function WinterTag({ style, name, x, y, size, id }: { style: string; name: string; x: number; y: number; size: number; id: string }) {
  const at = { x, y, fontSize: size, letterSpacing: 1, fontFamily: FONT, fontWeight: 800 }
  const glow = (std: number) => (
    <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation={std} />
    </filter>
  )
  switch (style) {
    case 'nm-frost':
      return (
        <>
          <defs>{glow(2.4)}</defs>
          <text {...at} fill="#7fc8ff" opacity="0.85" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fill="#f4fbff">
            {name}
          </text>
        </>
      )
    case 'nm-frostbite':
      return (
        <>
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.3" stopColor="#ffffff" />
              <stop offset="0.45" stopColor="#7fd0ff" />
              <stop offset="1" stopColor="#3fa0e8" />
            </linearGradient>
          </defs>
          <text {...at} fill={`url(#${id}f)`}>
            {name}
          </text>
        </>
      )
    case 'nm-glacier':
      return (
        <>
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#dff4ff" />
              <stop offset="0.5" stopColor="#7fc8ff" />
              <stop offset="1" stopColor="#3a7fd0" />
            </linearGradient>
            {glow(2)}
          </defs>
          <text {...at} fill="#3a7fd0" opacity="0.6" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fill={`url(#${id}f)`}>
            {name}
          </text>
        </>
      )
    case 'nm-hoarfrost':
      return (
        <>
          <defs>{glow(1.6)}</defs>
          <text {...at} fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="1 1.4" opacity="0.9" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeDasharray="0.8 1.6" strokeLinecap="round">
            {name}
          </text>
          <text {...at} fill="#dff2ff">
            {name}
          </text>
        </>
      )
    case 'nm-polar':
      return (
        <>
          <defs>{glow(3)}</defs>
          <text {...at} fill="#4aa8e8" opacity="0.8" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fill="#ffffff" stroke="#4aa8e8" strokeWidth="1.4" paintOrder="stroke" strokeLinejoin="round">
            {name}
          </text>
        </>
      )
    default:
      // Crystal: clear ice in flat facets, a magenta glint.
      return (
        <>
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e8f8ff" />
              <stop offset="0.25" stopColor="#e8f8ff" />
              <stop offset="0.25" stopColor="#7fd0ff" />
              <stop offset="0.45" stopColor="#7fd0ff" />
              <stop offset="0.45" stopColor="#dff4ff" />
              <stop offset="0.6" stopColor="#dff4ff" />
              <stop offset="0.6" stopColor="#4aa8e8" />
              <stop offset="0.8" stopColor="#4aa8e8" />
              <stop offset="0.8" stopColor="#c9eeff" />
            </linearGradient>
            {glow(2.2)}
          </defs>
          <text {...at} fill="#e86bd0" opacity="0.45" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fill={`url(#${id}f)`}>
            {name}
          </text>
        </>
      )
  }
}
