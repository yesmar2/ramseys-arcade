import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../lib/leaderboard'
import { requestEmailCode, signInWithEmailCode } from '../lib/auth'
import {
  DiscordCancelled,
  cancelDiscordSignIn,
  lastSignInWay,
  rememberSignInWay,
  signInWithDiscord,
  useSignInWays,
  wayWords,
  waysOn,
  type SignInWay,
} from '../lib/signInWays'
import { UserIcon } from './chromeIcons'
import { GoogleSignInButton } from './GoogleSignInButton'
import { Panel, PanelHead } from './Panel'
import '../styles/signIn.css'

/*
 * The ways to sign in, drawn two ways (picked from the sign-in canvas):
 *  - SignInList, every way one under another: Google's own button, Discord, then "or" and a code by
 *    email. The menu has the room for it.
 *  - SignInButton, after a run: one "Sign in" button with the ways named under it, opening a sheet of
 *    the list. The run's report stays as short as it was, with Play again in view.
 * Only the ways the API can do are shown (lib/signInWays), so with Google alone both are Google's
 * button, as before. Once there's more than one, the way this device used last is marked.
 */

type SignedInProps = {
  onSignedIn?: () => void
}

export function SignInList({
  onSignedIn,
  onBusy,
  autoFocus = false,
}: SignedInProps & { onBusy?: (busy: boolean) => void; autoFocus?: boolean }) {
  const ways = useSignInWays()
  const on = waysOn(ways)
  const [emailOpen, setEmailOpen] = useState(false)
  const [busy, setBusyHere] = useState(false)
  // Signing in, by Google's popup or Discord's: whoever holds the list waits too.
  const setBusy = (next: boolean) => {
    setBusyHere(next)
    onBusy?.(next)
  }
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLButtonElement>(null)
  const last = on.length > 1 ? lastSignInWay() : null
  const lastMark = (way: SignInWay) => (last === way ? <span className="signin-last">Last used</span> : null)

  if (emailOpen && ways.email) {
    return (
      <EmailSignIn
        onBack={
          on.length > 1
            ? () => {
                setEmailOpen(false)
                window.requestAnimationFrame(() => emailRef.current?.focus())
              }
            : undefined
        }
        onSignedIn={onSignedIn}
      />
    )
  }

  return (
    <div className="signin-list">
      {ways.google ? (
        <div className="signin-way-slot">
          <GoogleSignInButton
            text={on.length > 1 ? 'continue_with' : 'signin_with'}
            disabled={busy}
            onBusy={setBusy}
            onError={setError}
            onSignedIn={() => {
              setError(null)
              onSignedIn?.()
            }}
          />
          {lastMark('google')}
        </div>
      ) : null}
      {ways.discordClientId ? (
        <div className="signin-way-slot">
          <DiscordButton
            clientId={ways.discordClientId}
            disabled={busy}
            autoFocus={autoFocus && !ways.google}
            onBusy={setBusy}
            onError={setError}
            onSignedIn={() => {
              setError(null)
              onSignedIn?.()
            }}
          />
          {lastMark('discord')}
        </div>
      ) : null}
      {ways.email ? (
        <>
          {on.length > 1 ? (
            <p className="signin-or" aria-hidden="true">
              or
            </p>
          ) : null}
          <div className="signin-way-slot">
            <button
              ref={emailRef}
              type="button"
              className="signin-way signin-way--email"
              disabled={busy}
              onClick={() => {
                setError(null)
                setEmailOpen(true)
              }}
            >
              <MailIcon />
              Continue with email
            </button>
            {lastMark('email')}
          </div>
        </>
      ) : null}
      {error ? (
        <p className="signin-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** After a run: one button, and every way behind it in a sheet. With a single way on, that way's own button. */
export function SignInButton({ onSignedIn, label = 'Sign in' }: SignedInProps & { label?: string }) {
  const ways = useSignInWays()
  const on = waysOn(ways)
  const [open, setOpen] = useState(false)

  if (on.length < 2) return <SignInList onSignedIn={onSignedIn} />

  return (
    <div className="signin-one">
      <button type="button" className="signin-one__btn" onClick={() => setOpen(true)}>
        <UserIcon />
        {label}
      </button>
      <p className="signin-one__ways">
        <span className="signin-one__marks" aria-hidden="true">
          {on.map((way) => (
            <WayMark key={way} way={way} />
          ))}
        </span>
        {wayWords(on)}
      </p>
      {open ? (
        <SignInSheet
          onClose={() => setOpen(false)}
          onSignedIn={() => {
            setOpen(false)
            onSignedIn?.()
          }}
        />
      ) : null}
    </div>
  )
}

function SignInSheet({ onClose, onSignedIn }: { onClose: () => void } & SignedInProps) {
  const titleId = useId()
  return (
    // Typing happens in here (an email, a code), so a stray tap outside doesn't throw it away.
    <Panel onClose={onClose} labelledBy={titleId} scrimCloses={false} className="signin-sheet">
      <PanelHead titleId={titleId} title="Sign in" onClose={onClose} />
      <div className="panel__body panel__body--last signin-sheet__body">
        <p className="signin-sheet__lead">Pick a way. Next time, the one you used is marked.</p>
        <SignInList onSignedIn={onSignedIn} autoFocus />
        <p className="signin-sheet__note">Signing in with the same email any of these ways keeps you one player.</p>
      </div>
    </Panel>
  )
}

/* ---------- Discord ---------- */

function DiscordButton({
  clientId,
  disabled,
  autoFocus,
  onBusy,
  onError,
  onSignedIn,
}: {
  clientId: string
  disabled?: boolean
  autoFocus?: boolean
  onBusy: (busy: boolean) => void
  onError: (message: string | null) => void
} & SignedInProps) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'signing'>('idle')

  const start = () => {
    onError(null)
    setPhase('waiting')
    onBusy(true)
    // Straight from the press, so the popup is allowed to open.
    signInWithDiscord(clientId, { onAnswer: () => setPhase('signing') }).then(
      (how) => {
        if (how === 'away') return
        setPhase('idle')
        onBusy(false)
        onSignedIn?.()
      },
      (err: unknown) => {
        setPhase('idle')
        onBusy(false)
        if (!(err instanceof DiscordCancelled)) {
          onError(err instanceof Error ? err.message : 'Discord didn’t sign you in. Try again.')
        }
      },
    )
  }

  return (
    <div className={`signin-discord${phase === 'idle' ? '' : ' signin-discord--busy'}`}>
      <button
        type="button"
        className="signin-way signin-way--discord"
        disabled={disabled && phase === 'idle'}
        aria-busy={phase !== 'idle'}
        autoFocus={autoFocus}
        onClick={phase === 'idle' ? start : undefined}
      >
        {phase === 'signing' ? <span className="signin-spinner" aria-hidden="true" /> : <DiscordMark />}
        {phase === 'waiting' ? 'Waiting for Discord…' : phase === 'signing' ? 'Signing you in…' : 'Continue with Discord'}
      </button>
      {phase === 'waiting' ? (
        <button type="button" className="signin-link signin-discord__cancel" onClick={cancelDiscordSignIn}>
          Cancel
        </button>
      ) : null}
    </div>
  )
}

/* ---------- a code by email ---------- */

const CODE_LENGTH = 6
/** The API's wait between codes to one address (auth.ts CODE_RESEND_MS). */
const RESEND_WAIT_MS = 30_000

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

function EmailSignIn({ onBack, onSignedIn }: { onBack?: () => void } & SignedInProps) {
  const emailId = useId()
  const codeId = useId()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [devCode, setDevCode] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  // The wait before another code, counted down.
  useEffect(() => {
    if (step !== 'code' || now >= resendAt) return
    const timer = window.setTimeout(() => setNow(Date.now()), 250)
    return () => window.clearTimeout(timer)
  }, [step, now, resendAt])

  const send = async (to: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const sent = await requestEmailCode(to.trim())
      setSentTo(sent.email)
      setCode('')
      setDevCode(sent.devCode ?? null)
      setResendAt(Date.now() + RESEND_WAIT_MS)
      setNow(Date.now())
      setStep('code')
      window.requestAnimationFrame(() => codeRef.current?.focus())
    } catch (err) {
      setError(messageOf(err, 'Couldn’t send a code. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const check = async (full: string) => {
    setBusy(true)
    setError(null)
    try {
      await signInWithEmailCode(sentTo, full)
      rememberSignInWay('email')
      onSignedIn?.()
    } catch (err) {
      setCode('')
      setError(messageOf(err, 'That didn’t work. Try again.'))
      // A code that's gone can be replaced straight away.
      if (err instanceof ApiError && err.code === 'CODE_EXPIRED') setResendAt(0)
      window.requestAnimationFrame(() => codeRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  const back = onBack ? (
    <button type="button" className="signin-link signin-email__back" onClick={onBack}>
      <BackIcon />
      Other ways to sign in
    </button>
  ) : null

  if (step === 'email') {
    return (
      <form
        className="signin-email"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void send(email)
        }}
      >
        {back}
        <label className="signin-email__label" htmlFor={emailId}>
          Your email
        </label>
        <input
          id={emailId}
          className="signin-email__input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          enterKeyHint="send"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="signin-email__send" disabled={busy || !email.trim()}>
          {busy ? <span className="signin-spinner" aria-hidden="true" /> : <MailIcon />}
          {busy ? 'Sending…' : 'Email me a code'}
        </button>
        {error ? (
          <p className="signin-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="signin-email__note">We’ll email you a 6-digit code to type here. There’s no password.</p>
      </form>
    )
  }

  const waitLeft = Math.max(0, Math.ceil((resendAt - now) / 1000))
  return (
    <div className="signin-email signin-email--code">
      {back}
      <p className="signin-email__title">Check your email</p>
      <p className="signin-email__lead">
        We sent a 6-digit code to <strong>{sentTo}</strong>. Type it here.
      </p>
      <div className="signin-code">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`signin-code__slot${code[i] ? ' signin-code__slot--filled' : ''}${focused && !busy && i === Math.min(code.length, CODE_LENGTH - 1) ? ' signin-code__slot--at' : ''}`}
          >
            {code[i] ?? ''}
          </span>
        ))}
        <input
          id={codeId}
          ref={codeRef}
          className="signin-code__input"
          aria-label="The 6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          enterKeyHint="go"
          maxLength={CODE_LENGTH + 4}
          disabled={busy}
          value={code}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
            setCode(digits)
            setError(null)
            // Signed in at the sixth digit, with no button to find.
            if (digits.length === CODE_LENGTH) void check(digits)
          }}
        />
      </div>
      <p className={`signin-email__hint${error ? ' signin-error' : ''}`} role={error ? 'alert' : 'status'}>
        {busy ? (
          <>
            <span className="signin-spinner" aria-hidden="true" />
            Signing you in…
          </>
        ) : (
          (error ?? 'It signs you in as soon as all six are in.')
        )}
      </p>
      {devCode ? <p className="signin-email__dev">On this test server the code is {devCode}.</p> : null}
      <div className="signin-email__row">
        {waitLeft > 0 ? (
          <span className="signin-email__wait">Send a new code in 0:{String(waitLeft).padStart(2, '0')}</span>
        ) : (
          <button type="button" className="signin-link" disabled={busy} onClick={() => void send(sentTo)}>
            Send a new code
          </button>
        )}
        <button
          type="button"
          className="signin-link"
          disabled={busy}
          onClick={() => {
            setStep('email')
            setError(null)
            setCode('')
          }}
        >
          Use a different email
        </button>
      </div>
      <p className="signin-email__note">A code lasts 10 minutes. Can’t find it? Look in spam.</p>
    </div>
  )
}

/* ---------- marks ---------- */

function WayMark({ way }: { way: SignInWay }) {
  return (
    <span className={`signin-way-mark signin-way-mark--${way}`}>
      {way === 'google' ? <GoogleMark /> : way === 'discord' ? <DiscordMark /> : <MailIcon />}
    </span>
  )
}

function Svg({ children, fill = 'currentColor', viewBox = '0 0 24 24' }: { children: ReactNode; fill?: string; viewBox?: string }) {
  return (
    <svg className="signin-mark" viewBox={viewBox} fill={fill} aria-hidden="true">
      {children}
    </svg>
  )
}

function GoogleMark() {
  return (
    <Svg viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  )
}

function DiscordMark() {
  return (
    <Svg>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </Svg>
  )
}

function MailIcon() {
  return (
    <svg className="signin-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.2l8.5 6 8.5-6" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg className="signin-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 6l-6 6 6 6" />
    </svg>
  )
}
