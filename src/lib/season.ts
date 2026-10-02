import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from './leaderboard'

/*
 * The season: a stretch of about nine weeks with a theme (Season 1 is Space Race, from Oct 31), a free
 * pass of 30 levels moved by every ticket won in it, and looks to win on the way. The API's seasons.ts
 * decides it all; this is one shared copy, for the header's ring, the home banner, the Season page and the
 * run report, fetched once and nudged along by what a save answers.
 */

export type SeasonRewardKind = 'pin' | 'prize' | 'tickets' | 'skin'

export type SeasonReward = {
  level: number
  kind: SeasonRewardKind
  /** A prize id (data/prizes.ts), a skin's, the pin's, or tickets-<level>. */
  id: string
  name: string
  /** What it is, for its tile: "Title", "Lander ship". */
  what: string
  amount?: number
  /** The game a skin is for. */
  game?: string
  /** Whether this release can give it yet. */
  ready: boolean
}

export type SeasonInfo = {
  id: number
  slug: string
  name: string
  /** Its first and last boards' days, YYYY-MM-DD. */
  firstDay: string
  lastDay: string
  startsAt: number
  endsAt: number
  status: 'live' | 'upcoming' | 'over'
  /** Live early, for trying it out before its first day (the admin page's switch). */
  preview: boolean
  daysLeft: number
  levels: number
  perLevel: number
  /** The games it puts forward. */
  spotlight: string[]
}

export type SeasonYou = { earned: number; level: number; nextAt: number | null }

/** What a saved run did on the pass, from the save's answer. */
export type SeasonRun = {
  id: number
  name: string
  earned: number
  added: number
  level: number
  levels: number
  nextAt: number | null
  /** The next level's reward, to say what the run is heading for. */
  next: SeasonReward | null
  /** Every reward of the levels the run reached, when it reached one. */
  levelUp: SeasonReward[]
}

/** The season's standings: points across all games over its days, shown by place and name. */
export type SeasonStandings = {
  total: number
  top: { rank: number; name: string; avatarId: string }[]
  you: { rank: number; name: string } | null
  /** Places that win when it ends: the cup, then a trophy. */
  cupPlaces: number
  trophyPlaces: number
}

/** Something to do in the season besides the pass, with its own reward. */
export type SeasonGoal = {
  id: string
  title: string
  need: number
  have: number
  done: boolean
  reward: { kind: 'prize' | 'tickets'; id?: string; amount?: number; name: string }
}

type SeasonAnswer = {
  season: SeasonInfo | null
  rewards: SeasonReward[]
  you: SeasonYou | null
  /** Only on the Season page's asking (catchup): they take more reading than the header wants. */
  standings?: SeasonStandings
  goals?: SeasonGoal[]
}

type Store = SeasonAnswer & { loaded: boolean; loading: boolean }

const empty: Store = { season: null, rewards: [], you: null, loaded: false, loading: false }

const EVENT = 'arcade-season'
const STALE_MS = 60_000

let snapshot: Store = empty
let fetchedAt = 0
let fetchedSignedIn: boolean | null = null
let inFlight: Promise<void> | null = null
let inFlightCatchUp = false

