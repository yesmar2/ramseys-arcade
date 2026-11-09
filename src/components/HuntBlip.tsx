import type { ReactNode } from 'react'

/*
 * The Blips of the daily hunt (Ramsey, 2026-11-09: "instead of bugs maybe we do different types of blips to
 * find", then "i wanted this to be the blips not the bugs"). Ten of them, drawn as on the "Blip hunt: easier to
 * find" canvas: all the same round Blip as BlipFigure draws him, never cut, told apart by colour and what's on
 * top of his head, so a head poking over an edge is enough to say which one it is.
 */

export type HuntBlipPose = 'wave' | 'cheer' | 'sit' | 'stand'
export type HuntBlipMood = 'smile' | 'sleepy' | 'o' | 'open'

type Look = {
  body: string
  shade: string
  feet: string
  cheek: string
  /** The highlight's strength: a pale Blip takes more. */
  shine: number
  /** What's on top of his head, in colour; with `ink` alone, one flat colour for a not-caught-yet outline. */
  top: (ink?: string) => ReactNode
  /** Drawn over the body: a pebble's speckles. */
  over?: () => ReactNode
  /** Always sleepy-eyed, unless cheering. */
  sleepy?: boolean
}

const INK = '#0f2f2a'

const LOOKS: Record<string, Look> = {
  blip: {
    body: '#34c6a8',
    shade: '#1f9b84',
    feet: '#167a69',
    cheek: '#ff8fb3',
    shine: 0.35,
    top: (ink) => (
      <>
        {ink ? null : <circle cx="0" cy="-7.98" r="2.7" fill="#9ff7e2" opacity="0.45" />}
        <circle cx="0" cy="-7.98" r={ink ? 1.4 : 0.95} fill={ink ?? '#f2fffb'} />
      </>
    ),
  },
  ember: {
    body: '#ff8a4c',
    shade: '#e0602a',
    feet: '#b84a1c',
    cheek: '#ffd0b8',
    shine: 0.35,
    top: (ink) => (
      <>
        <path d="M0 -11.2 C1.9 -9.2 1.7 -7.3 0 -6.3 C-1.7 -7.3 -1.9 -9.2 0 -11.2 Z" fill={ink ?? '#ffb02e'} />
        {ink ? null : <path d="M0 -9.4 C0.9 -8.4 0.8 -7.5 0 -6.9 C-0.8 -7.5 -0.9 -8.4 0 -9.4 Z" fill="#fff3c4" />}
      </>
    ),
  },
  frost: {
    body: '#8fd3ff',
    shade: '#5aa9e0',
    feet: '#3f83b8',
    cheek: '#ff8fb3',
    shine: 0.45,
    top: (ink) => (
      <g stroke={ink ?? '#ffffff'} strokeWidth={ink ? 0.8 : 0.55} strokeLinecap="round">
        <line x1="0" y1="-10.6" x2="0" y2="-6.4" />
        <line x1="-1.82" y1="-9.55" x2="1.82" y2="-7.45" />
        <line x1="-1.82" y1="-7.45" x2="1.82" y2="-9.55" />
      </g>
    ),
  },
  berry: {
    body: '#ff7fae',
    shade: '#e0568a',
    feet: '#b83d6b',
    cheek: '#ffd6e6',
    shine: 0.35,
    top: (ink) => (
      <path
        d="M0 -6.7 C-2.6 -8.3 -2.1 -10.5 -0.9 -10.45 C-0.35 -10.4 0 -10 0 -9.6 C0 -10 0.35 -10.4 0.9 -10.45 C2.1 -10.5 2.6 -8.3 0 -6.7 Z"
        fill={ink ?? '#ffffff'}
      />
    ),
  },
  sunny: {
    body: '#ffe45c',
    shade: '#f0c419',
    feet: '#b8920f',
    cheek: '#ff9f7a',
    shine: 0.45,
    top: (ink) => (
      <>
        <circle cx="0" cy="-8.4" r="1.15" fill={ink ?? '#fff6c9'} />
        <g stroke={ink ?? '#fff6c9'} strokeWidth="0.5" strokeLinecap="round">
          <line x1="0" y1="-10.8" x2="0" y2="-10.1" />
          <line x1="2.3" y1="-8.4" x2="1.7" y2="-8.4" />
          <line x1="-2.3" y1="-8.4" x2="-1.7" y2="-8.4" />
          <line x1="1.65" y1="-10.05" x2="1.2" y2="-9.6" />
          <line x1="-1.65" y1="-10.05" x2="-1.2" y2="-9.6" />
        </g>
      </>
    ),
  },
  moss: {
    body: '#7bc950',
    shade: '#579c33',
    feet: '#3e7524',
    cheek: '#ff8fb3',
    shine: 0.35,
    top: (ink) => (
      <>
        <path d="M0 -6 L0 -8.6" stroke={ink ?? '#3e7524'} strokeWidth="0.55" strokeLinecap="round" />
        <path d="M0 -8.4 C-0.4 -10 -2.2 -10.3 -2.7 -9.6 C-2.1 -8.6 -0.8 -8.3 0 -8.4 Z" fill={ink ?? '#a6e07a'} />
        <path d="M0 -8.6 C0.4 -10.5 2.5 -10.8 2.9 -10.1 C2.3 -8.9 0.9 -8.5 0 -8.6 Z" fill={ink ?? '#a6e07a'} />
      </>
    ),
  },
  dusk: {
    body: '#9b8cff',
    shade: '#7563e8',
    feet: '#4d3db8',
    cheek: '#ff8fb3',
    shine: 0.35,
    sleepy: true,
    top: (ink) => (
      <path d="M0 -10.9 L0.5 -8.9 L2.3 -8.4 L0.5 -7.9 L0 -6.5 L-0.5 -7.9 L-2.3 -8.4 L-0.5 -8.9 Z" fill={ink ?? '#fff3a8'} />
    ),
  },
  bolt: {
    body: '#4c8dff',
    shade: '#2f6ad8',
    feet: '#2150a8',
    cheek: '#ff8fb3',
    shine: 0.35,
    top: (ink) => <path d="M0.7 -11.2 L-1.4 -8.2 L-0.1 -8.2 L-0.8 -6.1 L1.5 -9.1 L0.2 -9.1 Z" fill={ink ?? '#ffe14d'} />,
  },
  pebble: {
    body: '#aab5c0',
    shade: '#86929e',
    feet: '#5f6b77',
    cheek: '#ff8fb3',
    shine: 0.35,
    top: (ink) => (
      <>
        {ink ? null : <circle cx="0" cy="-7.98" r="2.4" fill="#ffffff" opacity="0.22" />}
        <circle cx="0" cy="-7.98" r={ink ? 1.4 : 0.95} fill={ink ?? '#f2f5f7'} />
      </>
    ),
    over: () => (
      <g fill="#76828e">
        <circle cx="3.7" cy="-1.6" r="0.5" />
        <circle cx="4.9" cy="0.5" r="0.32" />
        <circle cx="-4.9" cy="-0.4" r="0.4" />
        <circle cx="2.2" cy="-4.2" r="0.32" />
      </g>
    ),
  },
  cloud: {
    body: '#f4f7fb',
    shade: '#d2dce6',
    feet: '#9fb0c0',
    cheek: '#ff8fb3',
    shine: 0,
    top: (ink) => (
      <g fill="none" strokeWidth={ink ? 0.7 : 0.55}>
        <path d="M-2.3 -7.1 A2.3 2.3 0 0 1 2.3 -7.1" stroke={ink ?? '#ff7a7a'} />
        <path d="M-1.75 -7.1 A1.75 1.75 0 0 1 1.75 -7.1" stroke={ink ?? '#ffd45c'} />
        <path d="M-1.2 -7.1 A1.2 1.2 0 0 1 1.2 -7.1" stroke={ink ?? '#6fd3ff'} />
      </g>
    ),
  },
}

