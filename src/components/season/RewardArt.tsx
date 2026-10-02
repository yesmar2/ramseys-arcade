import { useId, type ReactNode } from 'react'
import type { Avatar, AvatarBadge } from '../../lib/avatars'
import { AvatarArt } from '../PlayerAvatar'
import { ThemeDrawing } from '../prizes/CardThemes'
import { SPACE, sparklePath } from '../../lib/seasonArt'
import { MissionPatch, Moonhopper, Rocket } from './SeasonArt'

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
      <path d="M42 76 L50 96 L58 76z" fill={SPACE.orange} />
      <path d="M46 76 L50 88 L54 76z" fill={SPACE.amber} />
      <path d="M50 12 L74 84 L50 72 L26 84 Z" fill={SPACE.amber} stroke="#7a4e00" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 30 L58 58 L50 54 L42 58z" fill={SPACE.night} />
    </>
  )
}

export function NovaFighter() {
  return (
    <>
      <path d="M44 80 L50 94 L56 80z" fill={SPACE.orange} />
      <path d="M50 10 L62 50 L82 68 L62 68 L58 80 L42 80 L38 68 L18 68 L38 50 Z" fill={SPACE.star} stroke={SPACE.violet} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="50" cy="46" rx="5" ry="10" fill="#2eb8a0" />
      <circle cx="28" cy="64" r="3" fill={SPACE.violet} />
      <circle cx="72" cy="64" r="3" fill={SPACE.violet} />
    </>
  )
}

export function RocketCar() {
  return (
    <>
      <path d="M40 88 L50 100 L60 88z" fill={SPACE.orange} />
      <path d="M44 88 L50 96 L56 88z" fill={SPACE.amber} />
      <rect x="26" y="80" width="48" height="8" rx="2" fill={SPACE.night} />
      <rect x="20" y="60" width="13" height="20" rx="3" fill="#1a2233" />
      <rect x="67" y="60" width="13" height="20" rx="3" fill="#1a2233" />
      <rect x="23" y="22" width="11" height="16" rx="3" fill="#1a2233" />
      <rect x="66" y="22" width="11" height="16" rx="3" fill="#1a2233" />
      <path d="M45 12 Q50 4 55 12 L57 40 Q65 47 64 62 L62 80 L38 80 L36 62 Q35 47 43 40 Z" fill={SPACE.star} />
      <rect x="27" y="14" width="46" height="6" rx="2" fill={SPACE.night} />
      <rect x="48" y="10" width="4" height="70" fill={SPACE.red} />
      <ellipse cx="50" cy="54" rx="6" ry="9" fill="#0b0f1a" />
      <path d="M43 47 Q50 40 57 47" fill="none" stroke={SPACE.night} strokeWidth="2.5" />
    </>
  )
}

const SNAKE: [number, number][] = [[18, 78], [30, 78], [42, 78], [54, 78], [66, 78], [66, 66], [66, 54], [54, 54], [42, 54], [30, 54], [30, 42], [30, 30], [42, 30], [54, 30], [66, 30]]

export function CometTail() {
  return (
    <>
      {SNAKE.map(([x, y], i) => {
        const k = i / (SNAKE.length - 1)
        return <circle key={i} cx={x} cy={y} r={(3.4 + k * 3.4).toFixed(1)} fill={k < 0.5 ? SPACE.violet : SPACE.amber} opacity={(0.35 + k * 0.65).toFixed(2)} />
      })}
      <circle cx="80" cy="30" r="15" fill={SPACE.amber} opacity="0.3" />
      <circle cx="80" cy="30" r="9" fill="#ffffff" stroke={SPACE.amber} strokeWidth="2" />
      <circle cx="83" cy="26" r="1.8" fill={SPACE.night} />
      <circle cx="83" cy="34" r="1.8" fill={SPACE.night} />
      <Spark x={20} y={30} s={5} c={SPACE.orange} />
    </>
  )
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
  if (reward.kind === 'title') {
    return (
      <Board size={size}>
        <Title text={reward.name} />
      </Board>
    )
  }
  const draw = reward.id ? DRAW[reward.id] : undefined
  return draw ? <>{draw(size)}</> : <MissionPatch size={size} />
}
