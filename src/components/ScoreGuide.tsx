import { useId, useState, type CSSProperties } from 'react'
import { HowToPlay } from './HowToPlay'
import { Panel, PanelHead } from './Panel'

type ScoreGuideProps = {
  slug: string
  /** The game's name, over the title. */
  game?: string
  /** Colour tokens for the panel, usually the game's accent. */
  style?: CSSProperties
  /** The round "i", or the start and pause cards' named button (PauseControls GameCardPills). */
  look?: 'icon' | 'pill'
}

/** In-game How to play panel, opened from the start and pause cards. */
export function ScoreGuide({ slug, game, style, look = 'icon' }: ScoreGuideProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  // The body scrolls on its own, so on a short screen the close and the last line stay in reach.
  const panel = open ? (
    <Panel wide labelledBy={titleId} onClose={() => setOpen(false)} style={style}>
      <PanelHead titleId={titleId} title="How to play" kicker={game} onClose={() => setOpen(false)} closeLabel="Close how to play" />
      <div className="panel__body panel__body--last">
        <HowToPlay slug={slug} />
      </div>
    </Panel>
  ) : null

  return (
    <>
      <button
        type="button"
        className={look === 'pill' ? 'game-pill' : 'patriot__info'}
        aria-label={look === 'pill' ? undefined : 'How to play'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        // Enter or Space clicks it with no pointer down first: a pointer's click has opened it already.
        onClick={(e) => {
          if (e.detail === 0) setOpen((v) => !v)
        }}
      >
        {look === 'pill' ? (
          <>
            <span className="game-pill__i" aria-hidden="true">
              i
            </span>
            How to play
          </>
        ) : (
          'i'
        )}
      </button>
      {panel}
    </>
  )
}
