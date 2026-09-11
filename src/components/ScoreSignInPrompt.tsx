import { useState } from 'react'
import { requestMagicLink } from '../lib/auth'
import { GoogleSignInButton } from './GoogleSignInButton'

type ScoreSignInPromptProps = {
  error?: string | null
  onSignedIn?: () => void
}

/** Compact Google + email sign-in for post-game score save gates. */
export function ScoreSignInPrompt({ error, onSignedIn }: ScoreSignInPromptProps) {
  const [emailDraft, setEmailDraft] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const sendMagicLink = async () => {
    const email = emailDraft.trim()
    if (!email || busy) return
    setBusy(true)
    setNote(null)
    setDevVerifyUrl(null)
    setLocalError(null)
    try {
      const result = await requestMagicLink(email)
      setNote(`Check ${result.email} for a sign-in link.`)
      if (result.verifyUrl) setDevVerifyUrl(result.verifyUrl)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not send link')
    } finally {
      setBusy(false)
    }
  }

  const shownError = localError || error

  return (
    <div className="score-save__signin">
      <p className="score-save__note">Sign in to save this score to the boards.</p>
      <GoogleSignInButton
        disabled={busy}
        onBusy={setBusy}
        onError={(message) => setLocalError(message)}
        onSignedIn={() => {
          setNote('Signed in.')
          setLocalError(null)
          onSignedIn?.()
        }}
      />
      {!showEmail ? (
        <button
          type="button"
          className="score-save__btn score-save__btn--ghost"
          disabled={busy}
          onClick={() => setShowEmail(true)}
        >
          Sign in with email
        </button>
      ) : (
        <>
          <label className="score-save__field">
            <span className="score-save__label">Email</span>
            <input
              className="score-save__input"
              type="email"
              autoComplete="email"
              value={emailDraft}
              disabled={busy}
              placeholder="you@example.com"
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void sendMagicLink()
                }
              }}
            />
          </label>
          <button
            type="button"
            className="score-save__btn"
            disabled={busy || !emailDraft.trim()}
            onClick={() => void sendMagicLink()}
          >
            {busy ? 'Sending…' : 'Email me a link'}
          </button>
        </>
      )}
      {note ? <p className="score-save__note">{note}</p> : null}
      {devVerifyUrl ? (
        <p className="score-save__note">
          Dev link:{' '}
          <a
            href={
              devVerifyUrl.includes('#')
                ? devVerifyUrl.slice(devVerifyUrl.indexOf('#'))
                : devVerifyUrl
            }
          >
            Open sign-in link
          </a>
        </p>
      ) : null}
      {shownError ? (
        <p className="score-save__note score-save__note--error">{shownError}</p>
      ) : null}
    </div>
  )
}
