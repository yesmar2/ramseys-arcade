import { useId, useState, type CSSProperties } from 'react'
import {
  AVATAR_COLORS,
  AVATAR_SHAPE_LABELS,
  AVATAR_SHAPES,
  avatarColor,
  encodeAvatar,
  randomAvatar,
  resolveAvatar,
  setLocalAvatarId,
  type Avatar,
} from '../lib/avatars'
import { inkOn } from '../lib/color'
import { setPlayerAvatar } from '../lib/leaderboard'
import { Panel, PanelHead } from './Panel'
import { PlayerAvatar } from './PlayerAvatar'

type AvatarStudioProps = {
  name: string
  /** What is saved now, so the studio opens on it. */
  current?: string | null
  onSaved: (avatarId: string) => void
  onClose: () => void
}

/**
 * Pick a character and colour it in. A big preview up top, the cast below it
 * drawn in the colours you've chosen so far, then two rows of swatches: the
 * body and the accent. Save writes it to the tag; the same string paints the
 * mark everywhere the tag appears.
 */
export function AvatarStudio({ name, current, onSaved, onClose }: AvatarStudioProps) {
  const [draft, setDraft] = useState<Avatar>(() => resolveAvatar(current, name))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const encoded = encodeAvatar(draft)
    try {
      const saved = await setPlayerAvatar(name, encoded)
      setLocalAvatarId(name, saved)
      onSaved(saved)
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(
        status === 401 || status === 403 || status === 409
          ? 'Only the owner of this tag can change its avatar — sign in first.'
          : err instanceof Error
            ? err.message
            : 'Could not save your avatar',
      )
      setBusy(false)
    }
  }

  const bodyHex = avatarColor(draft.body)

  // The panel wears the body colour being tried: its button, and the tint on the stage and the cast.
  return (
    <Panel
      wide
      labelledBy={titleId}
      onClose={onClose}
      scrimCloses={!busy}
      style={{ '--studio-accent': bodyHex, '--celeb-accent': bodyHex, '--hero-ink': inkOn(bodyHex) } as CSSProperties}
    >
      <PanelHead titleId={titleId} kicker={`Your avatar · ${name}`} title="Make it yours" onClose={onClose} />
      <div className="panel__body">
        <div className="studio__stage">
          <PlayerAvatar avatar={draft} name={name} size="xl" title="Preview" />
          <button type="button" className="chips__item studio__random" onClick={() => setDraft(randomAvatar())}>
            Surprise me
          </button>
        </div>

        <div className="studio__section">
          <p className="studio__label">Character</p>
          <div className="studio__shapes" role="listbox" aria-label="Character">
            {AVATAR_SHAPES.map((shape) => {
              const on = shape === draft.shape
              return (
                <button
                  key={shape}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`studio__shape${on ? ' studio__shape--on' : ''}`}
                  title={AVATAR_SHAPE_LABELS[shape]}
                  onClick={() => setDraft((d) => ({ ...d, shape }))}
                >
                  <PlayerAvatar avatar={{ ...draft, shape }} name={name} size="lg" title={AVATAR_SHAPE_LABELS[shape]} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="studio__section studio__section--row">
          <div>
            <p className="studio__label">Body</p>
            <Swatches value={draft.body} onPick={(i) => setDraft((d) => ({ ...d, body: i }))} label="Body colour" />
          </div>
          <div>
            <p className="studio__label">Accent</p>
            <Swatches value={draft.accent} onPick={(i) => setDraft((d) => ({ ...d, accent: i }))} label="Accent colour" />
          </div>
        </div>

        {error ? <p className="ev-note ev-note--error">{error}</p> : null}
      </div>

      <div className="panel__actions">
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="panel__btn" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save avatar'}
        </button>
      </div>
    </Panel>
  )
}

function Swatches({ value, onPick, label }: { value: number; onPick: (i: number) => void; label: string }) {
  return (
    <div className="studio__swatches" role="radiogroup" aria-label={label}>
      {AVATAR_COLORS.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={i === value}
          aria-label={c.id}
          className={`studio__swatch${i === value ? ' studio__swatch--on' : ''}`}
          style={{ '--swatch': c.hex } as CSSProperties}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  )
}
