import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../hooks/useAuth'
import { currentAccountId } from './auth'
import { api } from './leaderboard'

/*
 * The season: a stretch of about nine weeks with a theme (Season 1 is Space Race, from Oct 31), a free
 * pass of 30 levels moved by every ticket won in it, and looks to win on the way. The API's seasons.ts
 * decides it all; this is one shared copy, for the header's ring, the home banner, the Season page and the
 * run report, fetched once and nudged along by what a save answers. The last answer is kept on the device
 * (KEPT_KEY), so a page opens with the season it had last time, the home banner included, rather than
 * drawing the arcade without it and then switching once the API answers.
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
  /** On the Pass+ row: given only with the season's Pass+. */
  plus?: boolean
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

/**
 * A season's Pass+: a second row of looks on the same levels, bought once for the season (the API's
 * payments.ts, through Stripe). `buyable` once payments are set up and the season is live.
 */
export type SeasonPlus = {
  price: number
  currency: string
  rewards: SeasonReward[]
  /** Levels past the last that only Pass+ climbs. */
  bonus: number
  owned: boolean
  /** How it's had: bought for the season, or with a Plus membership. */
  via?: 'pass' | 'plus' | null
  buyable: boolean
}

type SeasonAnswer = {
  season: SeasonInfo | null
  rewards: SeasonReward[]
  plus?: SeasonPlus | null
  you: SeasonYou | null
  /** Only on the Season page's asking (catchup): they take more reading than the header wants. */
  standings?: SeasonStandings
  goals?: SeasonGoal[]
}

type Store = SeasonAnswer & { loaded: boolean; loading: boolean }

const empty: Store = { season: null, rewards: [], you: null, loaded: false, loading: false }

const EVENT = 'arcade-season'
const STALE_MS = 60_000

/** The last answer, kept on this device: the season and its rewards, and whose `you` it was. */
const KEPT_KEY = 'skermix-season'

type Kept = { answer: Pick<SeasonAnswer, 'season' | 'rewards' | 'plus' | 'you'>; account: string | null }

function keep(answer: SeasonAnswer) {
  try {
    const kept: Kept = { answer: { season: answer.season, rewards: answer.rewards, plus: answer.plus, you: answer.you }, account: currentAccountId() ?? null }
    localStorage.setItem(KEPT_KEY, JSON.stringify(kept))
  } catch {
    /* a private window keeps nothing: the page waits for the API */
  }
}

/**
 * The season this device saw last, to open with: none once it's over, and `you` only for the account it was
 * said for. The API's answer replaces it as soon as it comes.
 */
function kept(): Store {
  try {
    const raw = localStorage.getItem(KEPT_KEY)
    if (!raw) return empty
    const { answer, account } = JSON.parse(raw) as Kept
    if (!answer?.season || !Array.isArray(answer.rewards) || answer.season.endsAt <= Date.now()) return empty
    const mine = account != null && account === currentAccountId()
    // Whether Pass+ is owned is the account's too: another player on this device hasn't bought it.
    const plus = answer.plus ? { ...answer.plus, owned: mine && answer.plus.owned } : answer.plus
    return { ...empty, season: answer.season, rewards: answer.rewards, plus, you: mine ? answer.you : null }
  } catch {
    return empty
  }
}

let snapshot: Store = typeof window === 'undefined' ? empty : kept()
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
      keep(answer)
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

/** The highest level your pass reaches: the season's last, and with Pass+ its bonus levels too. */
export function seasonTop(store: Pick<SeasonAnswer, 'season' | 'plus'>): number {
  return (store.season?.levels ?? 0) + (store.plus?.owned ? store.plus.bonus : 0)
}

export function seasonProgress(season: SeasonInfo, you: Pick<SeasonYou, 'earned' | 'level'> | null, top = season.levels): SeasonProgress {
  const earned = you?.earned ?? 0
  const level = you?.level ?? 0
  if (level >= top) return { level, fraction: 1, toNext: null, earned }
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

/** Pass+'s price as money: $2.99. */
export function plusPrice(plus: Pick<SeasonPlus, 'price' | 'currency'>): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: plus.currency.toUpperCase() }).format(plus.price / 100)
  } catch {
    return `$${(plus.price / 100).toFixed(2)}`
  }
}

/** Stripe's checkout for the live season's Pass+: its page's address, to go to. */
export async function startPlusCheckout(): Promise<string> {
  const { url } = await api<{ url: string }>('/season/plus/checkout', { method: 'POST', body: '{}' })
  return url
}

/** Back from Stripe: the checkout, if it's paid, gives Pass+ now. Whether it was paid. */
export async function confirmPlusCheckout(session: string): Promise<boolean> {
  const { paid } = await api<{ paid: boolean }>('/season/plus/confirm', { method: 'POST', body: JSON.stringify({ session }) })
  return paid
}
