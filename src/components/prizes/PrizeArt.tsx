import { useId, type ReactNode } from 'react'
import { plateTier, prizeById, type Prize } from '../../data/prizes'
import { wearPrize, type Avatar } from '../../lib/avatars'
import { AvatarArt } from '../PlayerAvatar'
import { askForOrbitronFont, askForPixelFont } from '../../lib/nameStyle'
import { SHELF_SCALE, SIGN_W, signHeight, ticketPath } from '../../lib/prizeArt'
import { ThemeDrawing } from './CardThemes'
import { SignDrawing } from './SignArt'
import { isWinterName, WinterTag } from '../season/WinterNames'
import { flakeStrokes } from '../season/WinterFinishes'

/*
 * What the prize counter draws: the ticket, the counter's LED readout, and
 * each prize standing on its shelf, worn by the player looking at it (their
 * own badge, their own tag). The signs are in SignArt.tsx and the card themes
 * in CardThemes.tsx. The drawings follow the counter's design canvas.
 */

const FONT = 'Outfit, system-ui, sans-serif'

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

function star5(cx: number, cy: number, r: number, rot = 0) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = ((rot - 90 + i * 36) * Math.PI) / 180
    const rad = i % 2 === 0 ? r : r * 0.45
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

/** Seeded, so a drawing is the same every time it's drawn. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/* ---------- the counter's readout: seven-segment digits, lit orange ---------- */

const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'bcfg',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
}

function segment(seg: string, x0: number, y0: number): string {
  const W = 34
  const H = 62
  const T = 7.5
  const g = 1.1
  const t = T / 2
  const L = x0 + t
  const R = x0 + W - t
  const top = y0 + t
  const mid = y0 + H / 2
  const bot = y0 + H - t
  const f = (v: number) => v.toFixed(1)
  const hor = (y: number, a: number, b: number) => {
    const x1 = a + g
    const x2 = b - g
    return `M${f(x1)} ${f(y)}L${f(x1 + t)} ${f(y - t)}H${f(x2 - t)}L${f(x2)} ${f(y)}L${f(x2 - t)} ${f(y + t)}H${f(x1 + t)}Z`
  }
  const ver = (x: number, a: number, b: number) => {
    const y1 = a + g
    const y2 = b - g
    return `M${f(x)} ${f(y1)}L${f(x + t)} ${f(y1 + t)}V${f(y2 - t)}L${f(x)} ${f(y2)}L${f(x - t)} ${f(y2 - t)}V${f(y1 + t)}Z`
  }
  switch (seg) {
    case 'a':
      return hor(top, L, R)
    case 'g':
      return hor(mid, L, R)
    case 'd':
      return hor(bot, L, R)
    case 'f':
      return ver(L, top, mid)
    case 'b':
      return ver(R, top, mid)
    case 'e':
      return ver(L, mid, bot)
    default:
      return ver(R, mid, bot)
  }
}

/** A ticket machine's readout: the count in lit segments, unlit eights behind the digits it doesn't need. */
export function LedCounter({ value, digits = 5, width = 200 }: { value: number; digits?: number; width?: number }) {
  const id = useSvgId('led')
  const text = String(Math.max(0, Math.floor(value)))
  const cells = Math.max(digits, text.length)
  const padded = text.padStart(cells, ' ')
  const lit: string[] = []
  const ghost: string[] = []
  for (let i = 0; i < cells; i++) {
    const ch = padded[i]!
    for (const s of 'abcdefg') (SEGMENTS[ch]?.includes(s) ? lit : ghost).push(segment(s, 6 + i * 45, 2))
  }
  const vw = 12 + cells * 34 + (cells - 1) * 11
  const vh = 66
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={(width * vh) / vw} role="img" aria-label={`${value.toLocaleString()} tickets`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <filter id={id} x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform="skewX(-7) translate(8 0)">
        <path d={ghost.join('')} fill="rgba(255,106,61,0.08)" />
        <path d={lit.join('')} fill="#ff6a3d" filter={`url(#${id})`} />
        <path d={lit.join('')} fill="#ffb899" opacity="0.5" />
      </g>
    </svg>
  )
}

