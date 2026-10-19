import { useState } from 'react'
import { getGame } from '../../data/games'
import { seasonHref, useRoute } from '../../hooks/useHashRoute'
import { currentAccountId } from '../../lib/auth'
import { ordinal } from '../../lib/profileMath'
import { dayWords, headlinersFor, liveSeason, loudLevelUp, useSeason, type SeasonInfo, type SeasonNext, type SeasonWrap } from '../../lib/season'
import { Panel } from '../Panel'
import { RewardArt } from './RewardArt'
import { SeasonPatch, SeasonScene } from './SeasonLook'
import '../../styles/season.css'

/*
 * The season after this one, and the changeover to it (Ramsey picked my recommendations, 2026-10-19, from the
 * Seasons canvas row "What comes next"): seasons run back to back, and nothing said one was coming.
 *
 * - NextSeasonCard: "Coming next" at the foot of the Season page, all season, in the next season's own look.
 * - nextSeasonSoon: the next season's name for the home's season card, in the season's last week.
 * - SeasonWrapMoment: once, the first time a player is back after a season ended: how theirs went, then the
 *   new one, with a button to its pass.
 */

/** "Swoop, Marble Run and Pileup": the games a season has skins for. */
function skinGames(next: SeasonNext): string | null {
  const names = [...new Set([...next.skins, ...next.plusSkins].map((r) => r.game).filter((g): g is string => !!g))].map((slug) => getGame(slug)?.name ?? slug)
  if (!names.length) return null
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function startsIn(days: number): string {
  return days <= 0 ? 'starts today' : days === 1 ? 'starts tomorrow' : `starts in ${days} days`
}

export function NextSeasonCard({ next, season }: { next: SeasonNext; season: SeasonInfo }) {
  const headliners = headlinersFor(next.id, next.plusSkins)
  const games = skinGames(next)
  return (
    <section className={`season-next season-${next.slug}`} aria-labelledby="season-next-title">
      <div className="season-next__text">
        <div className="season-next__head">
          <SeasonPatch slug={next.slug} label={`S${next.id}`} size={46} />
          <div>
            <p className="season-next__kick">Coming next · Season {next.id}</p>
            <h2 id="season-next-title" className="season-next__name">
              {next.name}
            </h2>
          </div>
        </div>
        <p className="season-next__line">
          {dayWords(next.firstDay)} – {dayWords(next.lastDay)} · {startsIn(next.daysUntil)}, the day after {season.name} ends. A new free pass
          {games ? `, new skins for ${games},` : ''} and a clean start in the standings.
        </p>
        <p className="season-next__keep">
          What you win in {season.name} stays yours. Plus includes every season’s Gold Pass, {next.name}’s too.
        </p>
        {headliners.length ? (
          <ul className="season-next__skins" aria-label={`${next.name}’s Gold Pass headliners`}>
            {headliners.map((skin) => (
              <li key={skin.id}>
                <RewardArt reward={skin} size={84} />
                <b>{skin.name}</b>
                <span>{skin.what}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="season-next__art" aria-hidden="true">
        <SeasonScene slug={next.slug} />
      </div>
    </section>
  )
}

/** The days in a season's last stretch when its home card names the next one. */
const SOON_DAYS = 7

/** "Cold Snap starts Jan 5", in the live season's last week; else null. */
export function nextSeasonSoon(season: SeasonInfo, next: SeasonNext | null | undefined): string | null {
  if (!next || season.daysLeft > SOON_DAYS) return null
  return `${next.name} starts ${dayWords(next.firstDay)}`
}

/* ---------- the changeover ---------- */

const SEEN_KEY = 'skermix-season-wrap'

function seenWraps(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seenWraps().filter((k) => k !== key), key].slice(-20)))
  } catch {
    /* told again next visit, then */
  }
}

/**
 * Once per account and season on this device, in the new season's first month (the API sends `wrap` only then,
 * and only to a player who won a ticket in the last one). Never on a game's screen, and never over a level-up.
 */
export function SeasonWrapMoment() {
  const store = useSeason()
  const route = useRoute()
  const season = liveSeason(store)
  const wrap = store.wrap
  const key = wrap ? `${currentAccountId() ?? ''}:${wrap.id}` : ''
  const [closed, setClosed] = useState<string | null>(null)
  const inGame = route.name === 'gamePlay' || route.name === 'tournamentPlay' || route.name === 'challenge'
  const levelUp = store.you && store.you.announced != null && store.you.level > store.you.announced && loudLevelUp(store.you.pending ?? [])
  if (!season || !wrap || inGame || levelUp || closed === key || seenWraps().includes(key)) return null
  const done = () => {
    markSeen(key)
    setClosed(key)
  }
  return (
    <Panel onClose={done} label={`${wrap.name} is over. ${season.name} starts now.`} className="season-wrap" wide>
      <WrapBody wrap={wrap} season={season} onDone={done} />
    </Panel>
  )
}

function WrapBody({ wrap, season, onDone }: { wrap: SeasonWrap; season: SeasonInfo; onDone: () => void }) {
  return (
    <div className="season-wrap__card">
      <div className={`season-wrap__last season-${wrap.slug}`}>
        <p className="season-wrap__kick">
          Season {wrap.id} · {wrap.name}
        </p>
        <h2 className="season-wrap__title">That’s a wrap</h2>
        <dl className="season-wrap__stats">
          <div>
            <dt>Your level</dt>
            <dd>{wrap.level}</dd>
          </div>
          {wrap.place != null ? (
            <div>
              <dt>In the standings, of {wrap.field.toLocaleString()}</dt>
              <dd>{ordinal(wrap.place)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Looks kept, and the S{wrap.id} pin</dt>
            <dd>{wrap.kept}</dd>
          </div>
        </dl>
      </div>
      <div className={`season-wrap__new season-${season.slug}`}>
        <div className="season-wrap__art" aria-hidden="true">
          <SeasonScene slug={season.slug} />
        </div>
        <div className="season-wrap__now">
          <p className="season-wrap__kick">Season {season.id} starts now</p>
          <p className="season-wrap__name">{season.name}</p>
        </div>
      </div>
      <div className="season-wrap__foot">
        <p>A new free pass and a clean start in the standings. Win a ticket in any game to start it.</p>
        <div className="season-wrap__acts">
          <a className="panel__btn" href={seasonHref()} onClick={onDone}>
            See the new pass
          </a>
          <button type="button" className="panel__btn panel__btn--ghost" onClick={onDone} autoFocus>
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
