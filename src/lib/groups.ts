import { useSyncExternalStore } from 'react'
import { SESSION_KEY } from './accountEvents'
import type { Friend } from './friends'
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
  /** Tag of the member who holds the group. Absent on older API builds. */
  ownerName?: string | null
  /** Set for whoever may hand it out: the host, and everyone in it once they're let. */
  inviteCode: string | null
  /** The host has let everyone in the group invite. */
  membersInvite?: boolean
  /** This viewer may invite. Absent on older API builds, where only the host could. */
  canInvite?: boolean
  /**
   * How many it holds, as the API refuses a join past it: its host's plan's (the API's plans.ts groupMembers),
   * Plus's free week as Plus. Absent on older API builds.
   */
  memberLimit?: number
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

/** Clear board scope when the signed-in account changes. */
export function clearActiveGroup() {
  setActiveGroup(null)
}

export function appendGroupQuery(href: string, groupId: string | null = storedActiveGroup()): string {
  const raw = href.replace(/^#/, '')  // tolerate old `#/…` hrefs
  const [path, qs] = raw.split('?')
  const params = new URLSearchParams(qs || '')
  if (groupId) params.set('group', groupId)
  else params.delete('group')
  const q = params.toString()
  return `${path}${q ? `?${q}` : ''}`
}

export function parseGroupQuery(queryString?: string): string | null {
  if (!queryString) return null
  const value = new URLSearchParams(queryString).get('group')?.trim()
  if (!value || value === 'everyone') return null
  return value
}

/**
 * Whether this viewer can have boards show a group: signed in, as nobody else has groups or friends to show,
 * and one of their groups as this device last heard (before it has heard, the API says: withGroupFallback).
 * An address asking for one they can't isn't taken up, so a link can't leave them on boards that refuse them.
 */
export function canUseGroup(id: string): boolean {
  try {
    if (!localStorage.getItem(SESSION_KEY)) return false
  } catch {
    return false
  }
  if (id === FRIENDS_SCOPE) return true
  const heard = heardMyGroups()
  return heard === null || heard.some((g) => g.id === id)
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

/**
 * Drop a forbidden/unknown group and retry as Everyone so scores never leak. A request for a group of its
 * page's own (`group`, How your rank works from a group's page) wasn't the site's group: that one stays.
 */
export async function withGroupFallback<T>(run: () => Promise<T>, group?: string | null): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (group === undefined && isGroupScopeError(err) && storedActiveGroup()) {
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

const GROUPS_CACHE_KEY = 'skermix-my-groups'
const GROUPS_INFLIGHT_MS = 5_000
let groupsInflight: { key: string; at: number; promise: Promise<GroupPublic[]> } | null = null

/** The last list this device saw for the current player, for a first paint before the API answers. */
export function cachedMyGroups(): GroupPublic[] {
  return heardMyGroups() ?? []
}

/** The current player's groups as this device last heard them, or null before it has heard any. */
function heardMyGroups(): GroupPublic[] | null {
  try {
    const raw = localStorage.getItem(GROUPS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { player?: string; groups?: GroupPublic[] }
    const player = normalizePlayerName(getLastPlayerName())
    return parsed.player === player && Array.isArray(parsed.groups) ? parsed.groups : null
  } catch {
    return null
  }
}

/** Fired when this device remembers a new list of your groups: the names a page calls the boards' group by (useScope). */
export const MY_GROUPS_EVENT = 'arcade-my-groups'

function rememberMyGroups(player: string, groups: GroupPublic[]) {
  try {
    localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify({ player, groups }))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MY_GROUPS_EVENT))
}

/**
 * Groups the current player is in. Callers that mount together (the header
 * and the drawer) share one request, and the answer is remembered on the
 * device so the next visit can paint the group's name before asking again.
 */
export async function listMyGroups(): Promise<GroupPublic[]> {
  const params = new URLSearchParams()
  const player = normalizePlayerName(getLastPlayerName())
  if (player) params.set('playerName', player)
  const q = params.toString()
  const now = Date.now()
  if (groupsInflight && groupsInflight.key === q && now - groupsInflight.at < GROUPS_INFLIGHT_MS) {
    return groupsInflight.promise
  }
  const promise = api<{ groups: GroupPublic[] }>(`/groups${q ? `?${q}` : ''}`)
    .then((data) => {
      const groups = data.groups ?? []
      rememberMyGroups(player, groups)
      return groups
    })
    .catch((err) => {
      groupsInflight = null
      throw err
    })
  groupsInflight = { key: q, at: now, promise }
  return promise
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
  const data = await api<{ group?: GroupPublic }>(`/groups/${encodeURIComponent(id)}/rename`, {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
  })
  if (!data.group?.id || !data.group.name) {
    throw new Error('Could not rename group')
  }
  return data.group
}

/** Hand the group to another member, who must have signed in at least once. */
export async function transferGroup(id: string, name: string): Promise<GroupPublic> {
  const data = await api<{ group: GroupPublic }>(
    `/groups/${encodeURIComponent(id)}/transfer`,
    { method: 'POST', body: JSON.stringify({ name: name.trim().toUpperCase() }) },
  )
  return data.group
}

/** The host lets everyone in the group invite, or takes it back. */
export async function setGroupMembersInvite(id: string, on: boolean): Promise<GroupPublic> {
  const data = await api<{ group: GroupPublic }>(`/groups/${encodeURIComponent(id)}/members-invite`, {
    method: 'POST',
    body: JSON.stringify({ on }),
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
  const base = `/groups/${encodeURIComponent(id)}`
  if (!invite?.trim()) return base
  return `${base}?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
}

export function groupsIndexHref() {
  return '/groups'
}

/**
 * You and your friends, as the boards' scope: a group the API makes from who you've added (its
 * friendsBoardScope), with a page of its own on the Friends & groups page. No group's id is it.
 */
export const FRIENDS_SCOPE = 'friends'

/** Your friends' page, among your groups. */
export function friendsHref() {
  return groupHref(FRIENDS_SCOPE)
}

/**
 * You and your friends as a group, for the group pages' parts (its standings, its records) and an event's
 * invites: you first, then each friend from when you became friends.
 */
export function friendsGroup(me: string, friends: readonly Friend[]): GroupPublic {
  const you = normalizePlayerName(me)
  const members: GroupMember[] = [
    ...(you ? [{ name: you, joinedAt: 0 }] : []),
    ...friends.map((f) => ({ name: normalizePlayerName(f.name), joinedAt: f.since, avatarId: f.avatarId })),
  ]
  return {
    id: FRIENDS_SCOPE,
    name: 'Friends',
    memberCount: members.length,
    members,
    isOwner: false,
    isMember: true,
    ownerName: null,
    inviteCode: null,
  }
}

/** What the boards show, by name: "Friends", or a group's own name; nothing for everyone. */
export function scopeName(id: string | null): string | undefined {
  if (!id) return undefined
  if (id === FRIENDS_SCOPE) return 'Friends'
  return cachedMyGroups().find((g) => g.id === id)?.name
}

/**
 * A group's name as a page says it: its own, or "your group" while this device hasn't the list it's on yet (a
 * first visit, a ?group= link), so a group's board is never worded as the arcade's.
 */
function groupLabel(id: string): string {
  return scopeName(id) ?? 'your group'
}

/** Where a place on the boards is: "among your friends", "in FAMILY", "in the arcade". */
export function scopeWhere(id: string | null): string {
  if (!id) return 'in the arcade'
  if (id === FRIENDS_SCOPE) return 'among your friends'
  return `in ${groupLabel(id)}`
}

/** Who an empty board is empty of: "None of your friends", "Nobody in FAMILY", or "Nobody" for everyone. */
export function scopeNobody(id: string | null): string {
  if (!id) return 'Nobody'
  if (id === FRIENDS_SCOPE) return 'None of your friends'
  return `Nobody in ${groupLabel(id)}`
}

/** The boards' group as a page words it: by name, where a place on its boards is, and who an empty one has none of. */
export type ScopeWords = {
  /** The group's id, or Friends'; null for everyone. */
  id: string | null
  /** "Friends", a group's name, or "your group" until its name comes; nothing for everyone. */
  name: string | undefined
  /** As scopeWhere. */
  where: string
  /** As scopeNobody. */
  nobody: string
}

const EVERYONE_WORDS: ScopeWords = { id: null, name: undefined, where: 'in the arcade', nobody: 'Nobody' }
let lastWords: ScopeWords = EVERYONE_WORDS

/** The words for the boards' group now: the same object while they're the same, as useSyncExternalStore needs. */
function scopeWords(): ScopeWords {
  const id = storedActiveGroup()
  const name = id ? groupLabel(id) : undefined
  if (lastWords.id !== id || lastWords.name !== name) {
    lastWords = id ? { id, name, where: scopeWhere(id), nobody: scopeNobody(id) } : EVERYONE_WORDS
  }
  return lastWords
}

function subscribeScope(onChange: () => void) {
  window.addEventListener(ACTIVE_GROUP_EVENT, onChange)
  window.addEventListener(MY_GROUPS_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ACTIVE_GROUP_EVENT, onChange)
    window.removeEventListener(MY_GROUPS_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * The boards' group as a page words it, kept current: a group's name comes with the list of your groups, which
 * can land after the page's own data, and the page says it again then.
 */
export function useScope(): ScopeWords {
  return useSyncExternalStore(subscribeScope, scopeWords, () => EVERYONE_WORDS)
}

/**
 * One group's name (scopeName), kept current the same way, for a page whose group is its own, from its address,
 * not the boards' (How your rank works from a group's page). Nothing until the list it's on comes.
 */
export function useScopeName(id: string | null): string | undefined {
  return useSyncExternalStore(subscribeScope, () => scopeName(id), () => undefined)
}
