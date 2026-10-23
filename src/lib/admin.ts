import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from './leaderboard'
import type { SeasonInfo } from './season'

/*
 * Who's an admin is the API's call: the emails in its ADMIN_EMAILS (Render).
 * The site asks it (GET /admin/whoami) once a visit for a signed-in account,
 * and remembers a yes on this device so the menu's Admin row paints at once.
 * VITE_ADMIN_EMAILS (Vercel), if it's set, still counts straight away, and
 * local Vite DEV counts everyone. None of this grants anything: the API
 * answers only its own admins.
 */

const ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
)

/** True for emails in VITE_ADMIN_EMAILS, or anyone in local Vite DEV, without asking the API. */
export function isAdminAccount(account: { email?: string } | null | undefined) {
  if (import.meta.env.DEV) return true
  const email = account?.email?.trim().toLowerCase()
  return Boolean(email && ADMIN_EMAILS.has(email))
}

const REMEMBER_KEY = 'arcade-admin'
const answers = new Map<string, boolean>()
const asking = new Map<string, Promise<boolean>>()

function remembered(accountId: string): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === accountId
  } catch {
    return false
  }
}

function remember(accountId: string, admin: boolean) {
  try {
    if (admin) localStorage.setItem(REMEMBER_KEY, accountId)
    else if (localStorage.getItem(REMEMBER_KEY) === accountId) localStorage.removeItem(REMEMBER_KEY)
  } catch {
    /* storage may be off */
  }
}

/** Whether the API counts this account as an admin, asked once a visit. */
function askApi(accountId: string): Promise<boolean> {
  const known = answers.get(accountId)
  if (known !== undefined) return Promise.resolve(known)
  let pending = asking.get(accountId)
  if (!pending) {
    pending = fetchAdminWhoami()
      .then(
        () => true,
        () => false,
      )
      .then((admin) => {
        answers.set(accountId, admin)
        asking.delete(accountId)
        remember(accountId, admin)
        return admin
      })
    asking.set(accountId, pending)
  }
  return pending
}

/**
 * Whether this account is an admin, or undefined while the API is still being asked: signed in, not
 * listed, not answered this visit, and no yes remembered on this device. For a gate that sends people
 * away, which mustn't send an admin away before the answer comes.
 */
export function useAdminState(): boolean | undefined {
  const { account } = useAuth()
  const listed = isAdminAccount(account)
  const id = account?.id ?? null
  const [answer, setAnswer] = useState<{ id: string; admin: boolean } | null>(null)
  useEffect(() => {
    if (!id || listed) return
    let live = true
    void askApi(id).then((admin) => {
      if (live) setAnswer({ id, admin })
    })
    return () => {
      live = false
    }
  }, [id, listed])
  if (!id) return false
  if (listed) return true
  if (answer?.id === id) return answer.admin
  const known = answers.get(id)
  if (known !== undefined) return known
  return remembered(id) ? true : undefined
}

/** Whether this account is an admin: no until the API says yes, unless this device remembers a yes. */
export function useIsAdmin() {
  return useAdminState() === true
}

/*
 * The API's admin routes. The API answers only the emails in its own
 * ADMIN_EMAILS; to anyone else they don't exist.
 */

export type AdminClientError = {
  fingerprint: string
  message: string
  stack: string | null
  path: string | null
  release: string | null
  userAgent: string | null
  count: number
  firstAt: number
  lastAt: number
}

export type AdminFeedback = {
  id: string
  kind: 'idea' | 'problem'
  message: string
  path: string | null
  accountId: string | null
  name: string | null
  userAgent: string | null
  createdAt: number
}

export type AdminFlag = {
  id: string
  scoreId: string
  game: string
  name: string
  score: number
  kind: string
  detail: string
  createdAt: number
}

export type AdminBan = {
  name: string
  reason: string | null
  bannedBy: string
  bannedAt: number
}

export function fetchAdminWhoami() {
  return api<{ admin: true; email: string; unreviewedFlags: number }>('/admin/whoami')
}

/**
 * Who's playing (the API's playerStats.ts): players who played today, this week and this month; accounts
 * made; how many came back the next day and within a week of signing up; each of the last 14 days; and runs
 * begun in the last day, the only trace of signed-out play. Active means saved a run, which needs an account.
 */
export type PlayerStats = {
  day: string
  includeSeeded: boolean
  accounts: { total: number; saved: number }
  active: { day: number; week: number; month: number }
  joined: { day: number; week: number; month: number }
  returned: { nextDay: { players: number; back: number }; week: { players: number; back: number } }
  days: { day: string; active: number; joined: number }[]
  runs24h: { total: number; signedOut: number }
}

/** Whether the arcade's own events run (the daily event, the One Shot, the Weekly Triple): the API's siteEvents.ts. */
export async function fetchSiteEvents() {
  return (await api<{ on: boolean }>('/admin/site-events')).on
}

