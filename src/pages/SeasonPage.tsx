import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PageShell } from '../components/PageShell'
import { RewardArt } from '../components/season/RewardArt'
import { SeasonPatch } from '../components/season/SeasonLook'
import { UseSkin } from '../components/season/SkinPicker'
import { openAvatarStudio, openSiteMenu } from '../components/siteNav'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { gameHref, plusHref, rankHowHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { AVATAR_EVENT, AVATAR_PINS, AVATARS_ENABLED, getLocalAvatarId, isWearing, resolveAvatar, type Avatar, type AvatarPin } from '../lib/avatars'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName } from '../lib/leaderboard'
import { fetchPlus, freeWeekFor, money, perSeason, seasonWeeks, type PlusInfo } from '../lib/plus'
import {
  confirmPlusCheckout,
  daysLeftLabel,
  headlinersOf,
  plusPrice,
  refreshSeason,
  startPlusCheckout,
  seasonDates,
  seasonProgress,
  seasonTop,
  useSeason,
  type SeasonGoal,
  type SeasonInfo,
  type SeasonPlus,
  type SeasonReward,
} from '../lib/season'
import { starTile } from '../lib/seasonArt'
import { seasonFeed, seasonLines, useSeasonStandings } from '../lib/seasonStandings'
import { StandingsList } from '../components/StandingsList'
import { askForSeasonFont } from '../components/season/SeasonDressing'
import { useTickets } from '../lib/tickets'
import '../styles/season.css'

/*
 * The season's page (Ramsey picked layout A, 2026-10-02): the season in its own colours over the top, with
 * where you are on its pass; the pass itself, a row of its 30 levels' rewards that scrolls, the ones you've
 * won ticked and the next one lit; a rail of every level; and how it works, with the season's skins.
 */

/** A tile: won; next to win; still to come; or (on the Pass+ row, without Pass+) reached, and yours with it. */
type TileState = 'got' | 'next' | 'locked' | 'waiting'

function stateOf(reward: SeasonReward, level: number): TileState {
  return reward.level <= level ? 'got' : reward.level === level + 1 ? 'next' : 'locked'
}

/**
 * The skin the address asks for (#skin-<id>), from its card on a board or a game's skin picker: its tile is lit,
 * and its row turned to it. The page's own scroll down to it is the address's, as any page's (App.tsx).
 */
function soughtSkin(): string | null {
  const hash = typeof window === 'undefined' ? '' : window.location.hash
  if (!hash.startsWith('#skin-')) return null
  try {
    return decodeURIComponent(hash.slice('#skin-'.length))
  } catch {
    return null
  }
}

/** A row of tiles turned so that one sits in its middle. */
function turnTo(track: HTMLElement, tile: HTMLElement) {
  const row = track.getBoundingClientRect()
  const at = tile.getBoundingClientRect()
  track.scrollLeft += at.left - row.left - (row.width - at.width) / 2
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

/** Your avatar as the header shows it: what this device saved last, else what the API has. */
function useOwnAvatar(): Avatar | null {
  const name = normalizePlayerName(usePlayerName())
  const { avatarId: rankAvatarId } = useGlobalRank()
  const [local, setLocal] = useState<string | null>(() => getLocalAvatarId(name))
  useEffect(() => {
    setLocal(getLocalAvatarId(name))
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; avatarId?: string }>).detail
      if (detail?.name === name && detail.avatarId) setLocal(detail.avatarId)
    }
    window.addEventListener(AVATAR_EVENT, onChange)
    return () => window.removeEventListener(AVATAR_EVENT, onChange)
  }, [name])
  return useMemo(() => (name ? resolveAvatar(local ?? rankAvatarId, name) : null), [name, local, rankAvatarId])
}

function isPin(id: string): id is AvatarPin {
  return (AVATAR_PINS as readonly string[]).includes(id)
}