/** A card theme, filling a w × h box: for the player card, and small on the shelf. */
export function CardBackdrop({ theme, width, height, scale = 1, className }: { theme: string; width: number; height: number; scale?: number; className?: string }) {
  const id = useSvgId('card')
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}c`}>
          <rect width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <ThemeDrawing theme={theme} w={width} h={height} s={scale} id={id} />
      </g>
    </svg>
  )
}

/* ---------- each prize on its shelf ---------- */

function Shadow({ rx }: { rx: number }) {
  return <ellipse cx="80" cy="126" rx={rx} ry="4.5" fill="#000" opacity="0.4" />
}

/** A tag in a name style, in SVG, for the shelf's little board-row sign. */
function StyledTag({ style, name, x, y, size, id }: { style: string; name: string; x: number; y: number; size: number; id: string }) {
  const at = { x, y, fontSize: size, letterSpacing: 1 }
  // Season 2's (Cold Snap) are drawn in their own file.
  if (isWinterName(style)) return <WinterTag style={style} name={name} x={x} y={y} size={size} id={id} />
  switch (style) {
    // Season 1's (Space Race, its pass).
    case 'nm-starlight':
      return (
        <>
          <defs>
            <filter id={`${id}s`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="#ffffff" filter={`url(#${id}s)`}>
            {name}
            <tspan fill="#f5b942" fontSize={size * 0.7} dx="3">
              ✦
            </tspan>
          </text>
        </>
      )
    case 'nm-countdown':
      askForOrbitronFont()
      return (
        <text {...at} fontSize={size - 4} letterSpacing={2} fontFamily="Orbitron, Outfit, sans-serif" fontWeight={700} fill="#ff9a52">
          {name}
        </text>
      )
    case 'nm-nebula':
      return (
        <>
          <defs>
            <linearGradient id={`${id}n`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff7ac1" />
              <stop offset="0.6" stopColor="#b49cec" />
              <stop offset="1" stopColor="#8f96ff" />
            </linearGradient>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}n)`}>
            {name}
          </text>
        </>
      )
    // Season 1's Pass+: an aurora's ribbon, softly lit.
    case 'nm-aurora':
      return (
        <>
          <defs>
            <linearGradient id={`${id}a`} x1="0" y1="0.3" x2="1" y2="0.7">
              <stop offset="0" stopColor="#5fe0c8" />
              <stop offset="0.34" stopColor="#5cc8ec" />
              <stop offset="0.68" stopColor="#a68cf2" />
              <stop offset="1" stopColor="#ff8fcf" />
            </linearGradient>
            <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}a)`} opacity="0.7" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}a)`}>
            {name}
          </text>
        </>
      )
    // A green readout, scanlines through it and a cursor after.
    case 'nm-telemetry':
      return (
        <>
          <defs>
            <pattern id={`${id}l`} width="4" height="3" patternUnits="userSpaceOnUse">
              <rect width="4" height="2" fill="#7dffaf" />
              <rect y="2" width="4" height="1" fill="#45d36b" />
            </pattern>
            <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          <text {...at} fontSize={size - 2} letterSpacing={0.5} fontFamily="ui-monospace, Consolas, monospace" fontWeight={700} fill="#45d36b" opacity="0.6" filter={`url(#${id}g)`}>
            {name}▌
          </text>
          <text {...at} fontSize={size - 2} letterSpacing={0.5} fontFamily="ui-monospace, Consolas, monospace" fontWeight={700} fill={`url(#${id}l)`}>
            {name}
            <tspan fill="#7dffaf" opacity="0.8">
              ▌
            </tspan>
          </text>
        </>
      )
    // Plus's: a rainbow, crisp, a faint white edge.
    case 'nm-prism':
      return (
        <>
          <defs>
            <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff5a6a" />
              <stop offset="0.2" stopColor="#ff9a3d" />
              <stop offset="0.4" stopColor="#ffe14d" />
              <stop offset="0.6" stopColor="#4fe07a" />
              <stop offset="0.8" stopColor="#4fa8ff" />
              <stop offset="1" stopColor="#b678ff" />
            </linearGradient>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}p)`} stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.5">
            {name}
          </text>
        </>
      )
    // Magenta into cyan, round a dark glow.
    case 'nm-wormhole':
      return (
        <>
          <defs>
            <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff5fd8" />
              <stop offset="0.35" stopColor="#b678ff" />
              <stop offset="0.65" stopColor="#4fe3ff" />
              <stop offset="1" stopColor="#ff5fd8" />
            </linearGradient>
            <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="#d65cd6" stroke="#d65cd6" strokeWidth="2" opacity="0.8" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="none" stroke="#12002a" strokeWidth="3.5" strokeLinejoin="round">
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}w)`}>
            {name}
          </text>
        </>
      )
    case 'nm-neon':
      return (
        <>
          <defs>
            <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="none" stroke="#ff5fa2" strokeWidth="3" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="#ffe3f1">
            {name}
          </text>
        </>
      )
    case 'nm-candy':
      return (
        <>
          <defs>
            <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff7ac1" />
              <stop offset="0.5" stopColor="#ffd36e" />
              <stop offset="1" stopColor="#7fc8ff" />
            </linearGradient>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}c)`}>
            {name}
          </text>
        </>
      )
    case 'nm-pixel':
      askForPixelFont()
      return (
        <text x={x} y={y} fontSize={size - 3} fontFamily="Silkscreen, ui-monospace, monospace" fill="#e7eef3">
          {name}
        </text>
      )
    case 'nm-retro':
      return (
        <>
          <text {...at} x={x + 2.4} y={y + 2.4} fontFamily={FONT} fontWeight={800} fill="#ff5fa2">
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="#ffe07a">
            {name}
          </text>
        </>
      )
    case 'nm-glitch':
      return (
        <>
          <text {...at} x={x - 1.6} fontFamily={FONT} fontWeight={800} fill="#ff3d6e" opacity="0.9">
            {name}
          </text>
          <text {...at} x={x + 1.6} fontFamily={FONT} fontWeight={800} fill="#2fd8ff" opacity="0.9">
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="#f4f7fb">
            {name}
          </text>
        </>
      )
    case 'nm-ember':
      return (
        <>
          <defs>
            <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe08a" />
              <stop offset="0.55" stopColor="#ff8a3d" />
              <stop offset="1" stopColor="#ff3d1f" />
            </linearGradient>
            <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
          </defs>
          <text {...at} fontFamily={FONT} fontWeight={800} fill="#ff5a1f" opacity="0.8" filter={`url(#${id}g)`}>
            {name}
          </text>
          <text {...at} fontFamily={FONT} fontWeight={800} fill={`url(#${id}e)`}>
            {name}
          </text>
        </>
      )
    default:
      return (
        <text {...at} fontFamily={FONT} fontWeight={800} fill="none" stroke="#e7eef3" strokeWidth="1.2">
          {name}
        </text>
      )
  }
}

