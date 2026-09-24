import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { EventArtBox } from '../components/EventsHome'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { navigate, tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { PlanLimitNotice, PlusBadge } from '../components/PlusBadge'
import { isPlanLimitError } from '../lib/plans'
import {
  BRACKET_PLAYERS_MAX,
  BRACKET_PLAYERS_MIN,
  bracketDrawSize,
  bracketRoundCount,
  bracketRoundLabel,
  createTournament,
  DOUBLE_ELIM_SIZES,
  EVENT_GAMES,
  rememberTournamentInvite,
  snapToDoubleElimSize,
  type CreateTournamentInput,
  type Elimination,
  type EventGame,
  type TournamentKind,
} from '../lib/tournaments'
import { resolveGameAccent } from '../lib/theme'
import { inkOn } from '../lib/color'
import { fetchGroupDetail, type GroupPublic } from '../lib/groups'
import { sendInvite } from '../lib/invites'
import { getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { openSiteMenu } from '../components/siteNav'
import '../styles/evp.css'

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 0, label: 'Until everyone finishes' },
] as const

/** Bracket: finite time to play each open match (no overall tournament clock). */
const ROUND_DURATIONS = DURATIONS.filter((d) => d.hours > 0)

function attemptsSummary(maxAttempts: number, unlimited: boolean, gameCount: number) {
  const gameWord = gameCount === 1 ? 'game' : 'games'
  if (unlimited) return `Unlimited attempts per ${gameWord}`
  if (maxAttempts === 1) return `1 attempt per ${gameWord}`
  return `${maxAttempts} attempts per ${gameWord}`
}

function playersSummary(maxPlayers: number, unlimited: boolean) {
  if (unlimited) return 'Unlimited players'
  return `${maxPlayers} player${maxPlayers === 1 ? '' : 's'} max`
}

function clampBracketPlayers(n: number): number {
  if (!Number.isFinite(n)) return BRACKET_PLAYERS_MIN
  return Math.min(BRACKET_PLAYERS_MAX, Math.max(BRACKET_PLAYERS_MIN, Math.floor(n)))
}

/**
 * A number stepper with "Unlimited" built into the same control instead of a
 * detached checkbox. Nudging the stepper while unlimited is on turns it off,
 * so the two halves read as one setting.
 */
function LimitField({
  label,
  value,
  min,
  max,
  unlimited,
  onValue,
  onUnlimited,
  hint,
  hideLabel = false,
}: {
  label: string
  value: number
  min: number
  max: number
  /** Omit to hide the Unlimited half entirely (brackets need a fixed size). */
  unlimited?: boolean
  onValue: Dispatch<SetStateAction<number>>
  onUnlimited?: (next: boolean) => void
  hint: string
  /** When the step's own title already says it. */
  hideLabel?: boolean
}) {
  const canBeUnlimited = typeof unlimited === 'boolean' && Boolean(onUnlimited)
  const isUnlimited = canBeUnlimited && unlimited === true
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.floor(n)))

  // Functional update so a burst of clicks accumulates instead of each one
  // recomputing from the same rendered value.
  const step = (delta: number) => {
    if (isUnlimited) {
      onUnlimited?.(false)
      onValue((prev) => clamp(prev))
      return
    }
    onValue((prev) => clamp(prev + delta))
  }

  return (
    <div className="ev-limit">
      <span className={hideLabel ? 'visually-hidden' : 'ev-limit__label'} id={`limit-${label}`}>
        {label}
      </span>
      <div
        className={`ev-limit__control${isUnlimited ? ' ev-limit__control--off' : ''}`}
        role="group"
        aria-labelledby={`limit-${label}`}
      >
        <div className="ev-limit__stepper">
          <button
            type="button"
            className="ev-limit__btn"
            aria-label={`Fewer ${label.toLowerCase()}`}
            disabled={!isUnlimited && value <= min}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            className="ev-limit__value"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={isUnlimited ? '' : value}
            placeholder={isUnlimited ? '∞' : undefined}
            aria-label={label}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (!e.target.value.trim() || !Number.isFinite(next)) return
              if (isUnlimited) onUnlimited?.(false)
              onValue(clamp(next))
            }}
          />
          <button
            type="button"
            className="ev-limit__btn"
            aria-label={`More ${label.toLowerCase()}`}
            disabled={!isUnlimited && value >= max}
            onClick={() => step(1)}
          >
            +
          </button>
        </div>
        {canBeUnlimited ? (
          <button
            type="button"
            className={`ev-limit__any${isUnlimited ? ' ev-limit__any--on' : ''}`}
            aria-pressed={isUnlimited}
            onClick={() => onUnlimited?.(!isUnlimited)}
          >
            Unlimited
          </button>
        ) : null}
      </div>
      <p className="ev-field__hint">{hint}</p>
    </div>
  )
}

