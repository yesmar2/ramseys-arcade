import { useEffect, useState, type FormEvent } from 'react'
import { fetchSeasonPreview, setSeasonPlus, setSeasonPreview, type SeasonPreviewState } from '../lib/admin'
import { ApiError } from '../lib/leaderboard'
import { refreshSeason } from '../lib/season'
import { refreshTickets } from '../lib/tickets'

/*
 * The admin page's switch for previewing the season before its first day (the API's seasons.ts): on, the
 * season is live early, counting tickets from the first of this month, so it can be tried on staging, or
 * on the live site before the launch. On its first day it's live for everyone either way.
 */

function dayWords(key: number): string {
  const y = Math.floor(key / 10000)
  const m = Math.floor(key / 100) % 100
  const d = key % 100
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function AdminSeasonPreview() {
  const [state, setState] = useState<SeasonPreviewState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tag, setTag] = useState('')
  const [plusBusy, setPlusBusy] = useState(false)
  const [plusNote, setPlusNote] = useState<{ ok: boolean; text: string } | null>(null)

  // Pass+ for a tag, given or taken back: to try the Pass+ row without paying. What it gave stays given.
  const plus = async (on: boolean, event?: FormEvent) => {
    event?.preventDefault()
    const name = tag.trim().toUpperCase()
    if (!name || plusBusy) return
    setPlusBusy(true)
    setPlusNote(null)
    try {
      const done = await setSeasonPlus(name, on)
      setPlusNote({ ok: true, text: done.plus ? `${done.name} has Season ${done.season}’s Pass+ now.` : `${done.name}’s Pass+ is taken back. What it gave stays theirs.` })
      void refreshSeason({ force: true })
      void refreshTickets(true)
    } catch (err) {
      setPlusNote({
        ok: false,
        text:
          err instanceof ApiError && err.code === 'NO_ACCOUNT'
            ? `${name} has no account behind it.`
            : err instanceof ApiError && err.code === 'NO_PLUS'
              ? 'No season with a Pass+ right now.'
              : 'That didn’t go through. Try again.',
      })
    } finally {
      setPlusBusy(false)
    }
  }

  useEffect(() => {
    fetchSeasonPreview()
      .then(setState)
      .catch(() => setError('Couldn’t read the season.'))
  }, [])

  const on = state?.previewFrom != null
  const season = state?.season ?? null
  const flip = () => {
    if (!state || busy) return
    setBusy(true)
    setError(null)
    setSeasonPreview(!on)
      .then((next) => {
        setState(next)
        void refreshSeason({ force: true })
      })
      .catch(() => setError('That didn’t go through. Try again.'))
      .finally(() => setBusy(false))
  }

  const status = !season
    ? null
    : season.status === 'live'
      ? season.preview
        ? 'Previewing'
        : 'Live'
      : season.status === 'upcoming'
        ? 'Starts soon'
        : 'Over'

  return (
    <section className="adm-card" aria-labelledby="adm-season">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-season">
          Season
          {status ? <span className="adm-card__count">{status}</span> : null}
        </h2>
        <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={!state || busy || season?.status === 'over'} onClick={flip}>
          {busy ? 'Saving…' : on ? 'End the preview' : 'Preview it now'}
        </button>
      </div>
      <p className="adm-card__sub">
        {season ? (
          <>
            Season {season.id}, {season.name}: {season.firstDay} to {season.lastDay}.{' '}
          </>
        ) : null}
        {on && state?.previewFrom
          ? `Previewing: it’s live now on this server, counting tickets since ${dayWords(state.previewFrom)}. On its first day it’s live for everyone anyway.`
          : 'Preview it to try the pass, the banner and the ring before its first day: it goes live on this server, counting tickets since the 1st of this month.'}
      </p>
      {error ? <p className="adm-fail">{error}</p> : null}
      {season?.status === 'live' ? (
        <>
          <p className="adm-card__sub">Pass+: give it to a tag to try the Pass+ row without paying, or take it back.</p>
          <form className="adm-form" onSubmit={(event) => void plus(true, event)}>
            <input
              className="panel__input adm-input adm-input--tag"
              value={tag}
              maxLength={12}
              placeholder="TAG"
              aria-label="Tag to give Pass+ to"
              onChange={(event) => setTag(event.target.value.toUpperCase())}
            />
            <button type="submit" className="panel__btn adm-small" disabled={plusBusy || !tag.trim()}>
              {plusBusy ? 'Saving…' : 'Give Pass+'}
            </button>
            <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={plusBusy || !tag.trim()} onClick={() => void plus(false)}>
              Take it back
            </button>
          </form>
          {plusNote ? <p className={plusNote.ok ? 'adm-note' : 'adm-fail'}>{plusNote.text}</p> : null}
        </>
      ) : null}
    </section>
  )
}