/** A won look on the pass: opens the avatar studio with it on, ready to save. */
function WearLook({ reward, avatar }: { reward: SeasonReward; avatar: Avatar }) {
  const pin = reward.kind === 'pin' && isPin(reward.id) ? reward.id : null
  const on = pin ? avatar.pin === pin : isWearing(avatar, reward.id)
  return (
    <button
      type="button"
      className={`skin-use${on ? ' skin-use--on' : ''}`}
      aria-label={on ? `Wearing ${reward.name}: change what you wear` : `Wear ${reward.name}`}
      onClick={() => openAvatarStudio(pin ? { pin } : { prize: reward.id })}
    >
      {on ? 'Wearing' : 'Wear it'}
    </button>
  )
}

function Tile({
  reward,
  state,
  perLevel,
  toNext,
  action,
  sought = false,
}: {
  reward: SeasonReward
  state: TileState
  perLevel: number
  toNext: number | null
  action?: ReactNode
  /** The skin the address asks for: lit. */
  sought?: boolean
}) {
  // A locked level's season tickets would read as a price at the counter: the rail says how far they are.
  const foot =
    state === 'next' && toNext != null ? `${toNext.toLocaleString()} to go` : state === 'got' && !reward.ready ? `${reward.what} · on its way` : reward.what
  const at = ((reward.level - 1) * perLevel).toLocaleString()
  return (
    <li
      // A skin's tile is where its card on a board leads (lib/skinWhere.ts seasonSkinHref).
      id={reward.kind === 'skin' ? `skin-${reward.id}` : undefined}
      className={`season-tile season-tile--${state}${reward.plus ? ' season-tile--plus' : ''}${sought ? ' season-tile--sought' : ''}`}
      data-level={reward.level}
      title={state === 'locked' ? `Level ${reward.level}, at ${at} season tickets${reward.plus ? ', with Pass+' : ''}` : undefined}
    >
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
        ) : state === 'waiting' ? (
          <span className="season-tile__plusmark">Pass+</span>
        ) : (
          <span className="season-tile__next">Next</span>
        )}
      </span>
      <span className="season-tile__art">
        <RewardArt reward={reward} size={88} />
      </span>
      <span className="season-tile__name">{rewardTitle(reward)}</span>
      <span className="season-tile__what">{foot}</span>
      {state === 'waiting' ? <span className="season-tile__with">Yours with Pass+</span> : null}
      {action ? <span className="season-tile__act">{action}</span> : null}
    </li>
  )
}