export function CreateTournamentPage() {
  const { account, limits, loading: authLoading } = useAuth()
  const [kind, setKind] = useState<TournamentKind>('scores')
  const [title, setTitle] = useState('')
  const [games, setGames] = useState<EventGame[]>(['stacker'])
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [unlimitedAttempts, setUnlimitedAttempts] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [unlimitedPlayers, setUnlimitedPlayers] = useState(false)
  /** Made from a group's page: its members are invited once the event exists. */
  const groupId = useMemo(() => new URLSearchParams(window.location.search).get('group'), [])
  const [forGroup, setForGroup] = useState<GroupPublic | null>(null)
  const [inviting, setInviting] = useState(false)
  const [durationHours, setDurationHours] = useState(24)
  const [roundPlayHours, setRoundPlayHours] = useState(24)
  const [elimination, setElimination] = useState<Elimination>('single')
  /**
   * One game per winners round, round 1 first. Seeded from the single game
   * picker, so a host who never touches it gets the same game all the way
   * through — which is what every bracket did before this existed.
   */
  const [roundGames, setRoundGames] = useState<EventGame[][]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planError, setPlanError] = useState<unknown>(null)
  const isBracket = kind === 'bracket'
  const isDouble = isBracket && elimination === 'double'
  const bracketByes = isBracket && !isDouble ? bracketDrawSize(maxPlayers) - maxPlayers : 0
  const rounds = isBracket ? bracketRoundCount(maxPlayers) : 0
  /** Rounds differ from one another, or some round stacks more than one game. */
  const planDiverged =
    new Set(roundGames.map((r) => r.join('+'))).size > 1 ||
    roundGames.some((r) => r.length > 1)

  /*
   * The round count follows the roster size, so the plan is resized whenever
   * that changes: new rounds inherit the game before them, extra rounds fall
   * away. Growing a draw from four to eight should not silently reset a plan
   * the host already made.
   */
  useEffect(() => {
    if (!isBracket) {
      setRoundGames((prev) => (prev.length ? [] : prev))
      return
    }
    setRoundGames((prev) => {
      const base: EventGame[] = [games[0] ?? 'stacker']
      const next = Array.from({ length: rounds }, (_, i) => prev[i] ?? prev[i - 1] ?? base)
      const same =
        next.length === prev.length &&
        next.every((round, i) => round.join() === prev[i]?.join())
      return same ? prev : next
    })
  }, [isBracket, rounds, games])

  /*
   * Players gets its own card ahead of Games for a bracket: the roster size is
   * what decides how many rounds there are, and so how many games the host is
   * about to be asked for. Picking games first and watching the list resize
   * underneath is the wrong way round.
   */
  const playersField = <>{isDouble ? (
                <div className="ev-limit">
                  <span className="ev-limit__label" id="limit-players">
                    Players
                  </span>
                  <div
                    className="ev-sizes"
                    role="radiogroup"
                    aria-labelledby="limit-players"
                  >
                    {DOUBLE_ELIM_SIZES.map((size) => {
                      const locked = size > limits.maxDraw
                      return (
                        <button
                          key={size}
                          type="button"
                          role="radio"
                          aria-checked={maxPlayers === size}
                          disabled={locked}
                          title={locked ? `Draws over ${limits.maxDraw} are a Plus feature` : undefined}
                          className={`ev-size${maxPlayers === size ? ' ev-size--on' : ''}${
                            locked ? ' ev-size--locked' : ''
                          }`}
                          onClick={() => setMaxPlayers(size)}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                  <p className="ev-field__hint">
                    Double elimination needs a full draw, so the field is a power of two.
                    Draws when the last seat fills.
                  </p>
                </div>
              ) : (
                <LimitField
                  label="Players"
                  hideLabel={isBracket}
                  value={maxPlayers}
                  min={isBracket ? BRACKET_PLAYERS_MIN : 2}
                  max={Math.min(limits.maxDraw, isBracket ? BRACKET_PLAYERS_MAX : 99)}
                  unlimited={isBracket ? undefined : unlimitedPlayers}
                  onValue={setMaxPlayers}
                  onUnlimited={isBracket ? undefined : setUnlimitedPlayers}
                  hint={
                    isBracket
                      ? `Draws when the last seat fills.${
                          bracketByes > 0
                            ? ` ${bracketByes} player${bracketByes === 1 ? '' : 's'} get a bye.`
                            : ''
                        }`
                      : `${playersSummary(maxPlayers, unlimitedPlayers)}.`
                  }
                />
              )}</>

  const waitingForAuth = authLoading && !account

  const accent = useMemo(() => {
    const slug = games[0] ?? ''
    const first = getGame(slug)
    return resolveGameAccent(slug, first?.accent ?? '#2eb8a0')
  }, [games])

  const selectKind = (next: TournamentKind) => {
    setKind(next)
    if (next === 'bracket') {
      setUnlimitedPlayers(false)
      setUnlimitedAttempts(false)
      setMaxPlayers((n) =>
        elimination === 'double' ? snapToDoubleElimSize(n) : clampBracketPlayers(n),
      )
      setMaxAttempts((n) => Math.max(1, n))
      setGames((prev) => prev.slice(0, 1))
      if (roundPlayHours <= 0) setRoundPlayHours(24)
    }
  }

  const selectElimination = (next: Elimination) => {
    setElimination(next)
    // Double elim can't carry byes, so the field has to be a power of two.
    if (next === 'double') setMaxPlayers((n) => snapToDoubleElimSize(n))
  }

  const toggleGame = (slug: EventGame) => {
    setGames((prev) => {
      if (isBracket) return [slug]
      if (prev.includes(slug)) {
        if (prev.length === 1) return prev
        return prev.filter((g) => g !== slug)
      }
      if (prev.length >= 5) return prev
      return [...prev, slug]
    })
  }

  useEffect(() => {
    if (!groupId || !account) return
    let cancelled = false
    fetchGroupDetail(groupId)
      .then((g) => {
        if (cancelled || !(g.isMember || g.isOwner)) return
        setForGroup(g)
        // Room for the whole group, as far as the plan allows: an event can't be unlimited.
        setUnlimitedPlayers(false)
        setMaxPlayers(Math.max(2, Math.min(g.memberCount, limits.maxDraw)))
      })
      .catch(() => {
        /* Not a group we can see: the page is the plain one. */
      })
    return () => {
      cancelled = true
    }
  }, [groupId, account, limits.maxDraw])

  /** Every member but you gets the invite; a tag nobody claimed can't be invited, and is counted. */
  const inviteGroup = async (eventId: string, group: GroupPublic) => {
    const me = normalizePlayerName(getLastPlayerName())
    let missed = 0
    for (const m of group.members) {
      if (normalizePlayerName(m.name) === me) continue
      try {
        await sendInvite({ kind: 'tournament', targetId: eventId, toName: m.name })
      } catch {
        missed += 1
      }
    }
    return missed
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !account || games.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const input: CreateTournamentInput = {
        title: title.trim(),
        games: isBracket && roundGames.length ? [...new Set(roundGames.flat())] : games,
        ...(isBracket && roundGames.length ? { roundGames } : {}),
        maxAttempts: isBracket || !unlimitedAttempts ? Math.max(1, maxAttempts) : 0,
        maxPlayers: isBracket || !unlimitedPlayers ? maxPlayers : 0,
        durationHours: isBracket ? 0 : durationHours,
        ...(isBracket ? { roundPlayHours, elimination } : {}),
        kind,
      }
      const created = await createTournament(input)
      if (created.inviteCode) rememberTournamentInvite(created.id, created.inviteCode)
      if (forGroup) {
        setInviting(true)
        await inviteGroup(created.id, forGroup)
      }
      navigate(tournamentHref(created.id, created.inviteCode ?? undefined))
    } catch (err) {
      // A plan refusal gets its own notice; everything else is a plain error.
      if (isPlanLimitError(err)) {
        setPlanError(err)
        setError(null)
      } else {
        setPlanError(null)
        setError(err instanceof Error ? err.message : 'Could not create event')
      }
      setBusy(false)
    }
  }

  // The form's steps, numbered in the order they show: a bracket asks for its players before its games.
  const stepNo = (() => {
    let n = 0
    return () => ++n
  })()
  const gameNames = (isBracket && roundGames.length ? [...new Set(roundGames.flat())] : games).map(
    (slug) => getGame(slug)?.name ?? slug,
  )
  const durationLabel = DURATIONS.find((d) => d.hours === durationHours)?.label ?? ''
  const roundLabel = ROUND_DURATIONS.find((d) => d.hours === roundPlayHours)?.label ?? ''
  const previewMeta = isBracket
    ? [
        `${maxPlayers} players · ${rounds} ${rounds === 1 ? 'round' : 'rounds'}`,
        `${roundLabel} a round`,
        isDouble ? 'Double elimination' : null,
      ]
    : [
        durationHours === 0 ? 'Until everyone finishes' : `Ends in ${durationLabel}`,
        unlimitedAttempts ? 'Unlimited tries' : `${maxAttempts} ${maxAttempts === 1 ? 'try' : 'tries'} a game`,
        unlimitedPlayers ? 'Any number of players' : `0 of ${maxPlayers} in`,
      ]

  const step = (title: string, body: ReactNode, note?: ReactNode) => (
    <section className="evp-card evp-step" aria-label={title}>
      <div className="evp-step__head">
        <h2 className="evp-step__title">
          <span className="evp-step__n" aria-hidden="true">
            {stepNo()}
          </span>
          {title}
        </h2>
        {note ? <span className="evp-step__note">{note}</span> : null}
      </div>
      {body}
    </section>
  )

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {/* The form takes the colour of the games picked; the sign-in gate, with nothing picked yet, keeps the site's. */}
      <div className="evp evp--create" style={account ? ({ '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties) : undefined}>
        <header className="evp-create__head">
          <nav className="evp-crumbs" aria-label="Breadcrumb">
            <a href={tournamentsHref()}>Events</a>
            <span aria-hidden="true">›</span>
            <span aria-current="page">Make one</span>
          </nav>
          <h1 className="evp-create__title">{forGroup ? `Make an event for ${forGroup.name}` : 'Make an event'}</h1>
          <p className="evp-create__lede">
            {forGroup
              ? `Pick the games and the rules. Once it’s made, the other ${forGroup.memberCount - 1} in ${forGroup.name} get the invite${
                  forGroup.memberCount > limits.maxDraw
                    ? `, and the first ${limits.maxDraw} to join are in: that’s as many as an event holds on your plan`
                    : ''
                }.`
              : 'Pick the games and the rules, then invite your people.'}
          </p>
        </header>

        {waitingForAuth ? (
          <div className="evp-loading" aria-busy="true">
            <span className="evp-loading__hero" />
          </div>
        ) : !account ? (
          <section className="evp-card evp-create__gate" aria-labelledby="evp-gate-title">
            <h2 id="evp-gate-title" className="evp-card__title">
              Sign in to run your own
            </h2>
            <p className="evp-card__copy">
              Events you make are invite-only: top scores or a bracket, on the games you pick, for the people you invite by
              tag. Signing in gives you a tag and keeps your events on every device.
            </p>
            <div className="evp-acts">
              <button type="button" className="evp-btn" onClick={openSiteMenu}>
                Sign in
              </button>
              <a className="evp-btn evp-btn--ghost" href={tournamentsHref()}>
                Back to events
              </a>
            </div>
          </section>
        ) : (
          <form className="ev ev-form evp-create" onSubmit={(e) => void onSubmit(e)}>
            <div className="evp-create__steps">
              {step(
                'What kind of event?',
                <>
                  <div className="ev-choice" role="radiogroup" aria-label="Event format">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={kind === 'scores'}
                      className={`ev-choice__opt${kind === 'scores' ? ' ev-choice__opt--on' : ''}`}
                      onClick={() => selectKind('scores')}
                    >
                      <span className="ev-choice__name">Top scores</span>
                      <span className="ev-choice__desc">
                        Everyone posts runs. With more than one game, places pay points across them.
                      </span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={kind === 'bracket'}
                      className={`ev-choice__opt${kind === 'bracket' ? ' ev-choice__opt--on' : ''}`}
                      onClick={() => selectKind('bracket')}
                    >
                      <span className="ev-choice__name">Bracket</span>
                      <span className="ev-choice__desc">
                        Head to head, a round at a time. The higher score takes each match.
                      </span>
                    </button>
                  </div>

                  {isBracket ? (
                    <div className="ev-choice ev-choice--sub" role="radiogroup" aria-label="Elimination">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={elimination === 'single'}
                        className={`ev-choice__opt${elimination === 'single' ? ' ev-choice__opt--on' : ''}`}
                        onClick={() => selectElimination('single')}
                      >
                        <span className="ev-choice__name">Single elimination</span>
                        <span className="ev-choice__desc">One loss and you&apos;re out.</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={elimination === 'double'}
                        disabled={!limits.doubleElimination}
                        className={`ev-choice__opt${elimination === 'double' ? ' ev-choice__opt--on' : ''}${
                          limits.doubleElimination ? '' : ' ev-choice__opt--locked'
                        }`}
                        onClick={() => selectElimination('double')}
                      >
                        <span className="ev-choice__name">
                          Double elimination
                          {limits.doubleElimination ? null : <PlusBadge />}
                        </span>
                        <span className="ev-choice__desc">A loss drops you to the losers bracket.</span>
                      </button>
                    </div>
                  ) : null}
                </>,
              )}

              {isBracket
                ? step('Players', <div className="ev-rules">{playersField}</div>, `${rounds} round${rounds === 1 ? '' : 's'}`)
                : null}

              {step(
                'Which games?',
                <>
                  {/*
                    * A bracket picks a game per round rather than one for the draw.
                    * Leaving every row on the same game is the old behaviour, so
                    * "same game the whole way" needs no separate mode — it is just
                    * the plan you get if you change nothing.
                    */}
                  {isBracket ? (
                    <>
                      {planDiverged ? (
                        <button
                          type="button"
                          className="ev-rounds__same"
                          onClick={() =>
                            setRoundGames((prev) =>
                              prev.length ? prev.map(() => [...(prev[0] as EventGame[])]) : prev,
                            )
                          }
                        >
                          Use round 1’s games for every round
                        </button>
                      ) : null}
                      {limits.multiGameRounds ? null : (
                        <p className="ev-field__hint ev-rounds__locked">
                          Every round plays the same game.
                          <PlusBadge /> a different game each round.
                        </p>
                      )}
                      <ol className="ev-rounds">
                        {roundGames.map((round, i) => {
                          const spare = EVENT_GAMES.filter((g) => !round.includes(g))
                          return (
                            <li className="ev-round" key={i}>
                              <span className="ev-round__name">{bracketRoundLabel(i + 1, rounds)}</span>
                              <span className="ev-round__picks">
                                {round.map((slug) => {
                                  const g = getGame(slug)
                                  const chipAccent = resolveGameAccent(slug, g?.accent ?? accent)
                                  return (
                                    <span
                                      key={slug}
                                      className="ev-pick"
                                      style={{ '--game-accent': chipAccent } as CSSProperties}
                                    >
                                      <GameThumbArt slug={slug} accent={chipAccent} />
                                      <span className="ev-pick__name">{g?.name ?? slug}</span>
                                      {round.length > 1 ? (
                                        <button
                                          type="button"
                                          className="ev-pick__drop"
                                          aria-label={`Remove ${g?.name ?? slug} from ${bracketRoundLabel(i + 1, rounds)}`}
                                          onClick={() =>
                                            setRoundGames((prev) =>
                                              prev.map((cur, idx) => (idx === i ? cur.filter((x) => x !== slug) : cur)),
                                            )
                                          }
                                        >
                                          ×
                                        </button>
                                      ) : null}
                                    </span>
                                  )
                                })}
                                {limits.multiGameRounds && spare.length ? (
                                  <label className="ev-round__add">
                                    <span className="visually-hidden">
                                      Add a game to {bracketRoundLabel(i + 1, rounds)}
                                    </span>
                                    <select
                                      className="ev-round__select"
                                      value=""
                                      onChange={(e) => {
                                        const next = e.target.value as EventGame
                                        if (!next) return
                                        setRoundGames((prev) =>
                                          prev.map((cur, idx) => (idx === i && !cur.includes(next) ? [...cur, next] : cur)),
                                        )
                                      }}
                                    >
                                      <option value="">+ Add</option>
                                      {spare.map((option) => (
                                        <option key={option} value={option}>
                                          {getGame(option)?.name ?? option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </>
                  ) : (
                    <div className="ev-games">
                      {EVENT_GAMES.map((slug) => {
                        const g = getGame(slug)
                        const gameAccent = resolveGameAccent(slug, g?.accent ?? accent)
                        const picked = games.includes(slug)
                        const atCap = !isBracket && games.length >= 5 && !picked
                        return (
                          <button
                            key={slug}
                            type="button"
                            className={`ev-game${picked ? ' ev-game--on' : ''}`}
                            style={{ '--game-accent': gameAccent } as CSSProperties}
                            aria-pressed={picked}
                            disabled={atCap}
                            onClick={() => toggleGame(slug)}
                          >
                            <GameThumbArt slug={slug} accent={gameAccent} />
                            <span className="ev-game__name">{g?.name ?? slug}</span>
                            {picked ? (
                              <span className="ev-game__check" aria-hidden="true">
                                ✓
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <p className="ev-field__hint">
                    {isBracket
                      ? planDiverged
                        ? 'Each round is played on its own games. A round with more than one is a series: win the most of them to take the match. In a double-elim draw the losers round matches the winners round of the same number.'
                        : 'Every match is played on this game. Change a round, or add a second, to mix it up.'
                      : games.length > 1
                        ? 'Places on each game pay points, and the highest total wins.'
                        : 'Pick more than one and places on each pay points across them all.'}
                  </p>
                </>,
                isBracket ? `${rounds} round${rounds === 1 ? '' : 's'}` : `${games.length} picked · up to 5`,
              )}

              {step(
                'The rules',
                <div className="ev-rules evp-create__rules">
                  {isBracket ? null : playersField}
                  <LimitField
                    label={isBracket ? 'Tries in each match' : 'Tries on each game'}
                    value={maxAttempts}
                    min={1}
                    max={99}
                    unlimited={isBracket ? undefined : unlimitedAttempts}
                    onValue={setMaxAttempts}
                    onUnlimited={isBracket ? undefined : setUnlimitedAttempts}
                    hint={
                      isBracket
                        ? 'Fresh tries each round. The higher score takes the match.'
                        : `${attemptsSummary(maxAttempts, unlimitedAttempts, games.length)}. The best one counts.`
                    }
                  />
                </div>,
              )}

              {step(
                isBracket ? 'How long is a round?' : 'How long?',
                <>
                  <div className="evp-create__durations" role="radiogroup" aria-label={isBracket ? 'Time per round' : 'Duration'}>
                    {(isBracket ? ROUND_DURATIONS : DURATIONS).map((d) => {
                      const on = (isBracket ? roundPlayHours : durationHours) === d.hours
                      return (
                        <button
                          key={d.hours}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          className={`evp-choice${on ? ' evp-choice--on' : ''}`}
                          onClick={() => (isBracket ? setRoundPlayHours(d.hours) : setDurationHours(d.hours))}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="ev-field__hint">
                    {isBracket
                      ? 'A match’s clock starts once both players are seated, and the event ends when the final has a winner.'
                      : durationHours === 0
                        ? `It ends when every player has used all their tries.${
                            unlimitedAttempts ? ' Pick a number of tries for this one.' : ''
                          }`
                        : `It starts as soon as you make it, and ends ${durationLabel.toLowerCase()} later.`}
                  </p>
                </>,
              )}

              {step(
                'Name it',
                <>
                  <label className="ev-field">
                    <span className="evp-cap">Event name</span>
                    <input
                      className="ev-field__input"
                      value={title}
                      maxLength={60}
                      placeholder="Friday Night Arcade"
                      required
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <p className="ev-field__hint">Only the people you invite can see it or join.</p>
                </>,
              )}

              {error ? <p className="ev-note ev-note--error">{error}</p> : null}
              <PlanLimitNotice error={planError} />

              <button
                type="submit"
                className="evp-btn evp-btn--big evp-create__submit"
                disabled={busy || title.trim().length < 3 || games.length === 0}
              >
                {inviting && forGroup
                  ? `Inviting ${forGroup.name}…`
                  : busy
                    ? 'Creating…'
                    : `Create ${title.trim().length >= 3 ? title.trim() : 'the event'}`}
              </button>
            </div>

            <aside className="evp-create__aside" aria-label="Preview">
              <section className="evp-card evp-create__preview">
                <p className="evp-cap">How it will look</p>
                <div className="evp-create__card evp-wash">
                  <span className="evp-create__card-head">
                    <EventArtBox games={isBracket && roundGames.length ? [...new Set(roundGames.flat())] : games} size="3rem" />
                    <span className="evp-create__card-text">
                      <span className="evp-kick">
                        Invite only · {isBracket ? 'Bracket' : games.length > 1 ? 'Place points' : 'Top scores'}
                      </span>
                      <span className="evp-create__card-title">{title.trim() || 'Your event'}</span>
                    </span>
                  </span>
                  <span className="evp-card__copy">{gameNames.join(' · ')}</span>
                  <span className="evp-metas">
                    {previewMeta.filter(Boolean).map((m) => (
                      <span key={m} className="evp-meta">
                        {m}
                      </span>
                    ))}
                  </span>
                </div>
              </section>
              <section className="evp-card evp-create__next" aria-labelledby="evp-next-title">
                <h2 id="evp-next-title" className="evp-card__title">
                  What happens next
                </h2>
                <ol className="evp-steps">
                  <li>
                    <span className="evp-steps__n" aria-hidden="true">
                      1
                    </span>
                    <span>You get a link to share, and the event opens.</span>
                  </li>
                  <li>
                    <span className="evp-steps__n" aria-hidden="true">
                      2
                    </span>
                    <span>Invite friends by their tag. It shows up in their menu.</span>
                  </li>
                  <li>
                    <span className="evp-steps__n" aria-hidden="true">
                      3
                    </span>
                    <span>The winner takes a trophy for their player card.</span>
                  </li>
                </ol>
                <p className="evp-lesson">
                  {account.plan === 'plus'
                    ? `Plus runs up to ${limits.activeEvents} events at once, for up to ${limits.maxDraw} players.`
                    : `Free runs ${limits.activeEvents === 1 ? 'one event' : `${limits.activeEvents} events`} at a time, for up to ${limits.maxDraw} players. Plus runs more, bigger, and double elimination.`}
                </p>
              </section>
            </aside>
          </form>
        )}
      </div>
    </PageShell>
  )
}
