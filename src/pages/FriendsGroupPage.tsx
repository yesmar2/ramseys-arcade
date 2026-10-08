import { useState, type CSSProperties } from 'react'
import { useConfirm } from '../components/ConfirmPanel'
import { AddFriendCard, FriendRequests, FriendsBanner, FriendsList, FriendsMark } from '../components/FriendsCircle'
import { GroupRecords, GroupStandings, NewestRecords } from '../components/GroupDetail'
import { PageShell } from '../components/PageShell'
import { openSiteMenu } from '../components/siteNav'
import { useFriends } from '../hooks/useFriends'
import { useGroupBoard } from '../hooks/useGroupBoard'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import type { Friend } from '../lib/friends'
import { groupAccent, groupStyle, leadLine, youLine, type GroupPeriod } from '../lib/groupPages'
import { FRIENDS_SCOPE, friendsGroup, groupsIndexHref, setActiveGroup, useActiveGroup } from '../lib/groups'
import { normalizePlayerName } from '../lib/leaderboard'

/**
 * Your friends' page, a group's page made from who you've added (/groups/friends): how you stand among
 * them, your records, the newest of them, who's asked, and your friends themselves, with Remove beside
 * each. Signed out, the way to sign in.
 */
export function FriendsGroupPage() {
  const { signedIn, friends, incoming, loaded, remove } = useFriends()
  const playerName = normalizePlayerName(usePlayerName())
  const activeId = useActiveGroup()
  const [period, setPeriod] = useState<GroupPeriod>('monthly')
  const accent = groupAccent(FRIENDS_SCOPE)
  // Questions ask in a panel in your friends' colour, not the browser's grey box.
  const [ask, question] = useConfirm({ '--celeb-accent': accent, '--hero-ink': inkOn(accent) } as CSSProperties)
  const some = friends.length > 0
  const board = useGroupBoard(FRIENDS_SCOPE, period, signedIn && some)
  const month = useGroupBoard(FRIENDS_SCOPE, 'monthly', signedIn && some)
  const group = friendsGroup(playerName, friends)
  const monthEntries = month.table?.entries ?? []
  const style = groupStyle(FRIENDS_SCOPE)

  const onRemove = async (friend: Friend) => {
    const name = normalizePlayerName(friend.name)
    const yes = await ask({
      title: `Remove ${name} from your friends?`,
      body: 'You come off each other’s friends boards. Either of you can ask again any time.',
      confirm: 'Remove',
      destructive: true,
    })
    if (!yes) return
    await remove(friend.accountId)
    // Off the boards' scope too, if they were the last one: nobody to show.
    if (friends.length <= 1 && activeId === FRIENDS_SCOPE) setActiveGroup(null)
  }

  if (!signedIn) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="grp" style={style}>
          <section className="grp-banner grp-banner--plain" aria-labelledby="grp-title">
            <nav className="grp-crumbs" aria-label="Breadcrumb">
              <a href={groupsIndexHref()}>Friends &amp; groups</a>
              <span aria-hidden="true">›</span>
              <span aria-current="page">Friends</span>
            </nav>
            <div className="grp-banner__name">
              <FriendsMark size="lg" />
              <h1 id="grp-title" className="grp-banner__title">
                Friends
              </h1>
            </div>
            <p className="grp-copy">Sign in to add friends and race them: your own table, your own records, and the boards with just you on them.</p>
            <div className="grp-acts">
              <button type="button" className="grp-btn" onClick={openSiteMenu}>
                Sign in
              </button>
            </div>
          </section>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="grp" style={style}>
        <FriendsBanner
          friends={friends}
          loaded={loaded}
          lead={some && month.table ? leadLine(monthEntries, 'monthly', playerName) : null}
          you={some && month.table && playerName ? youLine(monthEntries, playerName, 'monthly', true) : null}
          onBoards={activeId === FRIENDS_SCOPE}
          onSetBoards={(on) => setActiveGroup(on ? FRIENDS_SCOPE : null)}
        />

        {incoming.length ? (
          <section className="grp-card grp-side frd-asking" aria-labelledby="frd-asking-title">
            <h2 id="frd-asking-title" className="grp-h2">
              Wants to be friends
            </h2>
            <FriendRequests requests={incoming} />
          </section>
        ) : null}

        <div className="grp-split frd-split">
          <div className="grp-split__main">
            {!loaded ? (
              <div className="grp-wait grp-wait--table" aria-busy="true" />
            ) : some ? (
              <>
                <GroupStandings group={group} me={playerName} period={period} onPeriod={setPeriod} table={board.table} />
                <GroupRecords group={group} me={playerName} records={board.records} title="Records among you" who="any of you" />
              </>
            ) : (
              <section className="grp-card grp-pitch" aria-labelledby="frd-none-title">
                <p className="grp-kick">Friends</p>
                <h2 id="frd-none-title" className="grp-pitch__title">
                  Nobody here yet
                </h2>
                <p className="grp-pitch__lede">
                  Add a friend by their gamer tag, or send them your link. Once they’re in, this is your own table of who’s
                  ahead each week and month, your own record on every game, and a switch that shows just the two of you on
                  every board.
                </p>
              </section>
            )}
          </div>
          <aside className="grp-split__side" aria-label="Your friends">
            <AddFriendCard me={playerName} />
            {some ? <NewestRecords records={board.records} /> : null}
            <FriendsList onRemove={(f) => void onRemove(f)} />
          </aside>
        </div>
        {question}
      </div>
    </PageShell>
  )
}
