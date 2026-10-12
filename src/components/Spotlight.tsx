import { useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { CloseIcon, Panel } from './Panel'
import { ReportConfetti } from './RunReport'
import '../styles/spotlight.css'

/*
 * The whole screen for something of your own, once: a Dailies streak milestone (MilestoneMoment.tsx). A win
 * over people is the takeover's, with its trophy and podium (WinTakeover.tsx); this is a stand lit from above
 * in the dark with the thing on it, what it is in a few words, what it earned, and a way to use it. Ramsey
 * picked it from the "More celebrations" canvas (B · Spotlight, 2026-10-11). Carry on, Esc or the close go
 * back to the page it covered.
 */

export type SpotlightData = {
  /** The colour it's lit in: the stand's glow, the beam, the button. */
  glow: string
  art: ReactNode
  kicker: string
  title: string
  lede: string
  /** What it earned, in a chip under the words. */
  prize: string | null
  /** A quiet line under the buttons: what's next. */
  note: string | null
}

export type SpotlightAction = { label: string; onClick: () => void }

export function Spotlight({
  data,
  primary,
  onClose,
}: {
  data: SpotlightData
  /** The way to use what it earned. Without one, the button that closes it is the bright one, and says Nice! */
  primary?: SpotlightAction | null
  onClose: () => void
}) {
  const titleId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // It can open as a page is pressed: a press begun before it was up doesn't reach its buttons.
  const allow = useDeliberatePress()

  return (
    <Panel
      onClose={onClose}
      labelledBy={titleId}
      scrimCloses={false}
      className="spotlight"
      layerClassName="spotlight-layer"
      style={{ '--spot-glow': data.glow } as CSSProperties}
      initialFocus={primary ? primaryRef : closeRef}
      backdrop={<ReportConfetti accent={data.glow} />}
    >
      <button
        type="button"
        className="panel__close spotlight__close"
        aria-label="Close"
        onClick={(e) => {
          if (allow(e)) onClose()
        }}
      >
        <CloseIcon />
      </button>
      <div className="spotlight__stage">
        <div className="spotlight__nook" aria-hidden="true">
          {data.art}
        </div>
        <span className="spotlight__kicker">{data.kicker}</span>
        <h2 id={titleId} className="spotlight__title">
          {data.title}
        </h2>
        <p className="spotlight__lede">{data.lede}</p>
        {data.prize ? <span className="spotlight__chip">{data.prize}</span> : null}
        <div className="spotlight__actions">
          {primary ? (
            <button
              ref={primaryRef}
              type="button"
              className="spotlight__btn"
              onClick={(e) => {
                if (allow(e)) primary.onClick()
              }}
            >
              {primary.label}
            </button>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            className={primary ? 'spotlight__btn spotlight__btn--ghost' : 'spotlight__btn'}
            onClick={(e) => {
              if (allow(e)) onClose()
            }}
          >
            {primary ? 'Carry on' : 'Nice!'}
          </button>
        </div>
        {data.note ? <p className="spotlight__note">{data.note}</p> : null}
      </div>
    </Panel>
  )
}