function emit(next: Store) {
  snapshot = next
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

function getSnapshot() {
  return snapshot
}

/**
 * Read the season again when it's stale, or when who's asking has changed. `catchUp` (the Season page)
 * also asks the API to give any reward up to the player's level that a later release brought.
 */
export function refreshSeason({ force = false, signedIn = fetchedSignedIn ?? false, catchUp = false } = {}): Promise<void> {
  // The page's asking (with the standings and goals) never rides on the header's plain one: it goes after it.
  if (inFlight && catchUp && !inFlightCatchUp) return inFlight.then(() => refreshSeason({ force, signedIn, catchUp }))
  if (inFlight) return inFlight
  const fresh = snapshot.loaded && Date.now() - fetchedAt < STALE_MS && fetchedSignedIn === signedIn
  if (!force && !catchUp && fresh) return Promise.resolve()
  emit({ ...snapshot, loading: true })
  inFlightCatchUp = catchUp
  inFlight = api<SeasonAnswer>(`/season${catchUp ? '?catchup=1' : ''}`)
    .then((answer) => {
      fetchedAt = Date.now()
      // The header's asking has no standings or goals: keep the page's from before, the same season's.
      const same = snapshot.season?.id === answer.season?.id && fetchedSignedIn === signedIn
      fetchedSignedIn = signedIn
      emit({
        ...answer,
        standings: answer.standings ?? (same ? snapshot.standings : undefined),
        goals: answer.goals ?? (same ? snapshot.goals : undefined),
        loaded: true,
        loading: false,
      })
    })
    .catch(() => {
      emit({ ...snapshot, loaded: true, loading: false })
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** A save answered with the pass: show the player's new place now. */
export function noteSeasonRun(run: SeasonRun | null | undefined) {
  if (!run || !snapshot.season || snapshot.season.id !== run.id) return
  emit({ ...snapshot, you: { earned: run.earned, level: run.level, nextAt: run.nextAt } })
}

/** The season, fetched once and shared; `you` is the signed-in player's place on its pass. */
export function useSeason(): Store {
  const { signedIn, loading } = useAuth()
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (loading) return
    void refreshSeason({ signedIn })
  }, [signedIn, loading])
  return snap
}

/** The season, when one is live (or previewed); null otherwise, and the site shows nothing of it. */
export function liveSeason(store: Pick<Store, 'season'>): SeasonInfo | null {
  return store.season?.status === 'live' ? store.season : null
}

export type SeasonProgress = {
  level: number
  /** How far into this level, 0..1, and the season tickets still to win for the next. */
  fraction: number
  toNext: number | null
  earned: number
}

export function seasonProgress(season: SeasonInfo, you: Pick<SeasonYou, 'earned' | 'level'> | null): SeasonProgress {
  const earned = you?.earned ?? 0
  const level = you?.level ?? 0
  if (level >= season.levels) return { level, fraction: 1, toNext: null, earned }
  if (level <= 0) return { level: 0, fraction: 0, toNext: null, earned }
  const from = (level - 1) * season.perLevel
  return { level, fraction: Math.min(1, (earned - from) / season.perLevel), toNext: Math.max(0, level * season.perLevel - earned), earned }
}

/** A reward in a phrase: "the Moonhopper", "the Liftoff title", "50 bonus tickets". */
export function rewardPhrase(reward: SeasonReward): string {
  switch (reward.kind) {
    case 'tickets':
      return `${reward.amount ?? 0} bonus tickets`
    case 'skin':
    case 'pin':
      return `the ${reward.name}`
    default: {
      const what = reward.what.toLowerCase()
      if (what === 'confetti') return `${reward.name} confetti`
      if (what === 'wall sign') return `the ${reward.name}`
      return `the ${reward.name} ${what}`
    }
  }
}

/** The reward a level gives first, if it has one. */
export function rewardAt(rewards: SeasonReward[], level: number): SeasonReward | null {
  return rewards.find((r) => r.level === level) ?? null
}

export function isSpotlight(season: SeasonInfo | null, game: string): boolean {
  return !!season && season.spotlight.includes(game)
}

/** Whether a game is in the live season's spotlight. */
export function useSpotlight(game: string): boolean {
  return isSpotlight(liveSeason(useSeason()), game)
}

/** "Oct 31 – Jan 4". */
export function seasonDates(season: SeasonInfo): string {
  const fmt = (day: string) => {
    const [y, m, d] = day.split('-').map(Number)
    return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  return `${fmt(season.firstDay)} – ${fmt(season.lastDay)}`
}

export function daysLeftLabel(season: SeasonInfo): string {
  const n = season.daysLeft
  return n <= 1 ? 'Last day' : `${n} days left`
}
