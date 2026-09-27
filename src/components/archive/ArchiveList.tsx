import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { usePlayerName } from '../../hooks/usePlayerName'
import { archiveDayWords, useArchiveDays } from '../../lib/archive'
import { normalizePlayerName } from '../../lib/leaderboard'
import { formatLeaderboardScore } from '../../lib/leaderboardFormat'
import { ordinal } from '../../lib/scoreboard'
import { PlayerName } from '../PlayerName'

/*
 * A daily game's archive as a grid of its days, newest first: today's at the top, and every day before
 * it with its hole or track drawn, who did best, your result, and the way to play it again. A day's
 * drawing and name are worked out only as its card comes near the screen, so a long archive costs no
 * more to open than a short one.
 */

/** A day as a game's archive lists it. `build` works out what its card shows, the first time it's near. */
export type ArchiveItem = {
  day: string
  n: number
  today: boolean
  href: string
  build: () => { title: string; sub: string; art: ReactNode }
  /** What its card says when nobody has a result on it, if not that nobody played that day. */
  empty?: string
}

/**
 * How a day went, as its card says it: the best result and how many played, and yours. With `record`,
 * it's a Hot Lap track's record, which its board keeps for good (TrackArchive), and your place on it.
 */
export type ArchiveResult = {
  top: { name: string; score: number; avatarId?: string }
  players: number
  you: { score: number; place?: number } | null
  record?: boolean
}

/** Whether an element has come within a screen of the view: once it has, it stays true. */
function useNear<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        setNear(true)
        seen.disconnect()
      },
      { rootMargin: '600px 0px' },
    )
    seen.observe(el)
    return () => seen.disconnect()
  }, [near])
  return [ref, near]
}

function DayCard({ slug, item, result, asked }: { slug: string; item: ArchiveItem; result: ArchiveResult | undefined; asked: boolean }) {
  const [ref, near] = useNear<HTMLLIElement>()
  const shown = useMemo(() => (near ? item.build() : null), [near, item])
  const figure = (score: number) => formatLeaderboardScore(slug, score)
  return (
    <li ref={ref} className={`arch-card${item.today ? ' arch-card--today' : ''}`}>
      <a className="arch-card__art" href={item.href} tabIndex={-1} aria-hidden="true">
        {shown?.art ?? null}
      </a>
      <div className="arch-card__text">
        <span className="arch-card__kicker">{item.today ? `Today · #${item.n}` : `#${item.n} · ${archiveDayWords(item.day)}`}</span>
        <strong className="arch-card__title">{shown?.title ?? ' '}</strong>
        <span className="arch-card__sub">{shown?.sub ?? ' '}</span>
        <span className="arch-card__best">
          {result ? (
            <>
              {result.record ? 'Record' : 'Best'}: <PlayerName name={result.top.name} avatarId={result.top.avatarId} /> ·{' '}
              {figure(result.top.score)}
              {result.players > 1 ? ` · ${result.players} players` : ''}
            </>
          ) : asked ? (
            (item.empty ?? (item.today ? 'Nobody on the board yet today' : 'Nobody on the board that day'))
          ) : (
            ' '
          )}
        </span>
        {result?.you ? (
          <span className="arch-card__you">
            You: {figure(result.you.score)}
            {result.you.place ? ` · ${ordinal(result.you.place)}` : ''}
          </span>
        ) : null}
      </div>
      <a className="arch-card__play" href={item.href}>
        {item.today ? 'Play today’s' : 'Play it again'}
      </a>
    </li>
  )
}

/** The grid of a game's days, with how each went; `asked` once the results have come, so none means nobody. */
export function ArchiveGrid({
  slug,
  items,
  results,
  asked,
}: {
  slug: string
  items: ArchiveItem[]
  results: ReadonlyMap<string, ArchiveResult>
  asked: boolean
}) {
  return (
    <ul className={`arch-grid arch-grid--${slug}`}>
      {items.map((item) => (
        <DayCard key={item.day} slug={slug} item={item} result={results.get(item.day)} asked={asked} />
      ))}
    </ul>
  )
}

/** A daily game's days, with each day's best and yours from its board. */
export function ArchiveList({ slug, items }: { slug: string; items: ArchiveItem[] }) {
  const me = normalizePlayerName(usePlayerName())
  const days = useArchiveDays(slug, me)
  const byDay = useMemo(() => new Map((days ?? []).map((d) => [d.day, d])), [days])
  return <ArchiveGrid slug={slug} items={items} results={byDay} asked={days !== null} />
}
