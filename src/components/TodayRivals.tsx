import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { rankHref } from '../hooks/useHashRoute'
import { groupsIndexHref } from '../lib/groups'
import { resolveGameAccent } from '../lib/theme'
import { betterFirst, rivalResult, rivalWords, type TodayDaily, type TodayKey, type TodayRival, type TodayRivals as Rivals } from '../lib/today'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { FlameIcon } from './TodayChip'

/*
 * The rivals under today's ticket, on the Today page (lib/today.ts): your friends, or one of your groups, on
 * the day's live dailies, with their result on each and their streak. The best on each is marked, and yours
 * stands out.
 * A wider screen has a table, one row a player and a column a daily; a phone has a card a player, their
 * results in a row of small pictures under the name. With nobody to race yet, it says how to get someone.
 */

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z" />
  </svg>
)

/** The best result on each daily among these players, once two or more have one. */
function bests(rivals: readonly TodayRival[], dailies: readonly TodayDaily[]): Partial<Record<TodayKey, number>> {
  const out: Partial<Record<TodayKey, number>> = {}
  for (const { key } of dailies) {
    const values = rivals.map((r) => rivalResult(r, key)).filter((v): v is number => v != null)
    if (values.length < 2) continue
    const top = [...values].sort(betterFirst(key))[0]
    if (top != null) out[key] = top
  }
  return out
}

function Thumb({ slug, className }: { slug: string; className: string }) {
  return <GameThumbArt slug={slug} accent={resolveGameAccent(slug, getGame(slug)?.accent ?? 'var(--accent)')} className={className} />
}

export function TodayRivals({
  data,
  dailies,
  group,
  onPick,
}: {
  data: Rivals | null
  /** Today's live dailies, in the ticket's order: a column (or a picture on a phone's card) each. */
  dailies: readonly TodayDaily[]
  group: string | null
  onPick: (group: string | null) => void
}) {
  if (!data) return null
  const others = data.rivals.filter((r) => !r.me)
  const best = bests(data.rivals, dailies)
  const title = data.scope.kind === 'group' ? `${data.scope.name} today` : 'Your friends today'
  return (
    <section className="today-rivals" aria-labelledby="today-rivals-title">
      <div className="today-rivals__head">
        <h2 id="today-rivals-title">{title}</h2>
        {data.groups.length ? (
          <div className="today-rivals__scopes" role="group" aria-label="Whose day to show">
            <button type="button" className="today-rivals__scope" aria-pressed={!group} onClick={() => onPick(null)}>
              Friends
            </button>
            {data.groups.map((g) => (
              <button key={g.id} type="button" className="today-rivals__scope" aria-pressed={group === g.id} onClick={() => onPick(g.id)}>
                {g.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {others.length ? (
        <>
          <table className="today-rivals__table">
            <thead>
              <tr>
                <th scope="col" className="today-rivals__who">
                  Player
                </th>
                {dailies.map((d) => (
                  <th key={d.key} scope="col">
                    <span className="today-rivals__col">
                      <Thumb slug={d.slug} className="today-rivals__thumb" />
                      {d.label}
                    </span>
                  </th>
                ))}
                <th scope="col" className="today-rivals__streak-head">
                  <FlameIcon />
                  <span className="today-rivals__sr">Streak</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rivals.map((r) => (
                <tr key={r.name} className={r.me ? 'today-rivals__me' : undefined}>
                  <th scope="row" className="today-rivals__who">
                    <a href={rankHref(r.name, 'all')} className="today-rivals__player">
                      <PlayerAvatar avatarId={r.avatarId} name={r.name} size="sm" />
                      <span className="today-rivals__name">{r.me ? 'You' : r.name}</span>
                    </a>
                  </th>
                  {dailies.map((d) => {
                    const value = rivalResult(r, d.key)
                    const top = value != null && best[d.key] === value
                    return (
                      <td key={d.key} className={top ? 'today-rivals__best' : undefined}>
                        {value == null ? (
                          <span className="today-rivals__none" aria-label="Not yet">
                            –
                          </span>
                        ) : (
                          <>
                            {top ? <CrownIcon /> : null}
                            {rivalWords(d.key, value)}
                          </>
                        )}
                      </td>
                    )
                  })}
                  <td className="today-rivals__streak">{r.streak > 0 ? r.streak : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* On a phone, a card a player instead (today.css shows one or the other). */}
          <ul className="today-rivals__cards">
            {data.rivals.map((r) => (
              <li key={r.name} className={`today-rival${r.me ? ' today-rival--me' : ''}`}>
                <div className="today-rival__top">
                  <a href={rankHref(r.name, 'all')} className="today-rivals__player">
                    <PlayerAvatar avatarId={r.avatarId} name={r.name} size="sm" />
                    <span className="today-rivals__name">{r.me ? 'You' : r.name}</span>
                  </a>
                  <span className="today-rival__streak">
                    <FlameIcon />
                    <span className="today-rivals__sr">Streak </span>
                    {r.streak > 0 ? r.streak : '–'}
                  </span>
                </div>
                <div className="today-rival__results" style={{ '--n': dailies.length } as CSSProperties}>
                  {dailies.map((d) => {
                    const value = rivalResult(r, d.key)
                    const top = value != null && best[d.key] === value
                    return (
                      <span
                        key={d.key}
                        className={`today-rival__result${value == null ? ' today-rival__result--none' : top ? ' today-rival__result--best' : ''}`}
                      >
                        <Thumb slug={d.slug} className="today-rival__thumb" />
                        <span className="today-rivals__sr">{d.label}: </span>
                        {value == null ? <span aria-label="Not yet">–</span> : rivalWords(d.key, value)}
                      </span>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="today-rivals__empty">
          {data.scope.kind === 'group'
            ? 'Nobody else in this group has a tag yet.'
            : 'Race your friends on today’s dailies. Add a friend from their player card, or '}
          {data.scope.kind === 'group' ? null : <a href={groupsIndexHref()}>start a group</a>}
          {data.scope.kind === 'group' ? null : ' and send them the invite.'}
        </p>
      )}
    </section>
  )
}
