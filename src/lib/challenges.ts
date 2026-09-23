import { useSyncExternalStore } from 'react'
import { getGame } from '../data/games'
import { scoreText } from './gameBoard'
import { api, getClaimToken, normalizePlayerName } from './leaderboard'
import { formatLeaderboardScore, isTimeBoard } from './leaderboardFormat'

/*
 * Challenges: one saved run, sent to a friend to beat.
 *
 * The link carries only an id; the API holds the run, so a friend always sees
 * a score somebody really played. Opening a link makes it this tab's
 * challenge for that game: the start card names it, a chip under the score
 * carries the target through the run, and the run report says who won. A run
 * saved against it counts on the API, which tells the challenger.
 */

export type Challenge = {
  id: string
  game: string
  name: string
  score: number
  createdAt: number
  avatarId?: string
  replyTo?: string | null
}

/** What the API made of a run saved against a challenge. */
export type ChallengeRunResult = {
  outcome: 'won' | 'short' | 'own'
  challengeId: string
  /** Whose challenge, and the score it set. */
  name: string
  score: number
  /** The winning run, sent back to the challenger as a challenge of its own. */
  replyId: string | null
}

export function challengeHref(game: string, id: string): string {
  return `/c/${encodeURIComponent(game)}/${encodeURIComponent(id)}`
}

export function challengeUrl(game: string, id: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}${challengeHref(game, id)}`
}

export async function fetchChallenge(id: string): Promise<Challenge> {
  return api<Challenge>(`/challenges/${encodeURIComponent(id)}`)
}

/** Send a saved run as a challenge; the same run gives the same link every time. */
export async function createChallenge(input: { game: string; scoreId: string; name: string }): Promise<Challenge> {
  const name = normalizePlayerName(input.name)
  const token = getClaimToken(name)
  return api<Challenge>('/challenges', {
    method: 'POST',
    body: JSON.stringify({ game: input.game, scoreId: input.scoreId, name, ...(token ? { token } : {}) }),
  })
}

/* ---------- the challenge this tab is playing ---------- */

const KEY = 'skermix-challenges'
const EVENT = 'arcade-challenge'
/** A link opened today still counts; one from last week does not follow you around. */
const KEEP_MS = 12 * 60 * 60 * 1000

export type ActiveChallenge = Challenge & {
  openedAt: number
  /** Your best run against it in this tab. */
  best?: number
}

function readAll(): Record<string, ActiveChallenge> {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ActiveChallenge>
    const now = Date.now()
    const out: Record<string, ActiveChallenge> = {}
    for (const [slug, ch] of Object.entries(parsed ?? {})) {
      if (ch && typeof ch.score === 'number' && now - (ch.openedAt ?? 0) < KEEP_MS) out[slug] = ch
    }
    return out
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, ActiveChallenge>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* private mode: the challenge lasts as long as the page */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function activeChallenge(slug: string): ActiveChallenge | null {
  return readAll()[slug] ?? null
}

export function setActiveChallenge(challenge: Challenge) {
  const all = readAll()
  all[challenge.game] = { ...challenge, openedAt: Date.now() }
  writeAll(all)
}

export function clearActiveChallenge(slug: string) {
  const all = readAll()
  if (!all[slug]) return
  delete all[slug]
  writeAll(all)
}

/** Keep your best run against the challenge, for the start card to say so. */
export function noteChallengeRun(slug: string, score: number) {
  const all = readAll()
  const ch = all[slug]
  if (!ch || (ch.best != null && ch.best >= score)) return
  all[slug] = { ...ch, best: score }
  writeAll(all)
}

let snapshotRaw: string | null = null
let snapshot: Record<string, ActiveChallenge> = {}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

function getSnapshot(): Record<string, ActiveChallenge> {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw
    snapshot = readAll()
  }
  return snapshot
}

/** The challenge this tab is playing on a game, kept current as it changes. */
export function useActiveChallenge(slug: string | null): ActiveChallenge | null {
  const all = useSyncExternalStore(subscribe, getSnapshot, () => snapshot)
  return slug ? (all[slug] ?? null) : null
}

/** The game this page is playing, from its address: /games/<slug>/play. */
export function playingSlug(): string | null {
  if (typeof window === 'undefined') return null
  const match = /^\/games\/([^/]+)\/play\/?$/.exec(window.location.pathname)
  return match ? decodeURIComponent(match[1]!) : null
}

/* ---------- words ---------- */

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

/** Did a run beat the challenge, and by how much either way. Board scores: higher is better. */
export function challengeOutcome(challenge: { score: number }, score: number): { won: boolean; gap: number } {
  return { won: score > challenge.score, gap: Math.abs(score - challenge.score) }
}

/** The line that goes out with a challenge. */
export function challengeMessage(slug: string, score: number): string {
  if (isTimeBoard(slug)) return `I did ${gameName(slug)} in ${scoreText(slug, score)}. Can you beat it?`
  return `I got ${scoreText(slug, score)} on ${gameName(slug)}. Can you beat it?`
}

/** The line that goes back with a beaten one. */
export function replyMessage(slug: string, theirs: number, mine: number): string {
  return `I beat your ${formatLeaderboardScore(slug, theirs)} on ${gameName(slug)} with ${formatLeaderboardScore(slug, mine)}. Take it back?`
}

/** "today at 6:40 pm", "yesterday", "Sep 21": when a challenge was set. */
export function challengeWhen(at: number, now = Date.now()): string {
  const day = (t: number) => new Date(t).toDateString()
  if (day(at) === day(now)) {
    const time = new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
    return `today at ${time}`
  }
  if (day(at) === day(now - 86_400_000)) return 'yesterday'
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
