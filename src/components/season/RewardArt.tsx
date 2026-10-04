import { useId, type ReactNode } from 'react'
import { prizeById } from '../../data/prizes'
import type { Avatar, AvatarBadge } from '../../lib/avatars'
import { AvatarArt } from '../PlayerAvatar'
import { ThemeDrawing } from '../prizes/CardThemes'
import { SPACE, sparklePath } from '../../lib/seasonArt'
import midnightRocketPicture from '../../assets/season/midnight-rocket.webp'
import rocketCarPicture from '../../assets/season/rocket-car.webp'
import { COMET_SHIP, COMET_TAIL, EAGLE, NEBULA_TAIL, NOVA_FIGHTER, RINGSHIP, SHUTTLE, type SkinArt, type SnakeTail } from '../../lib/skinArt'
import { ArtShapes, MissionPatch, Moonhopper, Rocket } from './SeasonArt'

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

function Title({ text }: { text: string }) {
  return (
    <>
      <polygon points="11,34 89,34 96,41 96,59 89,66 11,66 4,59 4,41" fill={SPACE.night} stroke={SPACE.orange} strokeWidth="2" />
      <text x="50" y="55" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={600} fontSize={text.length > 10 ? 12 : 14} fill={SPACE.star}>
        {text}
      </text>
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
 * The Rocket car: a picture of Hot Lap's own 3D model (car.ts buildRocketCar), from behind and above as the
 * game's camera sees it, rendered once in a browser (WebGL) and kept as a file. Re-render it if the car
 * changes, so the pass never shows another car than the one you drive.
 */
export function RocketCar({ picture = rocketCarPicture }: { picture?: string }) {
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
        <path d="M4 48C24 36 40 54 60 42S86 30 96 38" fill="none" stroke="#5fe0c8" strokeWidth="9" opacity="0.18" />
        <path d="M4 60C22 50 44 66 64 54S88 46 96 52" fill="none" stroke={SPACE.violet} strokeWidth="8" opacity="0.22" />
        <text x="50" y="61" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="24">
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
      <RocketCar />
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
      <RocketCar picture={midnightRocketPicture} />
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
        <Title text={reward.name} />
      </Board>
    )
  }
  const draw = reward.id ? DRAW[reward.id] : undefined
  return draw ? <>{draw(size)}</> : <MissionPatch size={size} />
}
