import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '../lib/leaderboard'
import { onOpenFeedback, sendFeedback, type FeedbackKind } from '../lib/feedback'
import { Panel, PanelHead } from './Panel'
import '../styles/feedback.css'

/*
 * Tell us: an idea or a game you'd like, or something that broke, in a few
 * words, sent with the page it came from. The site header holds it, and any
 * page opens it (openFeedback): the menu's foot and the footer do.
 */

const MAX = 2000

const WORDS: Record<FeedbackKind, { label: string; placeholder: string; note: string | null; thanks: string }> = {
  idea: {
    label: 'Your idea',
    placeholder: 'A game you’d like to see here, or something that would make it better',
    note: null,
    thanks: 'Got it. We read every one.',
  },
  problem: {
    label: 'What happened',
    placeholder: 'What went wrong, and on which game or page?',
    note: 'It goes with the page you’re on and your browser, to help us find it.',
    thanks: 'Got it. We’ll look into it.',
  },
}

export function FeedbackHost() {
  const [open, setOpen] = useState<FeedbackKind | null>(null)
  useEffect(() => onOpenFeedback((kind) => setOpen(kind)), [])
  return open ? <FeedbackPanel initialKind={open} onClose={() => setOpen(null)} /> : null
}

function FeedbackPanel({ initialKind, onClose }: { initialKind: FeedbackKind; onClose: () => void }) {
  const titleId = useId()
  const textId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [kind, setKind] = useState<FeedbackKind>(initialKind)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'writing' | 'sending' | 'sent'>('writing')
  const [error, setError] = useState<string | null>(null)
  const words = WORDS[kind]
  const ready = message.trim().length > 0 && state === 'writing'

  const send = async () => {
    if (!ready) return
    setState('sending')
    setError(null)
    try {
      await sendFeedback(kind, message.trim().slice(0, MAX))
      setState('sent')
    } catch (err) {
      setState('writing')
      setError(err instanceof ApiError && err.code === 'RATE_LIMITED' ? err.message : 'Couldn’t send it. Try again in a moment.')
    }
  }

  return (
    <Panel labelledBy={titleId} onClose={onClose} scrimCloses={false} initialFocus={textRef} className="feedback">
      <PanelHead titleId={titleId} title={state === 'sent' ? 'Thank you' : 'Tell us'} onClose={onClose} />
      {state === 'sent' ? (
        <>
          <div className="panel__body">
            <p className="feedback__done">{words.thanks}</p>
          </div>
          <div className="panel__actions">
            <button type="button" className="panel__btn" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="panel__body">
            <div className="feedback__kinds" role="radiogroup" aria-label="What it’s about">
              {(
                [
                  ['idea', 'An idea or a game'],
                  ['problem', 'Something broke'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  className="feedback__kind"
                  onClick={() => {
                    setKind(value)
                    textRef.current?.focus()
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="panel__field">
              <label className="panel__label" htmlFor={textId}>
                {words.label}
              </label>
              <textarea
                id={textId}
                ref={textRef}
                className="feedback__text"
                rows={5}
                maxLength={MAX}
                value={message}
                placeholder={words.placeholder}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {words.note ? <p className="feedback__note">{words.note}</p> : null}
            {error ? <p className="panel__error">{error}</p> : null}
          </div>
          <div className="panel__actions">
            <button type="button" className="panel__btn" disabled={!ready} onClick={() => void send()}>
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>
        </>
      )}
    </Panel>
  )
}
