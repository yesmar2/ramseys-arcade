import { api, getClaimToken, getLastPlayerName, normalizePlayerName, rememberClaimToken } from './leaderboard'
import type { GroupPublic } from './groups'
import { rememberGroupInvite } from './groups'
import {
  rememberTournamentInvite,
  rememberTournamentPlayer,
  type TournamentDetail,
} from './tournaments'
import { groupHref } from './groups'
import { tournamentHref } from '../hooks/useHashRoute'

export type InviteKind = 'group' | 'tournament'
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked'

export type PublicInvite = {
  id: string
  kind: InviteKind
  targetId: string
  targetName: string
  fromName: string | null
  toName: string
  /** The invitee's badge, on an event's list of who's been asked. */
  toAvatarId?: string
  status: InviteStatus
  createdAt: number
  expiresAt: number
}

export type AcceptInviteResult =
  | { kind: 'group'; invite: PublicInvite; group: GroupPublic }
  | {
      kind: 'tournament'
      invite: PublicInvite
      tournament: TournamentDetail
      player: { id: string; name: string; joinedAt: number }
    }

export function inviteTargetHref(invite: PublicInvite) {
  if (invite.kind === 'group') return groupHref(invite.targetId)
  return tournamentHref(invite.targetId)
}

const INVITES_INFLIGHT_MS = 5_000
let invitesInflight: { name: string; at: number; promise: Promise<PublicInvite[]> } | null = null

/**
 * Pending invites for a player. The header badge and the invites strip ask
 * at the same moment on every page, so they share one request.
 *
 * Prefer the local gamer tag; if none is set yet but a session exists, still
 * hit the API so account-owned tags can receive invites.
 */
export async function listPendingInvites(playerName?: string): Promise<PublicInvite[]> {
  const name = normalizePlayerName(playerName ?? getLastPlayerName())
  const now = Date.now()
  const cacheKey = name || '__session__'
  if (
    invitesInflight &&
    invitesInflight.name === cacheKey &&
    now - invitesInflight.at < INVITES_INFLIGHT_MS
  ) {
    return invitesInflight.promise
  }
  const params = new URLSearchParams({ status: 'pending' })
  if (name) params.set('playerName', name)
  const promise = api<{ invites: PublicInvite[] }>(`/invites?${params}`)
    .then((data) => data.invites ?? [])
    .catch((err) => {
      invitesInflight = null
      throw err
    })
  invitesInflight = { name: cacheKey, at: now, promise }
  return promise
}

/**
 * Who the host has invited to this event and not heard back from.
 *
 * Host only — the other listing answers what you have been invited to, this
 * answers who you have invited. Returns [] rather than throwing when you are
 * not the host, so a non-host detail page simply shows nothing.
 */
export async function listEventInvites(tournamentId: string): Promise<PublicInvite[]> {
  try {
    const data = await api<{ invites?: PublicInvite[] }>(
      `/tournaments/${encodeURIComponent(tournamentId)}/invites`,
    )
    return data.invites ?? []
  } catch {
    return []
  }
}

export async function sendInvite(input: {
  kind: InviteKind
  targetId: string
  toName: string
}): Promise<PublicInvite> {
  const fromName = normalizePlayerName(getLastPlayerName()) || undefined
  const data = await api<{ invite: PublicInvite }>('/invites', {
    method: 'POST',
    body: JSON.stringify({
      kind: input.kind,
      targetId: input.targetId,
      toName: normalizePlayerName(input.toName),
      fromName,
    }),
  })
  return data.invite
}

export async function acceptInvite(id: string): Promise<AcceptInviteResult> {
  const name = normalizePlayerName(getLastPlayerName())
  const token = name ? getClaimToken(name) : undefined
  const data = await api<AcceptInviteResult & { name?: string; token?: string }>(
    `/invites/${encodeURIComponent(id)}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ name, token }),
    },
  )
  if (data.kind === 'group' && data.group.inviteCode) {
    rememberGroupInvite(data.group.id, data.group.inviteCode)
  }
  if (data.kind === 'tournament') {
    rememberTournamentPlayer(data.tournament.id, data.player.id)
    if (data.tournament.inviteCode) {
      rememberTournamentInvite(data.tournament.id, data.tournament.inviteCode)
    }
  }
  if (data.token && name) rememberClaimToken(name, data.token)
  return data
}

export async function declineInvite(id: string): Promise<PublicInvite> {
  const name = normalizePlayerName(getLastPlayerName())
  const token = name ? getClaimToken(name) : undefined
  const data = await api<{ invite: PublicInvite }>(
    `/invites/${encodeURIComponent(id)}/decline`,
    {
      method: 'POST',
      body: JSON.stringify({ name, token }),
    },
  )
  return data.invite
}
