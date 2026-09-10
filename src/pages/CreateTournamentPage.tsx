import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { EventThumbs } from '../components/EventCard'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { tournamentHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import {
  BRACKET_PLAYERS_MAX,
  BRACKET_PLAYERS_MIN,
  bracketDrawSize,
  createTournament,
  EVENT_GAMES,
  rememberTournamentInvite,
  type CreateTournamentInput,
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

export function CreateTournamentPage() {
  const { account, loading: authLoading } = useAuth()
  const [kind, setKind] = useState<TournamentKind>('scores')
  const [title, setTitle] = useState('')
  const [games, setGames] = useState<EventGame[]>(['stacker'])
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [unlimitedAttempts, setUnlimitedAttempts] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [unlimitedPlayers, setUnlimitedPlayers] = useState(false)
  const [durationHours, setDurationHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isBracket = kind === 'bracket'
  const bracketByes = isBracket ? bracketDrawSize(maxPlayers) - maxPlayers : 0

  const waitingForAuth = authLoading && !account

  const accent = useMemo(() => {
    const slug = games[0] ?? ''
    const first = getGame(slug)
    return resolveGameAccent(slug, first?.accent ?? '#2eb8a0')
  }, [games])

  const durationLabel =
    DURATIONS.find((d) => d.hours === durationHours)?.label ?? '24 hours'

  const selectKind = (next: TournamentKind) => {
    setKind(next)
    if (next === 'bracket') {
      setUnlimitedPlayers(false)
      setUnlimitedAttempts(false)
      setMaxPlayers((n) => clampBracketPlayers(n))
      setMaxAttempts((n) => Math.max(1, n))
      setGames((prev) => prev.slice(0, 1))
    }
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
        games,
        maxAttempts: isBracket || !unlimitedAttempts ? Math.max(1, maxAttempts) : 0,
        maxPlayers: isBracket || !unlimitedPlayers ? maxPlayers : 0,
        durationHours,
        kind,
      }
      const created = await createTournament(input)
      if (created.inviteCode) rememberTournamentInvite(created.id, created.inviteCode)
      window.location.hash = tournamentHref(created.id, created.inviteCode ?? undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event')
      setBusy(false)
    }
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <header className="lb-page__header lb-page__header--compact lb-game-board__head">
        <div className="lb-page__heading-row">
          <PageBackLink href="#/tournaments" label="Back to Events" />
          <h1 className="lb-page__title">Create event</h1>
          <span className="lb-page__heading-slot" aria-hidden="true" />
        </div>
      </header>

      {waitingForAuth ? (
        <p className="lb-empty">Loading…</p>
      ) : !account ? (
        <div className="event-create-gate">
          <p className="tour-note">Sign in to host a private invite-only event.</p>
          <a className="score-save__btn" href="#/tournaments">
            Back to events
          </a>
        </div>
      ) : (
        <div
          className="event-create-layout"
          style={{ '--event-accent': accent } as CSSProperties}
        >
          <form className="event-create" onSubmit={(e) => void onSubmit(e)}>
            <section className="event-create__card">
              <h2 className="event-create__section-title">Details</h2>
              <p className="event-create__hint">
                Private events are invite-only and won&apos;t appear on the public events list.
              </p>
              <div className="event-create__kind" role="group" aria-label="Event type">
                <button
                  type="button"
                  className={`event-create__kind-btn${kind === 'scores' ? ' event-create__kind-btn--active' : ''}`}
                  aria-pressed={kind === 'scores'}
                  onClick={() => selectKind('scores')}
                >
                  Top scores
                </button>
                <button
                  type="button"
                  className={`event-create__kind-btn${kind === 'bracket' ? ' event-create__kind-btn--active' : ''}`}
                  aria-pressed={kind === 'bracket'}
                  onClick={() => selectKind('bracket')}
                >
                  Bracket
                </button>
              </div>
              <p className="event-create__hint">
                {isBracket
                  ? 'Single elimination. Both players play the game — higher score wins the match.'
                  : 'Everyone posts scores. Best score (or place points) wins.'}
              </p>
              <label className="event-create__field">
                <span className="event-create__label">Title</span>
                <input
                  className="event-create__input"
                  value={title}
                  maxLength={60}
                  placeholder="Friday Night Arcade"
                  required
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <div className="event-create__rule">
                <div className="event-create__rule-head">
                  <span className="event-create__rule-title">Players</span>
                  {isBracket ? null : (
                    <label className="event-create__toggle">
                      <input
                        type="checkbox"
                        checked={unlimitedPlayers}
                        onChange={(e) => setUnlimitedPlayers(e.target.checked)}
                      />
                      <span>Unlimited</span>
                    </label>
                  )}
                </div>
                {isBracket || !unlimitedPlayers ? (
                  <div className="event-create__stepper" aria-label="Maximum players">
                    <button
                      type="button"
                      className="event-create__stepper-btn"
                      aria-label="Fewer players"
                      disabled={isBracket ? maxPlayers <= BRACKET_PLAYERS_MIN : maxPlayers <= 2}
                      onClick={() =>
                        setMaxPlayers((n) =>
                          isBracket ? clampBracketPlayers(n - 1) : Math.max(2, n - 1),
                        )
                      }
                    >
                      −
                    </button>
                    {isBracket ? (
                      <input
                        className="event-create__stepper-value event-create__stepper-input"
                        type="number"
                        min={BRACKET_PLAYERS_MIN}
                        max={BRACKET_PLAYERS_MAX}
                        value={maxPlayers}
                        aria-label="Maximum players"
                        onChange={(e) =>
                          setMaxPlayers(clampBracketPlayers(Number(e.target.value)))
                        }
                      />
                    ) : (
                      <span className="event-create__stepper-value">{maxPlayers}</span>
                    )}
                    <button
                      type="button"
                      className="event-create__stepper-btn"
                      aria-label="More players"
                      disabled={isBracket ? maxPlayers >= BRACKET_PLAYERS_MAX : maxPlayers >= 99}
                      onClick={() =>
                        setMaxPlayers((n) =>
                          isBracket ? clampBracketPlayers(n + 1) : Math.min(99, n + 1),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                ) : null}
                <p className="event-create__hint">
                  {isBracket
                    ? `${maxPlayers} players. The bracket draws when the last seat fills.${
                        bracketByes > 0
                          ? ` ${bracketByes} player${bracketByes === 1 ? '' : 's'} get a bye.`
                          : ''
                      }`
                    : `${playersSummary(maxPlayers, unlimitedPlayers)}.`}
                </p>
              </div>
            </section>

            <section className="event-create__card">
              <div className="event-create__section-head">
                <h2 className="event-create__section-title">Games</h2>
                <span className="event-create__count">
                  {isBracket ? '1 game' : `${games.length} / 5 selected`}
                </span>
              </div>
              <p className="event-create__hint">
                {isBracket
                  ? 'Pick the game every match uses.'
                  : games.length > 1
                    ? 'Multiple games use place points — highest total wins.'
                    : 'Pick one or more games for this event.'}
              </p>
              <div className="event-create__game-grid">
                {EVENT_GAMES.map((slug) => {
                  const g = getGame(slug)
                  const gameAccent = resolveGameAccent(slug, g?.accent ?? accent)
                  const picked = games.includes(slug)
                  const atCap = !isBracket && games.length >= 5 && !picked
                  return (
                    <button
                      key={slug}
                      type="button"
                      className={`event-create__game${picked ? ' event-create__game--picked' : ''}${atCap ? ' event-create__game--disabled' : ''}`}
                      style={{ '--game-accent': gameAccent } as CSSProperties}
                      aria-pressed={picked}
                      disabled={atCap}
                      onClick={() => toggleGame(slug)}
                    >
                      <span className="event-create__game-art">
                        <GameThumbArt slug={slug} accent={gameAccent} />
                      </span>
                      <span className="event-create__game-name">{g?.name ?? slug}</span>
                      {picked ? (
                        <span className="event-create__game-check" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="event-create__card event-create__card--rules">
              <h2 className="event-create__section-title">Rules</h2>

              <div className="event-create__rule">
                <div className="event-create__rule-head">
                  <span className="event-create__rule-title">
                    {isBracket ? 'Attempts per match' : 'Attempts per game'}
                  </span>
                  {isBracket ? null : (
                    <label className="event-create__toggle">
                      <input
                        type="checkbox"
                        checked={unlimitedAttempts}
                        onChange={(e) => setUnlimitedAttempts(e.target.checked)}
                      />
                      <span>Unlimited</span>
                    </label>
                  )}
                </div>
                {isBracket || !unlimitedAttempts ? (
                  <div className="event-create__stepper" aria-label="Attempts per game">
                    <button
                      type="button"
                      className="event-create__stepper-btn"
                      aria-label="Fewer attempts"
                      disabled={maxAttempts <= 1}
                      onClick={() => setMaxAttempts((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <span className="event-create__stepper-value">{maxAttempts}</span>
                    <button
                      type="button"
                      className="event-create__stepper-btn"
                      aria-label="More attempts"
                      disabled={maxAttempts >= 99}
                      onClick={() => setMaxAttempts((n) => Math.min(99, n + 1))}
                    >
                      +
                    </button>
                  </div>
                ) : null}
                <p className="event-create__hint">
                  {isBracket
                    ? `${attemptsSummary(maxAttempts, false, 1).replace('per game', 'per match')}. Fresh tries each round.`
                    : `${attemptsSummary(maxAttempts, unlimitedAttempts, games.length)}. Best score counts per game.`}
                </p>
              </div>

              <div className="event-create__rule">
                <span className="event-create__rule-title">Duration</span>
                <select
                  className="event-create__input event-create__input--duration"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                >
                  {DURATIONS.map((d) => (
                    <option key={d.hours} value={d.hours}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {durationHours === 0 ? (
                  <p className="event-create__hint">
                    {isBracket
                      ? 'Ends when the final has a winner.'
                      : 'Ends when every player has used all their attempts.'}
                    {!isBracket && unlimitedAttempts
                      ? ' Pick a finite attempt limit for this mode.'
                      : null}
                  </p>
                ) : null}
              </div>
            </section>

            {error ? <p className="event-create__error">{error}</p> : null}

            <button
              type="submit"
              className="score-save__btn event-create__submit"
              disabled={busy || title.trim().length < 3 || games.length === 0}
            >
              {busy ? 'Creating…' : 'Create event'}
            </button>
          </form>

          <aside className="event-create-preview" aria-label="Preview">
            <p className="event-create-preview__eyebrow">Preview</p>
            <div className="event-create-preview__card">
              <EventThumbs games={games} size="lg" />
              <div className="event-create-preview__body">
                <h3 className="event-create-preview__title">
                  {title.trim() || 'Your event title'}
                </h3>
                <p className="event-create-preview__meta">
                  {games.map((slug) => getGame(slug)?.name ?? slug).join(' · ')}
                </p>
                <ul className="event-create-preview__facts">
                  <li>{playersSummary(maxPlayers, unlimitedPlayers)}</li>
                  <li>{attemptsSummary(maxAttempts, unlimitedAttempts, games.length)}</li>
                  <li>{durationLabel}</li>
                  {isBracket ? (
                    <li>Single-elim bracket</li>
                  ) : games.length > 1 ? (
                    <li>Place points scoring</li>
                  ) : null}
                  <li>Private · invite only</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  )
}
