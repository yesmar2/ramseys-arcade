import { useId, useState, type CSSProperties } from 'react'
import type { ScoreRow } from '../data/scoring'
import { Panel, PanelHead } from './Panel'

type HowToPlayContentProps = {
  how: string
  rows?: ScoreRow[] | null
  /** Scoring list style — lobby accordion vs in-game modal. */
  listClassName?: string
}

/** Shared how-to + scoring rows for lobby accordion and in-game modal. */
export function HowToPlayContent({
  how,
  rows,
  listClassName = 'game-lobby__scoring',
}: HowToPlayContentProps) {
  const scoring = rows?.length ? rows : null
  return (
    <>
      <p className="how-to-play__copy">{how}</p>
      {scoring ? (
        <ul className={listClassName}>
          {scoring.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

type ScoreGuideProps = {
  how: string
  rows?: ScoreRow[] | null
  /** The game's name, over the title. */
  game?: string
  /** Colour tokens for the panel, usually the game's accent. */
  style?: CSSProperties
}

/** In-game How to play panel, opened from the start and pause cards. */
export function ScoreGuide({ how, rows, game, style }: ScoreGuideProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  // The body scrolls on its own, so a long rulebook cannot push the close, or its own last line, off the screen.
  const panel = open ? (
    <Panel wide labelledBy={titleId} onClose={() => setOpen(false)} style={style}>
      <PanelHead titleId={titleId} title="How to play" kicker={game} onClose={() => setOpen(false)} closeLabel="Close how to play" />
      <div className="panel__body panel__body--last">
        <HowToPlayContent how={how} rows={rows} listClassName="panel__list" />
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