/** A tag short enough for a shelf's little signs. */
function shelfTag(name: string) {
  const tag = name.trim().toUpperCase() || 'YOU'
  return tag.length > 7 ? tag.slice(0, 7) : tag
}

/** The prize standing on the counter's shelf, on a 160 × 130 stage, worn by `avatar`. */
function ShelfArt({ prize, avatar, name }: { prize: Prize; avatar: Avatar; name: string }) {
  const id = useSvgId('pz')
  const bare: Avatar = { ...avatar, ring: null, pin: null }
  const tag = shelfTag(name)
  switch (prize.kind) {
    case 'finish':
      return (
        <>
          <Shadow rx={34} />
          <path d="M58 126 H102 L97 116 H63 Z" fill="rgba(231,238,243,0.10)" stroke="rgba(231,238,243,0.22)" strokeWidth="1" />
          <rect x="76.5" y="96" width="7" height="21" rx="2" fill="rgba(231,238,243,0.13)" />
          <g transform="translate(35 13) scale(1.4)">
            <AvatarArt avatar={wearPrize(bare, 'finish', prize.id)} name={name} />
          </g>
        </>
      )
    case 'name':
      return (
        <>
          <Shadow rx={54} />
          <path d="M50 126 L56 100 M110 126 L104 100" stroke="#2a3a48" strokeWidth="4" strokeLinecap="round" />
          <rect x="12" y="58" width="136" height="46" rx="14" fill="#0f1820" stroke="rgba(231,238,243,0.16)" strokeWidth="1.2" />
          <g transform="translate(20 64) scale(0.5)">
            <AvatarArt avatar={bare} name={name} />
          </g>
          <StyledTag style={prize.id} name={tag} x={58} y={89} size={tag.length > 5 ? 17 : 22} id={id} />
        </>
      )
    case 'card':
      return (
        <>
          <Shadow rx={60} />
          <defs>
            <clipPath id={`${id}c`}>
              <rect x="8" y="24" width="144" height="90" rx="12" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}c)`}>
            <g transform="translate(8 24)">
              <ThemeDrawing theme={prize.id} w={144} h={90} s={SHELF_SCALE[prize.id] ?? 0.6} id={`${id}t`} />
            </g>
            <rect x="8" y="84" width="144" height="30" fill="rgba(8,12,18,0.6)" />
          </g>
          <rect x="8" y="24" width="144" height="90" rx="12" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          <g transform="translate(14 88) scale(0.36)">
            <AvatarArt avatar={bare} name={name} />
          </g>
          <text x="40" y="106" fontFamily={FONT} fontWeight={800} fontSize="13" letterSpacing="0.5" fill="#fff">
            {tag}
          </text>
          <rect x="98" y="97" width="46" height="10" rx="5" fill="rgba(255,255,255,0.14)" />
          <rect x="46" y="114" width="68" height="9" rx="3" fill="#243442" />
        </>
      )
    case 'confetti':
      return <Popper kind={prize.id} id={id} />
    case 'title':
      return <TitleOnShelf prize={prize} id={id} />
    default:
      return (
        <svg x="4" y="16" width={SIGN_W * 0.345} height={signHeight(true) * 0.345} viewBox={`0 0 ${SIGN_W} ${signHeight(true)}`} overflow="visible">
          <SignDrawing sign={prize.id} name={tag} id={id} wires />
        </svg>
      )
  }
}

/** A title's plate on its little stand: plain, enamel, or in lights, by what it cost. */
function TitleOnShelf({ prize, id }: { prize: Prize; id: string }) {
  const tier = plateTier(prize)
  const text = prize.name.toUpperCase()
  // As big as the plate allows: long titles come down a size or two.
  const size = Math.min(12, 112 / (text.length * 0.78))
  const words = (fill: string, extra?: object) => (
    <text x="80" y={84 + size * 0.36} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.12} fill={fill} {...extra}>
      {text}
    </text>
  )
  const stand = <path d="M48 126 L54 104 M112 126 L106 104" stroke="#2a3a48" strokeWidth="4" strokeLinecap="round" />
  if (tier === 'lit') {
    const bulbs = [18, 34, 50, 66, 82, 98, 114, 130, 146]
    return (
      <>
        <defs>
          <filter id={`${id}g`} x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Shadow rx={58} />
        {stand}
        <rect x="6" y="58" width="148" height="52" rx="12" fill="#170b1c" stroke="#ff5fa2" strokeWidth="1.6" filter={`url(#${id}g)`} />
        <rect x="6" y="58" width="148" height="52" rx="12" fill="#170b1c" />
        {bulbs.map((x) => (
          <g key={x}>
            <circle cx={x} cy="63.5" r="1.9" fill="#fff6dc" />
            <circle cx={x} cy="104.5" r="1.9" fill="#fff6dc" />
          </g>
        ))}
        {words('#ff5fa2', { filter: `url(#${id}g)`, opacity: 0.85 })}
        {words('#fff4fa')}
      </>
    )
  }
  if (tier === 'enamel') {
    return (
      <>
        <defs>
          <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a86c8" />
            <stop offset="1" stopColor="#1f5a92" />
          </linearGradient>
        </defs>
        <Shadow rx={58} />
        {stand}
        <rect x="8" y="62" width="144" height="44" rx="22" fill={`url(#${id}e)`} stroke="#a9d6f5" strokeWidth="2" />
        <path d="M24 66.5 H136" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" />
        {words('#ffffff')}
      </>
    )
  }
  return (
    <>
      <Shadow rx={58} />
      {stand}
      <rect x="8" y="62" width="144" height="44" rx="10" fill="#223140" stroke="#3c5062" strokeWidth="1.5" />
      <rect x="13" y="67" width="134" height="34" rx="7" fill="none" stroke="rgba(231,238,243,0.12)" strokeWidth="1" />
      <circle cx="17" cy="84" r="1.8" fill="#5d7285" />
      <circle cx="143" cy="84" r="1.8" fill="#5d7285" />
      {words('#e7eef3')}
    </>
  )
}