/** Square boxes round him: a portrait, and the peek, where the top 58% shows (BugHunt.tsx SHOWN) and holds his eyes. */
const PORTRAIT_BOX = '-11.5 -12 23 23'
const PEEK_BOX = '-12.5 -11.6 25 25'

function Face({ mood, sleepy }: { mood: HuntBlipMood; sleepy: boolean }) {
  if (mood === 'open') {
    return (
      <>
        <path d="M-2.9 1.1 Q-1.9 -0.2 -0.9 1.1" fill="none" stroke={INK} strokeWidth="0.55" strokeLinecap="round" />
        <path d="M0.9 1.1 Q1.9 -0.2 2.9 1.1" fill="none" stroke={INK} strokeWidth="0.55" strokeLinecap="round" />
        <path d="M-1.6 3.4 Q0 5.3 1.6 3.4 Z" fill={INK} />
      </>
    )
  }
  const eyes =
    sleepy || mood === 'sleepy' ? (
      <>
        <path d="M-2.9 0.6 Q-1.9 1.75 -0.9 0.6" fill="none" stroke={INK} strokeWidth="0.6" strokeLinecap="round" />
        <path d="M0.9 0.6 Q1.9 1.75 2.9 0.6" fill="none" stroke={INK} strokeWidth="0.6" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse cx="-1.89" cy="1.05" rx="0.95" ry="1.58" fill={INK} />
        <ellipse cx="1.89" cy="1.05" rx="0.95" ry="1.58" fill={INK} />
        <circle cx="-1.58" cy="0.32" r="0.36" fill="#fff" />
        <circle cx="2.2" cy="0.32" r="0.36" fill="#fff" />
      </>
    )
  return (
    <>
      {eyes}
      {mood === 'o' ? (
        <ellipse cx="0" cy="3.9" rx="0.75" ry="0.85" fill={INK} />
      ) : (
        <path d="M-1.26 3.57 Q0 4.73 1.26 3.57" fill="none" stroke={INK} strokeWidth="0.47" strokeLinecap="round" />
      )}
    </>
  )
}

