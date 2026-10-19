import { useState } from 'react'
import { homeHref } from '../hooks/useHashRoute'
import { deleteAccount } from '../lib/auth'
import '../styles/deleteAccount.css'

/*
 * Delete my account, the menu's last Settings page (SiteMenu): what goes, the tag typed to confirm, and the
 * button. Ramsey, 2026-10-19: "can we do the "Delete my account" functionality now?" The API does the deleting
 * (deleteAccount.ts); lib/auth's deleteAccount then lets the account go from this browser.
 */
export function DeleteAccountPanel({ tag, onClose }: { tag: string; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const want = tag || 'DELETE'
  const ready = !busy && typed.trim().toUpperCase() === want.toUpperCase()

  const go = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await deleteAccount(typed.trim())
      setDone(true)
    } catch (err) {
      setError(err instanceof Error && err.message && !/^API error/.test(err.message) ? err.message : 'That didn’t go through. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  // Back to the home page, loaded afresh: nothing the page held of the account stays on screen.
  const leave = () => {
    onClose()
    window.location.assign(homeHref())
  }

  if (done) {
    return (
      <section className="delete-account" aria-live="polite">
        <p className="delete-account__lead">Your account is deleted.</p>
        <p className="delete-account__note">Thanks for playing. Every game is still here to play, without an account.</p>
        <button type="button" className="delete-account__btn" onClick={leave}>
          Done
        </button>
      </section>
    )
  }

  return (
    <section className="delete-account">
      <p className="delete-account__lead">This deletes your account for good. It can’t be undone.</p>
      <ul className="delete-account__list">
        <li>{tag ? `Your tag, ${tag}, and your sign-ins` : 'Your sign-ins'}</li>
        <li>Your scores, record book entries and trophies</li>
        <li>Your tickets, prizes, looks and season pass</li>
        <li>Your friends, and your places in groups and events</li>
      </ul>
      <p className="delete-account__note">
        A group you host passes to the member who joined it first. Feedback you sent stays, without your name on it.
      </p>
      <label className="delete-account__confirm">
        Type {want} to confirm
        <input
          className="delete-account__input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </label>
      <button type="button" className="delete-account__btn delete-account__btn--go" disabled={!ready} onClick={() => void go()}>
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
      {error ? (
        <p className="delete-account__fail" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
