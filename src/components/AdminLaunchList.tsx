import { useCallback, useEffect, useState } from 'react'
import { fetchLaunchList, removeFromLaunchList, sendLaunchEmail, sendLaunchTest, type LaunchList } from '../lib/admin'

/*
 * The admin page's launch list: who asked the coming-soon page (public/soon.html, in front of the site while it's
 * closed) to tell them when Blipka opens. The page promises one email on opening day, then the address is
 * deleted, and Send does both: a batch at a time, each address gone once its email has. Remove is for someone
 * who asks to come off before then.
 */
export function AdminLaunchList() {
  const [list, setList] = useState<LaunchList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setError(null)
    fetchLaunchList()
      .then(setList)
      .catch((err) => setError(errorText(err, 'Couldn’t load the list')))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const emails = list?.emails ?? []
  const next = Math.min(emails.length, list?.batch ?? 100)

  const act = async (what: string, run: () => Promise<string>) => {
    if (busy) return
    setBusy(what)
    setError(null)
    setDone(null)
    try {
      setDone(await run())
    } catch (err) {
      setError(errorText(err, 'That didn’t go through. Try again.'))
    } finally {
      setBusy(null)
    }
  }

  const onTest = () => act('test', async () => `Sent to ${(await sendLaunchTest()).to}. Look for “${list?.mail.subject}”.`)

  const onSend = () => {
    const whom = next === emails.length ? `all ${count(next, 'person', 'people')}` : `the first ${next} of ${emails.length}`
    if (!window.confirm(`Send “${list?.mail.subject}” to ${whom} on the list? Each address is deleted once its email has gone. This can’t be undone.`)) return
    void act('send', async () => {
      const { sent, left } = await sendLaunchEmail()
      refresh()
      return left
        ? `Sent ${count(sent, 'email')}. ${count(left, 'address', 'addresses')} left: send again for the rest (Resend’s free plan sends 100 a day).`
        : `Sent ${count(sent, 'email')}. The list is empty.`
    })
  }

  const onRemove = (email: string) => {
    if (!window.confirm(`Take ${email} off the list? They won’t get the opening-day email.`)) return
    void act(email, async () => {
      await removeFromLaunchList(email)
      setList((now) => (now ? { ...now, emails: now.emails.filter((row) => row.email !== email) } : now))
      return `${email} is off the list.`
    })
  }

  const onCopy = () =>
    act('copy', async () => {
      await navigator.clipboard.writeText(emails.map((row) => row.email).join('\n'))
      return `Copied ${count(emails.length, 'address', 'addresses')}.`
    })

  const onDownload = () => {
    const rows = ['email,joined', ...emails.map((row) => `${row.email},${new Date(row.createdAt).toISOString()}`)]
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`${rows.join('\n')}\n`], { type: 'text/csv' }))
    link.download = 'blipka-launch-list.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
  }

  return (
    <section className="adm-card" aria-labelledby="adm-launch">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-launch">
          Launch list
          {emails.length ? <span className="adm-card__count">{emails.length}</span> : null}
        </h2>
        <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={refresh}>
          Refresh
        </button>
      </div>
      <p className="adm-card__sub">
        Who asked the coming-soon page to tell them when Blipka opens, the latest first. The page promises one email on
        opening day, then the address is deleted: Send does both, {list?.batch ?? 100} at a time, the earliest first.
      </p>
      {list && !list.mailer ? (
        <p className="adm-fail">
          This API can’t send email yet. It needs RESEND_API_KEY and EMAIL_FROM on Render, with blipka.com verified in
          Resend.
        </p>
      ) : null}
      {list ? (
        <div className="adm-form">
          <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={!list.mailer || busy != null} onClick={() => void onTest()}>
            {busy === 'test' ? 'Sending…' : 'Send me a test'}
          </button>
          <button type="button" className="panel__btn adm-small" disabled={!list.mailer || !emails.length || busy != null} onClick={onSend}>
            {busy === 'send' ? 'Sending…' : next < emails.length ? `Send to the first ${next}` : 'Send the launch email'}
          </button>
          <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={!emails.length || busy != null} onClick={() => void onCopy()}>
            Copy all
          </button>
          <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={!emails.length} onClick={onDownload}>
            Download CSV
          </button>
        </div>
      ) : null}
      {done ? <p className="adm-note">{done}</p> : null}
      {error ? <p className="adm-fail">{error}</p> : null}
      {list ? (
        <details className="adm-row__more">
          <summary>The email</summary>
          <p className="adm-row__sub">
            <b>{list.mail.subject}</b>
          </p>
          <pre>{list.mail.text}</pre>
        </details>
      ) : null}
      {list && !emails.length ? <p className="adm-note">Nobody yet.</p> : null}
      {emails.length ? (
        <ul className="adm-list">
          {emails.map((row) => (
            <li key={row.email} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{row.email}</b>
                <span className="adm-row__sub">{ago(row.createdAt)}</span>
              </div>
              <div className="adm-row__acts">
                <button
                  type="button"
                  className="panel__btn panel__btn--ghost adm-small"
                  disabled={busy != null}
                  onClick={() => onRemove(row.email)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

function ago(at: number) {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}
