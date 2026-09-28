import { useEffect, useState } from 'react'
import { PageShell } from '../components/PageShell'
import { PushToggle } from '../components/PushToggle'
import { openSiteMenu } from '../components/siteNav'
import { useAuth } from '../hooks/useAuth'
import {
  fetchNotificationLevels,
  saveNotificationLevels,
  TOPIC_GROUPS,
  type NotificationLevel,
  type NotificationLevels,
  type NotificationTopic,
  type TopicInfo,
} from '../lib/notificationSettings'
import type { PushStatus } from '../lib/push'
import '../styles/notifSettings.css'

const CHOICES: readonly { level: NotificationLevel; label: string }[] = [
  { level: 'off', label: 'Off' },
  { level: 'inbox', label: 'Inbox' },
  { level: 'push', label: 'Push' },
]

/**
 * Notifications: what tells you, and how. Each kind of note is off, waits in the inbox, or is pushed to
 * your devices as well (lib/notificationSettings.ts). Push is offered only once the arcade can send it;
 * until then a kind set to push shows as the inbox, which is where it lands. Each change saves as it's made.
 */
export function NotificationSettingsPage() {
  const { signedIn, loading: authLoading } = useAuth()
  const [levels, setLevels] = useState<NotificationLevels | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  /** What the server says about push: undefined until it answers, null when it couldn't. */
  const [push, setPush] = useState<PushStatus | null | undefined>(undefined)
  const [saving, setSaving] = useState(0)
  const [saved, setSaved] = useState<'saved' | 'error' | null>(null)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    setFailed(false)
    fetchNotificationLevels()
      .then((next) => {
        if (!cancelled) setLevels(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, attempt])

  const canPush = Boolean(push?.available)

  const choose = (topic: NotificationTopic, level: NotificationLevel) => {
    const before = levels?.[topic]
    if (!before || before === level) return
    setLevels((now) => (now ? { ...now, [topic]: level } : now))
    setSaving((n) => n + 1)
    saveNotificationLevels({ [topic]: level })
      .then(() => setSaved('saved'))
      .catch(() => {
        // Put back what the server still has, unless another change to it has come since.
        setLevels((now) => (now && now[topic] === level ? { ...now, [topic]: before } : now))
        setSaved('error')
      })
      .finally(() => setSaving((n) => n - 1))
  }

  const ready = signedIn && levels != null && push !== undefined

  return (
    <PageShell innerClassName="lb-page__inner">
      <div className="ns">
        <header className="ns-head">
          <h1 className="ns-head__title">Notifications</h1>
          <p className="ns-head__lede">
            {canPush
              ? 'Pick what lands in your inbox, and what your phone gets as well.'
              : 'Pick what lands in your inbox.'}
          </p>
          {signedIn ? (
            <p className={`ns-head__status${saved === 'error' && !saving ? ' ns-head__status--err' : ''}`} aria-live="polite">
              {saving
                ? 'Saving…'
                : saved === 'saved'
                  ? 'Saved'
                  : saved === 'error'
                    ? 'That change didn’t save. Check your connection and try again.'
                    : 'Changes save as you make them.'}
            </p>
          ) : null}
        </header>

        {authLoading ? (
          <Loading />
        ) : !signedIn ? (
          <section className="ns-card ns-invite">
            <h2 className="ns-invite__title">Choose what tells you</h2>
            <p className="ns-invite__copy">
              Sign in to choose, kind by kind, which notifications you get and where they show up.
            </p>
            <button type="button" className="ns-invite__go" onClick={openSiteMenu}>
              Sign in
            </button>
          </section>
        ) : (
          <>
            <PushToggle where="settings" onStatus={setPush} />
            {failed ? (
              <section className="ns-card ns-invite">
                <h2 className="ns-invite__title">Your settings didn’t load</h2>
                <p className="ns-invite__copy">Check your connection and try again in a moment.</p>
                <button type="button" className="ns-invite__go" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </button>
              </section>
            ) : !ready ? (
              <Loading />
            ) : (
              <>
                <ul className={`ns-key${canPush ? '' : ' ns-key--two'}`} aria-label="What each choice means">
                  <li>
                    <b>Off</b> You won’t be told.
                  </li>
                  <li>
                    <b>Inbox</b> It waits for you under the bell.
                  </li>
                  {canPush ? (
                    <li>
                      <b>Push</b> Your inbox, and your phone or computer too, wherever alerts are on.
                    </li>
                  ) : null}
                </ul>
                {TOPIC_GROUPS.map((group, i) => (
                  <section className="ns-card" key={group.title} aria-labelledby={`ns-group-${i}`}>
                    <h2 className="ns-card__cap" id={`ns-group-${i}`}>
                      {group.title}
                    </h2>
                    <ul className="ns-list">
                      {group.topics.map((info) => (
                        <TopicRow key={info.topic} info={info} level={levels[info.topic]} canPush={canPush} onChoose={choose} />
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  )
}

function TopicRow({
  info,
  level,
  canPush,
  onChoose,
}: {
  info: TopicInfo
  level: NotificationLevel
  canPush: boolean
  onChoose: (topic: NotificationTopic, level: NotificationLevel) => void
}) {
  // With no push to send, a kind set to push still lands in the inbox, so that's what it shows.
  const shown = !canPush && level === 'push' ? 'inbox' : level
  const choices = canPush ? CHOICES : CHOICES.filter((c) => c.level !== 'push')
  return (
    <li className={`ns-row${shown === 'off' ? ' ns-row--off' : ''}`}>
      <span className="ns-row__text">
        <span className="ns-row__label">{info.label}</span>
        <span className="ns-row__hint">{info.hint}</span>
        {shown === 'off' && info.offWarning ? <span className="ns-row__warn">{info.offWarning}</span> : null}
      </span>
      <span className={`site-seg ns-seg${canPush ? '' : ' ns-seg--two'}`} role="group" aria-label={info.label}>
        {choices.map((choice) => (
          <button
            key={choice.level}
            type="button"
            data-level={choice.level}
            aria-pressed={shown === choice.level}
            onClick={() => {
              if (shown !== choice.level) onChoose(info.topic, choice.level)
            }}
          >
            {choice.label}
          </button>
        ))}
      </span>
    </li>
  )
}

function Loading() {
  return (
    <div className="ns-loading" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}
