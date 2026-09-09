import { api, getClaimToken, getLastPlayerName, normalizePlayerName, rememberClaimToken } from './leaderboard'
import type { GroupPublic } from './groups'
import { rememberGroupInvite } from './groups'
import { rememberTournamentInvite, type TournamentDetail } from './tournaments'
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

export async function listPendingInvites(playerName?: string): Promise<PublicInvite[]> {
  const name = normalizePlayerName(playerName ?? getLastPlayerName())
  if (!name) return []
  const params = new URLSearchParams({ playerName: name, status: 'pending' })
  const data = await api<{ invites: PublicInvite[] }>(`/invites?${params}`)
  return data.invites ?? []
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
  if (data.kind === 'tournament' && data.tournament.inviteCode) {
    rememberTournamentInvite(data.tournament.id, data.tournament.inviteCode)
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
