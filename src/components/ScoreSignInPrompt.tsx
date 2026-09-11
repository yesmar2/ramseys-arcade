import { useState } from 'react'
import { GoogleSignInButton } from './GoogleSignInButton'

type ScoreSignInPromptProps = {
  error?: string | null
  onSignedIn?: () => void
}

/** Compact Google sign-in for post-game score save gates. */
export function ScoreSignInPrompt({ error, onSignedIn }: ScoreSignInPromptProps) {
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const shownError = localError || error

  return (
    <div className="score-save__signin">
      <p className="score-save__note">Sign in to save this score to the boards.</p>
      <GoogleSignInButton
        disabled={busy}
        onBusy={setBusy}
        onError={(message) => setLocalError(message)}
        onSignedIn={() => {
          setLocalError(null)
          onSignedIn?.()
        }}
      />
      {shownError ? (
        <p className="score-save__note score-save__note--error">{shownError}</p>
      ) : null}
    </div>
  )
}
