import { useEffect, useState } from 'react'
import { getGame, isDailyGame, isGameListed } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { recordsPlaceHref, siteRecordsHref, standingsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { useActiveGroup, useScope } from '../lib/groups'
import { dailyPick } from '../lib/homePicks'
import { houseHolderLine, houseHolders } from '../lib/houseBook'
import {
  fetchGlobalBoard,
  normalizePlayerName,
  PERIOD_LABELS,
  type GlobalBoardEntry,
  type GlobalBoardResult,
} from '../lib/leaderboard'
import { recordValue } from '../lib/recordBook'
import { fetchGameRecords, GAMES_WITH_RECORDS, type RecordSummary } from '../lib/records'
import { fetchSiteRecords, siteRecordUnitWord, type SiteRecordBoard, type SiteRecordId } from '../lib/siteRecords'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { medalKind } from './PodiumMedal'
import { PlayerName } from './PlayerName'
import { openSiteMenu } from './siteNav'

/** The house records worth a plaque on the front page, in the order they hang. */
const PLAQUES: SiteRecordId[] = ['day-streak', 'days-played', 'games-in-a-day', 'boards-topped']

/**
 * One game's record book a day, so the front page walks through all of them. The dailies sit this out:
 * their records are on each one's page (its Records tab), not in a book.
 */
function spotlightGame(): string | null {
  return dailyPick(GAMES_WITH_RECORDS.filter((slug) => isGameListed(slug) && !isDailyGame(slug)))
}

function Standings({
  board,
  you,
}: {
  board: GlobalBoardResult | null
  you: string
}) {
  const period = useDefaultPeriod()
  const { nobody } = useScope()
  const { signedIn, signedOut } = useAuth()
  const { rank, score, nearby = [], avatarId } = useGlobalRank()
  const loading = useGlobalRankLoading()
  const entries = board?.entries ?? []
  const empty = board != null && entries.length === 0
  const youOnList = Boolean(you) && entries.some((e) => e.name === you)
  // Ranked, but below the rows shown: your own row goes under them.
  const yourRow: GlobalBoardEntry | null =
    you && rank != null && !youOnList && entries.length > 0
      ? { name: you, rank, score, games: 0, avatarId }
      : null
  // The gap over your row: none when it comes straight after the last row shown, but on a phone, which leaves
  // out the rows after the third (home.css).
  const last = entries[entries.length - 1]
  const nextAfter = yourRow != null && last != null && yourRow.rank === last.rank + 1
  const gap = !yourRow ? null : !nextAfter ? 'hb-row--gap' : entries.length > 3 ? 'hb-row--gap hb-row--gap-phone' : null
  const ahead = rank != null ? nearby.find((n) => n.rank === rank - 1) : undefined
  const behind = rank != null ? nearby.find((n) => n.rank === rank + 1) : undefined

  // Places and names only: the points behind them stay on the full Standings list, a tap away.
  const row = (e: GlobalBoardEntry) => {
    const medal = medalKind(e.rank)
    return (
      <li key={`${e.rank}-${e.name}`} className={`hb-row${e.name === you ? ' hb-row--you' : ''}`}>
        <span className={`hb-row__rank${medal ? ` hb-row__rank--${medal}` : ''}`}>{e.rank}</span>
        <PlayerMark name={e.name} avatarId={e.avatarId} className="hb-row__mark" />
        <PlayerName className="hb-row__name" name={e.name} avatarId={e.avatarId} />
        {e.name === you ? <span className="hb-row__you">You</span> : null}
      </li>
    )
  }

  return (
    <article className="hb-panel hb-panel--standings" data-hunt="home-standings">
      <div className="hb-panel__head">
        <h3 className="hb-panel__title">Standings</h3>
        <a className="home-section__more" href={standingsHref(period)}>
          Full board ›
        </a>
      </div>
      {board == null ? (
        <ol className="hb-rows" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="hb-row hb-row--skel">
              <span className="skel-line" />
            </li>
          ))}
        </ol>
      ) : empty ? (
        <p className="hb-empty">{nobody} is on the board yet. The first score posted takes #1.</p>
      ) : (
        <ol className="hb-rows">
          {entries.map(row)}
          {yourRow ? (
            <>
              {gap ? (
                <li className={`hb-row ${gap}`} aria-hidden="true">
                  ⋯
                </li>
              ) : null}
              {row(yourRow)}
            </>
          ) : null}
        </ol>
      )}
      {you && rank != null && !loading ? (
        <div className="hb-gaps">
          {/* Who is either side of you, by name: the label first, so it reads "Next up: SAM at #13". */}
          {ahead ? (
            <div className="hb-gap">
              <span>Next up</span>
              <b>
                {ahead.name} at #{ahead.rank}
              </b>
            </div>
          ) : null}
          {behind ? (
            <div className="hb-gap">
              <span>{rank === 1 ? 'You lead' : 'Right behind you'}</span>
              <b>{behind.name}</b>
            </div>
          ) : null}
        </div>
      ) : empty && you ? null : (
        // Not under an empty board as well: its own line already says the first score takes #1.
        <p className="hb-note">
          {/* All time leaves the dailies out (lib/allTime.ts). */}
          {you ? (
            `Post a score in any ranked game${period === 'all' ? ' but the dailies' : ''} and you’re on this list.`
          ) : signedIn ? (
            <>
              {/* Signed in with no tag yet: it's a tag that's missing, picked in the menu, as on the Dailies page. */}
              <button type="button" className="hb-note__signin" onClick={openSiteMenu}>
                Pick a gamer tag
              </button>{' '}
              and your scores count here.
            </>
          ) : signedOut ? (
            <>
              {/* The menu, where signing in lives, as on the Dailies page. */}
              <button type="button" className="hb-note__signin" onClick={openSiteMenu}>
                Sign in
              </button>{' '}
              and your scores count here.
            </>
          ) : (
            // A session whose account isn't known yet: the line's room, never Sign in.
            '\u00a0'
          )}
        </p>
      )}
    </article>
  )
}

