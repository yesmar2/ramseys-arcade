import { useEffect, useState, type CSSProperties } from 'react'
import { BoardEmpty, BoardSkeleton } from '../components/BoardChrome'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageShell } from '../components/PageShell'
import { PlayerMark } from '../components/PlayerMark'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame, PALETTE } from '../data/games'
import { homeHref, rankHref, recordsIndexHref, siteRecordsHref, type Route } from '../hooks/useHashRoute'
import { usePageMeta } from '../hooks/usePageMeta'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import {
  HOUSE_LEDE,
  houseClosest,
  houseDay,
  houseGroups,
  houseHeadline,
  houseHeld,
  houseRunnerUp,
  houseValue,
  houseWhen,
  houseYouLine,
} from '../lib/houseBook'
import { normalizePlayerName } from '../lib/leaderboard'
import { ordinal } from '../lib/profileMath'
import { fetchSiteRecords, type SiteRecordBoard, type SiteRecordId, type SiteRecordStanding } from '../lib/siteRecords'

/*
 * The house book: the records about the arcade itself, laid out like a game's
 * record book. Its banner says whose name is in the most of it, over a wall of
 * cabinets with the longest streak on the marquee; then what you hold and are
 * closest to; then its records in three groups, each with its holder, what it
 * leads the runner-up by and where you stand; and last, each record's top ten.
 *
 * Every other book belongs to a cabinet and asks how well somebody played it.
 * This one asks how they played: how often they turned up, how far they
 * ranged, how long they kept a streak alive. None of it is scored during a
 * run; it's all read back out of the scores on the boards, which is why a
 * quiet player with a long habit can top it.
 */

/** Stable identity, so the meta effect does not re-run on every render. */
const SITE_RECORDS_ROUTE: Route = { name: 'siteRecords' }

/** The house book's colour: the gold of a hall of fame, where each game's book takes the game's. */
const HOUSE_ACCENT = PALETTE.amber

/** The cabinets on the banner's wall: the whole arcade, in four. */
const HOUSE_WALL = ['snake', 'asteroids', 'pellets', 'putt'] as const

const MEDALS = ['gold', 'silver', 'bronze'] as const

function BackIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="sb-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </svg>
  )
}

type Standing = SiteRecordStanding[SiteRecordId]

/** A record in its group's table: it, its holder, what it leads by, and you. The row goes to its top ten. */
function HouseRow({ board, you, standing }: { board: SiteRecordBoard; you: string; standing: Standing }) {
  const top = board.entries[0]
  const holder = top ? normalizePlayerName(top.name) : ''
  const mine = Boolean(you) && holder === you
  return (
    <li className={`rbk-rec${mine ? ' rbk-rec--you' : ''}${top ? '' : ' rbk-rec--empty'}`}>
      <a className="rbk-rec__link" href={`#house-${board.id}`}>
        <span className="rbk-rec__what">
          <span className="rbk-rec__label">{board.label}</span>
          <span className="rbk-rec__set">{top ? houseWhen(board, top.at) : 'no holder yet'}</span>
        </span>
        <span className="rbk-rec__value">{top ? houseValue(board, top.value) : '–'}</span>
        <span className="rbk-rec__holder">
          {top ? (
            <PlayerMark name={holder} avatarId={top.avatarId} className="rbk-rec__mark" />
          ) : (
            <span className="rbk-rec__mark rbk-rec__mark--open" aria-hidden="true" />
          )}
          <span className="rbk-rec__name">{top ? holder : 'Nobody yet'}</span>
        </span>
        <span className="rbk-rec__runner">{houseRunnerUp(board)}</span>
        <span className={`rbk-rec__you${standing?.rank === 1 ? ' rbk-rec__you--on' : ''}`}>{houseYouLine(board, standing)}</span>
      </a>
    </li>
  )
}

