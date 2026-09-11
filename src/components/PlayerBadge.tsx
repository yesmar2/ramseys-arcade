import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { usePlayerName } from '../hooks/usePlayerName'
import { stopImpersonation } from '../lib/impersonate'
import {
  AVATAR_IDS,
  AVATARS_ENABLED,
  getLocalAvatarId,
  resolveAvatarId,
  setLocalAvatarId,
  type AvatarId,
} from '../lib/avatars'
import {
  linkCurrentNameToAccount,
  logoutAccount,
  requestMagicLink,
} from '../lib/auth'
import {
  ApiError,
  PLAYER_NAME_MAX,
  fetchNameAvatar,
  normalizePlayerName,
  rememberPlayerName,
  setPlayerAvatar,
} from '../lib/leaderboard'
import { currentTheme, THEME_EVENT, toggleTheme, themeLabel, type Theme } from '../lib/theme'
import { DevImpersonateControl } from './DevImpersonateControl'
import { GoogleSignInButton } from './GoogleSignInButton'
import { PlayerAvatar } from './PlayerAvatar'
import { SoundPackSelect } from './SoundPackSelect'

type PlayerBadgeProps = {
  /** Compact chip for tight headers / game overlays */
  compact?: boolean
  /** Round icon button instead of the name chip */
  icon?: boolean
  /** Inline panel for the site drawer (no trigger / popover). */
  embedded?: boolean
  /** Include theme/sounds block (popover only; drawer has its own). */
  showSettings?: boolean
  className?: string
}

export type PlayerBadgeHandle = {
  openEdit: () => void
}

