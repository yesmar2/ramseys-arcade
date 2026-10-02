import { useEffect, useRef, type CSSProperties } from 'react'
import { PageShell } from '../components/PageShell'
import { RewardArt } from '../components/season/RewardArt'
import { MissionPatch } from '../components/season/SeasonArt'
import { openSiteMenu } from '../components/siteNav'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { gameHref } from '../hooks/useHashRoute'
import { daysLeftLabel, refreshSeason, seasonDates, seasonProgress, useSeason, type SeasonInfo, type SeasonReward } from '../lib/season'
import { SPACE, starTile } from '../lib/seasonArt'
import '../styles/season.css'

/*
 * The season's page (Ramsey picked layout A, 2026-10-02): the season in its own colours over the top, with
 * where you are on its pass; the pass itself, a row of its 30 levels' rewards that scrolls, the ones you've
 * won ticked and the next one lit; a rail of every level; and how it works, with the season's skins.
 */

type TileState = 'got' | 'next' | 'locked'

function stateOf(reward: SeasonReward, level: number): TileState {
  return reward.level <= level ? 'got' : reward.level === level + 1 ? 'next' : 'locked'
}

function CheckBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

function rewardTitle(reward: SeasonReward): string {
  return reward.kind === 'tickets' ? `+${reward.amount ?? 0} tickets` : reward.name
}

function Tile({ reward, state, perLevel, toNext }: { reward: SeasonReward; state: TileState; perLevel: number; toNext: number | null }) {
  // A locked level's season tickets would read as a price at the counter: the rail says how far they are.
  const foot = state === 'next' && toNext != null ? `${toNext.toLocaleString()} to go` : state === 'got' && !reward.ready ? `${reward.what} · on its way` : reward.what
  const at = ((reward.level - 1) * perLevel).toLocaleString()
  return (
    <li className={`season-tile season-tile--${state}`} data-level={reward.level} title={state === 'locked' ? `Level ${reward.level}, at ${at} season tickets` : undefined}>
      <span className="season-tile__top">
        <span className="season-tile__lv">LV {reward.level}</span>
        {state === 'got' ? (
          <span className="season-tile__got" title="Yours">
            <CheckBadge />
          </span>
        ) : state === 'locked' ? (
          <span className="season-tile__lock">
            <LockGlyph />
          </span>
        ) : (
          <span className="season-tile__next">Next</span>
        )}
      </span>
      <span className="season-tile__art">
        <RewardArt reward={reward} size={88} />
      </span>
      <span className="season-tile__name">{rewardTitle(reward)}</span>
      <span className="season-tile__what">{foot}</span>
    </li>
  )
}

