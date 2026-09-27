import { useEffect, useState } from 'react'
import { AVATAR_EVENT, getLocalAvatarId } from '../lib/avatars'
import { useGlobalRank } from '../lib/globalRank'

/**
 * Your own avatar string: what this device saved last wins until the API
 * catches up, then the standings' copy. Repaints the moment it changes here.
 */
export function useMyAvatarId(name: string): string | null {
  const { avatarId: rankAvatarId } = useGlobalRank()
  const [local, setLocal] = useState<string | null>(() => (name ? getLocalAvatarId(name) : null))
  useEffect(() => {
    setLocal(name ? getLocalAvatarId(name) : null)
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; avatarId?: string }>).detail
      if (detail?.name === name && detail.avatarId) setLocal(detail.avatarId)
    }
    window.addEventListener(AVATAR_EVENT, onChange)
    return () => window.removeEventListener(AVATAR_EVENT, onChange)
  }, [name])
  return local ?? rankAvatarId ?? null
}
