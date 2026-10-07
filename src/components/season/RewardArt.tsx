import { useId, type ReactNode } from 'react'
import { prizeById } from '../../data/prizes'
import type { Avatar, AvatarBadge } from '../../lib/avatars'
import { AvatarArt } from '../PlayerAvatar'
import { ThemeDrawing } from '../prizes/CardThemes'
import { FROST, SPACE, sparklePath } from '../../lib/seasonArt'
import greenFlashPicture from '../../assets/season/green-flash.webp'
import moonBuggyPicture from '../../assets/season/moon-buggy.webp'
import rocketCarPicture from '../../assets/season/rocket-car.webp'
import shuttleCarPicture from '../../assets/season/shuttle-car.webp'
import bobsledPicture from '../../assets/season/bobsled.webp'
import auroraGliderPicture from '../../assets/season/aurora-glider.webp'
import crystalCarPicture from '../../assets/season/crystal-car.webp'
import snowSwiftPicture from '../../assets/season/swoop-snow-swift.webp'
import penguinPicture from '../../assets/season/swoop-penguin.webp'
import auroraPhoenixPicture from '../../assets/season/swoop-aurora-phoenix.webp'
import snowballPicture from '../../assets/season/marblerun-snowball.webp'
import iceMarblePicture from '../../assets/season/marblerun-ice-marble.webp'
import polarNightPicture from '../../assets/season/marblerun-polar-night.webp'
import iceCubesPicture from '../../assets/season/pileup-ice-cubes.webp'
import knittedPicture from '../../assets/season/pileup-knitted.webp'
import northernLightsPicture from '../../assets/season/pileup-northern-lights.webp'
import {
  AURORA_TAIL,
  FIRESIDE_TAIL,
  FROST_DRAGON,
  GONDOLA,
  ICE_BREAKER,
  ICE_CRYSTAL,
  ICICLE,
  NORTH_STAR,
  SNOWBIRD,
  SNOWDRIFT_TAIL,
  SNOWY_OWL,
  YETI,
  CANDY_TAIL,
  COMET_SHIP,
  COMET_TAIL,
  EAGLE,
  GOLD_LANDER,
  PAPER_PLANE,
  RETRO_WEDGE,
  NEBULA_TAIL,
  NOVA_FIGHTER,
  ORBITER,
  RINGSHIP,
  SATURN_TAIL,
  SHUTTLE,
  STARHOPPER,
  STINGRAY,
  type SkinArt,
  type SnakeTail,
} from '../../lib/skinArt'
import { FrostPatch } from './ColdSnapArt'
import { ArtShapes, MissionPatch, Moonhopper, Rocket } from './SeasonArt'
import { SeasonPatch } from './SeasonLook'
import { WINTER_LOOKS_DRAW } from './WinterRewardArt'

/*
 * A picture for each of Season 1's pass rewards, on a 100-wide board, for the
 * pass's tiles, the level-up panel and the skins card. The rewards themselves
 * (what each is, at which level) come from the API's season; this only draws
 * them, by id, and falls back to the season's patch for one it doesn't know.
 */

function Board({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {children}
    </svg>
  )
}