export async function setSiteEvents(on: boolean) {
  return (await api<{ on: boolean }>('/admin/site-events', { method: 'POST', body: JSON.stringify({ on }) })).on
}

/**
 * The season, and whether it's previewed early, live before its first day (the API's seasons.ts). `previewSeason` is
 * the season the preview shows when one was picked (null: the next to come), and `seasons` the ones to pick from.
 */
export type SeasonPreviewState = {
  season: SeasonInfo | null
  previewFrom: number | null
  previewSeason?: number | null
  seasons?: { id: number; name: string }[]
}

export function fetchSeasonPreview() {
  return api<SeasonPreviewState>('/admin/season-preview')
}

export function setSeasonPreview(on: boolean, season: number | null = null) {
  return api<SeasonPreviewState>('/admin/season-preview', { method: 'POST', body: JSON.stringify({ on, season }) })
}

/** A season's Pass+ for a tag's account, given or taken back, to try it without paying (the API's seasons.ts). */
export function setSeasonPlus(name: string, on: boolean) {
  return api<{ name: string; season: number; plus: boolean }>('/admin/season-plus', { method: 'POST', body: JSON.stringify({ name, on }) })
}

/** A Plus membership for a tag's account, given or taken back, to try it without paying (the API's plus.ts). */
export function setPlusMembership(name: string, on: boolean) {
  return api<{ name: string; plan: 'free' | 'plus' }>('/admin/plus', { method: 'POST', body: JSON.stringify({ name, on }) })
}

export function fetchPlayerStats(includeSeeded: boolean) {
  return api<PlayerStats>(`/admin/players${includeSeeded ? '?seeded=1' : ''}`)
}

/** A week of joiners, Monday to Sunday: how many still played in their second week (days 7 to 13 after joining). */
export type LaunchCohort = {
  from: string
  to: string
  players: number
  back: number
  /** done: every joiner's second week is over. soFar: it has begun for some. tooSoon: for none yet. */
  state: 'done' | 'soFar' | 'tooSoon'
}

/** The three numbers to watch from launch (the API's launchNumbers.ts): do new players stay, share, pay. */
export type LaunchNumbers = {
  day: string
  stayed: { players: number; back: number; from: string | null; to: string | null; cohorts: LaunchCohort[] }
  shared: {
    /** The last 7 days. */
    players: number
    sharers: number
    shares: number
    signedOut: number
    kinds: { kind: string; shares: number }[]
    weeks: { from: string; shares: number; sharers: number; players: number }[]
  }
  paying: {
    /** The last 30 days' players. */
    players: number
    paying: number
    plus: number
    trial: number
    goldPass: number
    season: { id: number; name: string } | null
  }
}

export function fetchLaunchNumbers() {
  return api<LaunchNumbers>('/admin/launch-numbers')
}

export async function fetchClientErrors() {
  return (await api<{ errors: AdminClientError[] }>('/admin/client-errors?limit=100')).errors
}

/** One error off the list, once it's fixed: it comes back if it happens again. */
export function removeClientError(fingerprint: string) {
  return api<{ removed: boolean }>(`/admin/client-errors/${encodeURIComponent(fingerprint)}`, { method: 'DELETE' })
}

/** Every error up to `before`, the newest the list shows: one that has happened since stays. */
export function clearClientErrors(before: number) {
  return api<{ removed: number }>('/admin/client-errors/clear', { method: 'POST', body: JSON.stringify({ before }) })
}

/** The push service a device's alerts go through, which says what kind of device it is (the API's errorAlerts.ts). */
export type PushService = 'apple' | 'google' | 'microsoft' | 'mozilla' | 'other'

/**
 * One of the admins' devices with push on: its push service, the kind of device it is ("Chrome on an Android
 * phone"; null for one that turned push on before that was kept, or from an older API), whose it is, and when it
 * was added and last turned on.
 */
export type AlertDevice = { service: PushService; device?: string | null; email: string; addedAt: number; lastSeenAt: number }

/**
 * Where an error spike's push goes (the API's errorAlerts.ts): how many of the admins' devices have push on, what
 * counts as a spike, and when each kind last went. `pushReady` is false where the API has no push keys (staging);
 * it and `deviceList` are missing from an older API.
 */
export type ErrorAlerts = {
  devices: number
  pushReady?: boolean
  deviceList?: AlertDevice[]
  spike: { site: { count: number; players: number }; api: { count: number } }
  windowMinutes: number
  lastAlert: { site: number | null; api: number | null }
}

export function fetchErrorAlerts() {
  return api<ErrorAlerts>('/admin/alerts')
}

