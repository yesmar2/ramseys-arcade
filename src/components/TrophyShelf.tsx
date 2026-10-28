import { useState, type ReactNode } from 'react'
import { tournamentCreateHref } from '../hooks/useHashRoute'
import { ordinal } from '../lib/profileMath'
import { proudestTrophy, summarizeTrophies, trophyTone, type TrophyAward } from '../lib/trophies'
import { medalKind } from './PodiumMedal'
import { SET_SIZE } from '../lib/bugHuntPick'
import { numberWord } from '../lib/numberWord'
import { secretByNumber, SECRETS } from '../lib/secrets'
import { useSeason } from '../lib/season'
import { seasonHasStandings } from '../lib/seasonStandings'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SeasonTrophy, SecretArt, SecretUnknown, TopTenRibbon, WeeklyMedal, type TrophyArtSize } from './TrophyArt'

/** Board trophies shown before "Show all": two rows on a wide screen with your open place, four on a phone. */
const BOARD_SHOWN = 11

/** A shelf this full gives its rarest trophy pride of place over the ledges. */
const PRIDE_FROM = 3

function TrophyIcon({ trophy, size = 'md' }: { trophy: TrophyAward; size?: TrophyArtSize }) {
  const kind = medalKind(trophy.rank)
  // An event win is a cup: the whole thing, not a place on a board.
  if (trophy.period === 'event') return <EventCup size={size} />
  if (trophy.period === 'hunt') return <HuntSetJar size={size} />
  if (trophy.period === 'secret') return <SecretArt n={trophy.periodKey} size={size} />
  if (trophy.period === 'season' && kind) return <SeasonTrophy season={trophy.periodKey} rank={trophy.rank} size={size} />
  if (trophy.period === 'monthly' || trophy.period === 'season') return kind ? <MonthlyTrophyCup tone={kind} size={size} /> : <TopTenRibbon tone="monthly" rank={trophy.rank} size={size} />
  return kind ? <WeeklyMedal rank={trophy.rank} size={size} /> : <TopTenRibbon tone="weekly" rank={trophy.rank} size={size} />
}

/** A set's month from its periodKey (YYYYMM): "October". */
function setMonthOf(periodKey: number): string {
  const y = Math.floor(periodKey / 100)
  const m = periodKey % 100
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
}

