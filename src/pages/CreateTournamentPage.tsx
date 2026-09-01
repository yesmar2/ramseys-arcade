import { useState, type CSSProperties, type FormEvent } from 'react'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import {
  createTournament,
  EVENT_GAMES,
  FORMAT_LABELS,
  type CreateTournamentInput,
  type EventGame,
  type TournamentFormat,
} from '../lib/tournaments'

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
] as const

const COMMUNITY_FORMATS = ['open', 'attempt-limited', 'single-run', 'cumulative'] as const
type CommunityFormat = (typeof COMMUNITY_FORMATS)[number]

export function CreateTournamentPage() {
  const { account, loading: authLoading } = useAuth()
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [game, setGame] = useState<EventGame>('stacker')
  const [format, setFormat] = useState<CommunityFormat>('open')
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [durationHours, setDurationHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedGame = getGame(game)
  const accent = selectedGame?.accent ?? '#2eb8a0'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !account) return
    setBusy(true)
    setError(null)
    try {
      const input: CreateTournamentInput = {
        title: title.trim(),
        blurb: blurb.trim() || undefined,
        game,
        format: format as Exclude<TournamentFormat, 'place-points'>,
        durationHours,
        ...(format === 'attempt-limited' ? { maxAttempts } : {}),
      }
      const created = await createTournament(input)
      window.location.hash = `#/tournaments/${created.id}`
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

      {authLoading ? (
        <p className="lb-empty">Loading…</p>
      ) : !account ? (
        <div className="event-create-gate">
          <p className="tour-note">Sign in to host a community event.</p>
          <a className="score-save__btn" href="#/tournaments">
            Back to events
          </a>
        </div>
      ) : (
        <form
          className="event-create"
          style={{ '--event-accent': accent } as CSSProperties}
          onSubmit={(e) => void onSubmit(e)}
        >
          <p className="event-create__intro">
            Pick a game, format, and duration. Your event goes live immediately.
          </p>

          <label className="score-save__field">
            <span className="score-save__label">Title</span>
            <input
              className="score-save__input"
              value={title}
              maxLength={60}
              placeholder="Friday Night Stacker"
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="score-save__field">
            <span className="score-save__label">Description (optional)</span>
            <textarea
              className="score-save__input event-create__textarea"
              value={blurb}
              maxLength={280}
              rows={3}
              placeholder="Friends-only sprint — best of three attempts."
              onChange={(e) => setBlurb(e.target.value)}
            />
          </label>

          <fieldset className="event-create__fieldset">
            <legend className="score-save__label">Game</legend>
            <div className="event-create__game-grid">
              {EVENT_GAMES.map((slug) => {
                const g = getGame(slug)
                const picked = slug === game
                return (
                  <button
                    key={slug}
                    type="button"
                    className={`event-create__game${picked ? ' event-create__game--picked' : ''}`}
                    style={{ '--event-accent': g?.accent ?? accent } as CSSProperties}
                    aria-pressed={picked}
                    onClick={() => setGame(slug)}
                  >
                    <GameThumbArt slug={slug} accent={g?.accent} />
                    <span>{g?.name ?? slug}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="event-create__fieldset">
            <legend className="score-save__label">Format</legend>
            <div className="event-create__format-list">
              {COMMUNITY_FORMATS.map((f) => (
                <label key={f} className="event-create__format">
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                  />
                  <span className="event-create__format-label">{FORMAT_LABELS[f]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {format === 'attempt-limited' && (
            <label className="score-save__field">
              <span className="score-save__label">Max attempts</span>
              <input
                className="score-save__input event-create__attempts"
                type="number"
                min={2}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value) || 3)}
              />
            </label>
          )}

          <label className="score-save__field">
            <span className="score-save__label">Duration</span>
            <select
              className="score-save__input"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="score-save__note score-save__note--error">{error}</p> : null}

          <button
            type="submit"
            className="lb-play event-create__submit"
            style={{ background: accent }}
            disabled={busy || title.trim().length < 3}
          >
            {busy ? 'Creating…' : 'Create event'}
          </button>
        </form>
      )}
    </PageShell>
  )
}
