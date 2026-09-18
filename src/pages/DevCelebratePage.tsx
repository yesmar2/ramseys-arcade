import { useState, type CSSProperties } from 'react'
import { PageShell } from '../components/PageShell'
import { PodiumMedal } from '../components/PodiumMedal'
import { tournamentsHref } from '../hooks/useHashRoute'
import {
  RankUpCelebration,
  ScoreCelebration,
  type CelebPayload,
} from '../components/ScoreSaveCard'

/**
 * Dev only (`/dev/celebrate`): the after-run screens with made-up data, so
 * they can be styled without playing a game to the end each time. Not
 * routed in production builds.
 */
export function DevCelebratePage() {
  const [awards, setAwards] = useState<CelebPayload | null>(null)
  const [climb, setClimb] = useState(false)

  const full: CelebPayload = {
    boards: [
      { period: 'all', rank: 3 },
      { period: 'weekly', rank: 1 },
    ],
    personalBest: { score: 14310, gain: 820 },
    books: [{ id: 'wave-5', label: 'Fastest to wave 5', rank: 2, value: '48.2s' } as never],
    bracket: null,
    placement: { place: 1, scope: 'game', label: 'Weekly Triple', score: 14310 },
  }
  const single: CelebPayload = {
    boards: [],
    personalBest: { score: 9120, gain: 40 },
    books: [],
    bracket: null,
  }
  const champ: CelebPayload = {
    boards: [],
    personalBest: null,
    books: [],
    bracket: { champion: true, matchWon: true, opponent: 'REESE', eventTitle: 'Friday Bracket' },
  }

  const accent = '#2eb8a0'

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev" style={{ '--event-accent': accent, '--board-accent': accent } as CSSProperties}>
        <section className="lst-block" aria-label="Overlays">
          <div className="lst-block__head">
            <h2 className="lst-block__title">Overlays</h2>
            <p className="lst-block__note">dev only</p>
          </div>
          <div className="hero__actions" style={{ flexDirection: 'row' }}>
            <button type="button" className="hero__ghost" onClick={() => setAwards(full)}>
              Awards · four cards
            </button>
            <button type="button" className="hero__ghost" onClick={() => setAwards(single)}>
              Awards · one card
            </button>
            <button type="button" className="hero__ghost" onClick={() => setAwards(champ)}>
              Awards · champion
            </button>
            <button type="button" className="hero__ghost" onClick={() => setClimb(true)}>
              Rank up
            </button>
          </div>
        </section>

        <section className="lst-block" aria-label="Score cards">
          <div className="lst-block__head">
            <h2 className="lst-block__title">Score card</h2>
            <p className="lst-block__note">static markup, three phases</p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
              gap: '1rem',
              padding: '1.5rem',
              borderRadius: '1.4rem',
              background: 'var(--playfield)',
              justifyItems: 'center',
            }}
          >
            <div className="score-save">
              <div className="score-save__hero">
                <span className="score-save__eyebrow">Ship down · Wave 6</span>
                <strong className="score-save__score">14,310</strong>
                <p className="score-save__pb score-save__pb--best">New personal best</p>
                <span className="score-save__gain">+820</span>
                <p className="score-save__sub">Saved as DAD</p>
              </div>
              <ul className="score-save__ranks" aria-label="Leaderboard ranks">
                <li>
                  <span>This month</span>
                  <strong>#14</strong>
                </li>
                <li>
                  <span>All time</span>
                  <strong>#37</strong>
                </li>
              </ul>
              <button type="button" className="score-save__btn">
                Play again
              </button>
              <div className="score-save__links">
                <button type="button" className="score-save__text-link">
                  Boards
                </button>
                <button type="button" className="score-save__text-link">
                  Record Books
                </button>
              </div>
            </div>

            <div className="score-save">
              <div className="score-save__hero">
                <span className="score-save__eyebrow">Ship down · Wave 3</span>
                <strong className="score-save__score">6,120</strong>
                <p className="score-save__sub">Best 14,310</p>
              </div>
              <label className="score-save__field">
                <span className="score-save__label">Gamer tag</span>
                <input className="score-save__input" defaultValue="" placeholder="YOU" />
              </label>
              <div className="score-save__actions">
                <button type="button" className="score-save__btn" disabled>
                  Continue
                </button>
                <button type="button" className="score-save__btn score-save__btn--ghost">
                  Skip
                </button>
              </div>
            </div>

            <div className="score-save tour-score">
              <div className="score-save__hero">
                <span className="score-save__eyebrow">Weekly Triple</span>
                <strong className="score-save__score">14,310</strong>
                <p className="score-save__sub">Asteroids · attempt 2 of 3</p>
              </div>
              <p className="score-save__as">Posted as DAD</p>
              <p className="score-save__note">1 attempt left</p>
              <ul className="score-save__ranks" aria-label="Tournament standing">
                <li>
                  <span>This game</span>
                  <span className="score-save__place-value">
                    <PodiumMedal kind="gold" size="sm" />
                    <strong>1st</strong>
                  </span>
                </li>
                <li>
                  <span>Points</span>
                  <strong>+10</strong>
                </li>
                <li>
                  <span>Overall</span>
                  <strong>2nd</strong>
                </li>
              </ul>
              <div className="score-save__actions">
                <button type="button" className="score-save__btn">
                  Play again
                </button>
              </div>
              <div className="score-save__links">
                <a href={tournamentsHref()}>Standings</a>
              </div>
            </div>
          </div>
        </section>

        {awards ? <ScoreCelebration payload={awards} onDone={() => setAwards(null)} /> : null}
        {climb ? (
          <RankUpCelebration climb={{ from: 41, to: 12, gained: 29 }} onDone={() => setClimb(false)} />
        ) : null}
      </div>
    </PageShell>
  )
}
