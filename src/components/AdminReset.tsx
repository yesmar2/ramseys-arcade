import { useCallback, useEffect, useState } from 'react'
import { fetchResetPreview, resetTestData, type ResetPreview } from '../lib/admin'

/*
 * The admin page's Reset test data (the API's resetWorld.ts). Ramsey, 2026-10-16: clear the live site's data
 * before testers are let in, and again when it opens, keeping accounts and tags. It empties everything played and
 * deletes the sample players; accounts, tags, sign-ins, friends and groups stay, as do the launch list and
 * feedback. Typing RESET is the confirmation, and the API refuses once launch day is over.
 */
export function AdminReset() {
  const [preview, setPreview] = useState<ResetPreview | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setError(null)
    fetchResetPreview()
      .then(setPreview)
      .catch((err) => setError(errorText(err, 'Couldn’t ask the API what’s there')))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const c = preview?.counts
  const open = preview?.open ?? false
  const ready = open && !busy && typed.trim().toUpperCase() === 'RESET'

  const onReset = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const { before, restarting } = await resetTestData()
      setTyped('')
      setDone(
        `Done: ${count(before.runs, 'run')}, ${count(before.boardScores, 'board score')} and ${count(before.samplePlayers, 'sample player')} are gone, and ${count(before.players, 'account')} kept. ` +
          (restarting ? 'The API is starting afresh: give it a minute, then Refresh.' : 'Restart the API so it lets go of what it held in memory.'),
      )
      if (!restarting) refresh()
    } catch (err) {
      setError(errorText(err, 'The reset didn’t answer. Refresh to see what’s there.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="adm-card adm-reset" aria-labelledby="adm-reset">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-reset">
          Reset test data
        </h2>
        <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={refresh}>
          Refresh
        </button>
      </div>
      <p className="adm-card__sub">
        Before launch only: once before letting testers in, and again on launch morning, before opening the site. It
        empties everything played and deletes the sample players. It stops working when launch day ends
        {preview ? `, ${when(preview.until)}` : ''}.
      </p>
      {c ? (
        <div className="adm-reset__lists">
          <div>
            <h3 className="adm-reset__head">Goes</h3>
            <ul className="adm-reset__list">
              <li>{count(c.samplePlayers, 'sample player')}</li>
              <li>{count(c.runs, 'run')}</li>
              <li>{count(c.boardScores, 'board score')}</li>
              <li>{count(c.records, 'record book entry', 'record book entries')}</li>
              <li>
                {count(c.ticketRows, 'ticket payout')} and {count(c.prizes, 'prize')}
              </li>
              <li>{count(c.trophies, 'trophy', 'trophies')}</li>
              <li>{count(c.seasonPlayers, 'player')} on the season pass</li>
              <li>{c.medalsAndLaps.toLocaleString()} medals, laps and ghosts</li>
              <li>
                {count(c.events, 'event')} and {count(c.notifications, 'notification')}
              </li>
            </ul>
          </div>
          <div>
            <h3 className="adm-reset__head">Stays</h3>
            <ul className="adm-reset__list">
              <li>{count(c.players, 'account')}, with their tags, sign-ins, friends and groups</li>
              <li>{count(c.launchList, 'address', 'addresses')} on the launch list</li>
              <li>{count(c.feedback, 'feedback message')}</li>
            </ul>
          </div>
        </div>
      ) : null}
      {preview ? <p className="adm-note">{preview.lastResetAt ? `Last reset ${when(preview.lastResetAt)}.` : 'Never reset.'}</p> : null}
      {preview && !open ? (
        <p className="adm-fail">Launch day is over, so the reset is switched off.</p>
      ) : preview ? (
        <div className="adm-form">
          <label className="adm-reset__confirm">
            Type RESET to confirm
            <input
              className="panel__input adm-input adm-input--tag"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="button" className="panel__btn adm-small adm-reset__go" disabled={!ready} onClick={() => void onReset()}>
            {busy ? 'Resetting…' : 'Reset test data'}
          </button>
        </div>
      ) : null}
      <p className="adm-note">A backup first is one click: in Neon, Branches → Create branch, from production.</p>
      {done ? (
        <p className="adm-note" role="status">
          {done}
        </p>
      ) : null}
      {error ? <p className="adm-fail">{error}</p> : null}
    </section>
  )
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/** "Nov 15, 12:00 AM ET", on the boards' clock. */
function when(at: number) {
  return `${new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}
