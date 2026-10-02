import { useEffect, useState } from 'react'
import { fetchSeasonPreview, setSeasonPreview, type SeasonPreviewState } from '../lib/admin'
import { refreshSeason } from '../lib/season'

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
    </section>
  )
}
