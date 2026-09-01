import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { EventThumbs } from '../components/EventCard'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { tournamentHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import {
  createTournament,
  EVENT_GAMES,
  rememberTournamentInvite,
  type CreateTournamentInput,
  type EventGame,
} from '../lib/tournaments'

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

export function CreateTournamentPage() {
  const { account, loading: authLoading } = useAuth()
  const [title, setTitle] = useState('')
  const [games, setGames] = useState<EventGame[]>(['stacker'])
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [unlimitedAttempts, setUnlimitedAttempts] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [unlimitedPlayers, setUnlimitedPlayers] = useState(false)
  const [durationHours, setDurationHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waitingForAuth = authLoading && !account

  const accent = useMemo(() => {
    const first = getGame(games[0] ?? '')
    return first?.accent ?? '#2eb8a0'
  }, [games])

  const durationLabel =
    DURATIONS.find((d) => d.hours === durationHours)?.label ?? '24 hours'

  const toggleGame = (slug: EventGame) => {
    setGames((prev) => {
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
        maxAttempts: unlimitedAttempts ? 0 : maxAttempts,
        maxPlayers: unlimitedPlayers ? 0 : maxPlayers,
        durationHours,
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
                  <label className="event-create__toggle">
                    <input
                      type="checkbox"
                      checked={unlimitedPlayers}
                      onChange={(e) => setUnlimitedPlayers(e.target.checked)}
                    />
                    <span>Unlimited</span>
                  </label>
                </div>
                {!unlimitedPlayers ? (
                  <div className="event-create__stepper" aria-label="Maximum players">
                    <button
                      type="button"
                      className="event-create__stepper-btn"
                      aria-label="Fewer players"
                      disabled={maxPlayers <= 2}
                      onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))}
                    >
                      −
                    </button>
                    <span className="event-create__stepper-value">{maxPlayers}</span>
                    <button
                      type="button"
                      className="event-create__stepper-btn"
                      aria-label="More players"
                      disabled={maxPlayers >= 99}
                      onClick={() => setMaxPlayers((n) => Math.min(99, n + 1))}
                    >
                      +
                    </button>
                  </div>
                ) : null}
                <p className="event-create__hint">{playersSummary(maxPlayers, unlimitedPlayers)}.</p>
              </div>
            </section>

            <section className="event-create__card">
              <div className="event-create__section-head">
                <h2 className="event-create__section-title">Games</h2>
                <span className="event-create__count">{games.length} / 5 selected</span>
              </div>
              <p className="event-create__hint">
                {games.length > 1
                  ? 'Multiple games use place points — highest total wins.'
                  : 'Pick one or more games for this event.'}
              </p>
              <div className="event-create__game-grid">
                {EVENT_GAMES.map((slug) => {
                  const g = getGame(slug)
                  const picked = games.includes(slug)
                  const atCap = games.length >= 5 && !picked
                  return (
                    <button
                      key={slug}
                      type="button"
                      className={`event-create__game${picked ? ' event-create__game--picked' : ''}${atCap ? ' event-create__game--disabled' : ''}`}
                      style={{ '--game-accent': g?.accent ?? accent } as CSSProperties}
                      aria-pressed={picked}
                      disabled={atCap}
                      onClick={() => toggleGame(slug)}
                    >
                      <span className="event-create__game-art">
                        <GameThumbArt slug={slug} accent={g?.accent} />
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
                  <span className="event-create__rule-title">Attempts per game</span>
                  <label className="event-create__toggle">
                    <input
                      type="checkbox"
                      checked={unlimitedAttempts}
                      onChange={(e) => setUnlimitedAttempts(e.target.checked)}
                    />
                    <span>Unlimited</span>
                  </label>
                </div>
                {!unlimitedAttempts ? (
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
                  {attemptsSummary(maxAttempts, unlimitedAttempts, games.length)}. Best score
                  counts per game.
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
                    Ends when every player has used all their attempts.
                    {unlimitedAttempts
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
                  {games.length > 1 ? <li>Place points scoring</li> : null}
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
