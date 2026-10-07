import type { ReactNode } from 'react'
import { getGame } from '../data/games'
import { challengeUrl } from '../lib/challenges'
import { scoreText } from '../lib/gameBoard'
import { useShare } from './SharePanel'

/*
 * Sending a link on its way: a challenge, or where you stand in an event. It
 * goes the way every Share does (useShare): the share sheet on a phone or a
 * tablet, copied on a computer, and the kit's panel, with the card the link
 * unfurls into, only when neither worked.
 */

export type LinkShareInput = {
  /** The game whose colours the panel wears. */
  game: string
  url: string
  /** The words that go out with the link. */
  message: string
  /** The card the link unfurls into, then what to show if it can't be drawn. */
  cards: string[]
  /** What the card shows, for anyone who can't see it. */
  cardAlt: string
  title: string
  kicker: string
}

export type ChallengeShareInput = {
  game: string
  id: string
  score: number
  name: string
  /** The words that go out with the link. */
  message: string
  /** The panel's heading, when it isn't a new challenge: a reply going back. */
  title?: string
}

/** `share` from the tap, the panel to render, and whether it was just copied (for the button's label). */
export function useLinkShare(): [(input: LinkShareInput) => void, ReactNode, boolean] {
  const { share, copied, panel } = useShare()
  const shareLink = ({ message, ...rest }: LinkShareInput) => share({ text: message, ...rest })
  return [shareLink, panel, copied]
}

export function useChallengeShare(): [(input: ChallengeShareInput) => void, ReactNode, boolean] {
  const [share, panel, copied] = useLinkShare()
  const shareChallenge = ({ game, id, score, message, title }: ChallengeShareInput) => {
    const name = getGame(game)?.name ?? game
    share({
      game,
      url: challengeUrl(game, id),
      message,
      // The card drawn for this challenge (api/challenge-card.js); failing that, the game's own, then the site's.
      cards: [`/api/challenge-card?game=${encodeURIComponent(game)}&id=${encodeURIComponent(id)}`, `/og/challenge/${game}.png`, '/og.png'],
      cardAlt: `The card the link shows: a challenge on ${name}`,
      title: title ?? 'Challenge a friend',
      kicker: `${name} · ${scoreText(game, score)}`,
    })
  }
  return [shareChallenge, panel, copied]
}
