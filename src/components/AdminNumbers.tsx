import { useCallback, useEffect, useState } from 'react'
import { fetchLaunchNumbers, type LaunchCohort, type LaunchNumbers } from '../lib/admin'
import '../styles/adminNumbers.css'

/*
 * The top of the admin page: the three numbers that say whether Blipka is working (Ramsey, 2026-10-22: "lets
 * see the numbers"). They're the ones I said to watch from launch (2026-10-15): do new players stay, do they
 * share, do some pay. The API counts them (launchNumbers.ts); the aims are my rough benchmarks from then: a
 * fifth still playing a week later, and 2% paying. Shares have no aim yet, only last week to beat.
 */

/** Fewer joiners or players than this and a rate says more about chance than about the arcade. */
const ENOUGH = { stayed: 30, shared: 30, paying: 100 }
const AIM = { stayed: 0.2, paying: 0.02 }

type Verdict = 'good' | 'close' | 'low' | 'few'

const VERDICT_WORDS: Record<Verdict, string> = {
  good: 'On track',
  close: 'Getting there',
  low: 'Below the aim',
  few: 'Too few players to tell yet',
}

function verdict(part: number, whole: number, aim: number, enough: number): Verdict {
  if (whole < enough) return 'few'
  const rate = part / whole
  return rate >= aim ? 'good' : rate >= aim / 2 ? 'close' : 'low'
}

/** "21%", or "1.6%" under 10%, where a tenth matters ("8%", not "8.0%"). */
function pct(part: number, whole: number): string {
  if (!whole) return '–'
  const rate = (part / whole) * 100
  return `${rate < 10 ? Math.round(rate * 10) / 10 : Math.round(rate)}%`
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayWords = (day: string) => monthDay.format(new Date(`${day}T12:00:00Z`))

/** What each kind of shared link is (lib/share.ts shareKind: the first part of its path). */
const KIND_WORDS: Record<string, string> = {
  today: 'Day cards',
  c: 'Challenges',
  e: 'Event places',
  records: 'Records',
  leaderboards: 'Day boards',
  games: 'Game pages',
  rank: 'Player cards',
  groups: 'Group invites',
  dailies: 'Dailies',
  text: 'Words only',
  home: 'The home page',
  link: 'Other links',
  other: 'Other links',
}

const kindWords = (kind: string) => KIND_WORDS[kind] ?? `/${kind}`

const players = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'player' : 'players'}`

function Big({
  label,
  value,
  lines,
  aim,
  verdict: v,
}: {
  label: string
  value: string
  lines: string[]
  aim: string
  verdict: Verdict | null
}) {
  return (
    <div className="adn-big">
      <span className="adn-big__label">{label}</span>
      <b className="adn-big__value">{value}</b>
      {lines.map((line) => (
        <span key={line} className="adn-big__line">
          {line}
        </span>
      ))}
      <span className={`adn-big__aim${v ? ` adn-big__aim--${v}` : ''}`}>
        {v ? <i aria-hidden="true" /> : null}
        {v ? `${VERDICT_WORDS[v]} · ` : ''}
        {aim}
      </span>
    </div>
  )
}

function stayedCell(c: LaunchCohort): string {
  if (!c.players) return '–'
  if (c.state === 'tooSoon') return 'Too soon'
  const words = `${c.back} of ${c.players}`
  return c.state === 'soFar' ? `${words} so far` : `${pct(c.back, c.players)} · ${words}`
}

export function AdminNumbers() {
  const [numbers, setNumbers] = useState<LaunchNumbers | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setError(null)
    fetchLaunchNumbers()
      .then(setNumbers)
      .catch(() => setError('Couldn’t count the numbers.'))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const n = numbers
  return (
    <section className="adm-card adn" aria-labelledby="adm-numbers">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-numbers">
          The three numbers
        </h2>
        <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={load}>
          Refresh
        </button>
      </div>
      <p className="adm-card__sub">
        Whether Blipka is working: new players stay, they share, and some pay. Signed-in players only, as on the
        Players card, since saving a run needs an account. Weeks run Monday to Sunday, New York time.
      </p>
      {error ? <p className="adm-fail">{error}</p> : null}
      {!n ? (
        error ? null : <p className="adm-note">Counting…</p>
      ) : (
        <NumbersBody n={n} />
      )}
    </section>
  )
}

function NumbersBody({ n }: { n: LaunchNumbers }) {
  const { stayed, shared, paying } = n
  // Last whole week's share rate, to beat: this week's isn't over.
  const lastWeek = shared.weeks[1]
  const paidBits = [
    paying.plus ? `${paying.plus} on Plus` : null,
    paying.goldPass ? `${paying.goldPass} with ${paying.season ? `the ${paying.season.name}` : 'this season’s'} Gold Pass` : null,
    paying.trial ? `${paying.trial} on a free week` : null,
  ].filter(Boolean) as string[]
  const rows = stayed.cohorts.map((c, i) => ({ cohort: c, share: shared.weeks[i] }))

  return (
    <>
      <div className="adn-bigs">
        <Big
          label="Still playing a week later"
          value={pct(stayed.back, stayed.players)}
          lines={[
            stayed.players
              ? `${stayed.back} of the ${stayed.players} who joined ${stayed.from && stayed.to ? `${dayWords(stayed.from)} – ${dayWords(stayed.to)}` : 'lately'} played in their second week`
              : 'Nobody who joined has had a whole second week yet',
          ]}
          aim="Aim: 1 in 5 or more"
          verdict={verdict(stayed.back, stayed.players, AIM.stayed, ENOUGH.stayed)}
        />
        <Big
          label="Shared something"
          value={pct(shared.sharers, shared.players)}
          lines={[
            `${shared.sharers} of the last 7 days’ ${players(shared.players)}`,
            `${shared.shares} ${shared.shares === 1 ? 'share' : 'shares'} in all${shared.signedOut ? `, ${shared.signedOut} signed out` : ''}`,
          ]}
          aim={lastWeek?.players ? `Last week: ${pct(lastWeek.sharers, lastWeek.players)}, to beat` : 'Aim: more each week'}
          verdict={shared.players < ENOUGH.shared ? 'few' : null}
        />
        <Big
          label="Paying"
          value={pct(paying.paying, paying.players)}
          lines={[
            `${paying.paying} of the last 30 days’ ${players(paying.players)}`,
            paidBits.length ? paidBits.join(' · ') : 'Nobody has paid yet',
          ]}
          aim="Aim: 2% or more"
          verdict={verdict(paying.paying, paying.players, AIM.paying, ENOUGH.paying)}
        />
      </div>

      <div className="adn-weeks">
        <table>
          <caption>Week by week</caption>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">Joined</th>
              <th scope="col">Still playing a week later</th>
              <th scope="col">Played</th>
              <th scope="col">Shared</th>
              <th scope="col">Shares</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cohort, share }, i) => (
              <tr key={cohort.from}>
                <th scope="row">
                  {dayWords(cohort.from)}
                  {i === 0 ? <span className="adn-weeks__now">this week</span> : null}
                </th>
                <td>{cohort.players}</td>
                <td className={cohort.state === 'done' ? undefined : 'adn-weeks__soft'}>{stayedCell(cohort)}</td>
                <td>{share?.players ?? 0}</td>
                <td>{share?.players ? pct(share.sharers, share.players) : '–'}</td>
                <td>{share?.shares ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="adn-kinds">
        <b>Shared in the last 7 days:</b>{' '}
        {shared.kinds.length
          ? shared.kinds.map((k) => `${kindWords(k.kind)} ${k.shares}`).join(' · ')
          : 'nothing yet'}
      </p>
    </>
  )
}
