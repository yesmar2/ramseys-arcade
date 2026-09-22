import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref, gamePlayHref, rankHref } from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { useGlobalRank } from '../lib/globalRank'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { getLeaderboard, normalizePlayerName, PERIOD_LABELS } from '../lib/leaderboard'
import { formatLeaderboardScore, isTimeBoard } from '../lib/leaderboardFormat'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { preloadGamePage } from '../pages/gamePages'
import { GameThumbArt } from './GameThumbArt'

type HeroScores = {
  best: number
  rank: number
  top: number
  topName: string
}

/** One run's place on a game's all-time board. */
type Place = { name: string; score: number; rank: number }

/** Your best on the banner's game, all time, with the run just above it and the nearest other player's below. */
type Rung = { you: Place; above: Place | null; below: Place | null }

/** What each game counts, where it is not points. Time boards count seconds. */
const UNITS: Record<string, [string, string]> = {
  crosswalk: ['row', 'rows'],
  stacker: ['block', 'blocks'],
  simon: ['round', 'rounds'],
}

/** A gap between two scores as a bare figure: 9, 1,250, 2.4s. */
function gapFigure(slug: string, gap: number): string {
  return isTimeBoard(slug) ? `${(gap / 1000).toFixed(1)}s` : gap.toLocaleString()
}

/** A gap in the game's own unit: 9 rows, 1 point, 2.4s. */
function gapText(slug: string, gap: number): string {
  if (isTimeBoard(slug)) return gapFigure(slug, gap)
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return `${gap.toLocaleString()} ${gap === 1 ? one : many}`
}

/** A points figure that agrees with itself: 1 pt, 2 pts. */
function pts(n: number) {
  return `${n.toLocaleString()} ${n === 1 ? 'pt' : 'pts'}`
}

/*
 * A board lists runs, not players. Your best is your highest run, so the run
 * just above it is always someone else's, but the runs below can be your own
 * and are skipped until another name turns up.
 */
async function fetchRung(slug: string, name: string): Promise<Rung | null> {
  const { you } = await getLeaderboard(slug, 'all', name, { limit: 1 })
  if (!you) return null
  const offset = Math.max(0, you.rank - 2)
  const { entries } = await getLeaderboard(slug, 'all', name, { offset, limit: 6 })
  const placed: Place[] = entries.map((e, i) => ({ name: e.name, score: e.score, rank: offset + 1 + i }))
  const above = placed.filter((p) => p.rank < you.rank && p.name !== name).at(-1) ?? null
  const below = placed.find((p) => p.rank > you.rank && p.name !== name) ?? null
  return { you: { name, score: you.score, rank: you.rank }, above, below }
}

/*
 * The last rungs this device saw, one per player, game and group, so a
 * returning player's banner opens on theirs instead of flashing the plain
 * banner while the board is asked again.
 */
const RUNGS_KEY = 'skermix-hero-rungs'
const RUNGS_KEPT = 12

function isRung(value: unknown): value is Rung {
  const you = (value as Rung | null)?.you
  return typeof you?.score === 'number' && typeof you.rank === 'number'
}

