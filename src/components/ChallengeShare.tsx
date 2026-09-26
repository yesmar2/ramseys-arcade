import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { challengeUrl } from '../lib/challenges'
import { detectDeviceType } from '../lib/device'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { scoreText } from '../lib/gameBoard'
import { Panel, PanelHead } from './Panel'
import { copyText } from './ShareBoardButton'

/*
 * Sending a link on its way: a challenge, or where you stand in an event. On
 * a phone or a tablet the device's own share sheet opens, which is where
 * people's chats are. On a computer, or when the sheet can't open (it needs
 * the tap that asked for it, and a slow network can outlast that), the kit's
 * panel: the card the link unfurls into, the words that go with it, Copy
 * link, and the usual places.
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

export function useLinkShare(): [(input: LinkShareInput) => void, ReactNode] {
  const [open, setOpen] = useState<LinkShareInput | null>(null)

  const share = (input: LinkShareInput) => {
    if (typeof navigator.share === 'function' && detectDeviceType() !== 'desktop') {
      navigator.share({ title: input.message, text: input.message, url: input.url }).catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setOpen(input)
      })
      return
    }
    setOpen(input)
  }

  const panel = open ? <LinkSharePanel {...open} onClose={() => setOpen(null)} /> : null
  return [share, panel]
}

export function useChallengeShare(): [(input: ChallengeShareInput) => void, ReactNode] {
  const [share, panel] = useLinkShare()
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
  return [shareChallenge, panel]
}

function LinkSharePanel({ game, url, message, cards, cardAlt, title, kicker, onClose }: LinkShareInput & { onClose: () => void }) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  const withLink = `${message}\n${url}`

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = () => {
    const done = () => {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    }
    if (copyText(withLink)) {
      done()
      return
    }
    void navigator.clipboard?.writeText(withLink).then(done).catch(() => {})
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedMessage = encodeURIComponent(message)
  const encodedBody = encodeURIComponent(withLink)
  const nativeShare = typeof navigator.share === 'function'

  return (
    <Panel labelledBy={titleId} onClose={onClose} style={gameAccentStyle(game)} className="challenge-share">
      <PanelHead titleId={titleId} title={title} kicker={kicker} onClose={onClose} />
      <div className="panel__body panel__body--last">
        {/* Showing the card here also draws it once, so a friend's chat finds it ready. */}
        <img
          className="challenge-share__card"
          src={cards[0]}
          alt={cardAlt}
          width={1200}
          height={630}
          onError={(e) => {
            const next = cards[cards.indexOf(e.currentTarget.getAttribute('src') ?? '') + 1]
            if (next) e.currentTarget.src = next
          }}
        />
        <p className="challenge-share__message">{message}</p>
        <div className="challenge-share__link">
          <span className="challenge-share__url">{url}</span>
          <button type="button" className="panel__btn challenge-share__copy" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <div className="share-panel__apps">
          {nativeShare ? (
            <button
              type="button"
              className="panel__btn panel__btn--ghost"
              onClick={() => {
                void navigator.share({ title: message, text: message, url }).catch(() => {})
              }}
            >
              Share…
            </button>
          ) : null}
          <a className="panel__btn panel__btn--ghost" href={`sms:?&body=${encodedBody}`}>
            Messages
          </a>
          <a className="panel__btn panel__btn--ghost" href={`mailto:?subject=${encodedMessage}&body=${encodedBody}`}>
            Email
          </a>
          <a
            className="panel__btn panel__btn--ghost"
            href={`https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`}
            target="_blank"
            rel="noreferrer"
          >
            X / Twitter
          </a>
          <a
            className="panel__btn panel__btn--ghost"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
        </div>
      </div>
    </Panel>
  )
}
