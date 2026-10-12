import { navigate } from '../hooks/useHashRoute'
import type { FriendsWeek } from '../lib/friendsWeek'
import { friendsHref } from '../lib/groups'
import { friendsWeekTakeover } from '../lib/winTakeover'
import { WinTakeover } from './WinTakeover'

/** Last week won among your friends, on the whole screen (FriendsWeekMoment.tsx loads it when there's one). */
export function FriendsWeekTakeover({ week, onClose }: { week: FriendsWeek; onClose: () => void }) {
  const data = friendsWeekTakeover(week)
  if (!data) return null
  return (
    <WinTakeover
      data={data}
      primary={{
        label: 'See your friends',
        onClick: () => {
          onClose()
          navigate(friendsHref())
        },
      }}
      onClose={onClose}
    />
  )
}