function HouseRecords({ boards }: { boards: SiteRecordBoard[] | null }) {
  return (
    <article className="hb-panel" data-hunt="home-records">
      <div className="hb-panel__head">
        <h3 className="hb-panel__title">House records</h3>
        {/* Named in full for a screen reader's list of links, where "All" alone says nothing. */}
        <a className="home-section__more" href={siteRecordsHref()}>
          All<span className="visually-hidden"> house records</span> ›
        </a>
      </div>
      <ul className="hb-plaques">
        {boards == null
          ? PLAQUES.map((id) => (
              <li key={id} className="hb-plaque hb-plaque--skel" aria-hidden="true">
                <span className="skel-line" />
              </li>
            ))
          : PLAQUES.map((id) => boards.find((b) => b.id === id))
              .filter((board): board is SiteRecordBoard => Boolean(board))
              .map((board) => {
                const top = board.entries[0] ?? null
                const holders = houseHolders(board)
                return (
                  <li key={board.id} className="hb-plaque">
                    <span className="hb-plaque__value">
                      {top ? top.value.toLocaleString() : '—'}
                      {top ? <small> {siteRecordUnitWord(top.value, board.unit)}</small> : null}
                    </span>
                    <span className="hb-plaque__label">{board.label}</span>
                    {/* Everyone on the most, not just the first of them. */}
                    <span className="hb-plaque__who">{holders ? houseHolderLine(holders) : 'Nobody yet'}</span>
                  </li>
                )
              })}
      </ul>
    </article>
  )
}

function RecordBook({ slug, records }: { slug: string; records: RecordSummary[] | null }) {
  const game = getGame(slug)
  const accent = resolveGameAccent(slug, game?.accent ?? 'var(--accent)')
  const set = (records ?? []).filter((r) => r.top).slice(0, 5)
  if (records != null && set.length === 0) return null
  return (
    <article className="hb-panel hb-panel--book">
      <div className="hb-panel__head">
        <span className="hb-panel__art" aria-hidden="true">
          <GameThumbArt slug={slug} accent={accent} />
        </span>
        <h3 className="hb-panel__title">{game?.name ?? slug} record book</h3>
        <a className="home-section__more" href={recordsPlaceHref(slug)}>
          Open<span className="visually-hidden"> the {game?.name ?? slug} record book</span> ›
        </a>
      </div>
      <ul className="hb-records">
        {records == null
          ? [0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="hb-record hb-record--skel">
                <span className="skel-line" />
              </li>
            ))
          : set.map((r) => (
              <li key={r.id} className="hb-record">
                <span className="hb-record__label">{r.label}</span>
                <span className="hb-record__value">{recordValue(r, r.top!.score)}</span>
                <span className="hb-record__who">{r.top!.name}</span>
              </li>
            ))}
      </ul>
    </article>
  )
}

/**
 * The boards at a glance, under the wall: where everyone stands for the period
 * the header is set to, the arcade's house records, and one game's record
 * book, a different one each day. Standings follow the period and the group
 * like every other board; records are all time.
 */
export function HomeBoards() {
  const period = useDefaultPeriod()
  const groupId = useActiveGroup()
  // The boards' group, when they show one: all three panels are then the group's.
  const group = useScope().name
  const you = normalizePlayerName(usePlayerName())
  const bookGame = spotlightGame()
  const [board, setBoard] = useState<GlobalBoardResult | null>(null)
  const [house, setHouse] = useState<SiteRecordBoard[] | null>(null)
  const [book, setBook] = useState<RecordSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setBoard(null)
    fetchGlobalBoard(5, period)
      .then((result) => {
        if (!cancelled) setBoard(result)
      })
      .catch(() => {
        if (!cancelled) setBoard({ totalPlayers: 0, entries: [] })
      })
    return () => {
      cancelled = true
    }
  }, [period, groupId])

  useEffect(() => {
    let cancelled = false
    fetchSiteRecords(you)
      .then((result) => {
        if (!cancelled) setHouse(result.boards)
      })
      .catch(() => {
        if (!cancelled) setHouse([])
      })
    return () => {
      cancelled = true
    }
  }, [you, groupId])

  useEffect(() => {
    if (!bookGame) return
    let cancelled = false
    fetchGameRecords(bookGame, 'all')
      .then((result) => {
        if (!cancelled) setBook(result.records)
      })
      .catch(() => {
        if (!cancelled) setBook([])
      })
    return () => {
      cancelled = true
    }
  }, [bookGame, groupId])

  const players = board?.totalPlayers ?? 0

  return (
    <section className="hboards" aria-labelledby="hboards-title">
      <div className="home-section__bar">
        <h2 id="hboards-title" className="home-section__title">
          {PERIOD_LABELS[period]}
          {group ? ` · ${group}` : ''}
        </h2>
        {board && players > 0 ? (
          <span className="home-section__count">
            {players.toLocaleString()} {players === 1 ? 'player' : 'players'} ranked
          </span>
        ) : null}
      </div>
      <div className="hboards__grid">
        <Standings board={board} you={you} />
        <HouseRecords boards={house} />
        {bookGame ? <RecordBook slug={bookGame} records={book} /> : null}
      </div>
    </section>
  )
}
