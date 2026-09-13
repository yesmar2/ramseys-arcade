import { api, normalizePlayerName } from './leaderboard'

export type FriendRequestDirection = 'incoming' | 'outgoing'

export type FriendRequest = {
  id: string
  direction: FriendRequestDirection
  name: string
  createdAt: number
}

export type Friend = {
  accountId: string
  name: string
  avatarId: string
  since: number
}

export type SendFriendRequestResult = {
  status: 'pending' | 'accepted'
  request?: FriendRequest
}

export async function listFriends(): Promise<{ friends: Friend[]; requests: FriendRequest[] }> {
  return api<{ friends: Friend[]; requests: FriendRequest[] }>('/friends')
}

export async function sendFriendRequest(toName: string): Promise<SendFriendRequestResult> {
  return api<SendFriendRequestResult>('/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ toName: normalizePlayerName(toName) }),
  })
}

export async function acceptFriendRequest(id: string): Promise<{ accountId: string; name: string }> {
  return api<{ accountId: string; name: string }>(
    `/friends/requests/${encodeURIComponent(id)}/accept`,
    { method: 'POST' },
  )
}

export async function declineFriendRequest(id: string): Promise<void> {
  await api(`/friends/requests/${encodeURIComponent(id)}/decline`, { method: 'POST' })
}

export async function cancelFriendRequest(id: string): Promise<void> {
  await api(`/friends/requests/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function removeFriend(accountId: string): Promise<void> {
  await api(`/friends/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
}
