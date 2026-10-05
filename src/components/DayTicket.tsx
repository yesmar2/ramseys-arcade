import type { CSSProperties, ReactNode } from 'react'
import { isRankedGame } from '../data/games'
import { PlayIcon } from './chromeIcons'
import { DailyKindTag } from './DailyKindTag'
import type { TodayFreezes } from '../lib/today'
import { GameArt } from './GameArt'
import { MedalIcon } from './RaceMedal'
import { MEDAL_NAMES, type Medal } from '../lib/raceMedals'
import { StreakFreezes } from './StreakFreezes'
import { FlameIcon, StarIcon } from './TodayChip'
import '../styles/today.css'

/*
 * A day's ticket on the Dailies page, today's (TodayCard) or a past day's (PastDayTicket), one frame for
 * both so they always look alike: a stub with the streak and the day's punches as pips, then the day's
 * dailies as tiles, all across on a desktop and three a row on a narrower ticket. Each tile is its game's
 * picture and name, then how it went or the way in; the day's course is their tip. On a phone the stub
 * goes, as the page's head just over it says the same. Ramsey picked the tiles on 2026-10-01 ("lot of
 * text, plus we have six games in there now"), for every day ("they should all match"), and the stub
 * gone on a phone.
 */

export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)

/** A daily on a day's ticket: what its tile shows. */
export type TicketTile = {
  key: string
  slug: string
  game: string
  /** The day's course, the tip on the picture and the name: "Hole #7 · Meadow Flipper". */
  course: string
  /** Where the picture and the name go: the game's page, or its Past tab at the day's course. */
  page: string
  done: boolean
  /** How it went, once done: "3 tries", "55.80s"; "Done" where that isn't known. */
  result: string | null
  /** Under the result, smaller: a past day's place, "38th of 65". */
  note: string | null
  /** A racing daily's medal against the day's blue (lib/raceMedals.ts), beside the result. */
  medal?: Medal | null
  /** The way in while it's still to play: where, its word ("Race", "Carry on"), its name read aloud, and its tip. */
  play: string
  go: string
  goLabel: string
  goTip: string | null
}

/**
 * A daily's tile: its picture and name, then how it went or the way in. Whether it's ranked or just for fun
 * is a mark on the picture's top corner, with a tip of its own, so it sits beside the picture's link rather
 * than in it; punched is a check on the other corner, over the picture dimmed.
 */
function Tile({ tile: t }: { tile: TicketTile }) {
  return (
    <li className={`today-tile${t.done ? ' today-tile--done' : ''}`}>
      <div className="today-tile__pic">
        <a className="today-tile__art" href={t.page} title={t.course} tabIndex={-1} aria-hidden="true">
          <GameArt slug={t.slug} className="today-tile__scene" />
        </a>
        <DailyKindTag slug={t.slug} look="badge" className="today-tile__kind" />
        {t.done ? (
          <span className="today-tile__check" aria-hidden="true">
            <CheckIcon />
          </span>
        ) : null}
      </div>
      <a className="today-tile__game" href={t.page} title={t.course}>
        {t.game}
      </a>
      {t.done ? (
        <span className="today-tile__result">
          <span className="today-tile__score">
            <CheckIcon />
            <span className="visually-hidden">Punched: </span>
            {t.result ?? 'Done'}
            {t.medal ? (
              <span className="today-tile__medal" title={`${MEDAL_NAMES[t.medal]} medal`}>
                <MedalIcon medal={t.medal} size={16} />
                <span className="visually-hidden">, {MEDAL_NAMES[t.medal]} medal</span>
              </span>
            ) : null}
          </span>
          {t.note ? <span className="today-tile__note">{t.note}</span> : null}
        </span>
      ) : (
        <a className="today-tile__go" href={t.play} title={t.goTip ?? undefined} aria-label={t.goLabel}>
          <PlayIcon />
          {t.go}
        </a>
      )}
    </li>
  )
}

