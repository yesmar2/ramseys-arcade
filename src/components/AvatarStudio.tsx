import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { fetchFlair, flairNote, type Flair } from '../lib/avatarFlair'
import { FINISH_IDS, plateTier, PRIZE_KINDS, PRIZES, prizeById, type PrizeKind } from '../data/prizes'
import { prizesHref } from '../hooks/useHashRoute'
import {
  AVATAR_COLORS,
  AVATAR_EMBLEMS,
  avatarWashColor,
  AVATAR_PATTERNS,
  AVATAR_PINS,
  AVATAR_RINGS,
  BADGE_LABELS,
  EMBLEM_LABELS,
  FREE_BADGES,
  isFinishBadge,
  PATTERN_LABELS,
  RING_INFO,
  encodeAvatar,
  monogramText,
  pinInfo,
  randomAvatar,
  resolveAvatar,
  setLocalAvatarId,
  wearPrize,
  wornPrize,
  type Avatar,
  type AvatarBadge,
  type AvatarPin,
  type AvatarRing,
} from '../lib/avatars'
import { inkOn } from '../lib/color'
import { useGlobalRank } from '../lib/globalRank'
import { setPlayerAvatar } from '../lib/leaderboard'
import { useTickets } from '../lib/tickets'
import { LockIcon, SparkleIcon } from './chromeIcons'
import { Panel, PanelHead } from './Panel'
import { AvatarArt } from './PlayerAvatar'
import { PlayerName } from './PlayerName'
import { CardBackdrop, PrizeArt } from './prizes/PrizeArt'
import { SignArt } from './prizes/SignArt'

/** Flair to put on as the studio opens: what a trophy just unlocked. */
export type AvatarWear = { ring?: AvatarRing; pin?: AvatarPin }

type AvatarStudioProps = {
  name: string
  /** What is saved now, so the studio opens on it. */
  current?: string | null
  /** Opens on the flair tab with this already on, ready to save. */
  wear?: AvatarWear | null
  onSaved: (avatarId: string) => void
  onClose: () => void
}

type Tab = 'mark' | 'colour' | 'flair' | 'prizes'

/** What the Prizes tab puts on, in its order: everything from the counter but a finish, which is a badge. */
const WORN_KINDS: Exclude<PrizeKind, 'finish'>[] = ['name', 'title', 'card', 'confetti', 'sign']

const NONE_LABELS: Record<Exclude<PrizeKind, 'finish'>, string> = {
  name: 'Plain',
  title: 'No title',
  card: 'Your colour',
  confetti: 'The usual',
  sign: 'No sign',
}

function Mark({ avatar, name, size, className }: { avatar: Avatar; name: string; size: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <AvatarArt avatar={avatar} name={name} />
    </svg>
  )
}

/**
 * The Prizes tab's preview: your player card, small, as what you wear dresses it. Its theme behind, your
 * badge, your tag in its style (or the neon sign), and your title under it. Most of what the counter
 * sells shows on the card rather than the badge, so the badge alone would show no change.
 */
function CardPreview({ avatar, name }: { avatar: Avatar; name: string }) {
  const theme = wornPrize(avatar, 'card')
  const title = prizeById(wornPrize(avatar, 'title'))
  const sign = wornPrize(avatar, 'sign')
  const confetti = prizeById(wornPrize(avatar, 'confetti'))
  return (
    <div className="studio__card" style={{ '--wash': avatarWashColor(avatar) } as CSSProperties}>
      {theme ? <CardBackdrop className="studio__card-theme" theme={theme} width={320} height={190} /> : null}
      <span className={`studio__card-shade${theme ? ' studio__card-shade--theme' : ''}`} aria-hidden="true" />
      <Mark className="studio__card-badge" avatar={avatar} name={name} size={80} />
      <span className="studio__card-text">
        <span className="studio__card-kicker">Your player card</span>
        {sign ? (
          <SignArt sign={sign} name={name} width={150} wires={false} />
        ) : (
          <PlayerName className="studio__card-name" name={name} style={wornPrize(avatar, 'name')} />
        )}
        {title ? <span className={`prize-plate prize-plate--${plateTier(title)}`}>{title.name}</span> : <span className="studio__card-none">No title</span>}
        {confetti ? <span className="studio__card-note">{confetti.name} confetti when you win</span> : null}
      </span>
    </div>
  )
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
    </svg>
  )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="studio__section">
      <div className="studio__section-head">
        <h3 className="studio__section-title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Make an avatar: the tag's monogram or an emblem, its colours and badge, and
 * a ring and a pin from what the player has earned. The preview up front is
 * what everyone will see; every choice is drawn in the colours picked so far,
 * and anything not yet earned can be tried on but not saved.
 */