/** What a test push found: each device's push service took it, or turned it down with an HTTP status. */
export type TestAlert = {
  devices: number
  sent: number
  pushReady?: boolean
  results?: { service: PushService; device?: string | null; ok: boolean; status: number | null }[]
}

/** A test push to the admins' devices. */
export function sendTestAlert() {
  return api<TestAlert>('/admin/alerts/test', { method: 'POST' })
}

export async function fetchFeedback() {
  return (await api<{ feedback: AdminFeedback[] }>('/admin/feedback?limit=100')).feedback
}

/** One message off the list, once it's dealt with: gone for good. */
export function removeFeedback(id: string) {
  return api<{ removed: boolean }>(`/admin/feedback/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Every message up to `before`, the newest the list shows: one sent since stays. */
export function clearFeedback(before: number) {
  return api<{ removed: number }>('/admin/feedback/clear', { method: 'POST', body: JSON.stringify({ before }) })
}

/**
 * The coming-soon page's launch list (the API's launchList.ts): who asked to hear when Blipka opens, the latest
 * first; whether the API can send email at all (Resend set up on Render); how many one send mails; and the email.
 */
export type LaunchList = {
  emails: { email: string; createdAt: number }[]
  mailer: boolean
  batch: number
  mail: { subject: string; text: string }
}

export function fetchLaunchList() {
  return api<LaunchList>('/admin/launch-list')
}

/** One address off the list, for someone who asked. */
export function removeFromLaunchList(email: string) {
  return api<{ removed: boolean }>(`/admin/launch-list/${encodeURIComponent(email)}`, { method: 'DELETE' })
}

/** The launch email to the admin asking, to see it first. */
export function sendLaunchTest() {
  return api<{ to: string }>('/admin/launch-list/test', { method: 'POST' })
}

/** The launch email to the next batch; each address is deleted once its email has gone. */
export function sendLaunchEmail() {
  return api<{ sent: number; left: number }>('/admin/launch-list/send', { method: 'POST' })
}

/** What Reset test data finds: kept, then gone (the API's resetWorld.ts ResetCounts). */
export type ResetCounts = {
  players: number
  launchList: number
  feedback: number
  samplePlayers: number
  /** Real players' avatars wearing something earned or bought, which comes off. */
  dressedAvatars: number
  runs: number
  boardScores: number
  records: number
  ticketRows: number
  prizes: number
  trophies: number
  seasonPlayers: number
  medalsAndLaps: number
  events: number
  notifications: number
}

export type ResetPreview = {
  counts: ResetCounts
  /** When the reset stops working (the end of launch day), ms. */
  until: number
  open: boolean
  lastResetAt: number | null
}

export function fetchResetPreview() {
  return api<ResetPreview>('/admin/reset')
}

/**
 * Empty everything played and delete the sample players, keeping accounts, tags, friends and groups. On Render
 * the API then starts afresh (`restarting`), which takes it away for a minute.
 */
export function resetTestData() {
  return api<{ at: number; before: ResetCounts; restarting: boolean }>('/admin/reset', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'RESET' }),
  })
}

export async function fetchOpenFlags() {
  return (await api<{ flags: AdminFlag[] }>('/admin/flags?limit=100')).flags
}

/** The API's run check (runCheck.ts there): whether runs are required, and how many of the last days' saves came with theirs. */
export type RunCheck = {
  required: boolean
  days: number
  saves: number
  withRun: number
  games: { game: string; saves: number; withRun: number; lastWithout: number | null }[]
}

export function fetchRunCheck(days = 7) {
  return api<RunCheck>(`/admin/run-check?days=${days}`)
}

export async function fetchBans() {
  return (await api<{ bans: AdminBan[] }>('/admin/bans')).bans
}

/** Settle a flag: the score stays, or (`void`) comes off the boards first. */
export async function settleFlag(flag: AdminFlag, voidScore: boolean) {
  if (voidScore) {
    await api('/admin/scores/void', { method: 'POST', body: JSON.stringify({ ids: [flag.scoreId] }) })
  }
  await api(`/admin/flags/${encodeURIComponent(flag.id)}/review`, { method: 'POST' })
}

/** Ban a tag; `purge` also deletes everything it has posted. */
export function banTag(name: string, reason: string, purge: boolean) {
  return api<{ ban: AdminBan; purged: { leaderboard: number; records: number } | null }>('/admin/bans', {
    method: 'POST',
    body: JSON.stringify({ name, reason: reason || undefined, purge }),
  })
}

export function liftBan(name: string) {
  return api(`/admin/bans/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

/** Tickets for a tag's account, from an admin: to try the prize counter, or to put a payout right. */
export function grantTickets(name: string, amount: number) {
  return api<{ name: string; earned: number; balance: number }>('/admin/tickets/grant', {
    method: 'POST',
    body: JSON.stringify({ name, amount }),
  })
}