/** A heart around (0, 0), a unit tall. */
const HEART = 'M0 0.36C-0.12 0.26-0.56-0.04-0.56-0.34C-0.56-0.64-0.16-0.74 0-0.44C0.16-0.74 0.56-0.64 0.56-0.34C0.56-0.04 0.12 0.26 0 0.36Z'

/** Fireworks bursting over the shelf: rays out from a point, each with a spark at its end. */
function Fireworks() {
  const bursts: [number, number, number, string][] = [
    [102, 40, 30, '#ff5fa2'],
    [56, 30, 20, '#2fe3cf'],
    [124, 84, 16, '#ffd36e'],
  ]
  return (
    <>
      <Shadow rx={20} />
      <path d="M80 124 Q84 90 100 46 M72 124 Q66 76 58 34" fill="none" stroke="rgba(255,230,190,0.35)" strokeWidth="1.6" strokeDasharray="2 4" strokeLinecap="round" />
      {bursts.map(([cx, cy, r, c]) => (
        <g key={cx}>
          <circle cx={cx} cy={cy} r={r * 0.9} fill={c} opacity="0.1" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            const x0 = cx + Math.cos(a) * r * 0.28
            const y0 = cy + Math.sin(a) * r * 0.28
            const x1 = cx + Math.cos(a) * r
            const y1 = cy + Math.sin(a) * r
            return (
              <g key={i}>
                <path d={`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`} stroke={c} strokeWidth="1.8" strokeLinecap="round" />
                <circle cx={x1 + Math.cos(a) * 3} cy={y1 + Math.sin(a) * 3} r="1.3" fill="#fff" />
              </g>
            )
          })}
          <circle cx={cx} cy={cy} r="2.2" fill="#fff" />
        </g>
      ))}
    </>
  )
}

