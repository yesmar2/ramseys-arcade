import type { CSSProperties, ReactNode } from 'react'
import { GameArt } from './GameArt'
import { CardBackdrop } from './prizes/PrizeArt'
import '../styles/playerCard.css'

/*
 * A player's trading card, full art: their background from the prize counter fills it (or, without one, the
 * picture of their best game), their avatar in the middle, and along the foot their tag, a line about them and
 * a place for each period. The edge is gold for a top-three place. Ramsey picked the full-art card from the
 * "Player card hero redesign" canvas (T1, then H2 + P2, 2026-10-20); the profile's card (PlayerCard.tsx) stands
 * it on its own sky, and the prize counter's fitting room shows it trying things on.
 */

/** The card's drawing size: a trading card's 5 × 7. The backgrounds draw to fit any size (PrizeArt ThemeDrawing). */
const CARD_W = 300
const CARD_H = 420

/** The background behind a card: their card theme, else their best game's picture, else nothing (the accent wash). */
export function CardArt({ theme, game, className, wide = false }: { theme: string | null; game: string | null; className?: string; wide?: boolean }) {
  if (theme) {
    return wide ? (
      <CardBackdrop className={className} theme={theme} width={1600} height={640} scale={1.5} />
    ) : (
      <CardBackdrop className={className} theme={theme} width={CARD_W} height={CARD_H} scale={1.1} />
    )
  }
  return game ? <GameArt slug={game} shape="card" className={className} /> : null
}

export function FullArtCard({
  name,
  theme,
  game,
  avatar,
  chip,
  corner,
  line,
  pips,
  gold = false,
  className,
  style,
}: {
  /** The tag, drawn in its name style by the caller (`name` is a node). */
  name: ReactNode
  theme: string | null
  /** Without a theme: the slug of the game whose picture fills the card. */
  game: string | null
  /** The avatar, drawn by the caller: a button to the studio on your own card. */
  avatar: ReactNode
  /** Top left: the place on screen. */
  chip?: ReactNode
  /** Top right: Plus, for a member. */
  corner?: ReactNode
  /** Under the tag: what they're best at. */
  line?: ReactNode
  /** Along the foot: a place for each period. */
  pips?: ReactNode
  gold?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`fac${gold ? ' fac--gold' : ''}${theme ? '' : game ? ' fac--game' : ' fac--plain'}${className ? ` ${className}` : ''}`} style={style}>
      <CardArt className="fac__art" theme={theme} game={game} />
      <span className="fac__fade" aria-hidden="true" />
      {chip || corner ? (
        <span className="fac__top">
          {chip ? <span className="fac__chip">{chip}</span> : <span />}
          {corner ? <span className="fac__chip fac__chip--corner">{corner}</span> : null}
        </span>
      ) : null}
      <span className="fac__avatar">{avatar}</span>
      <span className="fac__foot">
        <span className="fac__name">{name}</span>
        {line ? <span className="fac__line">{line}</span> : null}
        {pips ? <span className="fac__pips">{pips}</span> : null}
      </span>
    </div>
  )
}
