import type { CSSProperties } from 'react'
import { todayHref } from '../hooks/useHashRoute'
import { boardDay } from '../lib/rankHow'
import { liveDailies } from '../lib/today'

/*
 * The Dailies row while its own code is still coming (HomeToday.tsx is a chunk of its own, with every
 * daily's plan): the same section, head and cards in the same sizes, shimmering where the day's words and
 * pictures go, so the row holds its place on the page and nothing below it moves when it comes.
 */

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

export function HomeTodaySkeleton() {
  const n = Math.max(1, liveDailies(boardDay()).length)
  return (
    <section className="home-day home-day--skel" aria-busy="true" aria-labelledby="home-day-skel-title">
      <div className="home-day__head">
        <div className="home-day__when">
          <h2 id="home-day-skel-title" className="home-day__title">
            Dailies
          </h2>
          <span className="skel-line" style={skel('4.5rem')} />
        </div>
        <div className="home-day__stand">
          <span className="skel-line" style={skel('14rem')} />
        </div>
        <span className="home-day__next">
          <span className="skel-line" style={skel('9rem')} />
        </span>
        <a className="home-day__open" href={todayHref()}>
          Open Dailies
        </a>
      </div>
      <ul className="home-day__cards" style={{ '--n': n } as CSSProperties} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <li key={i}>
            <span className="home-day__card">
              <span className="home-day__pic home-day__pic--skel" />
              <span className="home-day__body">
                <span className="home-day__kicker">
                  <span className="skel-line" style={skel('6.5rem')} />
                </span>
                <span className="home-day__name">
                  <span className="skel-line" style={skel('8.5rem')} />
                </span>
                <span className="home-day__foot">
                  <span className="home-day__go home-day__go--skel">Play</span>
                  <span className="home-day__side">
                    <span className="skel-line" style={skel('5.5rem')} />
                  </span>
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