/** Meteors falling over the shelf, down to the right: where each head is, how long its tail, how thick. */
const METEORS: [number, number, number, number][] = [
  [116, 60, 62, 4.2],
  [70, 38, 44, 3.2],
  [142, 100, 46, 3.4],
  [58, 98, 34, 2.6],
  [104, 20, 24, 2.2],
]
const METEOR_SPARKS: [number, number, number][] = [
  [92, 36, 1.3],
  [99, 48, 0.9],
  [52, 24, 1.1],
  [124, 82, 1.2],
  [42, 84, 0.9],
  [86, 8, 0.8],
]

/** A meteor shower over the shelf: fireballs with burning tails, white-hot at the head, sparks shed behind. */
function Meteors({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8564f" stopOpacity="0" />
          <stop offset="0.5" stopColor="#f2813a" stopOpacity="0.6" />
          <stop offset="0.88" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#fff6e0" />
        </linearGradient>
        <radialGradient id={`${id}h`}>
          <stop offset="0" stopColor="#ffd68c" stopOpacity="0.8" />
          <stop offset="0.4" stopColor="#f2813a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f2813a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Shadow rx={22} />
      {METEOR_SPARKS.map(([x, y, r], i) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={i % 2 ? '#f5b942' : '#ffe7a3'} />
      ))}
      {METEORS.map(([x, y, len, r]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(36)`}>
          <path d={`M${-len} 0L0 ${-r}L0 ${r}Z`} fill={`url(#${id}m)`} />
          <circle r={r * 3} fill={`url(#${id}h)`} />
          <circle r={r} fill="#fff6e0" />
          <circle r={r * 0.55} fill="#ffffff" />
        </g>
      ))}
    </>
  )
}

/** A drop of water around (0, 0), its point up, `s` across. */
function dropPath(s: number) {
  return `M0 ${(-s * 1.6).toFixed(2)}C${(s * 0.9).toFixed(2)} ${(-s * 0.3).toFixed(2)} ${(s * 0.9).toFixed(2)} ${s.toFixed(2)} 0 ${s.toFixed(2)}C${(-s * 0.9).toFixed(2)} ${s.toFixed(2)} ${(-s * 0.9).toFixed(2)} ${(-s * 0.3).toFixed(2)} 0 ${(-s * 1.6).toFixed(2)}Z`
}

