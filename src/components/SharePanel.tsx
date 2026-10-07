import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { COPIED_MS, copyToClipboard, shareBody, shareOrCopy, type ShareMessage } from '../lib/share'
import { Panel, PanelHead } from './Panel'

/*
 * Every Share button's working (lib/share.ts): the share sheet on a phone or
 * a tablet, copied on a computer, and the kit's panel only when neither
 * worked. The panel shows the card the link unfurls into where there is one,
 * the words, the link with Copy, and the usual places.
 */

export type ShareInput = ShareMessage & {
  /** The panel's heading. */
  title?: string
  kicker?: string
  /** The game whose colours the panel wears. */
  game?: string
  /** The card the link unfurls into, then what to show if it can't be drawn. */
  cards?: string[]
  /** What the card shows, for anyone who can't see it. */
  cardAlt?: string
}

/** A Share button's working: `share` from the tap, `copied` for its label, and `panel` to render beside it. */
export function useShare(): { share: (input: ShareInput) => void; copied: boolean; panel: ReactNode } {
  const [open, setOpen] = useState<ShareInput | null>(null)
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const share = useCallback((input: ShareInput) => {
    // Drawn once now, so a friend's chat finds the card ready.
    if (input.cards?.[0]) new Image().src = input.cards[0]
    void shareOrCopy(input).then((outcome) => {
      if (outcome === 'copied') {
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
      } else if (outcome === 'failed') {
        setOpen(input)
      }
    })
  }, [])

  const panel = open ? <SharePanel {...open} onClose={() => setOpen(null)} /> : null
  return { share, copied, panel }
}

/** A message whose last line is its link, as the dailies' words are, shown as the words and the link apart. */
function splitLink({ text, url }: ShareMessage): { words: string; link: string | null } {
  if (url) return { words: text, link: url }
  const lines = text.split('\n')
  const last = lines[lines.length - 1]?.trim() ?? ''
  if (lines.length > 1 && /^https?:\/\/\S+$/.test(last)) return { words: lines.slice(0, -1).join('\n'), link: last }
  return { words: text, link: null }
}

export function SharePanel({ text, url, title = 'Share', kicker, game, cards, cardAlt = '', onClose }: ShareInput & { onClose: () => void }) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  const body = shareBody({ text, url })
  const { words, link } = splitLink({ text, url })

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = () => {
    void copyToClipboard(body).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
    })
  }

  const encodedBody = encodeURIComponent(body)
  const subject = encodeURIComponent(words.split('\n')[0] ?? '')
  const sheet = typeof navigator.share === 'function'

  return (
    <Panel labelledBy={titleId} onClose={onClose} style={game ? gameAccentStyle(game) : undefined} className="challenge-share">
      <PanelHead titleId={titleId} title={title} kicker={kicker} onClose={onClose} />
      <div className="panel__body panel__body--last">
        {cards?.length ? (
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
        ) : null}
        <p className="challenge-share__message">{words}</p>
        <div className="challenge-share__link">
          <span className="challenge-share__url">{link ?? ''}</span>
          <button type="button" className="panel__btn challenge-share__copy" onClick={copy}>
            {copied ? 'Copied' : link ? 'Copy link' : 'Copy'}
          </button>
        </div>
        <div className="share-panel__apps">
          {sheet ? (
            <button
              type="button"
              className="panel__btn panel__btn--ghost"
              onClick={() => {
                void navigator.share(url ? { title: text, text, url } : { text }).catch(() => {})
              }}
            >
              Share…
            </button>
          ) : null}
          <a className="panel__btn panel__btn--ghost" href={`sms:?&body=${encodedBody}`}>
            Messages
          </a>
          <a className="panel__btn panel__btn--ghost" href={`mailto:?subject=${subject}&body=${encodedBody}`}>
            Email
          </a>
          <a
            className="panel__btn panel__btn--ghost"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(words)}${link ? `&url=${encodeURIComponent(link)}` : ''}`}
            target="_blank"
            rel="noreferrer"
          >
            X / Twitter
          </a>
          {link ? (
            <a
              className="panel__btn panel__btn--ghost"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noreferrer"
            >
              Facebook
            </a>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
