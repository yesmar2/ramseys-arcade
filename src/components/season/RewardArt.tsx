import type { ReactNode } from 'react'
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

/** The player's own badge, D on teal as a stand-in, inside a finish. */
function Badge({ children, over }: { children?: ReactNode; over?: ReactNode }) {
  return (
    <>
      {children}
      <circle cx="50" cy="50" r="32" fill="#2eb8a0" />
      <text x="50" y="62" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={700} fontSize="34" fill="#0f2a26">
        A
      </text>
      {over}
    </>
  )
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

function Card({ fill, children }: { fill: string; children?: ReactNode }) {
  return (
    <>
      <rect x="10" y="18" width="80" height="64" rx="9" fill={fill} />
      {children}
    </>
  )
}

const DRAW: Record<string, (size: number) => ReactNode> = {
  's1-patch': (size) => <MissionPatch label="S1" size={size} />,
  's1-starlight': (size) => (
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
  's1-countdown': (size) => (
    <Board size={size}>
      <NamePlate fill="#0b0f1a">
        <text x="50" y="60" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={700} fontSize="22" letterSpacing="2" fill={SPACE.orange}>
          ACE
        </text>
        <path d="M18 66h64" stroke={SPACE.orange} strokeWidth="1.5" strokeDasharray="3 3" />
      </NamePlate>
    </Board>
  ),
  's1-nebula': (size) => (
    <Board size={size}>
      <NamePlate fill="#1a1240">
        <text x="50" y="61" textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize="24" fill="#e85d9a" stroke={SPACE.violet} strokeWidth="3" paintOrder="stroke">
          ACE
        </text>
      </NamePlate>
    </Board>
  ),
  's1-orbit': (size) => (
    <Board size={size}>
      <Badge over={<circle cx="81" cy="19" r="7" fill={SPACE.star} stroke={SPACE.muted} strokeWidth="1.5" />}>
        <circle cx="50" cy="50" r="44" fill="none" stroke={SPACE.indigo} strokeWidth="2.5" />
        <circle cx="50" cy="50" r="38" fill="none" stroke={SPACE.night} strokeWidth="5" />
      </Badge>
    </Board>
  ),
  's1-ringed': (size) => (
    <Board size={size}>
      <Badge over={<path d="M2 52 A48 14 0 0 0 98 52" fill="none" stroke={SPACE.amber} strokeWidth="6" transform="rotate(-18 50 52)" />}>
        <ellipse cx="50" cy="52" rx="48" ry="14" fill="none" stroke={SPACE.brass} strokeWidth="6" transform="rotate(-18 50 52)" />
      </Badge>
    </Board>
  ),
  's1-patch-ring': (size) => (
    <Board size={size}>
      <Badge>
        <circle cx="50" cy="50" r="42" fill="none" stroke={SPACE.orange} strokeWidth="9" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="#fff0e6" strokeWidth="1.4" strokeDasharray="2 3" />
        <circle cx="50" cy="50" r="47" fill="none" stroke={SPACE.night} strokeWidth="1.5" />
      </Badge>
    </Board>
  ),
  's1-shine': (size) => (
    <Board size={size}>
      <Badge over={<Spark x={82} y={16} s={8} c={SPACE.amber} />}>
        <circle cx="50" cy="50" r="42" fill="none" stroke={SPACE.violet} strokeWidth="9" strokeDasharray="33 33" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={SPACE.orange} strokeWidth="9" strokeDasharray="33 33" strokeDashoffset="33" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={SPACE.amber} strokeWidth="9" strokeDasharray="12 120" strokeDashoffset="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={SPACE.indigo} strokeWidth="9" strokeDasharray="12 120" strokeDashoffset="74" />
      </Badge>
    </Board>
  ),
  's1-deep-field': (size) => (
    <Board size={size}>
      <Card fill={SPACE.night}>
        {[[20, 28], [34, 44], [56, 26], [74, 40], [26, 64], [48, 58], [80, 70], [62, 72], [16, 46]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill={SPACE.star} />
        ))}
        <circle cx="70" cy="58" r="10" fill={SPACE.violet} />
        <ellipse cx="70" cy="58" rx="17" ry="4" fill="none" stroke={SPACE.amber} strokeWidth="1.8" transform="rotate(-15 70 58)" />
        <Spark x={30} y={32} s={4} c={SPACE.amber} />
      </Card>
    </Board>
  ),
  's1-launch-pad': (size) => (
    <Board size={size}>
      <Card fill={SPACE.panel}>
        <rect x="10" y="70" width="80" height="12" fill={SPACE.line} />
        <path d="M24 70 h52" stroke={SPACE.orange} strokeWidth="2" />
        <Rocket x={50} y={46} />
        <circle cx="38" cy="70" r="6" fill={SPACE.star} opacity="0.8" />
        <circle cx="62" cy="70" r="7" fill={SPACE.star} opacity="0.8" />
        <circle cx="50" cy="73" r="6" fill={SPACE.star} opacity="0.9" />
      </Card>
    </Board>
  ),
  's1-nebula-card': (size) => (
    <Board size={size}>
      <Card fill="#2a1650">
        <circle cx="36" cy="44" r="18" fill="#e85d9a" opacity="0.35" />
        <circle cx="58" cy="56" r="20" fill={SPACE.violet} opacity="0.45" />
        <circle cx="66" cy="36" r="12" fill={SPACE.indigo} opacity="0.4" />
        <Spark x={44} y={50} s={5} c={SPACE.star} />
      </Card>
    </Board>
  ),
  's1-stardust': (size) => (
    <Board size={size}>
      {([[20, 22, 6, SPACE.amber], [56, 16, 4, SPACE.violet], [80, 30, 7, SPACE.orange], [34, 48, 5, SPACE.indigo], [66, 54, 6, SPACE.amber], [16, 76, 5, SPACE.violet], [48, 80, 7, SPACE.orange], [84, 80, 4, SPACE.indigo]] as const).map(([x, y, s, c]) => (
        <Spark key={`${x}-${y}`} x={x} y={y} s={s} c={c} />
      ))}
    </Board>
  ),
  's1-shooting-stars': (size) => (
    <Board size={size}>
      {([[16, 30, SPACE.amber], [44, 18, SPACE.orange], [30, 62, SPACE.violet], [60, 50, SPACE.amber], [56, 82, SPACE.indigo]] as const).map(([x, y, c]) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x} ${y} l26 -12`} stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
          <Spark x={x + 28} y={y - 13} s={5} c={c} />
        </g>
      ))}
    </Board>
  ),
  's1-liftoff-sign': (size) => (
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