/** One record's top ten, with you under it when you're on it but not in it. */
function TopTen({ board, you, standing }: { board: SiteRecordBoard; you: string; standing: Standing }) {
  const listed = board.entries.some((e) => normalizePlayerName(e.name) === you)
  const last = board.entries[board.entries.length - 1]
  return (
    <section id={`house-${board.id}`} className="sb-card hbk-top" aria-labelledby={`hbk-top-${board.id}`}>
      <h3 id={`hbk-top-${board.id}`} className="hbk-top__title">
        {board.label}
      </h3>
      <p className="hbk-top__sub">{board.blurb}</p>
      {board.entries.length ? (
        <ol className="hbk-rows">
          {board.entries.map((entry, i) => {
            const name = normalizePlayerName(entry.name)
            const mine = Boolean(you) && name === you
            const medal = MEDALS[i]
            return (
              <li key={name} className={`hbk-row${medal ? ` hbk-row--${medal}` : ''}${mine ? ' hbk-row--you' : ''}`}>
                <a className="hbk-row__link" href={rankHref(name)}>
                  <span className="hbk-row__ord">{ordinal(i + 1).toUpperCase()}</span>
                  <PlayerMark name={name} avatarId={entry.avatarId} className="hbk-row__mark" />
                  <span className="hbk-row__who">
                    <span className="hbk-row__name">
                      <span>{name}</span>
                      {mine ? <span className="sb-row__you">You</span> : null}
                    </span>
                    {entry.at ? <span className="hbk-row__when">{houseDay(entry.at)}</span> : null}
                  </span>
                  <span className="hbk-row__value">{houseValue(board, entry.value)}</span>
                </a>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="hbk-top__note">Nobody yet.</p>
      )}
      {/* Only when you're not in the list already: a row repeated right under itself reads as a bug. */}
      {you && standing && !listed && standing.value > 0 && last ? (
        <p className="hbk-top__note">
          You: {houseValue(board, standing.value)}. Tenth has {houseValue(board, last.value)}.
        </p>
      ) : null}
    </section>
  )
}

export function SiteRecordsPage() {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const [data, setData] = useState<{ boards: SiteRecordBoard[]; you: SiteRecordStanding | null } | null>(null)
  const [failed, setFailed] = useState(false)

  usePageMeta(SITE_RECORDS_ROUTE)

  useEffect(() => {
    let live = true
    setFailed(false)
    fetchSiteRecords(you)
      .then((result) => {
        if (live) setData(result)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [you, groupId])

  const loading = !data && !failed
  const boards = data?.boards ?? []
  const head = houseHeadline(boards)
  const groups = houseGroups(boards)
  const held = houseHeld(boards, you)
  const close = houseClosest(boards, data?.you ?? null, you)
  // Your own avatar, from wherever you're on the lists.
  const yourAvatar = boards.flatMap((b) => b.entries).find((e) => normalizePlayerName(e.name) === you)?.avatarId
  const cover = boards.find((b) => b.id === 'day-streak') ?? boards[0]
  const coverTop = cover?.entries[0]
  const style = { '--hero-accent': HOUSE_ACCENT, '--hero-ink': inkOn(HOUSE_ACCENT), '--tile-accent': HOUSE_ACCENT } as CSSProperties

  return (
    <PageShell innerClassName="lb-page__inner">
      <div className="sb gb rbk hbk" style={{ '--gb-accent': HOUSE_ACCENT, '--gb-accent-ink': inkOn(HOUSE_ACCENT) } as CSSProperties}>
        <section className="home-banner gb-banner" style={style} aria-labelledby="hbk-title">
          <div className="home-banner__text gb-banner__text">
            <nav className="gb-crumb" aria-label="Breadcrumb">
              <a href={recordsIndexHref()}>
                <BackIcon />
                Record books
              </a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">House records</span>
            </nav>
            <p className="home-banner__kicker">
              <BookIcon />
              House book · the whole arcade
            </p>
            <h1 id="hbk-title" className="gb-title">
              {loading ? (
                <span className="skel-line" style={{ '--skel-w': '12ch' } as CSSProperties} />
              ) : (
                <>
                  {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
                  {head.rest}
                </>
              )}
            </h1>
            <p className="home-banner__blurb gb-lede">{HOUSE_LEDE}</p>
            <div className="home-banner__acts">
              <a className="home-banner__cta" href={`${homeHref()}#games`}>
                Browse all games
              </a>
              <a className="home-banner__ghost" href={recordsIndexHref()}>
                Every record book
              </a>
              <ShareBoardButton
                className="home-banner__ghost"
                text="Share"
                label={`The house records on ${APP_NAME}: who keeps turning up.`}
                url={siteRecordsHref()}
              />
            </div>
          </div>
          {/* A wall of cabinets, for the whole arcade, with the longest streak on the marquee. */}
          <div className="home-banner__art gb-banner__art hbk-art" aria-hidden="true">
            <span className="hbk-art__wall">
              {HOUSE_WALL.map((slug) => (
                <GameThumbArt key={slug} slug={slug} accent={getGame(slug)?.accent} className="hbk-art__thumb" />
              ))}
            </span>
            {cover && coverTop ? (
              <span className="gb-marquee rbk-marquee">
                <span>{cover.label}</span>
                <b>{houseValue(cover, coverTop.value)}</b>
                <span>{normalizePlayerName(coverTop.name)}</span>
              </span>
            ) : null}
          </div>
        </section>

        {you && data && (held.length || close.length) ? (
          <section className="sb-you" aria-label="You in the house book">
            <div className="sb-card rbk-card">
              <div className="rbk-card__head">
                <PlayerMark name={you} avatarId={yourAvatar} className="rbk-card__mark" />
                <h2 className="sb-card__title">{held.length ? `You hold ${held.length} here` : 'None in your name here yet'}</h2>
              </div>
              {held.length ? (
                <ul className="rbk-list">
                  {held.map((board) => (
                    <li key={board.id}>
                      <a className="rbk-item rbk-item--plain" href={`#house-${board.id}`}>
                        <span className="rbk-item__text">
                          <span className="rbk-item__label">{board.label}</span>
                          <span className="rbk-item__sub">{houseWhen(board, board.entries[0]!.at)}</span>
                        </span>
                        <span className="rbk-item__figure">{houseValue(board, board.entries[0]!.value)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rbk-card__note">You’re on {close.length === 1 ? 'one' : 'some'} of them, though.</p>
              )}
            </div>
            {close.length ? (
              <div className="sb-card rbk-card">
                <h2 className="sb-card__title">Closest to ink</h2>
                <p className="rbk-card__sub">The house records you are nearest to taking.</p>
                <ul className="rbk-list">
                  {close.map(({ board, value, rank, off }) => (
                    <li key={board.id}>
                      <a className="rbk-item rbk-item--plain" href={`#house-${board.id}`}>
                        <span className="rbk-item__text">
                          <span className="rbk-item__label">{board.label}</span>
                          <span className="rbk-item__sub">
                            {rank ? `You’re #${rank} with ${houseValue(board, value)}` : `You have ${houseValue(board, value)}`}
                          </span>
                        </span>
                        <span className="rbk-item__figure rbk-item__figure--quiet">{off} off</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {loading ? (
          <div className="sb-card rbk-group">
            <BoardSkeleton rows={6} />
          </div>
        ) : failed ? (
          <BoardEmpty title="Couldn’t load the house records" detail="Check your connection and try again." />
        ) : !boards.length ? (
          <BoardEmpty title={groupBoardEmptyTitle('No house records yet')} />
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.key} className="sb-card rbk-group" aria-labelledby={`hbk-${group.key}`}>
                <div className="rbk-group__head">
                  <h2 id={`hbk-${group.key}`} className="rbk-group__title">
                    {group.title}
                  </h2>
                  <span className="rbk-group__count">
                    {group.boards.length} {group.boards.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                <p className="rbk-group__sub">{group.sub}</p>
                <div className="rbk-group__cols" aria-hidden="true">
                  <span>Record</span>
                  <span>Best</span>
                  <span>Held by</span>
                  <span>Runner-up</span>
                  <span className="rbk-group__you">{you ? 'You' : ''}</span>
                </div>
                <ol className="rbk-recs">
                  {group.boards.map((board) => (
                    <HouseRow key={board.id} board={board} you={you} standing={data?.you?.[board.id]} />
                  ))}
                </ol>
              </section>
            ))}

            <section className="hbk-tops" aria-labelledby="hbk-tops-title">
              <div className="hbk-tops__head">
                <h2 id="hbk-tops-title" className="hbk-tops__title">
                  The top ten in each
                </h2>
                <p className="hbk-tops__sub">Most first. Two the same, and the name first in the alphabet goes first.</p>
              </div>
              <div className="hbk-tops__grid">
                {groups
                  .flatMap((g) => g.boards)
                  .map((board) => (
                    <TopTen key={board.id} board={board} you={you} standing={data?.you?.[board.id]} />
                  ))}
              </div>
            </section>
          </>
        )}
      </div>
    </PageShell>
  )
}
