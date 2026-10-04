import type { CSSProperties } from 'react'
import { gamePlayHref, seasonHref } from '../../hooks/useHashRoute'
import { daysLeftLabel, rewardAt, rewardPhrase, seasonProgress, type SeasonInfo, type SeasonReward, type SeasonYou } from '../../lib/season'
import { MoonScene } from './SeasonArt'
import '../../styles/season.css'

/*
 * The home page's banner while a season is live (Ramsey picked B, "dressed for the season", 2026-10-02):
 * the season's name and days left, where you are on its pass and what's next on it, and the game the banner
 * would have offered (today's pick, or the one you played last) as its second button.
 */

const STYLE = { '--hero-accent': '#f2813a', '--hero-ink': '#1a0e05', '--tile-accent': '#f2813a' } as CSSProperties

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
  /** The highest level their pass reaches: the season's last, or with Pass+ its bonus levels' (lib/season.ts seasonTop). */
  top?: number
}) {
  const p = seasonProgress(season, you, top)
  const next = p.level < season.levels ? rewardAt(rewards, p.level + 1) : null
  const blurb = !you
    ? `Win tickets in any game to climb a free pass of ${season.levels} levels, with looks and ships to win on the way.`
    : p.level <= 0
      ? 'Win a ticket in any game to start the pass. Every ticket you win this season moves you up.'
      : next && p.toNext != null
        ? `You’re Level ${p.level}. Level ${next.level} is ${p.toNext.toLocaleString()} ${p.toNext === 1 ? 'ticket' : 'tickets'} away, with ${rewardPhrase(next)}.`
        : p.level >= top
          ? 'You’ve reached the top of the pass. Every level is yours.'
          : `You’re Level ${p.level}. Every ticket you win moves you up.`
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
        <div className="home-banner__acts">
          <a className="home-banner__cta" href={seasonHref()}>
            See the pass
          </a>
          <a className="home-banner__ghost" href={gamePlayHref(pick.slug)}>
            {pick.kicker}: {pick.name}
          </a>
        </div>
        {you && p.level > 0 ? (
          <dl className="home-banner__figures" aria-label="Your season">
            <div className="home-banner__figure">
              <dt>Your level</dt>
              <dd>
                {p.level}
                <small> of {top}</small>
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
            ) : null}
          </dl>
        ) : null}
      </div>
      <a className="home-banner__art home-banner__art--season" href={seasonHref()} tabIndex={-1} aria-hidden="true">
        <MoonScene />
      </a>
    </section>
  )
}