/** A parachute with its capsule hanging under it, the canopy's middle at (0, 0) and `r` across half of it. */
function Parachute({ r, colour }: { r: number; colour: string }) {
  const gore = (a: number, b: number) =>
    `M0 ${-0.75 * r}Q${a * 0.85 * r} ${-0.62 * r} ${a * r} 0L${b * r} 0Q${b * 0.85 * r} ${-0.62 * r} 0 ${-0.75 * r}Z`
  const top = 1.25 * r
  const foot = top + 0.45 * r
  return (
    <>
      <path d={`M${-r} 0L0 ${top}L${r} 0M${-0.3 * r} 0L0 ${top}L${0.3 * r} 0`} stroke="#d9dde8" strokeWidth={Math.max(0.5, r * 0.04)} fill="none" opacity="0.8" />
      <path d={`M${-r} 0A${r} ${0.75 * r} 0 0 1 ${r} 0Z`} fill={colour} />
      <path d={`${gore(-0.6, -0.2)}${gore(0.2, 0.6)}`} fill="#ffffff" opacity="0.92" />
      <path d={`M${-0.13 * r} ${top}H${0.13 * r}L${0.36 * r} ${foot}H${-0.36 * r}Z`} fill="#e8ecf4" />
      <path d={`M${-0.36 * r} ${foot}Q0 ${foot + 0.18 * r} ${0.36 * r} ${foot}Z`} fill="#6a4a36" />
      <circle cx={0.06 * r} cy={top + 0.22 * r} r={0.06 * r} fill="#2a3a5a" />
    </>
  )
}

const SPLASH_CHUTES: [number, number, number, string][] = [
  [50, 30, 17, '#f2813a'],
  [110, 20, 12, '#e8564f'],
  [128, 64, 10, '#f2813a'],
]

/** Splashdown on the shelf: parachutes coming down with their capsules, and one landed in a splash. */
function Splashdown() {
  const rnd = seeded(44)
  const drops: ReactNode[] = []
  for (let i = 0; i < 14; i++) {
    const a = ((-155 + (i / 13) * 130 + (rnd() - 0.5) * 10) * Math.PI) / 180
    const d = 10 + rnd() * 16
    const x = 70 + Math.cos(a) * d * 1.3
    const y = 110 + Math.sin(a) * d
    const c = ['#ffffff', '#cfeaff', '#7fc8ff'][i % 3]!
    drops.push(<path key={i} d={dropPath(1.3 + rnd() * 1.3)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((a * 180) / Math.PI - 90).toFixed(0)})`} fill={c} />)
  }
  return (
    <>
      <ellipse cx="72" cy="119" rx="56" ry="8" fill="#2a6fd0" opacity="0.55" />
      <ellipse cx="70" cy="117" rx="20" ry="3.6" fill="none" stroke="#bfe6ff" strokeWidth="1.2" opacity="0.8" />
      <ellipse cx="70" cy="117" rx="32" ry="5.6" fill="none" stroke="#bfe6ff" strokeWidth="0.9" opacity="0.45" />
      <path d="M62 116Q64 104 66 113Q70 98 74 113Q76 104 78 116Z" fill="#cfeaff" opacity="0.85" />
      {drops}
      {SPLASH_CHUTES.map(([x, y, r, c]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${x > 100 ? 6 : -5})`}>
          <Parachute r={r} colour={c} />
        </g>
      ))}
    </>
  )
}

const POPPER_SEEDS: Record<string, number> = { 'cf-tickets': 3, 'cf-stars': 9, 'cf-hearts': 14, 'cf-pixels': 5, 'cf-stardust': 31, 'cf-shooting': 17 }

/** A four-point sparkle, for Stardust and the shooting stars. */
function sparkle4(x: number, y: number, s: number) {
  const k = s * 0.18
  return `M${x.toFixed(1)} ${(y - s).toFixed(1)}Q${(x + k).toFixed(1)} ${(y - k).toFixed(1)} ${(x + s).toFixed(1)} ${y.toFixed(1)}Q${(x + k).toFixed(1)} ${(y + k).toFixed(1)} ${x.toFixed(1)} ${(y + s).toFixed(1)}Q${(x - k).toFixed(1)} ${(y + k).toFixed(1)} ${(x - s).toFixed(1)} ${y.toFixed(1)}Q${(x - k).toFixed(1)} ${(y - k).toFixed(1)} ${x.toFixed(1)} ${(y - s).toFixed(1)}Z`
}
const PIXEL_COLOURS = ['#2fe3cf', '#ff4fa8', '#ffd23f', '#6c8cff', '#b86bff', '#45d36b']

