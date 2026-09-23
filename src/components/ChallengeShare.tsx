import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { challengeUrl } from '../lib/challenges'
import { detectDeviceType } from '../lib/device'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { scoreText } from '../lib/gameBoard'
import { Panel, PanelHead } from './Panel'
import { copyText } from './ShareBoardButton'

/*
 * Sending a challenge on its way. On a phone or a tablet the device's own
 * share sheet opens, which is where people's chats are. On a computer, or
 * when the sheet can't open (it needs the tap that asked for it, and a slow
 * network can outlast that), the kit's panel: the card the link unfurls into,
 * the words that go with it, Copy link, and the usual places.
 */

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

export function useChallengeShare(): [(input: ChallengeShareInput) => void, ReactNode] {
  const [open, setOpen] = useState<ChallengeShareInput | null>(null)

  const share = (input: ChallengeShareInput) => {
    const url = challengeUrl(input.game, input.id)
    if (typeof navigator.share === 'function' && detectDeviceType() !== 'desktop') {
      navigator.share({ title: input.message, text: input.message, url }).catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setOpen(input)
      })
      return
    }
    setOpen(input)
  }

  const panel = open ? <ChallengeSharePanel {...open} onClose={() => setOpen(null)} /> : null
  return [share, panel]
}

function ChallengeSharePanel({ game, id, score, message, title, onClose }: ChallengeShareInput & { onClose: () => void }) {
  const titleId = useId()
  const url = challengeUrl(game, id)
  const name = getGame(game)?.name ?? game
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
      <PanelHead
        titleId={titleId}
        title={title ?? 'Challenge a friend'}
        kicker={`${name} · ${scoreText(game, score)}`}
        onClose={onClose}
      />
      <div className="panel__body panel__body--last">
        <img
          className="challenge-share__card"
          src={`/og/challenge/${game}.png`}
          alt={`The card the link shows: a challenge on ${name}`}
          width={1200}
          height={630}
          // A game newer than its challenge card unfurls into the site's own card (scripts/prerender.mjs).
          onError={(e) => {
            if (!e.currentTarget.src.endsWith('/og.png')) e.currentTarget.src = '/og.png'
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