function readRungs(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNGS_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rememberedRung(key: string): Rung | null {
  const rung = readRungs()[key]
  return isRung(rung) ? rung : null
}

function rememberRung(key: string, rung: Rung | null) {
  try {
    const rungs = readRungs()
    // Re-adding moves the key to the end, so the oldest fall off first.
    delete rungs[key]
    if (rung) rungs[key] = rung
    const kept = Object.keys(rungs).slice(-RUNGS_KEPT)
    localStorage.setItem(RUNGS_KEY, JSON.stringify(Object.fromEntries(kept.map((k) => [k, rungs[k]]))))
  } catch {
    /* ignore */
  }
}

/** Where each mark sits along the line, in percent. */
function layout({ you, above, below }: Rung) {
  if (above && below) {
    const span = above.score - below.score
    const raw = span > 0 ? 8 + (84 * (you.score - below.score)) / span : 50
    // Kept off both ends, so the labels always have room between them.
    return { below: 8, you: Math.min(60, Math.max(34, raw)), above: 92 }
  }
  if (above) return { below: null, you: 22, above: 88 }
  if (below) return { below: 12, you: 78, above: null }
  return { below: null, you: 50, above: null }
}

/** A label near either end hangs inward from its mark, so it never runs off the line. */
function align(x: number) {
  return x < 20 ? ' hero-race__label--start' : x > 80 ? ' hero-race__label--end' : ''
}

function Flag() {
  return (
    <svg className="hero-race__flag" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 11V1.5" />
      <path d="M2.5 2h6.8L7.6 4.4l1.7 2.4H2.5z" />
    </svg>
  )
}

/**
 * Your best, the run above it and the player below, laid on a line in score
 * order, with the stretch still to cover lit in the game's colour. Their
 * names sit over the line and yours under it, beside what is left to go.
 */
function RaceLine({ slug, name, rung }: { slug: string; name: string; rung: Rung }) {
  const { you, above, below } = rung
  const x = layout(rung)
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const said = [above ? `${above.name} ${fmt(above.score)}` : null, `you ${fmt(you.score)}`, below ? `${below.name} ${fmt(below.score)}` : null]
  // With a mark each side, your label hangs left so the gap's own label fits to its right.
  const youAlign = above && below ? ' hero-race__label--end' : align(x.you)
  const lit = above && x.above != null ? { from: x.you, to: x.above } : below && x.below != null ? { from: x.below, to: x.you } : null
  const litGap = above ? above.score - you.score : below ? you.score - below.score : 0

  return (
    <div className="hero-race" role="img" aria-label={`${name} all-time board: ${said.filter(Boolean).join(', ')}`}>
      <span className="hero-race__track" />
      {lit && litGap > 0 ? <span className="hero-race__lit" style={{ left: `${lit.from}%`, width: `${lit.to - lit.from}%` }} /> : null}
      {below && x.below != null ? (
        <>
          <span className="hero-race__dot hero-race__dot--below" style={{ left: `${x.below}%` }} />
          <span className={`hero-race__label hero-race__label--top hero-race__label--below${align(x.below)}`} style={{ left: `${x.below}%` }}>
            {below.name} {fmt(below.score)}
          </span>
        </>
      ) : null}
      {above && x.above != null ? (
        <>
          <span className="hero-race__dot hero-race__dot--above" style={{ left: `${x.above}%` }} />
          <span className={`hero-race__label hero-race__label--top hero-race__label--above${align(x.above)}`} style={{ left: `${x.above}%` }}>
            {above.rank === 1 ? <Flag /> : null}
            {above.name} {fmt(above.score)}
          </span>
        </>
      ) : null}
      <span className="hero-race__dot hero-race__dot--you" style={{ left: `${x.you}%` }} />
      <span className={`hero-race__label hero-race__label--you${youAlign}`} style={{ left: `${x.you}%` }}>
        {above ? null : <Flag />}
        You {fmt(you.score)}
      </span>
      {lit && litGap > 0 ? (
        <span className="hero-race__label hero-race__label--gap" style={{ left: `${(lit.from + lit.to) / 2}%` }}>
          {gapFigure(slug, litGap)} {above ? 'to go' : 'ahead'}
        </span>
      ) : null}
    </div>
  )
}

/**
 * The banner: the one game to open right now, run big across the whole
 * width. The game's thumb leans as a big card on the right.
 *
 * For a player with a score on that game, the banner is about the next place
 * up on its all-time board: how far it is in the game's own unit, who holds
 * it, who is close behind, all laid on a line; and along the bottom, where
 * they stand across the arcade this period. Everyone else gets the kicker,
 * the name, the game's own line about itself, Play, and the board's top and
 * their best. Tinted from the game's colour, like every hero on the site.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const newest = newestSlug(device)
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  // Every figure below is group-scoped on the wire; switching group has to
  // refetch them or the banner keeps quoting the last group's board.
  const groupId = useActiveGroup()
  const [scores, setScores] = useState<HeroScores | null>(null)
  const standing = useGlobalRank()
  const lastPlayed = slug != null && recent.includes(slug)

  const rungKey = name && slug ? `${groupId ?? ''}|${name}|${slug}` : ''
  const [fetched, setFetched] = useState<{ key: string; rung: Rung | null } | null>(null)
  const remembered = useMemo(() => (rungKey ? rememberedRung(rungKey) : null), [rungKey])
  const rung = !rungKey ? null : fetched?.key === rungKey ? fetched.rung : remembered

  useEffect(() => {
    if (!slug) {
      setScores(null)
      return
    }
    let cancelled = false
    getLeaderboard(slug, period, name || undefined, { limit: 1 })
      .then(({ entries, you }) => {
        if (cancelled) return
        const leader = entries[0]
        setScores({
          best: you?.score ?? 0,
          rank: you?.rank ?? 0,
          top: leader?.score ?? 0,
          topName: leader?.name ?? '',
        })
      })
      .catch(() => {
        if (!cancelled) setScores(null)
      })
    return () => {
      cancelled = true
    }
  }, [name, slug, period, groupId])

  useEffect(() => {
    if (!rungKey || !slug) return
    let cancelled = false
    fetchRung(slug, name)
      .then((next) => {
        if (cancelled) return
        setFetched({ key: rungKey, rung: next })
        rememberRung(rungKey, next)
      })
      .catch(() => {
        /* keep what the device remembered */
      })
    return () => {
      cancelled = true
    }
  }, [rungKey, slug, name])

  // The game the banner offers is fetched once the banner is up, so Play opens it without a wait.
  useEffect(() => {
    if (slug) preloadGamePage(slug)
  }, [slug])

  if (!slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = game.accent
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  const periodWord = PERIOD_LABELS[period].toLowerCase()
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const acts = (
    <div className="home-banner__acts">
      <a className="home-banner__cta" href={gamePlayHref(slug)}>
        Play {game.name}
      </a>
      <a className="home-banner__ghost" href={gameHref(slug)}>
        Leaderboard
      </a>
    </div>
  )
  const art = (
    <a className="home-banner__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
      <GameThumbArt slug={slug} accent={accent} />
    </a>
  )

  if (rung) {
    const { you, above, below } = rung
    const gap = above ? above.score - you.score : 0
    const target = above ? (above.rank === 1 ? `the ${game.name} record` : `#${above.rank} on ${game.name}`) : ''
    const behind = below ? `${below.name} is ${gapText(slug, you.score - below.score)} behind you` : null
    const kicker = above ? (above.rank === 1 ? 'Your next record' : 'Your next place') : 'Your record'
    const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
    const ahead = standing.rank != null ? standing.nearby?.find((n) => n.rank === standing.rank! - 1) : undefined
    const trailing = standing.rank != null ? standing.nearby?.find((n) => n.rank === standing.rank! + 1) : undefined

    let body: string
    if (above && gap > 0) {
      body = `You’re #${you.rank} with ${fmt(you.score)}. ${above.name} holds ${above.rank === 1 ? 'it' : `#${above.rank}`} at ${fmt(above.score)}${behind ? `, and ${behind}` : ''}.`
    } else if (above) {
      body = `You’re #${you.rank} with ${fmt(you.score)}, level with ${above.name}, who got there first.${behind ? ` ${behind}.` : ''}`
    } else if (below) {
      body = `Your ${fmt(you.score)} leads ${below.name} by ${gapText(slug, you.score - below.score)}.`
    } else {
      body = `Your ${fmt(you.score)} tops the board.`
    }

    return (
      <section className="home-banner home-banner--rung" style={style} aria-label={kicker}>
        <div className="home-banner__text">
          <div className="home-banner__kicker-row">
            <p className="home-banner__kicker">{kicker}</p>
            <span className="home-banner__kicker-note">
              {game.name} · all time{group ? ` · ${group}` : ''}
            </span>
          </div>
          <h2 className="home-banner__goal">
            {above && gap > 0 ? (
              <>
                <span className="home-banner__gap">{gapText(slug, gap)}</span> from {target}.
              </>
            ) : above ? (
              <>Level with {target}.</>
            ) : (
              <>You hold the {game.name} record.</>
            )}
          </h2>
          <p className="home-banner__blurb">{body}</p>
          <RaceLine slug={slug} name={game.name} rung={rung} />
          {acts}
        </div>
        {art}
        {standing.rank != null ? (
          <div className="home-banner__standing">
            <span className="home-banner__stat">
              <span className="home-banner__stat-k">Your standing</span>
              <b className="home-banner__stat-rank">#{standing.rank}</b>
              <span className="home-banner__stat-v">
                {periodWord} · {pts(standing.score)}
              </span>
            </span>
            {ahead ? (
              <span className="home-banner__stat home-banner__stat--side">
                <span className="home-banner__stat-k">Ahead</span>
                <b>{ahead.name}</b>
                <span className="home-banner__stat-v">by {pts(ahead.score - standing.score)}</span>
              </span>
            ) : null}
            {trailing ? (
              <span className="home-banner__stat home-banner__stat--side">
                <span className="home-banner__stat-k">Behind</span>
                <b>{trailing.name}</b>
                <span className="home-banner__stat-v">by {pts(standing.score - trailing.score)}</span>
              </span>
            ) : null}
            {ahead ? (
              <span className="home-banner__stat home-banner__stat--next">
                <b>{(ahead.score - standing.score).toLocaleString()}</b> to #{ahead.rank}
              </span>
            ) : null}
            <a className="home-banner__standing-link" href={rankHref()}>
              Your profile ›
            </a>
          </div>
        ) : null}
      </section>
    )
  }

  const isNew = !lastPlayed && slug === newest
  const kicker = lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'

  return (
    <section className="home-banner" style={style} aria-label="Play">
      <div className="home-banner__text">
        <p className="home-banner__kicker">{kicker}</p>
        <h2 className="home-banner__name">
          <a href={gamePlayHref(slug)}>{game.name}</a>
        </h2>
        <p className="home-banner__blurb">{game.description}</p>
        {acts}
        {scores && scores.top > 0 ? (
          <dl className="home-banner__figures" aria-label={`${game.name} scores`}>
            <div className="home-banner__figure">
              <dt>Top {periodWord}</dt>
              <dd>
                {fmt(scores.top)}
                {scores.topName ? <small> by {scores.topName}</small> : null}
              </dd>
            </div>
            <div className="home-banner__figure">
              <dt>Your best</dt>
              <dd>
                {scores.best > 0 ? fmt(scores.best) : '—'}
                {scores.best > 0 && scores.rank > 0 ? <small> · #{scores.rank}</small> : null}
                {scores.best === 0 ? <small> not on the board yet</small> : null}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
      {art}
    </section>
  )
}
