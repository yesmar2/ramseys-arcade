import { useState, type ReactNode } from 'react'
import { tournamentCreateHref } from '../hooks/useHashRoute'
import { ordinal } from '../lib/profileMath'
import { summarizeTrophies, trophyTone, type TrophyAward } from '../lib/trophies'
import { medalKind } from './PodiumMedal'
import { SET_SIZE } from '../lib/bugHuntPick'
import { numberWord } from '../lib/numberWord'
import { secretByNumber, SECRETS } from '../lib/secrets'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SecretArt, SecretUnknown, TopTenRibbon, WeeklyMedal, type TrophyArtSize } from './TrophyArt'

/** Board trophies shown before "Show all": three rows on a phone, two on a wide screen with your open place. */
const BOARD_SHOWN = 9

function TrophyIcon({ trophy, size = 'md' }: { trophy: TrophyAward; size?: TrophyArtSize }) {
  const kind = medalKind(trophy.rank)
  // An event win is a cup: the whole thing, not a place on a board.
  if (trophy.period === 'event') return <EventCup size={size} />
  if (trophy.period === 'hunt') return <HuntSetJar size={size} />
  if (trophy.period === 'secret') return <SecretArt n={trophy.periodKey} size={size} />
  if (trophy.period === 'monthly') return kind ? <MonthlyTrophyCup tone={kind} size={size} /> : <TopTenRibbon tone="monthly" rank={trophy.rank} size={size} />
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
  if (t.period === 'secret') return isSelf ? (secretByNumber(t.periodKey)?.says ?? null) : 'Nobody says how to find it'
  if (t.score <= 0 || t.games <= 0) return null
  return t.games === 1 ? 'on 1 game' : `over ${t.games} games`
}

/**
 * A trophy in its own lit nook of the cabinet, spotlit in its colour, with
 * what it was and when under it. What it was won with is in the trophy's hover
 * text, and read out.
 */
function Item({ trophy, isSelf }: { trophy: TrophyAward; isSelf: boolean }) {
  const isEvent = trophy.period === 'event'
  const isSet = trophy.period === 'hunt'
  const isSecret = trophy.period === 'secret'
  const title = isEvent
    ? (trophy.eventTitle ?? 'An event')
    : isSet
      ? `${setMonthOf(trophy.periodKey)}’s full set`
      : isSecret
        ? (secretByNumber(trophy.periodKey)?.name ?? 'A secret')
        : `${ordinal(trophy.rank)} of the ${trophy.period === 'monthly' ? 'month' : 'week'}`
  const when = trophyWhen(trophy)
  const whenLine = isSecret ? `Found ${when}` : when
  const haul = trophyHaul(trophy, isSelf)
  return (
    <li className="pshelf__cell" title={[title, whenLine, haul].filter(Boolean).join(' · ')}>
      <span className={`pshelf__niche trophy-tone--${trophyTone(trophy.period, trophy.rank)}`}>
        <TrophyIcon trophy={trophy} size="lg" />
      </span>
      <span className="pshelf__cell-name">{title}</span>
      <span className="pshelf__cell-when">{whenLine}</span>
      {haul ? <span className="pshelf__sr">{haul}</span> : null}
    </li>
  )
}

/** One of the cabinet's shelves: its name and a count along a rule, then its nooks. */
function Section({ name, count, children, after }: { name: string; count: string; children?: ReactNode; after?: ReactNode }) {
  return (
    <section className="pshelf__section" aria-label={name}>
      <div className="pshelf__sec-head">
        <h3 className="pshelf__sec-name">{name}</h3>
        <span className="pshelf__sec-rule" aria-hidden="true" />
        <span className="pshelf__sec-count">{count}</span>
      </div>
      {children ? <ol className="pshelf__grid">{children}</ol> : null}
      {after}
    </section>
  )
}

/**
 * The trophy shelf: a dark display cabinet, each trophy lit in a nook of its
 * own, with event wins on one shelf, full months of the bug hunt on another,
 * secrets on a third and top-ten finishes of a week or a month on the last,
 * newest first. Your own shelf keeps a nook open for this week, and shows how
 * many secrets are still hidden. With nothing on it yet, it says how things
 * get onto it; for most of the arcade that is winning an event among friends
 * or catching a month of bugs, since the top ten of everyone is a small club.
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
  const boards = trophies.filter((t) => t.period === 'weekly' || t.period === 'monthly').sort(newest)
  const shownBoards = showAll ? boards : boards.slice(0, BOARD_SHOWN)
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
                    ? `${SECRETS.length} trophies are secret. Nobody says how to find them.`
                    : 'Some trophies are secret, and nobody says how to find them.'}
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
                    ? 'Finish a week or a month in the top ten of the whole arcade.'
                    : `${name}’s first top-ten week or month will show here.`}
                </span>
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <div className="pshelf__cabinet">
          {events.length > 0 ? (
            <Section name="Events won" count={String(events.length)}>
              {events.map((t) => (
                <Item key={t.id} trophy={t} isSelf={isSelf} />
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
            <Section
              name="Secrets"
              count={isSelf ? `${secrets.length} of ${SECRETS.length}` : String(secrets.length)}
              after={
                hidden.length > 0 ? (
                  <div className="pshelf__minis">
                    <span className="pshelf__minis-row" aria-hidden="true">
                      {hidden.map((x) => (
                        <span key={x.n} className="pshelf__mini">
                          <SecretUnknown size="sm" />
                        </span>
                      ))}
                    </span>
                    <span className="pshelf__minis-note">
                      {hidden.length === 1 ? 'One still hidden.' : `${hidden.length} still hidden.`} Nobody says how to find them.
                    </span>
                  </div>
                ) : null
              }
            >
              {secrets.length > 0 ? secrets.map((t) => <Item key={t.id} trophy={t} isSelf={isSelf} />) : null}
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
              {isSelf ? (
                <li className="pshelf__cell pshelf__cell--open">
                  <span className="pshelf__niche pshelf__niche--open" aria-hidden="true">
                    +
                  </span>
                  <span className="pshelf__cell-name">This week</span>
                  <span className="pshelf__cell-when">Still open</span>
                </li>
              ) : null}
            </Section>
          ) : null}
        </div>
      )}
      <p className="pshelf__foot">
        The arcade’s top ten each week and month get a trophy, and so does every event’s winner and every full month
        of the bug hunt. Some trophies are secret: nobody says how to get them.
      </p>
    </article>
  )
}
