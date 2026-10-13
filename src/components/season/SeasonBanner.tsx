import type { CSSProperties } from 'react'
import { gamePlayHref, seasonHref } from '../../hooks/useHashRoute'
import { daysLeftLabel, extraTickets, rewardAt, rewardPhrase, seasonProgress, type SeasonInfo, type SeasonReward, type SeasonYou } from '../../lib/season'
import { SeasonScene } from './SeasonLook'
import '../../styles/season.css'

/*
 * The home page's banner while a season is live (Ramsey picked B, "dressed for the season", 2026-10-02):
 * the season's name and days left, where you are on its pass and what's next on it, and the game the banner
 * would have offered (today's pick, or the one you played last) as its second button.
 */

// The season's accent and the ink on it, from its tokens (season.css): Space Race's orange, Cold Snap's aurora green.
const STYLE = { '--hero-accent': 'var(--space-orange)', '--hero-ink': 'var(--space-on-accent)', '--tile-accent': 'var(--space-orange)' } as CSSProperties

export function SeasonBanner({
  season,
  you,
  rewards,
  pick,
  top = season.levels,
}: {
  season: SeasonInfo
  you: SeasonYou | null
  rewards: SeasonReward[]
  pick: { slug: string; name: string; kicker: string }
  /** The last level with a look on their rows: the season's last, or with Pass+ its row's last (lib/season.ts seasonTop). */
  top?: number
}) {
  const p = seasonProgress(season, you)
  const next = p.level < season.levels ? rewardAt(rewards, p.level + 1) : null
  // Past the free row's last, the levels go on paying tickets.
  const extra = !next && p.level >= season.levels && p.toNext != null ? extraTickets(season, p.level + 1) : null
  const blurb = !you
    ? `Win tickets in any game to climb a free pass of ${season.levels} levels, with looks and ships to win on the way.`
    : p.level <= 0
      ? 'Win a ticket in any game to start the pass. Every ticket you win this season moves you up.'
      : next && p.toNext != null
        ? `You’re Level ${p.level}. Level ${next.level} is ${p.toNext.toLocaleString()} ${p.toNext === 1 ? 'ticket' : 'tickets'} away, with ${rewardPhrase(next)}.`
        : extra != null && p.toNext != null
          ? `You’re Level ${p.level}. Level ${p.level + 1} is ${p.toNext.toLocaleString()} ${p.toNext === 1 ? 'ticket' : 'tickets'} away, with ${extra} bonus tickets.`
          : p.level >= top
          ? 'You’ve reached the top of the pass. Every level is yours.'
          : `You’re Level ${p.level}. Every ticket you win moves you up.`
  // On the pass: your level and what's next, under the buttons.
  const figures = you != null && p.level > 0
  // A phone's banner has a line for the pass only where there's no level row: a few words, as on a phone's home.
  const short = figures ? null : !you ? 'Win tickets to climb the free pass.' : 'Win a ticket to start the pass.'
  return (
    <section className="home-banner home-banner--season" style={STYLE} aria-label={`Season ${season.id}: ${season.name}`} data-hunt="home-hero">
      <div className="home-banner__text">
        <p className="home-banner__kicker">
          Season {season.id} · {daysLeftLabel(season)}
        </p>
        <h2 className="home-banner__name">
          <a href={seasonHref()}>{season.name}</a>
        </h2>
        <p className="home-banner__blurb">{blurb}</p>
        {short ? <p className="home-banner__blurb home-banner__blurb--short">{short}</p> : null}
        <div className="home-banner__acts">
          <a className="home-banner__cta" href={seasonHref()}>
            See the pass
          </a>
          <a className="home-banner__ghost" href={gamePlayHref(pick.slug)}>
            {pick.kicker}: {pick.name}
          </a>
        </div>
        {figures ? (
          <dl className="home-banner__figures" aria-label="Your season">
            <div className="home-banner__figure">
              <dt>Your level</dt>
              <dd>
                {p.level}
                {p.level <= top ? <small> of {top}</small> : null}
              </dd>
            </div>
            {next && p.toNext != null ? (
              <div className="home-banner__figure">
                <dt>Next up</dt>
                <dd>
                  {next.name}
                  <small> at Level {next.level}</small>
                </dd>
              </div>
            ) : extra != null ? (
              <div className="home-banner__figure">
                <dt>Next up</dt>
                <dd>
                  {extra} tickets
                  <small> at Level {p.level + 1}</small>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
      <a className="home-banner__art home-banner__art--season" href={seasonHref()} tabIndex={-1} aria-hidden="true">
        <SeasonScene slug={season.slug} />
      </a>
    </section>
  )
}