/** A day's tiles in their groups, in order: ranked, then just for fun; a group with none is left out. */
function groupsOf(tiles: TicketTile[]): { kind: 'fun' | 'ranked'; tiles: TicketTile[] }[] {
  const ranked = tiles.filter((t) => isRankedGame(t.slug))
  const fun = tiles.filter((t) => !isRankedGame(t.slug))
  return [
    { kind: 'ranked' as const, tiles: ranked },
    { kind: 'fun' as const, tiles: fun },
  ].filter((g) => g.tiles.length > 0)
}

/** How many are done, beside the title: "2 of 6 done", the "done" left off on a phone. */
export function DoneCount({ done, total }: { done: number; total: number }) {
  return (
    <>
      {done} of {total}
      <span className="today-card__count-word"> done</span>
    </>
  )
}

type DayTicketProps = {
  /** The heading's id, which names the ticket. */
  labelId: string
  title: string
  /** Beside the title: how many are done (DoneCount), or what the day had. */
  count: ReactNode
  /** At the head's end: today's Share. */
  action?: ReactNode
  /** The stub's head word: "Your streak", or the day. */
  kicker: string
  /** The streak, the stub's big number, beside its line; null, the line alone (signed out, or not known yet). */
  streak: number | null
  /** A Full ticket: the streak's flame a gold star, the pips gold. */
  full: boolean
  line: string | null
  /** Today's streak freezes held, under the streak (StreakFreezes); left out for a past day, or signed out. */
  freezes?: TodayFreezes | null
  /** The day's punches, as pips; null for none (a past day, signed out). */
  punched: { done: number; total: number } | null
  tiles: TicketTile[]
  /** Under the tiles: today's bonus punches, or a past day's note. */
  children?: ReactNode
}

export function DayTicket({ labelId, title, count, action, kicker, streak, full, line, freezes, punched, tiles, children }: DayTicketProps) {
  return (
    <section className="today" aria-labelledby={labelId}>
      <div className="today-card">
        <div className="today-card__stub">
          <span className="today-card__notch today-card__notch--a" aria-hidden="true" />
          <span className="today-card__notch today-card__notch--b" aria-hidden="true" />
          <span className="today-card__label">{kicker}</span>
          {streak != null ? (
            <p className={`today-streak${full ? ' today-streak--full' : ''}`}>
              <span className="today-streak__n">{streak}</span>
              {full ? <StarIcon /> : <FlameIcon />}
              <span className="today-streak__line">
                <span className="visually-hidden">{streak === 1 ? 'day' : 'days'} in a row. </span>
                {line}
              </span>
            </p>
          ) : line ? (
            <p className="today-streak__line">{line}</p>
          ) : null}
          {streak != null && freezes ? <StreakFreezes freezes={freezes} className="sfz--stub" /> : null}
          {/* The day's punches, done first. The head says the count aloud. */}
          {punched ? (
            <span className={`today-pips${full ? ' today-pips--full' : ''}`} aria-hidden="true">
              {Array.from({ length: punched.total }, (_, i) => (
                <span key={i} className={`today-pips__pip${i < punched.done ? ' today-pips__pip--on' : ''}`} />
              ))}
              <span className="today-pips__count">
                {punched.done} of {punched.total}
              </span>
            </span>
          ) : null}
        </div>

        <div className="today-card__body">
          <div className="today-card__head">
            <h2 id={labelId} className="today-card__title">
              {title}
            </h2>
            <p className="today-card__count">{count}</p>
            {action}
          </div>
          {/*
           * The ranked dailies, then the just-for-fun ones (lib/today.ts TODAY_DAILIES has them so), each group
           * under its tag, so which count toward your rank is plain at a glance. Side by side while there's
           * room, the narrower ticket stacks them, three a row.
           */}
          <div className="today-groups">
            {groupsOf(tiles).map((group) => (
              <div key={group.kind} className={`today-group today-group--${group.kind}`} style={{ '--n': group.tiles.length } as CSSProperties}>
                <div className="today-group__label">
                  <DailyKindTag slug={group.tiles[0]!.slug} look="chip" />
                </div>
                <ul className="today-tiles" style={{ '--n': group.tiles.length } as CSSProperties}>
                  {group.tiles.map((t) => (
                    <Tile key={t.key} tile={t} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {children}
        </div>
      </div>
    </section>
  )
}
