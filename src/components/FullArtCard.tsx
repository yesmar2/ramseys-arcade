import type { CSSProperties, ReactNode } from 'react'
import { CardStars } from './CardStars'
import { CardBackdrop } from './prizes/PrizeArt'
import '../styles/playerCard.css'

/*
 * A player's trading card, full art: their background from the prize counter fills it (or, without one, their
 * own constellation, CardStars.tsx), their avatar in the middle, and along the foot their tag, a line about them and
 * a place for each period. The edge is gold for a top-three place, and a season's card foil sweeps over it all. Ramsey picked the full-art card from the
 * "Player card hero redesign" canvas (T1, then H2 + P2, 2026-10-20); the profile's card (PlayerCard.tsx) stands
 * it on its own sky, and the prize counter's fitting room shows it trying things on.
 */

/** The card's drawing size: a trading card's 5 × 7. The backgrounds draw to fit any size (PrizeArt ThemeDrawing). */
const CARD_W = 300
const CARD_H = 420

/** The background behind a card: their card theme, else their constellation, drawn from their tag and trophies. */
export function CardArt({
  theme,
  tag,
  trophies,
  className,
  wide = false,
}: {
  theme: string | null
  tag: string
  /** How many trophies they have, for the constellation's stars; null while they load. */
  trophies: number | null
  className?: string
  wide?: boolean
}) {
  const [w, h] = wide ? [1600, 640] : [CARD_W, CARD_H]
  if (theme) return <CardBackdrop className={className} theme={theme} width={w} height={h} scale={wide ? 1.5 : 1.1} />
  return <CardStars className={className} tag={tag} trophies={trophies} width={w} height={h} wide={wide} />
}

export function FullArtCard({
  name,
  tag,
  theme,
  trophies,
  avatar,
  chip,
  corner,
  line,
  pips,
  foil,
  back,
  flipped = false,
  onFlip,
  gold = false,
  className,
  style,
}: {
  /** The tag, drawn in its name style by the caller (`name` is a node). */
  name: ReactNode
  /** The tag as text: without a theme, it shapes their constellation. */
  tag: string
  theme: string | null
  /** Without a theme: how many trophies they have, a star each; null while they load. */
  trophies: number | null
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
  /** A card foil from a season's pass (prizes/FoilArt.tsx): a sheen that sweeps over the whole card. */
  foil?: string | null
  /** The card's back (the sticker album, StickerAlbum.tsx): the card turns over to it. */
  back?: ReactNode
  flipped?: boolean
  /** Turns the card over: a button in its top corner, front and back. */
  onFlip?: () => void
  gold?: boolean
  className?: string
  style?: CSSProperties
}) {
  const turn = onFlip ? (
    <button type="button" className="fac__turn" onClick={onFlip} aria-label={flipped ? 'Turn the card back to the front' : 'Turn the card over: the sticker album'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </svg>
    </button>
  ) : null
  const front = (
    <div
      className={`fac${gold ? ' fac--gold' : ''}${!back && className ? ` ${className}` : ''}`}
      style={back ? undefined : style}
      aria-hidden={back && flipped ? true : undefined}
      inert={back && flipped ? true : undefined}
    >
      <CardArt className="fac__art" theme={theme} tag={tag} trophies={trophies} />
      <span className="fac__fade" aria-hidden="true" />
      {chip || corner || turn ? (
        <span className="fac__top">
          {chip ? <span className="fac__chip">{chip}</span> : <span />}
          <span className="fac__top-end">
            {corner ? <span className="fac__chip fac__chip--corner">{corner}</span> : null}
            {turn}
          </span>
        </span>
      ) : null}
      <span className="fac__avatar">{avatar}</span>
      <span className="fac__foot">
        <span className="fac__name">{name}</span>
        {line ? <span className="fac__line">{line}</span> : null}
        {pips ? <span className="fac__pips">{pips}</span> : null}
      </span>
      {foil ? <span className={`fac__foil fac__foil--${foil}`} aria-hidden="true" /> : null}
    </div>
  )
  if (!back) return front
  return (
    <div className={`fac-scene${flipped ? ' fac-scene--back' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <div className="fac-scene__turn">
        {front}
        <div className={`fac fac--back${gold ? ' fac--gold' : ''}`} aria-hidden={flipped ? undefined : true} inert={flipped ? undefined : true}>
          {back}
          {turn ? <span className="fac__top fac__top--back">{turn}</span> : null}
        </div>
      </div>
    </div>
  )
}
