import { useEffect, useState } from 'react'
import { getGame, isGameHidden } from '../data/games'
import { globalRankingsHref, recordsHref, siteRecordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { dailyPick } from '../lib/homePicks'
import {
  fetchGlobalBoard,
  normalizePlayerName,
  PERIOD_LABELS,
  type GlobalBoardEntry,
  type GlobalBoardResult,
} from '../lib/leaderboard'
import { fetchGameRecords, formatRecordScore, GAMES_WITH_RECORDS, type RecordSummary } from '../lib/records'
import { fetchSiteRecords, siteRecordUnitWord, type SiteRecordBoard, type SiteRecordId } from '../lib/siteRecords'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { medalKind } from './PodiumMedal'
import { HiddenBug } from './BugHunt'

/** A points figure that agrees with itself: 1 pt, 2 pts. */
function pts(n: number) {
  return `${n.toLocaleString()} ${n === 1 ? 'pt' : 'pts'}`
}

/** The house records worth a plaque on the front page, in the order they hang. */
const PLAQUES: SiteRecordId[] = ['day-streak', 'days-played', 'runs-in-a-day', 'boards-topped']

/** One game's record book a day, so the front page walks through all of them. */
function spotlightGame(): string | null {
  return dailyPick(GAMES_WITH_RECORDS.filter((slug) => !isGameHidden(slug)))
}

function Standings({
  board,
  you,
}: {
  board: GlobalBoardResult | null
  you: string
}) {
  const period = useDefaultPeriod()
  const { rank, score, nearby = [], avatarId } = useGlobalRank()
  const loading = useGlobalRankLoading()
  const entries = board?.entries ?? []
  const youOnList = Boolean(you) && entries.some((e) => e.name === you)
  // Ranked, but below the rows shown: your own row goes under them.
  const yourRow: GlobalBoardEntry | null =
    you && rank != null && !youOnList && entries.length > 0
      ? { name: you, rank, score, games: 0, avatarId }
      : null
  const ahead = rank != null ? nearby.find((n) => n.rank === rank - 1) : undefined
  const behind = rank != null ? nearby.find((n) => n.rank === rank + 1) : undefined

  const row = (e: GlobalBoardEntry) => {
    const medal = medalKind(e.rank)
    return (
      <li key={`${e.rank}-${e.name}`} className={`hb-row${e.name === you ? ' hb-row--you' : ''}`}>
        <span className={`hb-row__rank${medal ? ` hb-row__rank--${medal}` : ''}`}>{e.rank}</span>
        <PlayerMark name={e.name} avatarId={e.avatarId} className="hb-row__mark" />
        <span className="hb-row__name">{e.name}</span>
        {e.name === you ? <span className="hb-row__you">You</span> : null}
        <span className="hb-row__pts">
          {e.score.toLocaleString()} <small>{e.score === 1 ? 'pt' : 'pts'}</small>
        </span>
      </li>
    )
  }

  return (
    <article className="hb-panel hb-panel--standings">
      <div className="hb-panel__head">
        <h3 className="hb-panel__title">Standings</h3>
        <a className="home-section__more" href={globalRankingsHref(period)}>
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
      ) : entries.length === 0 ? (
        <p className="hb-empty">Nobody is on the board yet. The first score posted takes #1.</p>
      ) : (
        <ol className="hb-rows">
          {entries.map(row)}
          {yourRow ? (
            <>
              <li className="hb-row hb-row--gap" aria-hidden="true">
                ⋯
              </li>
              {row(yourRow)}
            </>
          ) : null}
        </ol>
      )}
      {you && rank != null && !loading ? (
        <div className="hb-gaps">
          {ahead ? (
            <div className="hb-gap">
              <b>{pts(ahead.score - score)}</b>
              <span>
                to catch {ahead.name} at #{ahead.rank}
              </span>
            </div>
          ) : null}
          {behind ? (
            <div className="hb-gap">
              <b>{pts(score - behind.score)}</b>
              <span>{rank === 1 ? `your lead over ${behind.name}` : `between you and ${behind.name}`}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="hb-note">
          Every game&rsquo;s board pays points by place, and first pays 100.{' '}
          {you ? 'Post one score anywhere and you are on this list.' : 'Sign in with a gamer tag and your scores count here.'}
        </p>
      )}
    </article>
  )
}

function HouseRecords({ boards }: { boards: SiteRecordBoard[] | null }) {
  return (
    <article className="hb-panel">
      <div className="hb-panel__head">
        <h3 className="hb-panel__title">
          House records
          <HiddenBug spot="home-records" pose="peek" />
        </h3>
        <a className="home-section__more" href={siteRecordsHref()}>
          All ›
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
                return (
                  <li key={board.id} className="hb-plaque">
                    <span className="hb-plaque__value">
                      {top ? top.value.toLocaleString() : '—'}
                      {top ? <small> {siteRecordUnitWord(top.value, board.unit)}</small> : null}
                    </span>
                    <span className="hb-plaque__label">{board.label}</span>
                    <span className="hb-plaque__who">{top ? top.name : 'Nobody yet'}</span>
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
    <article className="hb-panel">
      <div className="hb-panel__head">
        <span className="hb-panel__art" aria-hidden="true">
          <GameThumbArt slug={slug} accent={accent} />
        </span>
        <h3 className="hb-panel__title">{game?.name ?? slug} record book</h3>
        <a className="home-section__more" href={recordsHref(slug)}>
          Open ›
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
                <span className="hb-record__value">{formatRecordScore(r.top!.score, r.unit, r.id)}</span>
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
