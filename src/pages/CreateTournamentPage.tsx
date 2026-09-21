import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBanner } from '../components/PageBanner'
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
      <span className="ev-limit__label" id={`limit-${label}`}>
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

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="page-stack">
        <PageBanner
          size="compact"
          crumbs={[{ href: tournamentsHref(), label: 'Events' }, { label: 'Create event' }]}
          kicker="Events"
          title="Create event"
          blurb="Pick the games, set the rules, and invite your people."
        />
      </div>

      {waitingForAuth ? (
        <p className="lb-empty">Loading…</p>
      ) : !account ? (
        <div className="event-create-gate">
          <p className="tour-note">Sign in to host a private invite-only event.</p>
          <a className="score-save__btn" href={tournamentsHref()}>
            Back to events
          </a>
        </div>
      ) : (
        <form
          className="ev ev-form"
          style={{ '--event-accent': accent } as CSSProperties}
          onSubmit={(e) => void onSubmit(e)}
        >
          <section className="ev-card">
            <div className="ev-card__head">
              <h2 className="ev-card__title">Format</h2>
            </div>
            <div className="ev-card__body">
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
                    Everyone posts scores. Best score wins.
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
                    Head to head. Higher score takes the match.
                  </span>
                </button>
              </div>

              {isBracket ? (
                <div
                  className="ev-choice ev-choice--sub"
                  role="radiogroup"
                  aria-label="Elimination"
                >
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
                    <span className="ev-choice__desc">
                      A loss drops you to the losers bracket.
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="ev-card">
            <div className="ev-card__head">
              <h2 className="ev-card__title">Name</h2>
            </div>
            <div className="ev-card__body">
              <label className="ev-field">
                <span className="visually-hidden">Event name</span>
                <input
                  className="ev-field__input"
                  value={title}
                  maxLength={60}
                  placeholder="Friday Night Arcade"
                  required
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <p className="ev-field__hint">
                Invite-only — it won&apos;t appear on the public events list.
              </p>
            </div>
          </section>

          {isBracket ? (
            <section className="ev-card">
              <div className="ev-card__head">
                <h2 className="ev-card__title">Players</h2>
                <p className="ev-card__note">
                  {rounds} round{rounds === 1 ? '' : 's'}
                </p>
              </div>
              <div className="ev-card__body ev-rules">{playersField}</div>
            </section>
          ) : null}

          <section className="ev-card">
            <div className="ev-card__head">
              <h2 className="ev-card__title">Games</h2>
              <p className="ev-card__note">
                {isBracket ? `${rounds} round${rounds === 1 ? '' : 's'}` : `${games.length} of 5`}
              </p>
            </div>
            <div className="ev-card__body">
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
                        <span className="ev-round__name">
                          {bracketRoundLabel(i + 1, rounds)}
                        </span>
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
                                        prev.map((cur, idx) =>
                                          idx === i ? cur.filter((x) => x !== slug) : cur,
                                        ),
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
                                    prev.map((cur, idx) =>
                                      idx === i && !cur.includes(next) ? [...cur, next] : cur,
                                    ),
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
                    ? 'Each round is played on its own games. A round with more than one is a series — win the most of them to take the match. In a double-elim draw the losers round matches the winners round of the same number.'
                    : 'Every match is played on this game — change a round, or add a second, to mix it up.'
                  : games.length > 1
                    ? 'Place points across games — highest total wins.'
                    : 'Pick more than one to score on place points across all of them.'}
              </p>
            </div>
          </section>

          <section className="ev-card">
            <div className="ev-card__head">
              <h2 className="ev-card__title">Rules</h2>
            </div>
            <div className="ev-card__body ev-rules">
              {isBracket ? null : playersField}

              <LimitField
                label={isBracket ? 'Attempts per match' : 'Attempts per game'}
                value={maxAttempts}
                min={1}
                max={99}
                unlimited={isBracket ? undefined : unlimitedAttempts}
                onValue={setMaxAttempts}
                onUnlimited={isBracket ? undefined : setUnlimitedAttempts}
                hint={
                  isBracket
                    ? 'Fresh tries each round.'
                    : `${attemptsSummary(maxAttempts, unlimitedAttempts, games.length)}. Best score counts.`
                }
              />

              <div className="ev-limit">
                <span className="ev-limit__label" id="limit-duration">
                  {isBracket ? 'Time per round' : 'Duration'}
                </span>
                <div className="ev-select">
                  <select
                    className="ev-field__input ev-field__input--select"
                    aria-labelledby="limit-duration"
                    value={isBracket ? roundPlayHours : durationHours}
                    onChange={(e) =>
                      isBracket
                        ? setRoundPlayHours(Number(e.target.value))
                        : setDurationHours(Number(e.target.value))
                    }
                  >
                    {(isBracket ? ROUND_DURATIONS : DURATIONS).map((d) => (
                      <option key={d.hours} value={d.hours}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="ev-field__hint">
                  {isBracket
                    ? 'Clock starts once both players are seated. The event ends when the final has a winner.'
                    : durationHours === 0
                      ? `Ends when every player has used all their attempts.${
                          unlimitedAttempts ? ' Pick a finite attempt limit for this mode.' : ''
                        }`
                      : 'The event ends when the clock runs out.'}
                </p>
              </div>
            </div>
          </section>

          {error ? <p className="ev-note ev-note--error">{error}</p> : null}
          <PlanLimitNotice error={planError} />

          <button
            type="submit"
            className="ev-join__btn"
            disabled={busy || title.trim().length < 3 || games.length === 0}
          >
            {busy ? 'Creating…' : 'Create event'}
          </button>
        </form>
      )}
    </PageShell>
  )
}