/** His arms: one raised in a wave, both up in a cheer, none sitting or standing. */
function Arms({ pose, fill }: { pose: HuntBlipPose; fill: string }) {
  if (pose === 'wave') {
    return <ellipse cx="-6.3" cy="-1.9" rx="1.25" ry="2.4" fill={fill} transform="rotate(-35 -6.3 -1.9)" />
  }
  if (pose === 'cheer') {
    return (
      <>
        <ellipse cx="-6.3" cy="-1.9" rx="1.25" ry="2.4" fill={fill} transform="rotate(-35 -6.3 -1.9)" />
        <ellipse cx="6.3" cy="-1.9" rx="1.25" ry="2.4" fill={fill} transform="rotate(35 6.3 -1.9)" />
      </>
    )
  }
  return null
}

/**
 * One of the hunt's Blips. `silhouette`: one not caught yet, his shape and what's on his head in one flat
 * colour, the element's CSS `color`. `peek`: framed for peeking out from behind something, his eyes in the top
 * part that shows.
 */
export function HuntBlip({
  kind,
  size,
  pose = 'wave',
  mood = 'smile',
  silhouette = false,
  peek = false,
  className,
}: {
  kind: string
  /** Its width and height in CSS pixels; the stylesheet may show it at another size. */
  size: number
  pose?: HuntBlipPose
  mood?: HuntBlipMood
  silhouette?: boolean
  peek?: boolean
  className?: string
}) {
  const look = LOOKS[kind] ?? LOOKS.blip!
  const flat = silhouette ? 'currentColor' : null
  return (
    <svg
      className={className}
      viewBox={peek ? PEEK_BOX : PORTRAIT_BOX}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {look.top(flat ?? undefined)}
      <ellipse cx="-2.31" cy="8.82" rx="1.79" ry="0.95" fill={flat ?? look.feet} />
      <ellipse cx="2.31" cy="8.82" rx="1.79" ry="0.95" fill={flat ?? look.feet} />
      <Arms pose={pose} fill={flat ?? look.body} />
      <circle cx="0" cy="1.26" r="7.35" fill={flat ?? look.body} />
      {flat ? null : (
        <>
          <path d="M-5.88 4.2 A7.35 7.35 0 0 0 5.88 4.2 A8.4 6.3 0 0 1 -5.88 4.2 Z" fill={look.shade} />
          {look.shine ? (
            <ellipse cx="-2.52" cy="-2.94" rx="2.52" ry="1.26" fill="#fff" opacity={look.shine} transform="rotate(-24 -2.52 -2.94)" />
          ) : null}
          {look.over?.()}
          <Face mood={mood} sleepy={Boolean(look.sleepy) && pose !== 'cheer'} />
          <ellipse cx="-3.57" cy="3.15" rx="0.95" ry="0.53" fill={look.cheek} opacity="0.7" />
          <ellipse cx="3.57" cy="3.15" rx="0.95" ry="0.53" fill={look.cheek} opacity="0.7" />
        </>
      )}
    </svg>
  )
}