function Hero({ season, level, fraction, toNext, earned, signedIn, authLoading }: { season: SeasonInfo; level: number; fraction: number; toNext: number | null; earned: number; signedIn: boolean; authLoading: boolean }) {
  const sky = { backgroundImage: starTile('#f4f0ff', 13, { size: 360, stars: 44 }) } as CSSProperties
  const live = season.status === 'live'
  const when =
    season.status === 'upcoming'
      ? `Starts ${seasonDates(season).split(' – ')[0]}`
      : season.status === 'over'
        ? `Ended ${seasonDates(season).split(' – ')[1]}`
        : `${seasonDates(season)} · ${daysLeftLabel(season)}`
  return (
    <section className="season-hero" aria-labelledby="season-title">
      <div className="season-hero__sky" style={sky} aria-hidden="true">
        <span className="season-hero__planet" />
        <span className="season-hero__ring" />
      </div>
      <div className="season-hero__text">
        <p className="season-hero__kick">Season {season.id}</p>
        <h1 className="season-hero__title" id="season-title">
          {season.name}
        </h1>
        <p className="season-hero__when">{when}</p>
        <p className="season-hero__lede">
          Every ticket you win this season moves you up the pass. Spending tickets never moves you back.
        </p>
        {season.preview ? <p className="season-hero__preview">Preview: the season starts for everyone on its first day. Tickets since the 1st count here, for trying it out.</p> : null}
      </div>
      <div className="season-level">
        <MissionPatch label={level > 0 ? String(level) : undefined} size={104} className="season-level__patch" />
        <div className="season-level__body">
          {!live ? (
            <>
              <span className="season-level__n">{season.levels} levels</span>
              <span className="season-level__sub">
                {season.status === 'upcoming' ? 'Free for everyone, from its first day.' : 'What players won is theirs to keep.'}
              </span>
            </>
          ) : !signedIn ? (
            <>
              <span className="season-level__n">Climb the pass</span>
              <span className="season-level__sub">Sign in, then win tickets in any game.</span>
              <button type="button" className="season-level__signin" onClick={openSiteMenu} disabled={authLoading}>
                Sign in
              </button>
            </>
          ) : (
            <>
              <span className="season-level__n">
                {level > 0 ? `Level ${level}` : 'Level 0'} <small>of {season.levels}</small>
              </span>
              <span className="season-level__meter" aria-hidden="true">
                <i style={{ width: `${Math.round(fraction * 100)}%` }} />
              </span>
              <span className="season-level__sub">
                {earned.toLocaleString()} season {earned === 1 ? 'ticket' : 'tickets'}
                {toNext != null && level > 0 ? (
                  <>
                    {' · '}
                    <b>
                      {toNext.toLocaleString()} to Level {level + 1}
                    </b>
                  </>
                ) : level <= 0 ? (
                  <>
                    {' · '}
                    <b>win one to start</b>
                  </>
                ) : null}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export function SeasonPage() {
  const store = useSeason()
  const { signedIn, loading: authLoading } = useAuth()
  const trackRef = useRef<HTMLOListElement>(null)
  const season = store.season
  const p = season ? seasonProgress(season, season.status === 'live' ? store.you : null) : null
  const level = p?.level ?? 0

  // The page asks for any reward a later release brought up to your level, and reads the pass fresh.
  useEffect(() => {
    if (authLoading) return
    void refreshSeason({ signedIn, catchUp: signedIn })
  }, [signedIn, authLoading])

  // The row starts at your next level, a couple of won ones showing to its left.
  const rewardsKey = store.rewards.length
  useEffect(() => {
    const track = trackRef.current
    if (!track || !rewardsKey) return
    const target = track.querySelector<HTMLElement>(`[data-level="${Math.max(1, level - 1)}"]`)
    if (target) track.scrollLeft = target.offsetLeft - track.offsetLeft - 8
  }, [level, rewardsKey])

  const scrollBy = (dir: 1 | -1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  if (!season || !p) {
    return (
      <PageShell innerClassName="lb-page__inner season-page">
        {store.loaded ? (
          <section className="season-empty">
            <h1>No season right now</h1>
            <p>The next one starts soon. Every game still pays tickets for the prize counter meanwhile.</p>
          </section>
        ) : (
          <div className="season-hero season-hero--wait" aria-busy="true" />
        )}
      </PageShell>
    )
  }

  const skins = store.rewards.filter((r) => r.kind === 'skin')
  const spotlight = season.spotlight.map((slug) => getGame(slug)).filter((g): g is NonNullable<typeof g> => g != null)

  return (
    <PageShell innerClassName="lb-page__inner season-page">
      <Hero season={season} level={level} fraction={p.fraction} toNext={p.toNext} earned={p.earned} signedIn={signedIn} authLoading={authLoading} />

      <section className="season-pass" aria-labelledby="season-pass-title">
        <div className="season-pass__head">
          <div>
            <h2 id="season-pass-title">Season pass</h2>
            <p>Free for everyone · {season.levels} levels · looks only, never score</p>
          </div>
          <div className="season-pass__nav">
            <button type="button" aria-label="Earlier levels" onClick={() => scrollBy(-1)}>
              <Chevron back />
            </button>
            <button type="button" aria-label="Later levels" onClick={() => scrollBy(1)}>
              <Chevron />
            </button>
          </div>
        </div>
        <ol className="season-track" ref={trackRef}>
          {store.rewards.map((reward) => (
            <Tile key={`${reward.level}-${reward.id}`} reward={reward} state={stateOf(reward, level)} perLevel={season.perLevel} toNext={p.toNext} />
          ))}
        </ol>
        <div className="season-rail" aria-hidden="true">
          <div className="season-rail__bar">
            {Array.from({ length: season.levels }, (_, i) => {
              const n = i + 1
              const style =
                n === level + 1 && level > 0
                  ? ({ background: `linear-gradient(90deg, ${SPACE.orange} ${Math.round(p.fraction * 100)}%, var(--season-rail-off) 0)` } as CSSProperties)
                  : undefined
              return <span key={n} className={n <= level ? 'season-rail__on' : undefined} style={style} />
            })}
          </div>
          <div className="season-rail__ends">
            <span>Level 1</span>
            <span>Level {season.levels} at {((season.levels - 1) * season.perLevel).toLocaleString()} season tickets</span>
          </div>
        </div>
      </section>

      <div className="season-cards">
        <section className="season-card" aria-labelledby="season-how-title">
          <h2 id="season-how-title">How the pass works</h2>
          <ul className="season-how">
            <li>
              <b>Win tickets in any game.</b> Every ticket you win this season counts. Spending them at the prize counter never takes you back.
            </li>
            <li>
              <b>A level every {season.perLevel} tickets,</b> {season.levels} in all. The pass is free, and so is everything on it.
            </li>
            <li>
              <b>What you win is yours to keep</b> after the season ends: ships, badges, titles and more. Looks only, never score.
            </li>
            {spotlight.length ? (
              <li>
                <b>In the spotlight:</b>{' '}
                {spotlight.map((game, i) => (
                  <span key={game.slug}>
                    {i > 0 ? (i === spotlight.length - 1 ? ' and ' : ', ') : ''}
                    <a href={gameHref(game.slug)}>{game.name}</a>
                  </span>
                ))}
                , with their skins on the pass.
              </li>
            ) : null}
          </ul>
        </section>
        {skins.length ? (
          <section className="season-card" aria-labelledby="season-skins-title">
            <h2 id="season-skins-title">Skins this season</h2>
            <p className="season-card__sub">Looks only: same speed, same size.</p>
            <ul className="season-skins">
              {skins.map((skin) => {
                const game = skin.game ? getGame(skin.game) : null
                const yours = level >= skin.level
                return (
                  <li key={skin.id} className={yours ? 'season-skin season-skin--yours' : 'season-skin'}>
                    <span className="season-skin__art">
                      <RewardArt reward={skin} size={72} />
                    </span>
                    <span className="season-skin__name">{skin.name}</span>
                    <span className="season-skin__what">
                      {game?.name ?? skin.what} · {yours ? 'yours' : `Lv ${skin.level}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </PageShell>
  )
}