export const PlayerBadge = forwardRef<PlayerBadgeHandle, PlayerBadgeProps>(
  function PlayerBadge(
    {
      compact = false,
      icon = false,
      embedded = false,
      showSettings = !embedded,
      className = '',
    },
    ref,
  ) {
    const name = usePlayerName()
    const impersonation = useImpersonation()
    const { account, signedIn } = useAuth()
    const [editing, setEditing] = useState(embedded)
    const [draft, setDraft] = useState(name || '')
    const [emailDraft, setEmailDraft] = useState('')
    const [showEmailSignIn, setShowEmailSignIn] = useState(false)
    const [busy, setBusy] = useState(false)
    const [authBusy, setAuthBusy] = useState(false)
    const [avatarBusy, setAvatarBusy] = useState(false)
    const [avatarId, setAvatarId] = useState<AvatarId>(() =>
      resolveAvatarId(getLocalAvatarId(name), name),
    )
    const [error, setError] = useState<string | null>(null)
    const [authNote, setAuthNote] = useState<string | null>(null)
    const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null)
    const [theme, setTheme] = useState<Theme>(() =>
      typeof document === 'undefined' ? 'light' : currentTheme(),
    )
    const rootRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      const sync = () => setTheme(currentTheme())
      window.addEventListener(THEME_EVENT, sync)
      return () => window.removeEventListener(THEME_EVENT, sync)
    }, [])

    useEffect(() => {
      if (!AVATARS_ENABLED) return
      const cleaned = normalizePlayerName(name)
      if (!cleaned) {
        setAvatarId(resolveAvatarId(null, ''))
        return
      }
      const local = getLocalAvatarId(cleaned)
      setAvatarId(resolveAvatarId(local, cleaned))
      let cancelled = false
      void fetchNameAvatar(cleaned).then((id) => {
        if (cancelled || !id) return
        const resolved = resolveAvatarId(id, cleaned)
        setAvatarId(resolved)
        setLocalAvatarId(cleaned, resolved)
      })
      return () => {
        cancelled = true
      }
    }, [name])

    useEffect(() => {
      if (embedded) setEditing(true)
    }, [embedded])

    useEffect(() => {
      setDraft(name || '')
    }, [name])

    const startEdit = () => {
      setDraft(name || '')
      setError(null)
      setAuthNote(null)
      setDevVerifyUrl(null)
      setShowEmailSignIn(false)
      setEditing(true)
    }

    useImperativeHandle(ref, () => ({ openEdit: startEdit }))

    const save = async () => {
      if (impersonation) {
        setError('Stop impersonating before changing your gamer tag')
        return
      }
      const cleaned = normalizePlayerName(draft)
      if (!cleaned || busy) return
      setBusy(true)
      setError(null)
      try {
        if (signedIn) {
          // Account path: set active tag, free previous, rename scores.
          await linkCurrentNameToAccount(cleaned)
        } else {
          await rememberPlayerName(cleaned)
        }
        if (!embedded) setEditing(false)
      } catch (err) {
        if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
          setError(
            signedIn
              ? 'That gamer tag is taken'
              : 'That gamer tag is taken. Sign in or pick another.',
          )
        } else {
          setError(err instanceof Error ? err.message : 'Could not save gamer tag')
        }
      } finally {
        setBusy(false)
      }
    }

    const sendMagicLink = async () => {
      const email = emailDraft.trim()
      if (!email || authBusy) return
      setAuthBusy(true)
      setAuthNote(null)
      setDevVerifyUrl(null)
      setError(null)
      try {
        const result = await requestMagicLink(email)
        setAuthNote(`Check ${result.email} for a sign-in link.`)
        if (result.verifyUrl) setDevVerifyUrl(result.verifyUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send link')
      } finally {
        setAuthBusy(false)
      }
    }

    const signOut = async () => {
      setAuthBusy(true)
      try {
        await logoutAccount()
        setAuthNote('Signed out on this device.')
      } finally {
        setAuthBusy(false)
      }
    }

    const cancel = () => {
      if (busy || authBusy) return
      if (embedded) {
        setDraft(name || '')
        setError(null)
        setAuthNote(null)
        setDevVerifyUrl(null)
        setShowEmailSignIn(false)
        return
      }
      setEditing(false)
      setError(null)
      setAuthNote(null)
      setDevVerifyUrl(null)
      setShowEmailSignIn(false)
    }

    useEffect(() => {
      if (!editing || embedded) return
      if (signedIn) {
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      const onPointer = (e: PointerEvent) => {
        if (!rootRef.current?.contains(e.target as Node)) cancel()
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') cancel()
      }
      window.addEventListener('pointerdown', onPointer)
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('pointerdown', onPointer)
        window.removeEventListener('keydown', onKey)
      }
    }, [editing, busy, authBusy, signedIn, embedded])

    const pickAvatar = async (next: AvatarId) => {
      if (impersonation) {
        setError('Stop impersonating before changing an avatar')
        return
      }
      const cleaned = normalizePlayerName(name || draft)
      if (!cleaned || avatarBusy) return
      setAvatarBusy(true)
      setError(null)
      try {
        if (!normalizePlayerName(name)) {
          await rememberPlayerName(cleaned)
        }
        const saved = await setPlayerAvatar(cleaned, next)
        const resolved = resolveAvatarId(saved, cleaned)
        setAvatarId(resolved)
        setLocalAvatarId(cleaned, resolved)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save avatar')
      } finally {
        setAvatarBusy(false)
      }
    }

    const displayName = normalizePlayerName(name)
    const triggerClass = icon
      ? `player-badge player-badge--icon${signedIn ? ' player-badge--account' : ' player-badge--signin'}${displayName ? ' player-badge--named' : ''}`
      : `player-badge${compact ? ' player-badge--compact' : ''}${displayName ? '' : ' player-badge--empty'}`
    const triggerLabel = icon
      ? signedIn
        ? displayName
          ? `Account · ${displayName}`
          : 'Account'
        : 'Sign in'
      : displayName
        ? `Gamer tag ${displayName}`
        : 'Set gamer tag'

    const gamerTagSection = (
      <>
        <p className="player-badge__panel-title">
          {signedIn ? 'Gamer tag' : 'Play as'}
        </p>
        {impersonation ? (
          <p className="player-badge__impersonate">
            Acting as {impersonation.name} for testing. Your tag stays{' '}
            {impersonation.previousName || 'unset'}.
          </p>
        ) : null}
        {!signedIn && !impersonation ? (
          <p className="player-badge__panel-blurb">
            Pick a tag to play. Sign in below to keep it across devices.
          </p>
        ) : null}
        <label className="player-badge__field">
          <span className="player-badge__label">Tag</span>
          <input
            ref={inputRef}
            className="player-badge__input"
            value={draft}
            maxLength={PLAYER_NAME_MAX}
            disabled={busy || Boolean(impersonation)}
            onChange={(e) => {
              setDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
            }}
          />
        </label>

        {AVATARS_ENABLED ? (
          <div className="player-badge__avatars">
            <span className="player-badge__label">Avatar</span>
            <div className="player-badge__avatar-grid" role="listbox" aria-label="Choose avatar">
              {AVATAR_IDS.map((id) => {
                const selected = id === avatarId
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`player-badge__avatar-opt${selected ? ' player-badge__avatar-opt--on' : ''}`}
                    disabled={avatarBusy || busy || Boolean(impersonation)}
                    onClick={() => void pickAvatar(id)}
                  >
                    <PlayerAvatar avatarId={id} name={displayName || draft} size="md" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {error && <p className="player-badge__error">{error}</p>}
        <div className="player-badge__panel-actions">
          {impersonation ? (
            <button
              type="button"
              className="player-badge__btn"
              onClick={() => {
                stopImpersonation()
                setError(null)
                setEditing(false)
              }}
            >
              Stop acting as {impersonation.name}
            </button>
          ) : (
            <button
              type="button"
              className="player-badge__btn"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
          <button
            type="button"
            className="player-badge__btn player-badge__btn--ghost"
            disabled={busy || authBusy}
            onClick={cancel}
          >
            {embedded ? 'Reset' : 'Cancel'}
          </button>
        </div>
      </>
    )

    const authSection = (
      <div className={`player-badge__auth${signedIn ? '' : ' player-badge__auth--lead'}`}>
        <p className="player-badge__panel-title player-badge__panel-title--sub">
          {signedIn ? 'Account' : 'Sign in'}
        </p>
        {!signedIn ? (
          <p className="player-badge__panel-blurb">
            Keep your gamer tag and scores across phones and browsers.
          </p>
        ) : null}
        {signedIn && account ? (
          <>
            <p className="player-badge__auth-email">{account.email}</p>
            <button
              type="button"
              className="player-badge__btn player-badge__btn--ghost"
              disabled={authBusy}
              onClick={() => void signOut()}
            >
              {authBusy ? 'Working…' : 'Sign out'}
            </button>
          </>
        ) : (
          <>
            <GoogleSignInButton
              disabled={authBusy}
              onBusy={setAuthBusy}
              onError={(message) => setError(message)}
              onSignedIn={() => {
                setAuthNote('Signed in.')
                setError(null)
                if (!embedded) setEditing(false)
              }}
            />
            {!showEmailSignIn ? (
              <button
                type="button"
                className="player-badge__btn player-badge__btn--ghost"
                disabled={authBusy}
                onClick={() => setShowEmailSignIn(true)}
              >
                Sign in with email
              </button>
            ) : (
              <>
                <label className="player-badge__field">
                  <span className="player-badge__label">Email</span>
                  <input
                    className="player-badge__input player-badge__input--email"
                    type="email"
                    autoComplete="email"
                    value={emailDraft}
                    disabled={authBusy}
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
                  className="player-badge__btn"
                  disabled={authBusy || !emailDraft.trim()}
                  onClick={() => void sendMagicLink()}
                >
                  {authBusy ? 'Sending…' : 'Email me a link'}
                </button>
              </>
            )}
          </>
        )}
        {authNote && <p className="player-badge__auth-note">{authNote}</p>}
        {devVerifyUrl && (
          <p className="player-badge__auth-note">
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
        )}
      </div>
    )

    const settingsSection = (
      <div className="player-badge__settings">
        <p className="player-badge__panel-title player-badge__panel-title--sub">Settings</p>
        <div className="site-drawer__prefs">
          <button
            type="button"
            className="site-drawer__pref"
            onClick={() => {
              toggleTheme()
            }}
          >
            <span className="site-drawer__pref-label">Theme</span>
            <span className="site-drawer__pref-value">
              {themeLabel(theme)}
            </span>
          </button>
          <SoundPackSelect variant="drawer" />
        </div>
        <DevImpersonateControl variant="drawer" />
      </div>
    )

    const panelBody = signedIn ? (
      <>
        {gamerTagSection}
        {authSection}
        {showSettings ? settingsSection : null}
      </>
    ) : (
      <>
        {authSection}
        <div className="player-badge__guest-tag">{gamerTagSection}</div>
        {showSettings ? settingsSection : null}
      </>
    )

    if (embedded) {
      return (
        <div
          className={`player-badge-wrap player-badge-wrap--embedded${className ? ` ${className}` : ''}`}
          ref={rootRef}
        >
          <div className="player-badge__panel player-badge__panel--embedded" role="group">
            {panelBody}
          </div>
        </div>
      )
    }

    return (
      <div className={`player-badge-wrap${className ? ` ${className}` : ''}`} ref={rootRef}>
        <button
          type="button"
          className={triggerClass}
          onClick={startEdit}
          aria-expanded={editing}
          aria-haspopup="dialog"
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          {icon ? (
            signedIn ? (
              AVATARS_ENABLED && displayName ? (
                <PlayerAvatar avatarId={avatarId} name={displayName} size="md" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="8.2"
                    r="3.1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M6.2 18.6c.7-3.2 3-4.8 5.8-4.8s5.1 1.6 5.8 4.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )
            ) : (
              <span className="player-badge__signin-label">Sign in</span>
            )
          ) : displayName ? (
            <>
              {AVATARS_ENABLED ? (
                <PlayerAvatar avatarId={avatarId} name={displayName} size="sm" />
              ) : null}
              <strong className="player-badge__name">{displayName}</strong>
            </>
          ) : (
            'Set gamer tag'
          )}
        </button>

        {editing && (
          <div
            className="player-badge__panel"
            role="dialog"
            aria-label={signedIn ? 'Account' : 'Sign in'}
          >
            {panelBody}
          </div>
        )}
      </div>
    )
  },
)