/** The party popper itself: its cone, striped, and its open mouth. */
function PopperCone() {
  return (
    <>
      <Shadow rx={26} />
      <path d="M42 124 L58 84 L86 104 Z" fill="#e85d9a" />
      <path d="M48.5 108 L54 94.4 L62.4 100.5 Z M45.2 116.4 L47 112 L52 115.6 Z" fill="#ffd36e" opacity="0.9" />
      <ellipse cx="72" cy="94" rx="17" ry="6" transform="rotate(36 72 94)" fill="#ffb8d6" />
    </>
  )
}

/** Where each streamer curls out of the popper's mouth, and its colour; then the squares of confetti among them. */
const STREAMERS: [string, string][] = [
  ['M74 90C70 72 90 72 86 56S70 40 84 28S108 24 104 10', '#ff4fa8'],
  ['M78 92C92 80 104 90 112 76S112 56 128 54S146 60 150 42', '#2fe3cf'],
  ['M75 88C72 74 58 70 56 56S64 38 52 26', '#ffd23f'],
  ['M80 95C98 98 108 108 124 100S140 86 154 92', '#6c8cff'],
  ['M77 89C86 74 100 72 100 58S94 44 110 34S124 30 128 18', '#b86bff'],
]
const STREAMER_BITS: [number, number, number, string][] = [
  [42, 40, 20, '#2fe3cf'],
  [120, 30, -15, '#ff4fa8'],
  [140, 74, 35, '#ffd23f'],
  [96, 42, 50, '#ff8552'],
  [64, 18, -30, '#6c8cff'],
  [134, 112, 10, '#b86bff'],
]

/** Paper streamers curling out of the popper, each twisting as it goes, and a few squares of confetti. */
function Streamers() {
  return (
    <>
      {STREAMERS.map(([d, c]) => (
        <g key={c}>
          <path d={d} fill="none" stroke={c} strokeWidth="3.6" />
          <path d={d} fill="none" stroke="#000000" strokeWidth="3.6" strokeDasharray="5 9" opacity="0.2" />
        </g>
      ))}
      <PopperCone />
      {STREAMER_BITS.map(([x, y, rot, c]) => (
        <rect key={`${x}-${y}`} x={x - 2.5} y={y - 2.5} width="5" height="5" fill={c} transform={`rotate(${rot} ${x} ${y})`} />
      ))}
    </>
  )
}

