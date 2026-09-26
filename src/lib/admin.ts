import { useAuth } from '../hooks/useAuth'
import { api } from './leaderboard'

const ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
)

/** True for allowlisted emails, or anyone in local Vite DEV. */
export function isAdminAccount(account: { email?: string } | null | undefined) {
  if (import.meta.env.DEV) return true
  const email = account?.email?.trim().toLowerCase()
  return Boolean(email && ADMIN_EMAILS.has(email))
}

export function useIsAdmin() {
  const { account } = useAuth()
  return isAdminAccount(account)
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
