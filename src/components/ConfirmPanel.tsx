import { useCallback, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Panel, PanelHead } from './Panel'

export type ConfirmAsk = {
  title: string
  /** What it costs, in a sentence. */
  body?: ReactNode
  /** The button that goes ahead, named for what it does: "Leave group", not "OK". */
  confirm: string
  cancel?: string
  /** Deleting or taking something away: the answer is red. */
  destructive?: boolean
}

/**
 * A question in the panel kit, in place of the browser's own grey box:
 * `await ask({ … })` resolves true when the answer is yes. Render the
 * returned node somewhere in the page; it is empty until a question is open.
 * Focus starts on the way out, so a stray Enter never goes ahead.
 */
export function useConfirm(style?: CSSProperties): [(ask: ConfirmAsk) => Promise<boolean>, ReactNode] {
  const [open, setOpen] = useState<(ConfirmAsk & { resolve: (yes: boolean) => void }) | null>(null)
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback((q: ConfirmAsk) => new Promise<boolean>((resolve) => setOpen({ ...q, resolve })), [])

  const answer = (yes: boolean) => {
    open?.resolve(yes)
    setOpen(null)
  }

  const node = open ? (
    <Panel
      alert
      labelledBy={titleId}
      describedBy={open.body ? bodyId : undefined}
      onClose={() => answer(false)}
      initialFocus={cancelRef}
      style={style}
    >
      <PanelHead titleId={titleId} title={open.title} onClose={() => answer(false)} closeLabel={open.cancel ?? 'Cancel'} />
      {open.body ? (
        <div className="panel__body">
          <p id={bodyId} className="panel__text">
            {open.body}
          </p>
        </div>
      ) : null}
      <div className="panel__actions">
        <button ref={cancelRef} type="button" className="panel__btn panel__btn--ghost" onClick={() => answer(false)}>
          {open.cancel ?? 'Cancel'}
        </button>
        <button
          type="button"
          className={`panel__btn${open.destructive ? ' panel__btn--destroy' : ''}`}
          onClick={() => answer(true)}
        >
          {open.confirm}
        </button>
      </div>
    </Panel>
  ) : null

  return [ask, node]
}