/** A party popper going off in its confetti: stars, bubbles, hearts, pixels or tickets. Fireworks go up on their own, meteors fall, parachutes come down, and streamers curl out of it. */
function Popper({ kind, id }: { kind: string; id: string }) {
  if (kind === 'cf-fireworks') return <Fireworks />
  if (kind === 'cf-meteors') return <Meteors id={id} />
  if (kind === 'cf-splashdown') return <Splashdown />
  if (kind === 'cf-streamers') return <Streamers />
  const rnd = seeded(POPPER_SEEDS[kind] ?? 21)
  const bits: ReactNode[] = []
  for (let i = 0; i < 15; i++) {
    const a = ((-105 + rnd() * 110) * Math.PI) / 180
    const d = 24 + rnd() * 50
    const x = 74 + d * Math.cos(a)
    const y = 90 + d * Math.sin(a)
    const rot = Math.floor(rnd() * 360)
    if (kind === 'cf-tickets') {
      bits.push(
        <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})`}>
          <path d={ticketPath(-7, -4, 14, 8, 1.4, 1.2)} fill={`url(#${id}t)`} />
          <path d="M-3 -2.2V2.2" stroke="#3a1406" strokeWidth="0.8" strokeDasharray="1 1" opacity="0.5" />
        </g>,
      )
    } else if (kind === 'cf-stars') {
      const c = ['#f5b942', '#2fe3cf', '#ff7ac1', '#7fc8ff'][Math.floor(rnd() * 4)]!
      bits.push(<path key={i} d={star5(x, y, 4 + rnd() * 3.5, rot)} fill={c} />)
    } else if (kind === 'cf-hearts') {
      const c = ['#ff5f7a', '#ff7ac1', '#e24139', '#ffb3c7'][Math.floor(rnd() * 4)]!
      const size = 9 + rnd() * 6
      bits.push(<path key={i} d={HEART} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(rot % 60) - 30}) scale(${size.toFixed(1)})`} fill={c} />)
    } else if (kind === 'cf-pixels') {
      const c = PIXEL_COLOURS[Math.floor(rnd() * PIXEL_COLOURS.length)]!
      const size = 4 + Math.floor(rnd() * 3) * 1.5
      bits.push(<rect key={i} x={Math.round(x)} y={Math.round(y)} width={size} height={size} fill={c} />)
    } else if (kind === 'cf-stardust') {
      const c = ['#f5b942', '#ffe7a3', '#b9a6f0', '#f2813a'][Math.floor(rnd() * 4)]!
      bits.push(<path key={i} d={sparkle4(x, y, 3.5 + rnd() * 3.5)} fill={c} />)
    } else if (kind === 'cf-snowfall' || kind === 'cf-flurry') {
      // Season 2's: snowflakes, and in a flurry a few more, swept round.
      const c = ['#ffffff', '#dff2ff', '#bfe6ff'][Math.floor(rnd() * 3)]!
      const fx = kind === 'cf-flurry' ? x + Math.sin(i) * 10 : x
      bits.push(<path key={i} d={flakeStrokes(fx, y, 3.5 + rnd() * 3, rot)} fill="none" stroke={c} strokeWidth="1.2" strokeLinecap="round" />)
      if (kind === 'cf-flurry') bits.push(<circle key={`d${i}`} cx={x - 8} cy={y + 6} r="1.4" fill="#ffffff" opacity="0.8" />)
    } else if (kind === 'cf-snowballs') {
      if (i % 2 === 0) {
        const r = 4 + rnd() * 3.5
        bits.push(
          <g key={i}>
            <circle cx={x - r * 1.4} cy={y + r * 0.8} r={r * 0.45} fill="#eaf4fc" opacity="0.5" />
            <circle cx={x} cy={y} r={r} fill="#ffffff" stroke="#a9c8e4" strokeWidth="1" />
          </g>,
        )
      }
    } else if (kind === 'cf-icicles') {
      if (i % 2 === 0) {
        const len = 12 + rnd() * 9
        bits.push(<path key={i} d={`M${(x - 2.6).toFixed(1)} ${(y - len).toFixed(1)}H${(x + 2.6).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}Z`} fill="#dff4ff" stroke="#4aa8e8" strokeWidth="0.8" />)
      }
    } else if (kind === 'cf-shooting') {
      if (i % 3 === 0) {
        const c = ['#ffffff', '#ffe7a3', '#b9a6f0'][Math.floor(rnd() * 3)]!
        bits.push(
          <g key={i}>
            <path d={`M${(x - 22).toFixed(1)} ${(y + 9).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`} stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
            <path d={sparkle4(x, y, 4.5)} fill="#ffffff" />
          </g>,
        )
      }
    } else {
      const c = ['#7fc8ff', '#2fe3cf', '#b3d7ff'][Math.floor(rnd() * 3)]!
      const r = 3.5 + rnd() * 5
      bits.push(
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={c} fillOpacity="0.16" stroke={c} strokeWidth="1.3" />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#fff" opacity="0.8" />
        </g>,
      )
    }
  }
  return (
    <>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffa477" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
      </defs>
      <PopperCone />
      <path d="M74 88 C 80 70, 70 62, 84 50" fill="none" stroke="#2fe3cf" strokeWidth="2" strokeLinecap="round" />
      <path d="M80 92 C 100 86, 96 70, 116 66" fill="none" stroke="#ff7ac1" strokeWidth="2" strokeLinecap="round" />
      {bits}
    </>
  )
}

/** A prize as it stands on the counter's shelf, worn by the player looking at it. */
export function PrizeArt({ prize, avatar, name, width = 150, className }: { prize: Prize | string; avatar: Avatar; name: string; width?: number; className?: string }) {
  const p = typeof prize === 'string' ? prizeById(prize) : prize
  if (!p) return null
  return (
    <svg className={className} viewBox="0 0 160 130" width={width} height={(width * 130) / 160} aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      <ShelfArt prize={p} avatar={avatar} name={name} />
    </svg>
  )
}