/** When a trophy was for: a day for an event, the week's Monday, or the month; for a secret, the day it was found. */
function trophyWhen(t: TrophyAward): string {
  try {
    if (t.period === 'secret') return new Date(t.awardedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (t.period === 'season') return `Season ${t.periodKey}`
    if (t.period === 'monthly' || t.period === 'hunt') {
      const y = Math.floor(t.periodKey / 100)
      const m = t.periodKey % 100
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    const y = Math.floor(t.periodKey / 10_000)
    const m = Math.floor((t.periodKey % 10_000) / 100)
    const d = t.periodKey % 100
    const day = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return t.period === 'weekly' ? `Week of ${day}` : day
  } catch {
    return ''
  }
}

/**
 * What the trophy was won over: over 6 games. Its points stay off the shelf, as they do everywhere but the
 * Standings. A bracket is won on matches, so it says nothing. A secret says how it was found only on your own
 * shelf: on anyone else's it stays a secret.
 */
function trophyHaul(t: TrophyAward, isSelf: boolean): string | null {
  if (t.period === 'hunt') return `All ${numberWord(SET_SIZE)} bugs`
  if (t.period === 'secret') return isSelf ? (secretByNumber(t.periodKey)?.says ?? null) : 'A secret trophy'
  if (t.score <= 0 || t.games <= 0) return null
  return t.games === 1 ? 'on 1 game' : `over ${t.games} games`
}

/** What a trophy is, in a few words: the event's name, the set's month, the secret's name, or its place. */
function trophyTitle(t: TrophyAward): string {
  if (t.period === 'event') return t.eventTitle ?? 'An event'
  if (t.period === 'hunt') return `${setMonthOf(t.periodKey)}’s full set`
  if (t.period === 'secret') return secretByNumber(t.periodKey)?.name ?? 'A secret'
  return `${ordinal(t.rank)} of the ${t.period === 'season' ? 'season' : t.period === 'monthly' ? 'month' : 'week'}`
}

/** When it was for, in full; a secret's is the day it was found. */
function whenLineOf(t: TrophyAward): string {
  const when = trophyWhen(t)
  return t.period === 'secret' ? `Found ${when}` : when
}

/**
 * When it was for, short enough for a trophy's small plate: a week by its Monday (the title already says week),
 * a month without its year unless it was another year's. The hover text keeps the full words.
 */
function plateWhenOf(t: TrophyAward): string {
  if (t.period === 'weekly') return trophyWhen(t).replace(/^Week of /, '')
  if (t.period === 'monthly' || t.period === 'hunt') {
    const y = Math.floor(t.periodKey / 100)
    return y === new Date().getFullYear() ? setMonthOf(t.periodKey) : trophyWhen(t)
  }
  return whenLineOf(t)
}

/**
 * A trophy standing on the cabinet's glass ledge, lit from below in its
 * colour, with a small plate under it saying what it was and when. The same
 * event won more than once stands once, tagged ×N, with every date in its
 * hover text. What it was won with is in the hover text too, and read out.
 */
function Item({ trophy, isSelf, wins }: { trophy: TrophyAward; isSelf: boolean; wins?: TrophyAward[] }) {
  const title = trophyTitle(trophy)
  const whenLine = whenLineOf(trophy)
  const haul = trophyHaul(trophy, isSelf)
  const times = wins && wins.length > 1 ? wins.length : 0
  const hover = times
    ? [title, `won ${numberWord(times)} times: ${wins!.map(trophyWhen).join(', ')}`]
    : [title, whenLine, haul]
  return (
    <li className="pshelf__item" title={hover.filter(Boolean).join(' · ')}>
      <span className={`pshelf__stand trophy-tone--${trophyTone(trophy.period, trophy.rank)}`}>
        <TrophyIcon trophy={trophy} size="lg" />
        {times ? (
          <span className="pshelf__times" aria-hidden="true">
            ×{times}
          </span>
        ) : null}
      </span>
      <span className="pshelf__plate">
        <span className="pshelf__plate-name">{title}</span>
        <span className="pshelf__plate-when">{plateWhenOf(trophy)}</span>
      </span>
      {times ? <span className="pshelf__sr">Won {numberWord(times)} times.</span> : haul ? <span className="pshelf__sr">{haul}</span> : null}
    </li>
  )
}

/** A gap on the ledge: this week's open place, or the secrets still hidden. Its plate is quieter. */
function Gap({ art, name, when }: { art: ReactNode; name: string; when: string }) {
  return (
    <li className="pshelf__item pshelf__item--gap">
      <span className="pshelf__stand trophy-tone--hidden" aria-hidden="true">
        {art}
      </span>
      <span className="pshelf__plate">
        <span className="pshelf__plate-name">{name}</span>
        <span className="pshelf__plate-when">{when}</span>
      </span>
    </li>
  )
}

/** One of the cabinet's ledges: its name and a count along a rule, then its trophies standing on the glass. */
function Section({ name, count, children, after }: { name: string; count: string; children?: ReactNode; after?: ReactNode }) {
  return (
    <section className="pshelf__section" aria-label={name}>
      <div className="pshelf__sec-head">
        <h3 className="pshelf__sec-name">{name}</h3>
        <span className="pshelf__sec-rule" aria-hidden="true" />
        <span className="pshelf__sec-count">{count}</span>
      </div>
      {children ? <ol className="pshelf__ledge">{children}</ol> : null}
      {after}
    </section>
  )
}

/** Events won, one each by name: the same event won again stands once, with all its wins, newest first. */
function eventWins(events: TrophyAward[]): TrophyAward[][] {
  const byName = new Map<string, TrophyAward[]>()
  for (const t of events) {
    const key = (t.eventTitle ?? t.id).trim().toLowerCase()
    const wins = byName.get(key)
    if (wins) wins.push(t)
    else byName.set(key, [t])
  }
  return [...byName.values()]
}

/**
 * The trophy shelf: a dark display cabinet with glass ledges, the rarest
 * trophy given pride of place on a pedestal above them. Event wins stand on
 * one ledge, full months of the bug hunt on another, secrets on a third and
 * top-ten finishes of a week, a month or a season on the last, newest first.
 * Your own shelf keeps a gap open for this week, and one for the secrets
 * still hidden. With nothing on it yet, it says how things get onto it; for
 * most of the arcade that is winning an event among friends or catching a
 * month of bugs, since the top ten of everyone is a small club.
 */
export function TrophyShelf({
  trophies,
  isSelf,
  name,
}: {
  /** Null while loading. */
  trophies: TrophyAward[] | null
  isSelf: boolean
  name: string
}) {
  const [showAll, setShowAll] = useState(false)
  // While a season has standings, its top ten take trophies too, as each week's and month's do.
  const seasons = seasonHasStandings(useSeason().season)

  if (trophies === null) {
    return (
      <article className="pshelf pcard-panel" id="trophies" aria-busy="true" aria-label="Trophies">
        <div className="pshelf__head">
          <h2 className="pshelf__title">Trophy shelf</h2>
        </div>
        <div className="pshelf__cabinet pshelf__cabinet--wait" aria-hidden="true" />
      </article>
    )
  }

  const newest = (a: TrophyAward, b: TrophyAward) => b.awardedAt - a.awardedAt || a.rank - b.rank
  const events = trophies.filter((t) => t.period === 'event').sort(newest)
  const sets = trophies.filter((t) => t.period === 'hunt').sort(newest)
  const secrets = trophies.filter((t) => t.period === 'secret').sort(newest)
  const hidden = isSelf ? SECRETS.filter((x) => !secrets.some((t) => t.periodKey === x.n)) : []
  const boards = trophies.filter((t) => t.period === 'weekly' || t.period === 'monthly' || t.period === 'season').sort(newest)
  const shownBoards = showAll ? boards : boards.slice(0, BOARD_SHOWN)
  const pride = trophies.length >= PRIDE_FROM ? proudestTrophy(trophies) : null
  const prideHaul = pride ? trophyHaul(pride, isSelf) : null
  const s = summarizeTrophies(trophies)
  const bits = [
    s.events > 0 ? `${s.events} ${s.events === 1 ? 'event' : 'events'} won` : null,
    s.podium > 0 ? `${s.podium} ${s.podium === 1 ? 'podium' : 'podiums'}` : null,
    s.topTen > 0 ? `${s.topTen} top ten` : null,
    s.sets ? `${s.sets} bug hunt ${s.sets === 1 ? 'set' : 'sets'}` : null,
    s.secrets ? `${s.secrets} ${s.secrets === 1 ? 'secret' : 'secrets'}` : null,
  ].filter(Boolean)

  return (
    <article className="pshelf pcard-panel" id="trophies" aria-labelledby="pshelf-title">
      <div className="pshelf__head">
        <h2 className="pshelf__title" id="pshelf-title">
          Trophy shelf
        </h2>
        <span className="pshelf__note">{trophies.length === 0 ? 'None yet' : bits.join(' · ')}</span>
      </div>

      {trophies.length === 0 ? (
        <div className="pshelf__shelf pshelf__shelf--grow pshelf__shelf--empty">
          <p className="pshelf__cap">Ways onto the shelf</p>
          <ul className="pshelf__ways">
            <li className="pshelf__way">
              <span className="pshelf__plinth pshelf__plinth--empty">
                <EventCup size="md" />
              </span>
              <span className="pshelf__words">
                <span className="pshelf__name">Win an event</span>
                <span className="pshelf__when">
                  {isSelf
                    ? 'Start one with friends. Whoever finishes on top takes a trophy.'
                    : `Every event’s winner takes a trophy.`}
                </span>
                {isSelf ? (
                  <a className="pshelf__link" href={tournamentCreateHref()}>
                    Create an event ›
                  </a>
                ) : null}
              </span>
            </li>
            <li className="pshelf__way">
              <span className="pshelf__plinth pshelf__plinth--empty">
                <HuntSetJar size="md" />
              </span>
              <span className="pshelf__words">
                <span className="pshelf__name">Catch every bug</span>
                <span className="pshelf__when">
                  {isSelf
                    ? `A bug hides somewhere on the site every day. Catch all ${numberWord(SET_SIZE)} in a month.`
                    : `A full month of the daily bug hunt goes on the shelf.`}
                </span>
              </span>
            </li>
            <li className="pshelf__way">
              <span className="pshelf__plinth pshelf__plinth--empty">
                <SecretUnknown size="md" />
              </span>
              <span className="pshelf__words">
                <span className="pshelf__name">Find a secret</span>
                <span className="pshelf__when">
                  {isSelf
                    ? `${SECRETS.length} secret trophies are hidden around the arcade.`
                    : 'Some trophies are secret, hidden around the arcade.'}
                </span>
              </span>
            </li>
            <li className="pshelf__way">
              <span className="pshelf__plinth pshelf__plinth--empty">
                <TopTenRibbon tone="weekly" size="md" />
              </span>
              <span className="pshelf__words">
                <span className="pshelf__name">Arcade top ten</span>
                <span className="pshelf__when">
                  {isSelf
                    ? `Finish ${seasons ? 'a week, a month or a season' : 'a week or a month'} in the top ten of the whole arcade.`
                    : `${name}’s first top-ten ${seasons ? 'week, month or season' : 'week or month'} will show here.`}
                </span>
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <div className="pshelf__cabinet">
          {pride ? (
            <div className="pshelf__pride">
              <span className={`pshelf__pedestal trophy-tone--${trophyTone(pride.period, pride.rank)}`} aria-hidden="true">
                <TrophyIcon trophy={pride} size="lg" />
              </span>
              <span className="pshelf__pride-words">
                <span className="pshelf__pride-cap">Pride of place</span>
                <span className="pshelf__pride-name">{trophyTitle(pride)}</span>
                <span className="pshelf__pride-when">{[whenLineOf(pride), prideHaul].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          ) : null}
          {events.length > 0 ? (
            <Section name="Events won" count={String(events.length)}>
              {eventWins(events).map((wins) => (
                <Item key={wins[0]!.id} trophy={wins[0]!} isSelf={isSelf} wins={wins} />
              ))}
            </Section>
          ) : null}
          {sets.length > 0 ? (
            <Section name="Bug hunt" count={String(sets.length)}>
              {sets.map((t) => (
                <Item key={t.id} trophy={t} isSelf={isSelf} />
              ))}
            </Section>
          ) : null}
          {secrets.length > 0 || hidden.length > 0 ? (
            <Section name="Secrets" count={isSelf ? `${secrets.length} of ${SECRETS.length}` : String(secrets.length)}>
              {secrets.map((t) => (
                <Item key={t.id} trophy={t} isSelf={isSelf} />
              ))}
              {hidden.length > 0 ? (
                <Gap
                  art={<SecretUnknown size="lg" />}
                  name={hidden.length === 1 ? 'One to find' : `${hidden.length} to find`}
                  when="Hidden about"
                />
              ) : null}
            </Section>
          ) : null}
          {boards.length > 0 || isSelf ? (
            <Section
              name="Arcade top ten"
              count={String(boards.length)}
              after={
                boards.length > BOARD_SHOWN ? (
                  <button type="button" className="pshelf__more" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show fewer' : `Show all ${boards.length}`}
                  </button>
                ) : null
              }
            >
              {shownBoards.map((t) => (
                <Item key={t.id} trophy={t} isSelf={isSelf} />
              ))}
              {isSelf ? <Gap art={<span className="pshelf__open">+</span>} name="This week" when="Still open" /> : null}
            </Section>
          ) : null}
        </div>
      )}
      <p className="pshelf__foot">
        The arcade’s top ten each {seasons ? 'week, month and season' : 'week and month'} get a trophy, and so does
        every event’s winner and every full month of the bug hunt. Some trophies are secret, hidden around the arcade.
      </p>
    </article>
  )
}