export function AvatarStudio({ name, current, wear, onSaved, onClose }: AvatarStudioProps) {
  const saved = useMemo(() => resolveAvatar(current, name), [current, name])
  const [draft, setDraft] = useState<Avatar>(() =>
    wear ? { ...saved, ...(wear.ring ? { ring: wear.ring } : {}), ...(wear.pin ? { pin: wear.pin } : {}) } : saved,
  )
  const [history, setHistory] = useState<Avatar[]>(() => (wear ? [saved] : []))
  const [tab, setTab] = useState<Tab>(wear ? 'flair' : 'mark')
  const [flair, setFlair] = useState<Flair | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const standing = useGlobalRank()
  const tickets = useTickets()
  const owned = useMemo(() => new Set(tickets.owned), [tickets.owned])

  useEffect(() => {
    let live = true
    // Flair just unlocked may still be cached on the server as not earned yet.
    void fetchFlair(name, Boolean(wear)).then((f) => {
      if (live) setFlair(f)
    })
    return () => {
      live = false
    }
  }, [name, wear])

  const go = (next: Avatar) => {
    if (encodeAvatar(next) === encodeAvatar(draft)) return
    setHistory((h) => [...h, draft].slice(-30))
    setDraft(next)
    setError(null)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setDraft(last)
  }
  const common = { body: draft.body, detail: draft.detail, badge: draft.badge, ring: draft.ring, pin: draft.pin }
  const letters = draft.kind === 'mono' ? draft.letters : 1
  const base: Avatar = { ...draft, ring: null, pin: null }

  const ringEarned = (id: AvatarRing) => saved.ring === id || !!flair?.rings.find((r) => r.id === id)?.earned
  const pinEarned = (id: AvatarPin) => saved.pin === id || !!flair?.pins.find((p) => p.id === id)?.earned
  const trying =
    draft.ring && flair && !ringEarned(draft.ring)
      ? { label: RING_INFO[draft.ring].label, rule: RING_INFO[draft.ring].rule, note: flairNote('ring', draft.ring, flair.rings.find((r) => r.id === draft.ring), false) }
      : draft.pin && flair && !pinEarned(draft.pin)
        ? { label: pinInfo(draft.pin).label, rule: pinInfo(draft.pin).rule, note: flairNote('pin', draft.pin, flair.pins.find((p) => p.id === draft.pin), false) }
        : null
  const earnedCount = flair ? flair.rings.filter((r) => r.earned).length + flair.pins.filter((p) => p.earned).length : null
  // A finish from the prize counter can be tried on, but only worn once it's traded for.
  const finishLocked = isFinishBadge(draft.badge) && !owned.has(draft.badge) && saved.badge !== draft.badge
  const lockedFinish = finishLocked ? prizeById(draft.badge) : null
  const blocked = Boolean(trying) || finishLocked
  const prizeCount = PRIZES.filter((p) => p.kind !== 'finish' && owned.has(p.id)).length

  const save = async () => {
    if (busy || blocked) return
    setBusy(true)
    setError(null)
    try {
      const id = await setPlayerAvatar(name, encodeAvatar(draft))
      setLocalAvatarId(name, id)
      onSaved(id)
    } catch (err) {
      const status = (err as { status?: number }).status
      const code = (err as { code?: string }).code
      setError(
        code === 'FLAIR_NOT_EARNED'
          ? 'That ring or pin isn’t yours yet.'
          : code === 'PRIZE_NOT_OWNED'
            ? 'That’s a prize from the counter you haven’t traded for yet.'
            : status === 401 || status === 403 || status === 409
            ? 'Only the owner of this tag can change its avatar. Sign in first.'
            : err instanceof Error
              ? err.message
              : 'Could not save your avatar',
      )
      setBusy(false)
    }
  }

  const body = AVATAR_COLORS[draft.body]?.hex ?? AVATAR_COLORS[0].hex
  const style = { '--studio-accent': body, '--celeb-accent': body, '--hero-ink': inkOn(body, '#10202c') } as CSSProperties
  const tabs: { id: Tab; label: string; count?: number | null }[] = [
    { id: 'mark', label: 'Mark' },
    { id: 'colour', label: 'Colours' },
    { id: 'flair', label: 'Flair', count: earnedCount },
    { id: 'prizes', label: 'Prizes', count: prizeCount || null },
  ]

  const tile = (key: string, avatar: Avatar, label: string, on: boolean, pick: () => void, size = 56) => (
    <button key={key} type="button" className="studio__tile" aria-pressed={on} onClick={pick}>
      <Mark avatar={avatar} name={name} size={size} />
      <span>{label}</span>
    </button>
  )

  const flairItem = (kind: 'ring' | 'pin', id: AvatarRing | AvatarPin | null) => {
    const info = id == null ? { label: 'None', rule: kind === 'ring' ? 'Just the badge' : 'No pin' } : kind === 'ring' ? RING_INFO[id as AvatarRing] : pinInfo(id as AvatarPin)
    const earned = id == null || (kind === 'ring' ? ringEarned(id as AvatarRing) : pinEarned(id as AvatarPin))
    const state = id == null ? undefined : (kind === 'ring' ? flair?.rings : flair?.pins)?.find((s) => s.id === id)
    const note = id == null ? '' : flairNote(kind, id, state, (kind === 'ring' ? saved.ring : saved.pin) === id)
    const avatar: Avatar = kind === 'ring' ? { ...base, ring: id as AvatarRing | null } : { ...base, pin: id as AvatarPin | null }
    const on = (kind === 'ring' ? draft.ring : draft.pin) === id
    const locked = !earned && flair != null
    return (
      <button
        key={`${kind}-${id ?? 'none'}`}
        type="button"
        className={`studio__item${locked ? ' studio__item--locked' : ''}`}
        aria-pressed={on}
        onClick={() => go(kind === 'ring' ? { ...draft, ring: id as AvatarRing | null } : { ...draft, pin: id as AvatarPin | null })}
      >
        <Mark className="studio__item-art" avatar={avatar} name={name} size={52} />
        <span className="studio__item-text">
          <span className="studio__item-name">{info.label}</span>
          <span className="studio__item-rule">{info.rule}</span>
          {note ? <span className={`studio__item-note${earned ? ' studio__item-note--yours' : ''}`}>{note}</span> : null}
        </span>
        {locked ? (
          <span className="studio__item-lock" aria-label="Not earned yet">
            <LockIcon />
          </span>
        ) : null}
      </button>
    )
  }

  // A badge finish: yours to pick if you've traded for it, otherwise tried on with its price and a lock.
  const finishTile = (b: AvatarBadge) => {
    const mine = owned.has(b) || saved.badge === b
    const prize = prizeById(b)
    return (
      <button
        key={b}
        type="button"
        className={`studio__tile${mine ? '' : ' studio__tile--locked'}`}
        aria-pressed={draft.badge === b}
        aria-label={
          mine
            ? BADGE_LABELS[b]
            : prize?.earned
              ? `${BADGE_LABELS[b]}: ${prize.earned.by.toLowerCase()} earns it`
              : `${BADGE_LABELS[b]}, ${prize?.price.toLocaleString()} tickets at the prize counter`
        }
        onClick={() => go({ ...draft, badge: b })}
      >
        <Mark avatar={{ ...base, badge: b }} name={name} size={56} />
        <span>{mine ? BADGE_LABELS[b] : prize?.earned ? prize.earned.short : `${prize?.price.toLocaleString()}`}</span>
        {mine ? null : (
          <span className="studio__tile-lock" aria-hidden="true">
            <LockIcon />
          </span>
        )}
      </button>
    )
  }

  // What the Prizes tab offers for one kind: none, then the ones you own.
  const wornItem = (kind: Exclude<PrizeKind, 'finish'>, id: string | null) => {
    const prize = id ? prizeById(id) : null
    const on = wornPrize(draft, kind) === id
    const preview = wearPrize({ ...base }, kind, id)
    return (
      <button key={`${kind}-${id ?? 'none'}`} type="button" className="studio__item" aria-pressed={on} onClick={() => go(wearPrize(draft, kind, id))}>
        {prize ? (
          <PrizeArt className="studio__item-art" prize={prize} avatar={preview} name={name} width={64} />
        ) : (
          <Mark className="studio__item-art" avatar={preview} name={name} size={52} />
        )}
        <span className="studio__item-text">
          <span className="studio__item-name">
            {prize?.kind === 'name' ? <PlayerName name={prize.name} style={prize.id} /> : (prize?.name ?? NONE_LABELS[kind])}
          </span>
          <span className="studio__item-rule">{prize ? prize.blurb : 'Nothing from the counter'}</span>
        </span>
      </button>
    )
  }

  const swatches = (key: 'body' | 'detail', label: string) => (
    <div className="studio__swatches" role="radiogroup" aria-label={label}>
      {AVATAR_COLORS.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={draft[key] === i}
          aria-label={c.label}
          title={c.label}
          className="studio__swatch"
          style={{ '--swatch': c.hex } as CSSProperties}
          onClick={() => go(key === 'body' ? { ...draft, body: i } : { ...draft, detail: i })}
        />
      ))}
    </div>
  )

  return (
    <Panel wide className="studio" labelledBy={titleId} onClose={onClose} scrimCloses={!busy} style={style}>
      <PanelHead titleId={titleId} kicker={`Your avatar · ${name}`} title="Make it yours" onClose={onClose} />
      <div className="panel__body studio__body">
        <div className="studio__side">
          <div className={`studio__stage${tab === 'prizes' ? ' studio__stage--card' : ''}`}>
            {tab === 'prizes' ? <CardPreview avatar={draft} name={name} /> : <Mark className="studio__preview" avatar={draft} name={name} size={200} />}
            <div className="studio__tools">
              <button type="button" className="studio__tool" onClick={() => go({ ...randomAvatar(draft), ...(draft.worn ? { worn: draft.worn } : {}) })}>
                <DiceIcon />
                <span>Shuffle</span>
              </button>
              <button type="button" className="studio__tool" onClick={undo} disabled={!history.length}>
                <UndoIcon />
                <span>Undo</span>
              </button>
            </div>
          </div>
          <div className="studio__where">
            <p className="studio__label">Where you’ll show up</p>
            <div className="studio__row">
              {standing.rank != null ? <span className="studio__row-rank">{standing.rank}</span> : null}
              <Mark avatar={draft} name={name} size={28} />
              <PlayerName className="studio__row-name" name={name} style={wornPrize(draft, 'name')} />
              {standing.rank != null ? <span className="studio__row-pts">{standing.score.toLocaleString()} pts</span> : null}
            </div>
            <div className="studio__where-more">
              <span className="studio__chip">
                <Mark avatar={draft} name={name} size={30} />
                <span>{name}</span>
              </span>
              <span className="studio__tabicon">
                <span>
                  <Mark avatar={draft} name={name} size={22} />
                </span>
                You
              </span>
            </div>
          </div>
        </div>

        <div className="studio__main">
          <div className="studio__tabs" role="tablist" aria-label="What to change">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="studio__tab" onClick={() => setTab(t.id)}>
                {t.label}
                {t.count ? <span className="studio__count">{t.count}</span> : null}
              </button>
            ))}
          </div>

          <div className="studio__pane" role="tabpanel">
            {tab === 'mark' ? (
              <>
                <Section
                  title="Your tag"
                  aside={
                    name.length > 1 ? (
                      <div className="studio__letters" role="group" aria-label="Letters">
                        {([1, 2] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={draft.kind === 'mono' && draft.letters === n}
                            onClick={() => go({ kind: 'mono', letters: n, pattern: draft.kind === 'mono' ? draft.pattern : 'plain', ...common })}
                          >
                            {monogramText(name, n)}
                          </button>
                        ))}
                      </div>
                    ) : null
                  }
                >
                  <div className="studio__grid">
                    {AVATAR_PATTERNS.map((p) =>
                      tile(
                        p,
                        { kind: 'mono', letters, pattern: p, ...common, ring: null, pin: null },
                        PATTERN_LABELS[p],
                        draft.kind === 'mono' && draft.pattern === p,
                        () => go({ kind: 'mono', letters, pattern: p, ...common }),
                      ),
                    )}
                  </div>
                </Section>
                <Section title="Or an emblem" aside={<span className="studio__aside">Drawn bold so it holds up in a board row</span>}>
                  <div className="studio__grid">
                    {AVATAR_EMBLEMS.map((e) =>
                      tile(
                        e,
                        { kind: 'emblem', emblem: e, ...common, ring: null, pin: null },
                        EMBLEM_LABELS[e],
                        draft.kind === 'emblem' && draft.emblem === e,
                        () => go({ kind: 'emblem', emblem: e, ...common }),
                      ),
                    )}
                  </div>
                </Section>
              </>
            ) : null}

            {tab === 'colour' ? (
              <>
                <Section title={`Colour · ${AVATAR_COLORS[draft.body]?.label ?? ''}`} aside={<span className="studio__aside">Your card and your stats wear it</span>}>
                  {swatches('body', 'Colour')}
                </Section>
                <Section
                  title={`Detail · ${AVATAR_COLORS[draft.detail]?.label ?? ''}`}
                  aside={<span className="studio__aside">{draft.kind === 'mono' ? 'The line under your letter' : 'The emblem’s second colour'}</span>}
                >
                  {swatches('detail', 'Detail colour')}
                </Section>
                <Section title="Badge" aside={<span className="studio__aside">The round it sits on</span>}>
                  <div className="studio__grid studio__grid--four">
                    {FREE_BADGES.map((b) => tile(b, { ...base, badge: b }, BADGE_LABELS[b], draft.badge === b, () => go({ ...draft, badge: b })))}
                  </div>
                </Section>
                <Section
                  title="Finishes"
                  aside={
                    <a className="studio__aside studio__aside--link" href={prizesHref()}>
                      From the prize counter ›
                    </a>
                  }
                >
                  <div className="studio__grid studio__grid--four">{FINISH_IDS.map((b) => finishTile(b as AvatarBadge))}</div>
                </Section>
              </>
            ) : null}

            {tab === 'prizes' ? (
              prizeCount === 0 ? (
                <div className="studio__prizes-empty">
                  <p>
                    Name styles, titles, card themes and confetti come from the prize counter, for the tickets every run pays. What you
                    trade for goes on here.
                  </p>
                  <a className="panel__btn" href={prizesHref()}>
                    Go to the prize counter
                  </a>
                </div>
              ) : (
                <>
                  {WORN_KINDS.map((kind) => {
                    const mine = PRIZES.filter((p) => p.kind === kind && owned.has(p.id))
                    if (!mine.length) return null
                    return (
                      <Section key={kind} title={PRIZE_KINDS[kind].one}>
                        <div className="studio__flair">{[null, ...mine.map((p) => p.id)].map((id) => wornItem(kind, id))}</div>
                      </Section>
                    )
                  })}
                  <a className="studio__aside studio__aside--link" href={prizesHref()}>
                    More at the prize counter ›
                  </a>
                </>
              )
            ) : null}

            {tab === 'flair' ? (
              <>
                {flair == null ? <p className="studio__aside">Checking what you’ve earned…</p> : null}
                <Section title="Rings" aside={<span className="studio__aside">Around your badge, for how you’ve placed</span>}>
                  <div className="studio__flair">{[null, ...AVATAR_RINGS].map((r) => flairItem('ring', r))}</div>
                </Section>
                <Section title="Pins" aside={<span className="studio__aside">On its edge, for what you’ve done</span>}>
                  <div className="studio__flair">{[null, ...AVATAR_PINS].map((p) => flairItem('pin', p))}</div>
                </Section>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel__actions studio__actions">
        {error ? (
          <p className="studio__note studio__note--error" role="alert">
            {error}
          </p>
        ) : trying ? (
          <p className="studio__note studio__note--trying">
            <LockIcon />
            <span>
              <b>Trying on {trying.label}.</b> {trying.rule} to wear it.{trying.note ? ` ${trying.note}.` : ''}
            </span>
          </p>
        ) : lockedFinish ? (
          <p className="studio__note studio__note--trying">
            <LockIcon />
            <span>
              <b>Trying on {lockedFinish.name}.</b> Trade {lockedFinish.price.toLocaleString()} tickets for it at the{' '}
              <a href={prizesHref()}>prize counter</a> to wear it.
            </span>
          </p>
        ) : tab === 'prizes' ? (
          <p className="studio__note">
            <SparkleIcon />
            <span>What you’ve traded tickets for at the prize counter, to put on. It shows on your player card and the boards.</span>
          </p>
        ) : (
          <p className="studio__note">
            <SparkleIcon />
            <span>Rings and pins are earned in play. Nobody can buy one.</span>
          </p>
        )}
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="panel__btn" disabled={busy || blocked} onClick={() => void save()}>
          {busy ? 'Saving…' : trying ? 'Earn it to wear it' : finishLocked ? 'Trade for it to wear it' : 'Save avatar'}
        </button>
      </div>
    </Panel>
  )
}
