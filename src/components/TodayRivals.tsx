import { getGame } from '../data/games'
import { rankHref } from '../hooks/useHashRoute'
import { groupsIndexHref } from '../lib/groups'
import { resolveGameAccent } from '../lib/theme'
import { betterFirst, rivalWords, type TodayKey, type TodayRival, type TodayRivals as Rivals } from '../lib/today'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { FlameIcon } from './TodayChip'

/*
 * The rivals under today's ticket (lib/today.ts): your friends, or one of your groups, on the day's three,
 * one row a player with their result on each and their streak. The best on each is marked, and your row
 * stands out. With nobody to race yet, it says how to get someone.
 */

const COLUMNS: { key: TodayKey; slug: string; label: string }[] = [
  { key: 'hole', slug: 'acechase', label: 'Hole' },
  { key: 'track', slug: 'hotlap', label: 'Track' },
  { key: 'wanted', slug: 'findbug', label: 'Bugs' },
]

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z" />
  </svg>
)

/** The best result on each of the three among these players, once two or more have one. */
function bests(rivals: readonly TodayRival[]): Record<TodayKey, number | null> {
  const out = { hole: null, track: null, wanted: null } as Record<TodayKey, number | null>
  for (const { key } of COLUMNS) {
    const values = rivals.map((r) => r[key]).filter((v): v is number => v != null)
    if (values.length < 2) continue
    out[key] = [...values].sort(betterFirst(key))[0] ?? null
  }
  return out
}

export function TodayRivals({
  data,
  group,
  onPick,
}: {
  data: Rivals | null
  group: string | null
  onPick: (group: string | null) => void
}) {
  if (!data) return null
  const others = data.rivals.filter((r) => !r.me)
  const best = bests(data.rivals)
  const title = data.scope.kind === 'group' ? `${data.scope.name} today` : 'Your friends today'
  return (
    <section className="today-rivals" aria-labelledby="today-rivals-title">
      <div className="today-rivals__head">
        <h3 id="today-rivals-title">{title}</h3>
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
        <table className="today-rivals__table">
          <thead>
            <tr>
              <th scope="col" className="today-rivals__who">
                Player
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col">
                  <span className="today-rivals__col">
                    <GameThumbArt slug={c.slug} accent={resolveGameAccent(c.slug, getGame(c.slug)?.accent ?? 'var(--accent)')} className="today-rivals__thumb" />
                    {c.label}
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
                {COLUMNS.map((c) => {
                  const value = r[c.key]
                  const top = value != null && best[c.key] === value
                  return (
                    <td key={c.key} className={top ? 'today-rivals__best' : undefined}>
                      {value == null ? (
                        <span className="today-rivals__none" aria-label="Not yet">
                          –
                        </span>
                      ) : (
                        <>
                          {top ? <CrownIcon /> : null}
                          {rivalWords(c.key, value)}
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
      ) : (
        <p className="today-rivals__empty">
          {data.scope.kind === 'group'
            ? 'Nobody else in this group has a tag yet.'
            : 'Race your friends on today’s three. Add a friend from their player card, or '}
          {data.scope.kind === 'group' ? null : <a href={groupsIndexHref()}>start a group</a>}
          {data.scope.kind === 'group' ? null : ' and send them the invite.'}
        </p>
      )}
    </section>
  )
}
