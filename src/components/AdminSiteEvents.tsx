import { useEffect, useState } from 'react'
import { fetchSiteEvents, setSiteEvents } from '../lib/admin'

/*
 * The admin page's switch for the arcade's own events: the daily event, the One Shot and the Weekly Triple
 * (the API's siteEvents.ts). Ramsey chose to launch with them paused (2026-10-02), to turn on once enough
 * people play each day that they won't sit empty. Events players run themselves carry on either way.
 */
export function AdminSiteEvents() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSiteEvents()
      .then(setOn)
      .catch(() => setError('Couldn’t read the switch.'))
  }, [])

  const flip = () => {
    if (on == null || busy) return
    setBusy(true)
    setError(null)
    setSiteEvents(!on)
      .then(setOn)
      .catch(() => setError('That didn’t go through. Try again.'))
      .finally(() => setBusy(false))
  }

  return (
    <section className="adm-card" aria-labelledby="adm-site-events">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-site-events">
          Site events
          {on != null ? <span className="adm-card__count">{on ? 'On' : 'Paused'}</span> : null}
        </h2>
        <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={on == null || busy} onClick={flip}>
          {busy ? 'Saving…' : on ? 'Pause them' : 'Turn them on'}
        </button>
      </div>
      <p className="adm-card__sub">
        The arcade’s own events: today’s event, the One Shot and the Weekly Triple.{' '}
        {on
          ? 'They’re running, on the Events page, the home page and as the Dailies’ bonus punches.'
          : 'Paused, none is made and none is shown, and events players run themselves carry on.'}{' '}
        Turn them on once the Players card shows about 30 players a day, so each one draws a field. A trophy needs five
        who played in the arcade’s events, three in a player’s own.
      </p>
      {error ? <p className="adm-fail">{error}</p> : null}
    </section>
  )
}
