import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { seasonHref } from '../../hooks/useHashRoute'
import { boardDay } from '../../lib/rankHow'
import { rewardPhrase, useSeason, type SeasonReward, type SeasonRun } from '../../lib/season'
import { LockIcon } from '../chromeIcons'
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

/** The day a player last heard what Pass+ had at a level they reached: once a day is plenty. */
const MISSED_KEY = 'skermix-passplus-missed'

/**
 * For a player without Pass+ (or Plus), the Pass+ rewards at the levels this run reached, and how many are
 * waiting all told: the moment Pass+ is worth the most, since what it had there is theirs at once. Said on
 * a level up only, once a day at most, and never on Plus's free week, which gives them with its first payment.
 */
function useMissedPlus(run: SeasonRun): { missed: SeasonReward[]; waiting: number } | null {
  const { season, plus } = useSeason()
  const { isPlus } = useAuth()
  const [today] = useState(boardDay)
  const [heardToday] = useState(() => {
    try {
      return localStorage.getItem(MISSED_KEY) === today
    } catch {
      return false
    }
  })
  const found = useMemo(() => {
    if (!plus || plus.owned || isPlus || !season || season.id !== run.id || !run.levelUp.length) return null
    const before = run.earned - run.added
    const from = before <= 0 ? 0 : Math.min(run.levels, 1 + Math.floor(before / season.perLevel))
    const missed = plus.rewards.filter((r) => r.level > from && r.level <= run.level)
    if (!missed.length) return null
    return { missed, waiting: plus.rewards.filter((r) => r.level <= run.level).length }
  }, [plus, isPlus, season, run])
  useEffect(() => {
    if (!found || heardToday) return
    try {
      localStorage.setItem(MISSED_KEY, today)
    } catch {
      // Said again next time, then.
    }
  }, [found, heardToday, today])
  return heardToday ? null : found
}

/** A level reached on this run: its number on the season's patch, and what it gave. */
export function SeasonLevelUp({ run }: { run: SeasonRun }) {
  const shown = run.levelUp.slice(-3)
  const plus = useMissedPlus(run)
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
      {plus ? (
        <p className="run-levelup__missed">
          <span className="run-levelup__missed-lock" aria-hidden="true">
            <LockIcon />
          </span>
          <span>
            <b>
              Pass+ had {rewardPhrase(plus.missed[0]!)} here
              {plus.missed.length > 1 ? ` and ${plus.missed.length - 1} more` : ''}.
            </b>
            <small>
              {plus.waiting === 1 ? '1 Pass+ reward is' : `${plus.waiting} Pass+ rewards are`} waiting for you: Pass+ or Plus gives{' '}
              {plus.waiting === 1 ? 'it' : 'them all'} at once.
            </small>
          </span>
        </p>
      ) : null}
      <a className="run-levelup__go" href={seasonHref()}>
        {plus ? 'See Pass+' : 'See the pass'}
      </a>
    </div>
  )
}
