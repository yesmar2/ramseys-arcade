import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from './leaderboard'

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

export function useIsAdmin() {
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
  return answers.get(id) ?? remembered(id)
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

export async function fetchClientErrors() {
  return (await api<{ errors: AdminClientError[] }>('/admin/client-errors?limit=100')).errors
}

export async function fetchFeedback() {
  return (await api<{ feedback: AdminFeedback[] }>('/admin/feedback?limit=100')).feedback
}

export async function fetchOpenFlags() {
  return (await api<{ flags: AdminFlag[] }>('/admin/flags?limit=100')).flags
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
