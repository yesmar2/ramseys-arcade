import type { CSSProperties } from 'react'
import { todayHref } from '../hooks/useHashRoute'
import { boardDay } from '../lib/rankHow'
import { liveDailies, todayRule } from '../lib/today'

/*
 * Today's ticket while its own code is still coming (HomeToday.tsx is a chunk of its own, with every daily's
 * plan): the same stub and races in the same sizes, shimmering where the day's words and pictures go, so the
 * ticket holds its place on the page and nothing below it moves when it comes.
 */

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

export function HomeTodaySkeleton() {
  const day = boardDay()
  const n = Math.max(1, liveDailies(day).length)
  const rule = todayRule(n, day)
  return (
    <section className="home-day home-day--skel" aria-busy="true" aria-labelledby="home-day-skel-title">
      <div className="home-day__stub">
        <div className="home-day__when">
          <h2 id="home-day-skel-title" className="home-day__title">
            Today’s ticket
          </h2>
          <span className="home-day__date">
            <span className="skel-line" style={skel('9rem')} />
          </span>
        </div>
        {/* Each in the ticket's own text styles, so each is a line of text tall. */}
        <div className="home-day__streak" aria-hidden="true">
          <span className="home-day__flame home-day__flame--skel" />
          <span className="home-day__streak-words">
            <b className="home-day__streak-big">
              <span className="skel-line" style={skel('8rem')} />
            </b>
            <span className="home-day__streak-sub">
              <span className="skel-line" style={skel('10rem')} />
            </span>
          </span>
        </div>
        <div className="home-day__punch" aria-hidden="true">
          <span className="home-day__holes">
            {Array.from({ length: rule.count }, (_, i) => (
              <span key={i} className="home-day__hole home-day__hole--skel" />
            ))}
          </span>
          <span className="home-day__count">
            <span className="skel-line" style={skel('12rem')} />
          </span>
        </div>
        <span className="home-day__next" aria-hidden="true">
          <span className="skel-line" style={skel('9rem')} />
        </span>
        <span className="home-day__start home-day__start--skel" aria-hidden="true">
          Start
        </span>
      </div>
      <div className="home-day__races">
        <div className="home-day__head">
          <h3 className="home-day__races-title">Today’s races</h3>
          <span className="home-day__races-sub">New every day, the same for everyone</span>
          <a className="home-day__open" href={todayHref()}>
            Open Dailies
          </a>
        </div>
        <ul className="home-day__cards" style={{ '--n': n } as CSSProperties} aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <li key={i} className="home-day__race">
              <span className="home-day__card">
                <span className="home-day__pic home-day__pic--skel" />
                <span className="home-day__body">
                  <span className="home-day__medal">
                    <span className="skel-line" style={skel('7rem')} />
                  </span>
                  <span className="home-day__side">
                    <span className="skel-line" style={skel('8rem')} />
                  </span>
                </span>
              </span>
              <span className="home-day__foot">
                <span className="home-day__go home-day__go--skel">Play</span>
              </span>
            </li>
          ))}
        </ul>
        <span className="home-day__start home-day__start--under home-day__start--skel" aria-hidden="true">
          Start
        </span>
      </div>
    </section>
  )
}
