import { useEffect, useState } from 'react'
import { getGame } from '../data/games'
import { useAdminInbox } from '../hooks/useAdminInbox'
import { adminHref, type AdminSection } from '../hooks/useHashRoute'
import { adminAgo, fetchSeasonPreview, FLAG_KINDS, type SeasonPreviewState } from '../lib/admin'
import { capitalName, huntDay, huntPick, huntWhere, msUntilNextBug } from '../lib/bugHunt'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { AdminNumbers } from './AdminNumbers'
import { AdminPlayers } from './AdminPlayers'

/*
 * The admin page's front (AdminPage.tsx, /admin), from pick A of the "Admin page redesign" canvas (2026-10-23):
 * the three numbers; what needs you, the newest of each kind, each opening its own section; who's playing;
 * and today on the site. Everything else is a section of the sidebar.
 */

/** Long words cut at a word, so a card's line stays a line or two. */
function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`
}

/** "13 h 45 min" or "40 min". */
function untilWords(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function Need<T>({
  section,
  label,
  items,
  words,
  none,
}: {
  section: AdminSection
  label: string
  items: T[] | null
  words: (item: T) => { title: string; sub: string }
  none: string
}) {
  const count = items?.length ?? null
  const first = items?.[0]
  const said = first ? words(first) : null
  return (
    <a className={`adm-need${count ? ' adm-need--some' : ''}`} href={adminHref(section)}>
      <span className="adm-need__label">
        {label}
        {count != null ? ` · ${count || 'none'}` : ''}
      </span>
      {said ? (
        <>
          <b className="adm-need__title">{said.title}</b>
          <span className="adm-need__sub">{said.sub}</span>
        </>
      ) : (
        <span className="adm-need__sub">{count == null ? 'Checking…' : none}</span>
      )}
    </a>
  )
}

function TodayOnTheSite({ siteEvents }: { siteEvents: boolean | null }) {
  const pick = huntPick(huntDay())
  const [season, setSeason] = useState<SeasonPreviewState | null>(null)
  const [seasonFailed, setSeasonFailed] = useState(false)
  useEffect(() => {
    fetchSeasonPreview().then(setSeason, () => setSeasonFailed(true))
  }, [])
  const s = season?.season
  const seasonWords = !s
    ? seasonFailed
      ? 'Couldn’t read the season'
      : season
        ? 'No season set'
        : 'Checking…'
    : s.status === 'upcoming'
      ? `${s.name} starts ${monthDay.format(new Date(`${s.firstDay}T12:00:00Z`))}`
      : s.status === 'live'
        ? `${s.name}, ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'} left`
        : `${s.name} is over`
  return (
    <section className="adm-card" aria-labelledby="adm-today">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-today">
          Today on the site
        </h2>
      </div>
      <div className="adm-today">
        <a className="adm-today__tile" href={adminHref('hunt')}>
          <span className="adm-today__label">Bug hunt</span>
          <b>
            {capitalName(pick.bug)}, {huntWhere(pick.anchor, pick.pose)}
          </b>
          <span>The next bug in {untilWords(msUntilNextBug())}</span>
        </a>
        <a className="adm-today__tile" href={adminHref('season')}>
          <span className="adm-today__label">Season</span>
          <b>{seasonWords}</b>
          <span>{season ? (season.previewFrom ? 'Previewed early' : 'No early preview') : ''}</span>
        </a>
        <a className="adm-today__tile" href={adminHref('events')}>
          <span className="adm-today__label">Site events</span>
          <b>{siteEvents == null ? 'Checking…' : siteEvents ? 'Running' : 'Paused'}</b>
          <span>Today’s event, the One Shot and the Weekly Triple</span>
        </a>
      </div>
    </section>
  )
}

export function AdminOverview() {
  const { inbox } = useAdminInbox()
  return (
    <>
      <AdminNumbers />
      <section className="adm-needs" aria-labelledby="adm-needs">
        <h2 className="visually-hidden" id="adm-needs">
          Needs you
        </h2>
        <Need
          section="feedback"
          label="Feedback"
          items={inbox.feedback}
          none="Nothing new from players."
          words={(f) => ({
            title: `“${clip(f.message, 110)}”`,
            sub: `${f.kind === 'problem' ? 'Something broke' : 'Idea'} · ${adminAgo(f.createdAt)}${f.name ? ` · ${f.name}` : ''}`,
          })}
        />
        <Need
          section="errors"
          label="Site errors"
          items={inbox.errors}
          none="Nothing has broken lately."
          words={(e) => ({
            title: clip(e.message, 90),
            sub: `${e.count.toLocaleString()} ${e.count === 1 ? 'time' : 'times'} · last ${adminAgo(e.lastAt)}${e.path ? ` · ${e.path}` : ''}`,
          })}
        />
        <Need
          section="flags"
          label="Flagged scores"
          items={inbox.flags}
          none="No scores waiting."
          words={(f) => ({
            title: `${f.name} · ${getGame(f.game)?.name ?? f.game} · ${formatLeaderboardScore(f.game, f.score)}`,
            sub: `${FLAG_KINDS[f.kind] ?? f.kind} · ${adminAgo(f.createdAt)}`,
          })}
        />
      </section>
      <AdminPlayers />
      <TodayOnTheSite siteEvents={inbox.siteEvents} />
    </>
  )
}
