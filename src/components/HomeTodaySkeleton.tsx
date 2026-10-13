import type { CSSProperties } from 'react'
import { todayHref } from '../hooks/useHashRoute'
import { boardDay } from '../lib/rankHow'
import { alsoDailies, liveDailies } from '../lib/today'
import { BlipPoll } from './BlipPoll'

/*
 * The Dailies row while its own code is still coming (HomeToday.tsx is a chunk of its own, with every
 * daily's plan): the same section, head and cards in the same sizes, Blip's question beside them and the
 * day's puzzles under them, shimmering where the day's words and pictures go, so the row holds its place on
 * the page and nothing below it moves when it comes.
 */

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

export function HomeTodaySkeleton() {
  const day = boardDay()
  const n = Math.max(1, liveDailies(day).length)
  const also = alsoDailies(day).length
  return (
    <section className="home-day home-day--skel" aria-busy="true" aria-labelledby="home-day-skel-title">
      <div className="home-day__head">
        <div className="home-day__when">
          <h2 id="home-day-skel-title" className="home-day__title">
            Dailies
          </h2>
          <span className="home-day__date">
            <span className="skel-line" style={skel('4.5rem')} />
          </span>
        </div>
        {/* Each in the row's own text styles, so each is a line of text tall, and they wrap where the row's do. */}
        <div className="home-day__stand">
          <span className="home-day__pips" aria-hidden="true">
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="home-day__pip" />
            ))}
          </span>
          <span className="home-day__count">
            <span className="skel-line" style={skel('2.5rem')} />
          </span>
          <span className="home-day__streak">
            <span>
              <span className="skel-line" style={skel('16rem')} />
            </span>
          </span>
        </div>
        <span className="home-day__next">
          <span className="skel-line" style={skel('9rem')} />
        </span>
        <a className="home-day__open" href={todayHref()}>
          Open Dailies
        </a>
      </div>
      {/* The races, and Blip's question beside them: his own card, already here, waiting on its question itself. */}
      <div className="home-day__row" style={{ '--races': `${n}fr` } as CSSProperties}>
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
        <BlipPoll />
      </div>
      {/* The day's puzzles, the slim line under the races (AlsoToday.tsx), each a shimmer till it comes. */}
      {also > 0 ? (
        <div className="also also--compact" aria-hidden="true">
          <div className="also__head">
            <p className="also__title">Also today</p>
            <p className="also__sub">Daily puzzles, just for fun. They don’t count toward your streak.</p>
          </div>
          <ul className="also__list">
            {Array.from({ length: also }, (_, i) => (
              <li key={i} className="also__item">
                <span className="also__pic" />
                <span className="also__text">
                  <span className="also__game">
                    <span className="skel-line" style={skel('5.5rem')} />
                  </span>
                  <span className="also__course">
                    <span className="skel-line" style={skel('7.5rem')} />
                  </span>
                </span>
                <span className="also__go skel-btn">Play</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {/* On a phone the time to the next dailies comes under the cards (homeToday.css), as on the row. */}
      <p className="home-day__next home-day__next--under">
        <span>
          <span className="skel-line" style={skel('9rem')} />
        </span>
      </p>
    </section>
  )
}
