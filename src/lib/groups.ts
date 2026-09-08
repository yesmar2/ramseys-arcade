import { useSyncExternalStore } from 'react'
import {
  api,
  getClaimToken,
  getLastPlayerName,
  normalizePlayerName,
  rememberClaimToken,
} from './leaderboard'

export const ACTIVE_GROUP_KEY = 'skermix-active-group'
export const ACTIVE_GROUP_EVENT = 'arcade-active-group'

export type GroupMember = {
  name: string
  joinedAt: number
  avatarId?: string
}

export type GroupPublic = {
  id: string
  name: string
  memberCount: number
  members: GroupMember[]
  isOwner: boolean
  isMember: boolean
  inviteCode: string | null
}

export function storedActiveGroup(): string | null {
  try {
    const value = localStorage.getItem(ACTIVE_GROUP_KEY)?.trim()
    if (!value || value === 'everyone') return null
    return value
  } catch {
    return null
  }
}

export function setActiveGroup(id: string | null) {
  const next = id?.trim() && id !== 'everyone' ? id.trim() : null
  const prev = storedActiveGroup()
  if (prev === next) return
  try {
    if (next) localStorage.setItem(ACTIVE_GROUP_KEY, next)
    else localStorage.removeItem(ACTIVE_GROUP_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACTIVE_GROUP_EVENT))
  }
}

export function appendGroupQuery(href: string, groupId: string | null = storedActiveGroup()): string {
  const raw = href.replace(/^#/, '')
  const [path, qs] = raw.split('?')
  const params = new URLSearchParams(qs || '')
  if (groupId) params.set('group', groupId)
  else params.delete('group')
  const q = params.toString()
  return `#${path}${q ? `?${q}` : ''}`
}

export function parseGroupQuery(queryString?: string): string | null {
  if (!queryString) return null
  const value = new URLSearchParams(queryString).get('group')?.trim()
  if (!value || value === 'everyone') return null
  return value
}

export function applyBoardScope(params: URLSearchParams, groupId: string | null = storedActiveGroup()) {
  if (groupId) params.set('group', groupId)
  const player = normalizePlayerName(getLastPlayerName())
  if (player) params.set('playerName', player)
  return params
}

export const GROUP_BOARD_EMPTY =
  'No scores from this group yet in this time frame.'

export function groupBoardEmptyTitle(fallback: string) {
  return storedActiveGroup() ? GROUP_BOARD_EMPTY : fallback
}

export function isGroupScopeError(err: unknown): boolean {
  const code = (err as { code?: string }).code
  return code === 'GROUP_FORBIDDEN' || code === 'GROUP_NOT_FOUND'
}

/** Drop a forbidden/unknown group and retry as Everyone so scores never leak. */
export async function withGroupFallback<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (isGroupScopeError(err) && storedActiveGroup()) {
      setActiveGroup(null)
      return run()
    }
    throw err
  }
}

const GROUP_INVITES_KEY = 'skermix-group-invites'

function readGroupInvites(): Record<string, string> {
  try {
    const raw = localStorage.getItem(GROUP_INVITES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

export function getGroupInvite(id: string): string | null {
  return readGroupInvites()[id] ?? null
}

export function rememberGroupInvite(id: string, inviteCode: string) {
  if (!id || !inviteCode) return
  try {
    const map = readGroupInvites()
    map[id] = inviteCode.trim().toUpperCase()
    localStorage.setItem(GROUP_INVITES_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function subscribeActiveGroup(onChange: () => void) {
  window.addEventListener(ACTIVE_GROUP_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ACTIVE_GROUP_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useActiveGroup(): string | null {
  return useSyncExternalStore(subscribeActiveGroup, storedActiveGroup, () => null)
}

export async function listMyGroups(): Promise<GroupPublic[]> {
  const params = new URLSearchParams()
  const player = normalizePlayerName(getLastPlayerName())
  if (player) params.set('playerName', player)
  const q = params.toString()
  const data = await api<{ groups: GroupPublic[] }>(`/groups${q ? `?${q}` : ''}`)
  return data.groups ?? []
}

export async function fetchGroupDetail(
  id: string,
  invite?: string,
): Promise<GroupPublic> {
  const params = new URLSearchParams()
  const player = normalizePlayerName(getLastPlayerName())
  if (player) params.set('playerName', player)
  if (invite) params.set('invite', invite.trim().toUpperCase())
  const q = params.toString()
  const data = await api<{ group: GroupPublic }>(
    `/groups/${encodeURIComponent(id)}${q ? `?${q}` : ''}`,
  )
  return data.group
}

export async function createGroup(name: string): Promise<GroupPublic> {
  const playerName = normalizePlayerName(getLastPlayerName()) || undefined
  const data = await api<{ group: GroupPublic }>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, playerName }),
  })
  return data.group
}

export async function joinGroup(
  id: string,
  invite: string,
): Promise<GroupPublic> {
  const name = normalizePlayerName(getLastPlayerName())
  const token = name ? getClaimToken(name) : undefined
  const data = await api<{ group: GroupPublic; name: string; token?: string }>(
    `/groups/${encodeURIComponent(id)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({ name, invite: invite.trim().toUpperCase(), token }),
    },
  )
  if (data.token && data.name) rememberClaimToken(data.name, data.token)
  return data.group
}

export async function leaveGroup(id: string): Promise<void> {
  const name = normalizePlayerName(getLastPlayerName())
  const token = name ? getClaimToken(name) : undefined
  await api(`/groups/${encodeURIComponent(id)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ name, token }),
  })
}

export async function kickGroupMember(id: string, name: string): Promise<GroupPublic> {
  const data = await api<{ group: GroupPublic }>(`/groups/${encodeURIComponent(id)}/kick`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return data.group
}

export async function renameGroup(id: string, name: string): Promise<GroupPublic> {
  const data = await api<{ group: GroupPublic }>(`/groups/${encodeURIComponent(id)}/rename`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return data.group
}

export async function rotateGroupInvite(id: string): Promise<GroupPublic> {
  const data = await api<{ group: GroupPublic }>(
    `/groups/${encodeURIComponent(id)}/rotate-invite`,
    { method: 'POST' },
  )
  return data.group
}

export async function deleteGroup(id: string): Promise<void> {
  await api(`/groups/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function groupHref(id: string, invite?: string) {
  const base = `#/groups/${encodeURIComponent(id)}`
  if (!invite?.trim()) return base
  return `${base}?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
}

export function groupsIndexHref() {
  return '#/groups'
}
