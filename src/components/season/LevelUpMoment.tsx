import { useState } from 'react'
import { seasonHref, useRoute } from '../../hooks/useHashRoute'
import { liveSeason, noteLevelsSeen, seasonTop, useSeason, type SeasonRun } from '../../lib/season'
import { Panel } from '../Panel'
import { SeasonLevelUp } from './SeasonRun'
import '../../styles/season.css'

/*
 * A season level reached where no run's report could say so: tickets from a bug caught, a day's place paid at
 * midnight, a record on a past course, a Dailies milestone, an event. The API keeps the last level you were
 * told of; when the season comes back with levels past it, they're told here, once (lib/season.ts
 * noteLevelsSeen), with the run report's own level-up. Off a game it's a celebration over the page; while a
 * game is being played it waits in a small note in the corner, to open when you like.
 */

export function LevelUpMoment() {
  const store = useSeason()
  const route = useRoute()
  const season = liveSeason(store)
  const you = store.you
  const [opened, setOpened] = useState(false)
  if (!season || !you || you.announced == null || you.level <= you.announced || !you.pending?.length) return null

  // As a run's report has it (SeasonRun): `added` is what it takes from the last level told of to now, which
  // the report's Pass+ line reads to know which levels were just reached.
  const before = you.announced <= 0 ? 0 : you.announced * season.perLevel - 1
  const run: SeasonRun = {
    id: season.id,
    name: season.name,
    earned: you.earned,
    added: Math.max(0, you.earned - before),
    level: you.level,
    levels: seasonTop(store),
    nextAt: you.nextAt,
    next: null,
    levelUp: you.pending,
  }
  const done = () => {
    setOpened(false)
    noteLevelsSeen()
  }
  const inGame = route.name === 'gamePlay' || route.name === 'tournamentPlay'

  if (inGame && !opened) {
    return (
      <div className="levelup-note" role="status">
        <button type="button" className="levelup-note__open" onClick={() => setOpened(true)}>
          <span className="levelup-note__kick">Level up</span>
          <b>Level {you.level}</b>
          <span className="levelup-note__see">See what you got ›</span>
        </button>
        <button type="button" className="levelup-note__close" aria-label="Close" onClick={done}>
          ×
        </button>
      </div>
    )
  }

  return (
    <Panel onClose={done} label={`Season level ${you.level}`} className="levelup-panel">
      <SeasonLevelUp run={run} />
      <div className="levelup-panel__acts">
        <button type="button" className="panel__btn" onClick={done} autoFocus>
          Nice!
        </button>
        <a className="panel__btn panel__btn--ghost" href={seasonHref()} onClick={() => noteLevelsSeen()}>
          See the pass
        </a>
      </div>
    </Panel>
  )
}
