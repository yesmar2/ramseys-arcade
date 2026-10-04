import { seasonHref } from '../../hooks/useHashRoute'
import { rewardPhrase, useSeason, type SeasonRun } from '../../lib/season'
import { RewardArt } from './RewardArt'
import { MissionPatch } from './SeasonArt'
import { UseSkin } from './SkinPicker'
import '../../styles/season.css'

/*
 * The season's line on a run's report, under its tickets: what the run added to the pass and how far to
 * the next level; and, when it reached one, the level's rewards, given then and there.
 */

export function SeasonRunLine({ run }: { run: SeasonRun }) {
  const { season } = useSeason()
  const perLevel = season?.id === run.id ? season.perLevel : run.level > 0 && run.nextAt ? run.nextAt / run.level : 150
  const from = Math.max(0, run.level - 1) * perLevel
  const fraction = run.nextAt == null ? 1 : Math.min(1, Math.max(0, (run.earned - from) / perLevel))
  const toNext = run.nextAt == null ? 0 : Math.max(0, run.nextAt - run.earned)
  return (
    <>
      <a className="run-season" href={seasonHref()}>
        <MissionPatch label={String(Math.max(1, run.level))} size={40} />
        <span className="run-season__body">
          <span className="run-season__top">
            <span className="run-season__n">{run.added > 0 ? `Season pass +${run.added}` : 'Season pass'}</span>
            <span className="run-season__lv">
              Level {run.level} of {run.levels}
            </span>
          </span>
          <span className="run-season__meter" aria-hidden="true">
            <i style={{ width: `${Math.round(fraction * 100)}%` }} />
          </span>
          <span className="run-season__why">
            {run.nextAt == null
              ? 'Every level of the pass is yours.'
              : run.next
                ? `${toNext.toLocaleString()} more for Level ${run.level + 1}: ${rewardPhrase(run.next)}`
                : `${toNext.toLocaleString()} more for Level ${run.level + 1}`}
          </span>
        </span>
      </a>
      {run.levelUp.length ? <SeasonLevelUp run={run} /> : null}
    </>
  )
}

/** A level reached on this run: its number on the season's patch, and what it gave. */
export function SeasonLevelUp({ run }: { run: SeasonRun }) {
  const shown = run.levelUp.slice(-3)
  return (
    <div className="run-levelup" role="status">
      <span className="run-levelup__kick">Level up</span>
      <MissionPatch label={String(run.level)} size={76} />
      <strong className="run-levelup__title">Level {run.level}</strong>
      <ul className="run-levelup__got">
        {shown.map((reward) => (
          <li key={`${reward.level}-${reward.id}`}>
            <span className="run-levelup__art">
              <RewardArt reward={reward} size={56} />
            </span>
            <span className="run-levelup__what">
              <b>
                {reward.kind === 'tickets' ? `+${reward.amount ?? 0} tickets` : reward.name}
                {reward.plus ? <span className="run-levelup__plus">Pass+</span> : null}
              </b>
              <small>{reward.ready ? (reward.kind === 'tickets' ? 'Added to your tickets' : `${reward.what} · it’s yours`) : `${reward.what} · on its way`}</small>
              {reward.kind === 'skin' && reward.game && reward.ready ? <UseSkin game={reward.game} id={reward.id} /> : null}
            </span>
          </li>
        ))}
      </ul>
      <a className="run-levelup__go" href={seasonHref()}>
        See the pass
      </a>
    </div>
  )
}