function Hero({ season, level, top, fraction, toNext, earned, signedIn, authLoading }: { season: SeasonInfo; level: number; top: number; fraction: number; toNext: number | null; earned: number; signedIn: boolean; authLoading: boolean }) {
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
        <SeasonPatch label={level > 0 ? String(level) : undefined} size={104} className="season-level__patch" slug={season.slug} />
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
                {level > 0 ? `Level ${level}` : 'Level 0'} <small>of {top}</small>
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


/**
 * The Pass+ stage: its best skins big, on lit stands, as a pass leads with its best (Ramsey: "go with A",
 * after asking whether a whole season should be paid, as Fortnite's pass is). Each says its level, or that it's
 * yours once Pass+ is and your level has reached it.
 */
function HeadlinerStage({ headliners, owned, level }: { headliners: SeasonReward[]; owned: boolean; level: number }) {
  if (headliners.length < 3) return null
  return (
    <div className="pass-stage" role="group" aria-label="Pass+ headliners">
      <span className="pass-stage__kick">The headliners</span>
      <ul className="pass-stage__row">
        {headliners.map((reward, i) => {
          const middle = i === 1
          const game = reward.game ? (getGame(reward.game)?.name ?? reward.game) : null
          const yours = owned && reward.level <= level
          return (
            <li key={reward.id} className={`pass-stage__spot${middle ? ' pass-stage__spot--star' : ''}`}>
              {middle ? <span className="pass-stage__only">Pass+ only</span> : null}
              <span className="pass-stage__art" aria-hidden="true">
                <RewardArt reward={reward} size={middle ? 230 : 160} />
              </span>
              <span className="pass-stage__stand" aria-hidden="true" />
              <b className="pass-stage__name">{reward.name}</b>
              <span className="pass-stage__what">
                {game ? `${game} ${reward.what.replace(/^.*\s/, '').toLowerCase()}` : reward.what} · {yours ? 'yours' : `Level ${reward.level}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Pass+: the paid second row of the pass, on the same levels, and the way to get it (Stripe's checkout, from
 * the API). Without it, its rewards show what they are, and the ones your level has reached say they're
 * yours the moment you get it. Looks only, never score; what it gives is kept for good.
 */
function PassPlus({
  season,
  plus,
  level,
  toNext,
  signedIn,
  authLoading,
  onPlus,
  actionFor,
  sought,
}: {
  season: SeasonInfo
  plus: SeasonPlus
  level: number
  toNext: number | null
  signedIn: boolean
  authLoading: boolean
  /** On Plus without Pass+ yet: the free week, whose first payment brings it. */
  onPlus: boolean
  actionFor: (reward: SeasonReward) => ReactNode
  /** The skin the address asks for, when it's one of Pass+'s: its tile turned to and lit. */
  sought: string | null
}) {
  const trackRef = useRef<HTMLOListElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'plain' | 'bad'; text: string } | null>(null)
  const price = plusPrice(plus)
  const skins = plus.rewards.filter((r) => r.kind === 'skin')
  const skinGames = [...new Set(skins.map((r) => (r.game ? (getGame(r.game)?.name ?? r.game) : r.name)))]
  const looks = plus.rewards.length - skins.length
  const gameList = skinGames.length > 1 ? `${skinGames.slice(0, -1).join(', ')} and ${skinGames[skinGames.length - 1]}` : (skinGames[0] ?? '')
  const [plusInfo, setPlusInfo] = useState<PlusInfo | null>(null)
  useEffect(() => {
    if (plus.owned) return
    let live = true
    fetchPlus()
      .then((info) => {
        if (live) setPlusInfo(info)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [plus.owned])
  const firstBonus = plus.rewards.find((r) => r.level > season.levels)?.id
  const headliners = headlinersOf(season, plus)

  // A Pass+ skin the address asks for: the row turns to it.
  const rewardsKey = plus.rewards.length
  useEffect(() => {
    const track = trackRef.current
    const tile = sought ? document.getElementById(`skin-${sought}`) : null
    if (track && tile && track.contains(tile)) turnTo(track, tile)
  }, [sought, rewardsKey])

  // Back from Stripe's page: a paid checkout gives Pass+ now (its webhook may be a moment behind).
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const back = query.get('plus')
    if (!back) return
    const session = query.get('session')
    window.history.replaceState(window.history.state, '', window.location.pathname)
    if (back === 'cancelled') {
      setNote({ tone: 'plain', text: `No charge. Pass+ is here all season, whenever you want it.` })
      return
    }
    if (back !== 'done' || !session) return
    setNote({ tone: 'plain', text: 'Checking the payment…' })
    void confirmPlusCheckout(session)
      .then(async (paid) => {
        await refreshSeason({ force: true, signedIn: true, catchUp: true })
        setNote(
          paid
            ? { tone: 'good', text: 'Pass+ is yours. What your level has reached is in your hangar and your avatar’s Prizes now.' }
            : { tone: 'plain', text: 'The payment is still going through. Pass+ arrives as soon as it does.' },
        )
      })
      .catch(() => setNote({ tone: 'bad', text: 'Couldn’t check the payment just now. If it went through, Pass+ arrives shortly.' }))
  }, [])

  const buy = async () => {
    if (!signedIn) {
      openSiteMenu()
      return
    }
    setBusy(true)
    setNote(null)
    try {
      window.location.assign(await startPlusCheckout())
    } catch (err) {
      setBusy(false)
      setNote({ tone: 'bad', text: err instanceof Error ? err.message : 'Couldn’t open the payment page' })
    }
  }

  const stateOfPlus = (reward: SeasonReward): TileState =>
    plus.owned ? stateOf(reward, level) : signedIn && reward.level <= level ? 'waiting' : 'locked'

  return (
    <section className={`season-plus${plus.owned ? ' season-plus--owned' : ''}`} aria-labelledby="season-plus-title">
      <div className="season-plus__head">
        <div className="season-plus__words">
          <h2 id="season-plus-title">
            Pass+ <span className="season-plus__season">Season {season.id}</span>
          </h2>
          <p>
            {plus.rewards.length} more: {skins.length} skins, new ships and cars to play in for {gameList}, and {looks} looks for your card and
            name{plus.bonus ? `, with ${plus.bonus} bonus levels past ${season.levels} that only Pass+ climbs` : ''}. Yours to keep. Looks only,
            never score.
          </p>
        </div>
        <div className="season-plus__get">
          {plus.owned ? (
            <span className="season-plus__owned">
              <CheckBadge /> {plus.via === 'plus' ? 'Included with your Plus' : 'Yours this season'}
            </span>
          ) : onPlus ? (
            // Plus's free week gives nothing kept for good: Pass+ comes with its first payment.
            <span className="season-plus__soon">Yours with your first Plus payment, when the free week ends</span>
          ) : (
            <div className="season-plus__ways">
              {plus.buyable ? (
                <button type="button" className="season-plus__buy" onClick={() => void buy()} disabled={busy || authLoading}>
                  <b>{busy ? 'Opening…' : signedIn ? `Get Pass+ · ${price}` : `Sign in to get Pass+`}</b>
                  <small>Once, for the whole season ({seasonWeeks(season)} weeks). Yours to keep.</small>
                </button>
              ) : (
                <span className="season-plus__soon">On sale soon · {price} for the season</span>
              )}
              <a className="season-plus__member" href={plusHref()}>
                {freeWeekFor(plusInfo) && plusInfo ? (
                  <>
                    <b>Or try Plus free for a week</b>
                    <small>
                      Then {money(plusInfo.price, plusInfo.currency)}/month, with every season’s Pass+ and every past daily. Pass+ comes with
                      the first payment.
                    </small>
                  </>
                ) : (
                  <>
                    <b>Or join Plus{plusInfo ? ` · ${money(plusInfo.price, plusInfo.currency)}/month` : ''}</b>
                    <small>
                      {plusInfo ? `About ${perSeason(plusInfo.price, season, plusInfo.currency)} a season, with` : 'With'} every season’s Pass+, and
                      every past daily.
                    </small>
                  </>
                )}
              </a>
            </div>
          )}
          {!plus.owned && !onPlus && signedIn && level > 0 ? (
            <span className="season-plus__now">
              {plus.rewards.filter((r) => r.level <= level).length
                ? `${plus.rewards.filter((r) => r.level <= level).length} of them yours at once`
                : 'The first comes at once'}
            </span>
          ) : null}
        </div>
      </div>
      <HeadlinerStage headliners={headliners} owned={plus.owned} level={level} />
      <ol className="season-track season-track--plus" ref={trackRef}>
        {plus.rewards.map((reward) => {
          const state = stateOfPlus(reward)
          return (
            <Fragment key={reward.id}>
              {reward.id === firstBonus ? (
                <li className="season-track__bonus" aria-label={`Bonus levels, ${season.levels + 1} on: Pass+ only`}>
                  <span>Bonus levels</span>
                </li>
              ) : null}
              <Tile
                reward={reward}
                state={state}
                perLevel={season.perLevel}
                toNext={toNext}
                action={plus.owned ? actionFor(reward) : null}
                sought={reward.id === sought}
              />
            </Fragment>
          )
        })}
      </ol>
      {note ? (
        <p className={`season-plus__note season-plus__note--${note.tone}`} role="status">
          {note.text}
        </p>
      ) : null}
    </section>
  )
}

/**
 * The season's standings, listed as the Standings page lists them (its Season tab): find a player, your own
 * row, Show more, and the lines under the places that win. Everyone's, whatever group the header has on: the
 * season's cup is everyone's.
 */
function SeasonStandingsCard({ season }: { season: SeasonInfo }) {
  const you = normalizePlayerName(usePlayerName())
  const data = useSeasonStandings(you, null)
  return (
    <div className="season-standings-list sb-scope">
      <StandingsList
        feed={seasonFeed(data)}
        you={you}
        title="Season standings"
        sub="Points from your ten best games, this season only"
        how={rankHowHref(undefined, 'season')}
        lines={seasonLines(data)}
        foot={
          season.status === 'over'
            ? `${season.name} is over: its cups and trophies are on their shelves.`
            : `When the season ends, the top ${data.prizes?.cupPlaces ?? 3} take the Season ${season.id} cup and the top ${data.prizes?.trophyPlaces ?? 10} a trophy.`
        }
      />
    </div>
  )
}

function GoalsCard({ goals }: { goals: SeasonGoal[] }) {
  return (
    <section className="season-card" aria-labelledby="season-goals-title">
      <h2 id="season-goals-title">Season goals</h2>
      <p className="season-card__sub">Extra, on top of the pass</p>
      <ul className="season-goals">
        {goals.map((goal) => (
          <li key={goal.id} className={goal.done ? 'season-goal season-goal--done' : 'season-goal'}>
            <span className="season-goal__top">
              <b>{goal.title}</b>
              <span>{goal.done ? 'Done' : `${goal.have} of ${goal.need}`}</span>
            </span>
            <span className="season-goal__meter" aria-hidden="true">
              <i style={{ width: `${Math.round((100 * goal.have) / goal.need)}%` }} />
            </span>
            <span className="season-goal__reward">{goal.done ? `${goal.reward.name} · yours` : goal.reward.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One skin on the skins card: its picture, name, game and level, the whole of it a way into its game. */
function SkinChip({ skin, yours, plus }: { skin: SeasonReward; yours: boolean; plus?: boolean }) {
  const game = skin.game ? getGame(skin.game) : null
  const inner = (
    <>
      <span className="season-skinchip__art" aria-hidden="true">
        <RewardArt reward={skin} size={44} />
      </span>
      <span className="season-skinchip__words">
        <b>{skin.name}</b>
        <span>
          {game?.name ?? skin.what} · {yours ? 'yours' : `Lv ${skin.level}`}
        </span>
      </span>
    </>
  )
  return (
    <li className={`season-skinchip${plus ? ' season-skinchip--plus' : ''}${yours ? ' season-skinchip--yours' : ''}`}>
      {game ? (
        <a className="season-skinchip__in" href={gameHref(game.slug)} aria-label={`${skin.name}, ${game.name}: play ${game.name}`}>
          {inner}
        </a>
      ) : (
        <span className="season-skinchip__in">{inner}</span>
      )}
    </li>
  )
}

/**
 * Every skin this season in one card, the free pass's and then Pass+'s, each a small chip that opens its game.
 * Ramsey picked B from the "Season skins card" canvas (2026-10-08): the card had only the free pass's skins, in
 * tall tiles three rows deep beside a short card, and none of Pass+'s.
 */
function SkinsCard({ free, plus, level, owned, plusOwned }: { free: SeasonReward[]; plus: SeasonReward[]; level: number; owned: string[]; plusOwned: boolean }) {
  const toPlus = () => document.querySelector('.season-plus')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <section className="season-card season-card--wide season-skincard" aria-labelledby="season-skins-title">
      <div className="season-skincard__head">
        <h2 id="season-skins-title">Skins this season</h2>
        <p className="season-card__sub">
          {free.length + plus.length} in all · looks only: same speed, same size
        </p>
      </div>
      {free.length ? (
        <>
          <h3 className="season-skincard__group">Free pass · {free.length}</h3>
          <ul className="season-skinchips">
            {free.map((skin) => (
              <SkinChip key={skin.id} skin={skin} yours={level >= skin.level || owned.includes(skin.id)} />
            ))}
          </ul>
        </>
      ) : null}
      {plus.length ? (
        <>
          <div className="season-skincard__grouprow">
            <h3 className="season-skincard__group season-skincard__group--plus">Pass+ · {plus.length}</h3>
            <button type="button" className="season-skincard__see" onClick={toPlus}>
              See Pass+
              <Chevron />
            </button>
          </div>
          <ul className="season-skinchips">
            {plus.map((skin) => (
              <SkinChip key={skin.id} skin={skin} plus yours={owned.includes(skin.id) || (plusOwned && level >= skin.level)} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

export function SeasonPage() {
  const store = useSeason()
  const { owned } = useTickets()
  const { signedIn, isPlus, loading: authLoading } = useAuth()
  const avatar = useOwnAvatar()
  const trackRef = useRef<HTMLOListElement>(null)
  const [sought] = useState(soughtSkin)
  const season = store.season
  const top = seasonTop(store)
  const p = season ? seasonProgress(season, season.status === 'live' ? store.you : null, top || undefined) : null
  const level = p?.level ?? 0
  const slug = season?.slug ?? null

  // The page is in its season's look and lettering whichever season it shows (season.css .season-<slug>).
  useEffect(() => {
    askForSeasonFont(slug)
  }, [slug])

  // The page asks for any reward a later release brought up to your level, and reads the pass fresh.
  useEffect(() => {
    if (authLoading) return
    void refreshSeason({ signedIn, catchUp: signedIn })
  }, [signedIn, authLoading])

  // The row starts at your next level, a couple of won ones showing to its left; or at the skin the address asks for.
  const rewardsKey = store.rewards.length
  useEffect(() => {
    const track = trackRef.current
    if (!track || !rewardsKey) return
    const skin = sought ? document.getElementById(`skin-${sought}`) : null
    if (skin && track.contains(skin)) {
      turnTo(track, skin)
      return
    }
    const target = track.querySelector<HTMLElement>(`[data-level="${Math.max(1, level - 1)}"]`)
    if (target) track.scrollLeft = target.offsetLeft - track.offsetLeft - 8
  }, [level, rewardsKey, sought])

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
  const plusSkins = store.plus?.rewards.filter((r) => r.kind === 'skin') ?? []
  const spotlight = season.spotlight.map((slug) => getGame(slug)).filter((g): g is NonNullable<typeof g> => g != null)

  // What a won level's tile lets you do with it: put a look on (in the studio), or play a game in its skin.
  const actionFor = (reward: SeasonReward): ReactNode => {
    if (!signedIn || reward.level > level || !reward.ready) return null
    if (reward.kind === 'skin') return reward.game && owned.includes(reward.id) ? <UseSkin game={reward.game} id={reward.id} /> : null
    if (!avatar || !AVATARS_ENABLED) return null
    if (reward.kind === 'pin') return isPin(reward.id) ? <WearLook reward={reward} avatar={avatar} /> : null
    if (reward.kind === 'prize') return owned.includes(reward.id) ? <WearLook reward={reward} avatar={avatar} /> : null
    return null
  }

  return (
    <PageShell innerClassName={`lb-page__inner season-page season-${season.slug}`}>
      <Hero season={season} level={level} top={top || season.levels} fraction={p.fraction} toNext={p.toNext} earned={p.earned} signedIn={signedIn} authLoading={authLoading} />

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
            <Tile
              key={`${reward.level}-${reward.id}`}
              reward={reward}
              state={stateOf(reward, level)}
              perLevel={season.perLevel}
              toNext={p.toNext}
              action={actionFor(reward)}
              sought={reward.id === sought}
            />
          ))}
        </ol>
        <div className="season-rail" aria-hidden="true">
          <div className="season-rail__bar">
            {Array.from({ length: season.levels }, (_, i) => {
              const n = i + 1
              const style =
                n === level + 1 && level > 0
                  ? ({ background: `linear-gradient(90deg, var(--space-orange) ${Math.round(p.fraction * 100)}%, var(--season-rail-off) 0)` } as CSSProperties)
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

      {store.plus ? (
        <PassPlus
          season={season}
          plus={store.plus}
          level={level}
          toNext={p.toNext}
          signedIn={signedIn}
          authLoading={authLoading}
          onPlus={isPlus}
          actionFor={actionFor}
          sought={sought}
        />
      ) : null}

      <div className="season-cards">
        {season.status !== 'upcoming' ? <SeasonStandingsCard season={season} /> : null}
        {store.goals?.length ? <GoalsCard goals={store.goals} /> : null}
        <section className={`season-card${store.goals?.length ? '' : ' season-card--wide'}`} aria-labelledby="season-how-title">
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
        {skins.length || plusSkins.length ? (
          <SkinsCard free={skins} plus={plusSkins} level={level} owned={owned} plusOwned={Boolean(store.plus?.owned)} />
        ) : null}
      </div>
    </PageShell>
  )
}
