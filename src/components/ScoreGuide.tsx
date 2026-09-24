import { useId, useState, type CSSProperties } from 'react'
import { HowToPlay } from './HowToPlay'
import { Panel, PanelHead } from './Panel'

type ScoreGuideProps = {
  slug: string
  /** The game's name, over the title. */
  game?: string
  /** Colour tokens for the panel, usually the game's accent. */
  style?: CSSProperties
}

/** In-game How to play panel, opened from the start and pause cards. */
export function ScoreGuide({ slug, game, style }: ScoreGuideProps) {
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
        className="patriot__info"
        aria-label="How to play"
        aria-expanded={open}
        onPointerDown={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        i
      </button>
      {panel}
    </>
  )
}