function Spark({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return <path d={sparklePath(x, y, s)} fill={c} />
}

function Ticket({ x, y, fill }: { x: number; y: number; fill: string }) {
  return <path d={`M${x} ${y}h64v12a6 6 0 0 0 0 12v12H${x}v-12a6 6 0 0 0 0-12z`} fill={fill} />
}

function Tickets({ amount }: { amount: number }) {
  return (
    <>
      <g transform="rotate(-16 50 50)">
        <Ticket x={18} y={32} fill="#e8564f" />
      </g>
      <g transform="rotate(-5 50 50)">
        <Ticket x={18} y={32} fill="#f2813a" />
      </g>
      <g transform="rotate(7 50 50)">
        <Ticket x={18} y={32} fill="#f5b942" />
        <text x="50" y="57" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="19" fill="#7a4e00">
          +{amount}
        </text>
      </g>
    </>
  )
}

function NamePlate({ fill, children }: { fill: string; children: ReactNode }) {
  return (
    <>
      <rect x="4" y="26" width="92" height="48" rx="10" fill={fill} />
      {children}
    </>
  )
}

/** Season 2's titles (Cold Snap), whose plates are its colours: a polar night edged in aurora green. */
const WINTER_TITLES = new Set(['t-cold-snap', 't-snow-day', 't-hot-cocoa', 't-first-frost', 't-snow-bunny', 't-snow-angel', 't-ice-cold', 't-polar-explorer', 't-cold-legend', 't-snowbound'])

function Title({ text, id }: { text: string; id?: string }) {
  // A title too long for one line of the plate (Space Race Legend, Founding Member) goes on two, split at its last space.
  const cut = text.length > 14 ? text.lastIndexOf(' ') : -1
  const look = id && WINTER_TITLES.has(id) ? { plate: FROST.night, edge: FROST.green, ink: FROST.snow } : { plate: SPACE.night, edge: SPACE.orange, ink: SPACE.star }
  return (
    <>
      <polygon points="11,34 89,34 96,41 96,59 89,66 11,66 4,59 4,41" fill={look.plate} stroke={look.edge} strokeWidth="2" />
      {cut > 0 ? (
        <text textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={600} fontSize="12" fill={look.ink}>
          <tspan x="50" y="48">
            {text.slice(0, cut)}
          </tspan>
          <tspan x="50" y="61">
            {text.slice(cut + 1)}
          </tspan>
        </text>
      ) : (
        <text x="50" y="55" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={600} fontSize={text.length > 10 ? 12 : 14} fill={look.ink}>
          {text}
        </text>
      )}
    </>
  )
}

function Lander() {
  return <Moonhopper />
}

export function CometShip() {
  return (
    <>
      <ArtShapes shapes={COMET_SHIP.flame} />
      <ArtShapes shapes={COMET_SHIP.body} />
    </>
  )
}

export function NovaFighter() {
  return (
    <>
      <ArtShapes shapes={NOVA_FIGHTER.flame} />
      <ArtShapes shapes={NOVA_FIGHTER.body} />
    </>
  )
}

/**
 * A skin's picture rendered from its game's own drawing, once in a browser, and kept as a file: a Hot Lap car
 * (car.ts, seasonCars.ts) from behind and above as the game's camera sees it, a Swoop bird, a Marble Run marble,
 * Pileup's blocks. Re-render it if the drawing changes, so the pass never shows another look than the one you play.
 */
export function RenderedSkin({ picture = rocketCarPicture }: { picture?: string }) {
  return <image href={picture} x="0" y="0" width="100" height="100" />
}

/** A ship skin's picture from its game's own drawing (lib/skinArt.ts), with its flame or without. */
function ShipArt({ art, flame = true }: { art: SkinArt; flame?: boolean }) {
  return (
    <>
      {flame ? <ArtShapes shapes={art.flame} /> : null}
      <ArtShapes shapes={art.body} />
    </>
  )
}

// The Comet tail's path on the board, head last: one bead every 12, as Snake lays one every spacing.
const SNAKE: [number, number][] = [[18, 78], [30, 78], [42, 78], [54, 78], [66, 78], [66, 66], [66, 54], [54, 54], [42, 54], [30, 54], [30, 42], [30, 30], [42, 30], [54, 30], [66, 30]]

/** A bead tail's picture (Snake's skins), drawn as Snake draws it. */
function BeadTail({ tail, spark }: { tail: SnakeTail; spark: string }) {
  const step = 12
  const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`
  return (
    <>
      {SNAKE.map(([x, y], i) => {
        const bead = tail.bead((SNAKE.length - 1 - i) / (SNAKE.length - 1))
        return <circle key={i} cx={x} cy={y} r={(bead.r * step).toFixed(1)} fill={rgb(bead.rgb)} opacity={bead.alpha.toFixed(2)} />
      })}
      <circle cx="80" cy="30" r={tail.glow * step} fill={rgb(tail.glowColor)} opacity="0.3" />
      <circle cx="80" cy="30" r={tail.head * step} fill={rgb(tail.headFill)} stroke={rgb(tail.headRing)} strokeWidth="2" />
      {tail.planetRing ? (
        <ellipse cx="80" cy="30" rx={tail.head * step * 1.6} ry={tail.head * step * 0.42} transform="rotate(-20 80 30)" fill="none" stroke={rgb(tail.planetRing)} strokeWidth="1.8" />
      ) : null}
      <circle cx="83" cy="26" r="1.8" fill={tail.eyes} />
      <circle cx="83" cy="34" r="1.8" fill={tail.eyes} />
      <Spark x={20} y={30} s={5} c={spark} />
    </>
  )
}

export function CometTail() {
  return <BeadTail tail={COMET_TAIL} spark={SPACE.orange} />
}

function FinishArt({ badge, size }: { badge: AvatarBadge; size: number }) {
  const avatar: Avatar = { kind: 'mono', letters: 1, pattern: 'plain', body: 4, detail: 0, badge, ring: null, pin: null }
  return (
    <svg width={size} height={size} viewBox="-2 0 68 68" aria-hidden="true">
      <AvatarArt avatar={avatar} name="ACE" />
    </svg>
  )
}

function CardArt({ theme, size }: { theme: string; size: number }) {
  const id = `ra${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Board size={size}>
      <defs>
        <clipPath id={`${id}c`}>
          <rect x="8" y="20" width="84" height="60" rx="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <g transform="translate(8 20)">
          <ThemeDrawing theme={theme} w={84} h={60} s={0.45} id={`${id}t`} />
        </g>
      </g>
      <rect x="8" y="20" width="84" height="60" rx="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </Board>
  )
}

const DRAW: Record<string, (size: number) => ReactNode> = {
  's1': (size) => <MissionPatch label="S1" size={size} />,
  's2': (size) => <FrostPatch label="S2" size={size} />,
  'nm-starlight': (size) => (
    <Board size={size}>
      <NamePlate fill={SPACE.night}>
        <text x="50" y="61" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="24" fill="#ffffff">
          ACE
        </text>
        <Spark x={14} y={36} s={5} c={SPACE.amber} />
        <Spark x={86} y={64} s={4} c={SPACE.star} />
        <Spark x={80} y={34} s={3} c={SPACE.orange} />
      </NamePlate>
    </Board>
  ),
  'nm-countdown': (size) => (
    <Board size={size}>
      <NamePlate fill="#0b0f1a">
        <text x="50" y="60" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={700} fontSize="22" letterSpacing="2" fill={SPACE.orange}>
          ACE
        </text>
        <path d="M18 66h64" stroke={SPACE.orange} strokeWidth="1.5" strokeDasharray="3 3" />
      </NamePlate>
    </Board>
  ),
  'nm-nebula': (size) => (
    <Board size={size}>
      <NamePlate fill="#1a1240">
        <text x="50" y="61" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="24" fill="#e85d9a" stroke={SPACE.violet} strokeWidth="3" paintOrder="stroke">
          ACE
        </text>
      </NamePlate>
    </Board>
  ),
  // The finishes and card themes are drawn as they are worn (PlayerAvatar, CardThemes).
  orbit: (size) => <FinishArt badge="orbit" size={size} />,
  ringed: (size) => <FinishArt badge="ringed" size={size} />,
  mission: (size) => <FinishArt badge="mission" size={size} />,
  supernova: (size) => <FinishArt badge="supernova" size={size} />,
  'cd-deepfield': (size) => <CardArt theme="cd-deepfield" size={size} />,
  'cd-launchpad': (size) => <CardArt theme="cd-launchpad" size={size} />,
  'cd-nebula': (size) => <CardArt theme="cd-nebula" size={size} />,
  'cf-stardust': (size) => (
    <Board size={size}>
      {([[20, 22, 6, SPACE.amber], [56, 16, 4, SPACE.violet], [80, 30, 7, SPACE.orange], [34, 48, 5, SPACE.indigo], [66, 54, 6, SPACE.amber], [16, 76, 5, SPACE.violet], [48, 80, 7, SPACE.orange], [84, 80, 4, SPACE.indigo]] as const).map(([x, y, s, c]) => (
        <Spark key={`${x}-${y}`} x={x} y={y} s={s} c={c} />
      ))}
    </Board>
  ),
  'cf-shooting': (size) => (
    <Board size={size}>
      {([[16, 30, SPACE.amber], [44, 18, SPACE.orange], [30, 62, SPACE.violet], [60, 50, SPACE.amber], [56, 82, SPACE.indigo]] as const).map(([x, y, c]) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x} ${y} l26 -12`} stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
          <Spark x={x + 28} y={y - 13} s={5} c={c} />
        </g>
      ))}
    </Board>
  ),
  'sign-liftoff': (size) => (
    <Board size={size}>
      <rect x="5" y="22" width="90" height="56" rx="8" fill={SPACE.night} stroke={SPACE.orange} strokeWidth="2.5" />
      <Rocket x={26} y={52} scale={0.95} turn={30} />
      <text x="64" y="48" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="13" fill={SPACE.star}>
        LIFT
      </text>
      <text x="64" y="65" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="13" fill={SPACE.orange}>
        OFF
      </text>
    </Board>
  ),
  // Its Pass+ row's looks.
  'nm-aurora': (size) => (
    <Board size={size}>
      <NamePlate fill="#0b1030">
        <path d="M6 36C24 28 40 40 60 32S86 26 94 32" fill="none" stroke="#5fe0c8" strokeWidth="5" strokeLinecap="round" opacity="0.3" />
        <path d="M6 68C22 62 44 72 64 66S88 62 94 66" fill="none" stroke={SPACE.violet} strokeWidth="5" strokeLinecap="round" opacity="0.35" />
        <text x="50" y="61" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="24" stroke="#0b1030" strokeWidth="3" paintOrder="stroke">
          <tspan fill="#5fe0c8">A</tspan>
          <tspan fill="#a68cf2">C</tspan>
          <tspan fill="#ff8fcf">E</tspan>
        </text>
      </NamePlate>
    </Board>
  ),
  eclipse: (size) => <FinishArt badge="eclipse" size={size} />,
  'cd-mission': (size) => <CardArt theme="cd-mission" size={size} />,
  'cf-meteors': (size) => (
    <Board size={size}>
      {([[10, 12, 40, 5, SPACE.orange], [52, 20, 30, 3.8, SPACE.amber], [24, 50, 36, 4.4, SPACE.red], [62, 60, 26, 3.2, SPACE.orange]] as const).map(([x, y, len, r, c]) => (
        <g key={`${x}-${y}`} transform={`translate(${x + len * 0.81} ${y + len * 0.59}) rotate(36)`}>
          <path d={`M${-len} 0L0 ${-r}L0 ${r}Z`} fill={c} opacity="0.6" />
          <path d={`M${-len * 0.45} 0L0 ${-r * 0.6}L0 ${r * 0.6}Z`} fill={SPACE.amber} />
          <circle r={r * 2.2} fill={SPACE.amber} opacity="0.3" />
          <circle r={r} fill="#fff6e0" />
        </g>
      ))}
      <circle cx="40" cy="26" r="1.4" fill={SPACE.amber} />
      <circle cx="74" cy="44" r="1.2" fill="#ffe7a3" />
      <circle cx="46" cy="70" r="1.3" fill={SPACE.amber} />
    </Board>
  ),
  'nm-telemetry': (size) => (
    <Board size={size}>
      <NamePlate fill="#04140c">
        <text x="14" y="60" fontFamily="ui-monospace, Consolas, monospace" fontWeight={700} fontSize="20" fill="#45d36b" opacity="0.6">
          &gt;
        </text>
        <text x="48" y="61" textAnchor="middle" fontFamily="ui-monospace, Consolas, monospace" fontWeight={700} fontSize="24" fill="#7dffaf">
          ACE
        </text>
        <rect x="72" y="44" width="9" height="19" fill="#7dffaf" opacity="0.8" />
        <path d="M4 30h92M4 33h92M4 36h92M4 39h92M4 42h92M4 45h92M4 48h92M4 51h92M4 54h92M4 57h92M4 60h92M4 63h92M4 66h92M4 69h92" stroke="#000000" strokeWidth="1" opacity="0.25" />
      </NamePlate>
    </Board>
  ),
  'nm-wormhole': (size) => (
    <Board size={size}>
      <NamePlate fill="#0d0618">
        <ellipse cx="50" cy="50" rx="40" ry="18" fill="none" stroke="#ff5fd8" strokeWidth="2" opacity="0.4" transform="rotate(-12 50 50)" />
        <ellipse cx="50" cy="50" rx="28" ry="12" fill="none" stroke="#b678ff" strokeWidth="2" opacity="0.45" transform="rotate(10 50 50)" />
        <ellipse cx="50" cy="50" rx="16" ry="7" fill="none" stroke="#4fe3ff" strokeWidth="2" opacity="0.5" transform="rotate(-20 50 50)" />
        <text x="50" y="61" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="24" stroke="#12002a" strokeWidth="4" paintOrder="stroke">
          <tspan fill="#ff5fd8">A</tspan>
          <tspan fill="#b678ff">C</tspan>
          <tspan fill="#4fe3ff">E</tspan>
        </text>
      </NamePlate>
    </Board>
  ),
  'cd-porthole': (size) => <CardArt theme="cd-porthole" size={size} />,
  'cd-station': (size) => <CardArt theme="cd-station" size={size} />,
  'blue-marble': (size) => <FinishArt badge="blue-marble" size={size} />,
  'black-hole': (size) => <FinishArt badge="black-hole" size={size} />,
  'cf-splashdown': (size) => (
    <Board size={size}>
      {([[34, 24, 16, SPACE.orange], [70, 38, 12, SPACE.red]] as const).map(([x, y, r, c]) => (
        <g key={x}>
          <path d={`M${x - r} ${y}L${x} ${y + r * 1.25}L${x + r} ${y}`} fill="none" stroke="#d9dde8" strokeWidth="0.8" />
          <path d={`M${x - r} ${y}A${r} ${r * 0.75} 0 0 1 ${x + r} ${y}Z`} fill={c} />
          <path d={`M${x - r * 0.35} ${y}A${r * 0.35} ${r * 0.75} 0 0 1 ${x + r * 0.35} ${y}Z`} fill="#ffffff" />
          <path d={`M${x - r * 0.13} ${y + r * 1.25}H${x + r * 0.13}L${x + r * 0.36} ${y + r * 1.7}H${x - r * 0.36}Z`} fill="#e8ecf4" />
        </g>
      ))}
      <ellipse cx="52" cy="86" rx="40" ry="6" fill="#4aa8e8" opacity="0.6" />
      <path d="M44 85Q46 72 49 82Q52 66 55 82Q58 72 60 85Z" fill="#cfeaff" />
      {([[38, 72, 2.2], [44, 64, 1.8], [62, 62, 2], [68, 72, 2.2], [52, 58, 1.6], [32, 80, 1.6], [74, 80, 1.6]] as const).map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={x % 3 ? '#ffffff' : '#7fc8ff'} />
      ))}
    </Board>
  ),
  // Plus's monthly looks: the arcade's own colours, not the season's.
  'nm-prism': (size) => (
    <Board size={size}>
      <NamePlate fill="#14101e">
        {(['#ff5a6a', '#ff9a3d', '#ffe14d', '#4fe07a', '#4fa8ff', '#b678ff'] as const).map((c, i) => (
          <rect key={c} x={14 + i * 12} y="66" width="12" height="3" fill={c} />
        ))}
        <text x="50" y="59" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="26" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.5">
          <tspan fill="#ff7a5a">A</tspan>
          <tspan fill="#ffe14d">C</tspan>
          <tspan fill="#4fa8ff">E</tspan>
        </text>
      </NamePlate>
    </Board>
  ),
  'cd-snowglobe': (size) => <CardArt theme="cd-snowglobe" size={size} />,
  // Season 2's looks (Cold Snap): finishes and card themes as they're worn, the rest in WinterRewardArt.tsx.
  snowflake: (size) => <FinishArt badge="snowflake" size={size} />,
  igloo: (size) => <FinishArt badge="igloo" size={size} />,
  snowman: (size) => <FinishArt badge="snowman" size={size} />,
  blizzard: (size) => <FinishArt badge="blizzard" size={size} />,
  'polar-bear': (size) => <FinishArt badge="polar-bear" size={size} />,
  'diamond-dust': (size) => <FinishArt badge="diamond-dust" size={size} />,
  'ice-crown': (size) => <FinishArt badge="ice-crown" size={size} />,
  'cd-snowfield': (size) => <CardArt theme="cd-snowfield" size={size} />,
  'cd-ski-lodge': (size) => <CardArt theme="cd-ski-lodge" size={size} />,
  'cd-pine-forest': (size) => <CardArt theme="cd-pine-forest" size={size} />,
  'cd-frozen-lake': (size) => <CardArt theme="cd-frozen-lake" size={size} />,
  'cd-ice-cave': (size) => <CardArt theme="cd-ice-cave" size={size} />,
  'cd-northern-lights': (size) => <CardArt theme="cd-northern-lights" size={size} />,
  ...WINTER_LOOKS_DRAW,
  'cf-streamers': (size) => (
    <Board size={size}>
      {([['M8 30C24 18 30 42 46 30S66 16 82 26S94 36 96 32', '#ff4fa8'], ['M6 58C22 48 34 70 52 58S72 44 92 56', '#2fe3cf'], ['M30 8C26 24 46 28 42 44S30 62 40 76S58 86 54 96', '#ffd23f'], ['M60 6C66 20 80 18 78 34S66 50 76 62', '#6c8cff']] as const).map(([d, c]) => (
        <g key={c}>
          <path d={d} fill="none" stroke={c} strokeWidth="4.5" />
          <path d={d} fill="none" stroke="#000000" strokeWidth="4.5" strokeDasharray="6 10" opacity="0.22" />
        </g>
      ))}
      {([[20, 80, 20, '#b86bff'], [70, 82, -25, '#ff8552'], [86, 12, 40, '#ffd23f'], [14, 16, -10, '#2fe3cf']] as const).map(([x, y, rot, c]) => (
        <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" fill={c} transform={`rotate(${rot} ${x} ${y})`} />
      ))}
    </Board>
  ),
  'lander-moonhopper': (size) => (
    <Board size={size}>
      <Lander />
    </Board>
  ),
  'asteroids-comet': (size) => (
    <Board size={size}>
      <CometShip />
    </Board>
  ),
  'barrage-nova': (size) => (
    <Board size={size}>
      <NovaFighter />
    </Board>
  ),
  'hotlap-rocket': (size) => (
    <Board size={size}>
      <RenderedSkin />
    </Board>
  ),
  'snake-comet-tail': (size) => (
    <Board size={size}>
      <CometTail />
    </Board>
  ),
  // Season 1's Pass+ skins.
  'asteroids-shuttle': (size) => (
    <Board size={size}>
      <ShipArt art={SHUTTLE} />
    </Board>
  ),
  'lander-eagle': (size) => (
    <Board size={size}>
      <ShipArt art={EAGLE} flame={false} />
    </Board>
  ),
  'barrage-ringship': (size) => (
    <Board size={size}>
      <ShipArt art={RINGSHIP} />
    </Board>
  ),
  'snake-nebula-tail': (size) => (
    <Board size={size}>
      <BeadTail tail={NEBULA_TAIL} spark="#5fe0c8" />
    </Board>
  ),
  'hotlap-midnight': (size) => (
    <Board size={size}>
      <RenderedSkin picture={moonBuggyPicture} />
    </Board>
  ),
  'hotlap-sunracer': (size) => (
    <Board size={size}>
      <RenderedSkin picture={shuttleCarPicture} />
    </Board>
  ),
  'barrage-stingray': (size) => (
    <Board size={size}>
      <ShipArt art={STINGRAY} />
    </Board>
  ),
  'snake-saturn-tail': (size) => (
    <Board size={size}>
      <BeadTail tail={SATURN_TAIL} spark={SPACE.amber} />
    </Board>
  ),
  'asteroids-orbiter': (size) => (
    <Board size={size}>
      <ShipArt art={ORBITER} />
    </Board>
  ),
  'lander-starhopper': (size) => (
    <Board size={size}>
      <ShipArt art={STARHOPPER} flame={false} />
    </Board>
  ),
  // Season 2's skins (Cold Snap), free row then Pass+. Its Lander, Asteroids and Barrage ones sit the season out
  // (lib/skins.ts) but keep their pictures here for a later one.
  'lander-icebreaker': (size) => (
    <Board size={size}>
      <ShipArt art={ICE_BREAKER} flame={false} />
    </Board>
  ),
  'asteroids-icicle': (size) => (
    <Board size={size}>
      <ShipArt art={ICICLE} />
    </Board>
  ),
  'barrage-snowbird': (size) => (
    <Board size={size}>
      <ShipArt art={SNOWBIRD} />
    </Board>
  ),
  'swoop-snow-swift': (size) => (
    <Board size={size}>
      <RenderedSkin picture={snowSwiftPicture} />
    </Board>
  ),
  'marblerun-snowball': (size) => (
    <Board size={size}>
      <RenderedSkin picture={snowballPicture} />
    </Board>
  ),
  'pileup-ice-cubes': (size) => (
    <Board size={size}>
      <RenderedSkin picture={iceCubesPicture} />
    </Board>
  ),
  'swoop-penguin': (size) => (
    <Board size={size}>
      <RenderedSkin picture={penguinPicture} />
    </Board>
  ),
  'swoop-aurora-phoenix': (size) => (
    <Board size={size}>
      <RenderedSkin picture={auroraPhoenixPicture} />
    </Board>
  ),
  'marblerun-ice-marble': (size) => (
    <Board size={size}>
      <RenderedSkin picture={iceMarblePicture} />
    </Board>
  ),
  'marblerun-polar-night': (size) => (
    <Board size={size}>
      <RenderedSkin picture={polarNightPicture} />
    </Board>
  ),
  'pileup-knitted': (size) => (
    <Board size={size}>
      <RenderedSkin picture={knittedPicture} />
    </Board>
  ),
  'pileup-northern-lights': (size) => (
    <Board size={size}>
      <RenderedSkin picture={northernLightsPicture} />
    </Board>
  ),
  'hotlap-ice-rocket': (size) => (
    <Board size={size}>
      <RenderedSkin picture={bobsledPicture} />
    </Board>
  ),
  'snake-snowdrift-tail': (size) => (
    <Board size={size}>
      <BeadTail tail={SNOWDRIFT_TAIL} spark={FROST.green} />
    </Board>
  ),
  'asteroids-ice-crystal': (size) => (
    <Board size={size}>
      <ShipArt art={ICE_CRYSTAL} />
    </Board>
  ),
  'lander-gondola': (size) => (
    <Board size={size}>
      <ShipArt art={GONDOLA} flame={false} />
    </Board>
  ),
  'hotlap-whiteout': (size) => (
    <Board size={size}>
      <RenderedSkin picture={crystalCarPicture} />
    </Board>
  ),
  'barrage-snowy-owl': (size) => (
    <Board size={size}>
      <ShipArt art={SNOWY_OWL} />
    </Board>
  ),
  'asteroids-north-star': (size) => (
    <Board size={size}>
      <ShipArt art={NORTH_STAR} />
    </Board>
  ),
  'snake-aurora-tail': (size) => (
    <Board size={size}>
      <BeadTail tail={AURORA_TAIL} spark={FROST.violet} />
    </Board>
  ),
  'hotlap-borealis': (size) => (
    <Board size={size}>
      <RenderedSkin picture={auroraGliderPicture} />
    </Board>
  ),
  'snake-fireside-tail': (size) => (
    <Board size={size}>
      <BeadTail tail={FIRESIDE_TAIL} spark={FROST.amber} />
    </Board>
  ),
  'barrage-frost-dragon': (size) => (
    <Board size={size}>
      <ShipArt art={FROST_DRAGON} />
    </Board>
  ),
  'lander-yeti': (size) => (
    <Board size={size}>
      <ShipArt art={YETI} flame={false} />
    </Board>
  ),
  // The Hangar's: for good, traded for tickets.
  'hotlap-green-flash': (size) => (
    <Board size={size}>
      <RenderedSkin picture={greenFlashPicture} />
    </Board>
  ),
  'lander-gold': (size) => (
    <Board size={size}>
      <ShipArt art={GOLD_LANDER} flame={false} />
    </Board>
  ),
  'asteroids-retro': (size) => (
    <Board size={size}>
      <ShipArt art={RETRO_WEDGE} />
    </Board>
  ),
  'barrage-paper-plane': (size) => (
    <Board size={size}>
      <ShipArt art={PAPER_PLANE} flame={false} />
    </Board>
  ),
  'snake-candy-stripe': (size) => (
    <Board size={size}>
      <BeadTail tail={CANDY_TAIL} spark="#e84054" />
    </Board>
  ),
}

export type RewardLike = { kind: string; id?: string; name: string; amount?: number }

export function RewardArt({ reward, size }: { reward: RewardLike; size: number }) {
  if (reward.kind === 'tickets') {
    return (
      <Board size={size}>
        <Tickets amount={reward.amount ?? 0} />
      </Board>
    )
  }
  // A title: its plate. The pass sends titles as prizes, so the catalogue says which they are.
  if (reward.kind === 'title' || (reward.kind === 'prize' && reward.id && prizeById(reward.id)?.kind === 'title')) {
    return (
      <Board size={size}>
        <Title text={reward.name} id={reward.id} />
      </Board>
    )
  }
  const draw = reward.id ? DRAW[reward.id] : undefined
  return draw ? <>{draw(size)}</> : <SeasonPatch size={size} />
}
