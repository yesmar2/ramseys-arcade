import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { tournamentCreateHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { cachedMyGroups, groupHref, groupsIndexHref, listMyGroups, type GroupPublic } from '../lib/groups'
import { normalizePlayerName } from '../lib/leaderboard'

/*
 * An eight-player draw, drawn as the path one player takes to the cup: the
 * events page's brackets in miniature, lit through in the site's colour.
 */
const R1 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 12 + i * 24)
const R2 = [0, 1, 2, 3].map((i) => (R1[2 * i]! + R1[2 * i + 1]!) / 2)
const R3 = [0, 1].map((i) => (R2[2 * i]! + R2[2 * i + 1]!) / 2)
const FINAL = (R3[0]! + R3[1]!) / 2

function Slot({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g className={on ? 'gband-slot gband-slot--on' : 'gband-slot'}>
      <rect x={x} y={y - 9} width="84" height="18" rx="9" />
      <rect className="gband-slot__bar" x={x + 12} y={y - 2} width={on ? 40 : 30} height="4" rx="2" />
    </g>
  )
}

function Join({ x, a, b, on }: { x: number; a: number; b: number; on: boolean }) {
  return (
    <path
      className={on ? 'gband-line gband-line--on' : 'gband-line'}
      d={`M${x} ${a} H${x + 24} V${b} M${x} ${b} H${x + 24} M${x + 24} ${(a + b) / 2} H${x + 48}`}
    />
  )
}

function BracketArt() {
  return (
    <svg className="gband__art" viewBox="0 0 480 196" aria-hidden="true">
      {R1.map((y, i) => (
        <Slot key={`a${i}`} x={0} y={y} on={i === 2} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Join key={`j1${i}`} x={84} a={R1[2 * i]!} b={R1[2 * i + 1]!} on={i === 1} />
      ))}
      {R2.map((y, i) => (
        <Slot key={`b${i}`} x={132} y={y} on={i === 1} />
      ))}
      {[0, 1].map((i) => (
        <Join key={`j2${i}`} x={216} a={R2[2 * i]!} b={R2[2 * i + 1]!} on={i === 0} />
      ))}
      {R3.map((y, i) => (
        <Slot key={`c${i}`} x={264} y={y} on={i === 0} />
      ))}
      <Join x={348} a={R3[0]!} b={R3[1]!} on />
      <circle className="gband-cup" cx="428" cy={FINAL} r="30" />
      <g className="gband-trophy" transform={`translate(413 ${FINAL - 15}) scale(1.25)`}>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </g>
    </svg>
  )
}

/**
 * Groups and events, near the foot of the page: a board for your own people,
 * and events to run on it. Someone without a group gets the pitch and a way to
 * start one; someone in groups gets them by name, and making an event leads.
 */
export function HomeGroupsBand() {
  const { signedIn } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const [groups, setGroups] = useState<GroupPublic[]>(() => (name ? cachedMyGroups() : []))

  useEffect(() => {
    if (!signedIn || !name) {
      setGroups([])
      return
    }
    let cancelled = false
    listMyGroups()
      .then((list) => {
        if (!cancelled) setGroups(list.filter((g) => g.isMember))
      })
      .catch(() => {
        /* keep whatever the device remembered */
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, name])

  const mine = signedIn ? groups.slice(0, 3) : []

  return (
    <section className="gband" aria-labelledby="gband-title" data-hunt="home-groups">
      <div className="gband__text">
        <p className="gband__kicker">Groups and events</p>
        <h2 id="gband-title" className="gband__title">
          Your own board, for your own people.
        </h2>
        {mine.length > 0 ? (
          <>
            <p className="gband__lead">
              Your groups keep a board where only your people count. Run an event for one of them: best
              score, place points or a bracket.
            </p>
            <ul className="gband__groups">
              {mine.map((g) => (
                <li key={g.id}>
                  <a className="gband__group" href={groupHref(g.id)}>
                    {g.name}
                    <small>
                      {g.memberCount} {g.memberCount === 1 ? 'player' : 'players'}
                    </small>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="gband__lead">
            Start a group for the family, the office or the group chat: the same games, on a board where
            only your people count. Then run an event with best score, place points or a bracket.
          </p>
        )}
        <div className="gband__acts">
          {mine.length > 0 ? (
            <>
              <a className="gband__cta" href={tournamentCreateHref()}>
                Create an event
              </a>
              <a className="gband__ghost" href={groupsIndexHref()}>
                All groups
              </a>
            </>
          ) : (
            <>
              <a className="gband__cta" href={groupsIndexHref()}>
                Start a group
              </a>
              <a className="gband__ghost" href={tournamentCreateHref()}>
                Create an event
              </a>
            </>
          )}
        </div>
      </div>
      <BracketArt />
    </section>
  )
}
