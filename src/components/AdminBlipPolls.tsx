import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/leaderboard'
import type { PollQuestion } from '../lib/poll'

/*
 * Blip's questions on /admin: today's and the two weeks after, as planned (the API's pollPlan.ts) or as edited
 * here. Any of them can be edited for its day, or put back to the plan's; a past day's can't, its answers are in.
 */

const DAYS = 14

const dayWords = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

type List = { today: number; polls: PollQuestion[] }

function Editor({ poll, onDone }: { poll: PollQuestion; onDone: (next: PollQuestion | null) => void }) {
  const [q, setQ] = useState(poll.q)
  const [options, setOptions] = useState(() => [...poll.options, '', '', ''].slice(0, 4))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const answers = options.map((o) => o.trim()).filter(Boolean)
    if (busy || q.trim().length < 3 || answers.length < 2) {
      setError('A question and at least two answers')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { poll: saved } = await api<{ poll: PollQuestion }>(`/poll/admin/${poll.n}`, {
        method: 'PUT',
        body: JSON.stringify({ q: q.trim(), options: answers }),
      })
      onDone(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save it')
      setBusy(false)
    }
  }

  const reset = async () => {
    setBusy(true)
    setError(null)
    try {
      const { poll: back } = await api<{ poll: PollQuestion }>(`/poll/admin/${poll.n}`, { method: 'DELETE' })
      onDone(back)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t put it back')
      setBusy(false)
    }
  }

  return (
    <form className="adm-form adm-poll-edit" onSubmit={(event) => void save(event)}>
      <input className="panel__input adm-input" value={q} maxLength={90} aria-label="Question" onChange={(e) => setQ(e.target.value)} />
      {options.map((option, i) => (
        <input
          key={i}
          className="panel__input adm-input"
          value={option}
          maxLength={24}
          placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`}
          aria-label={`Answer ${i + 1}`}
          onChange={(e) => setOptions((all) => all.map((o, j) => (j === i ? e.target.value : o)))}
        />
      ))}
      <div className="adm-row__acts">
        <button type="submit" className="panel__btn adm-small" disabled={busy}>
          Save
        </button>
        <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={busy} onClick={() => onDone(null)}>
          Cancel
        </button>
        {poll.edited ? (
          <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={busy} onClick={() => void reset()}>
            Back to the plan’s
          </button>
        ) : null}
      </div>
      {error ? <p className="adm-note">{error}</p> : null}
    </form>
  )
}

export function AdminBlipPolls() {
  const [list, setList] = useState<List | null>(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const load = useCallback(() => {
    setError(false)
    api<List>(`/poll/admin?count=${DAYS}`)
      .then(setList)
      .catch(() => setError(true))
  }, [])

  useEffect(load, [load])

  return (
    <section className="adm-card" aria-labelledby="adm-polls">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-polls">
          Blip’s questions
        </h2>
      </div>
      <p className="adm-card__sub">
        Today’s question and the two weeks after it, as planned or as edited here. Edit any of them for its day; signed-in
        players answer once, for 5 tickets. A question that’s been edited can go back to the plan’s.
      </p>
      {error ? (
        <p className="adm-note">Couldn’t load the questions.</p>
      ) : !list ? (
        <p className="adm-note">Loading…</p>
      ) : (
        <ul className="adm-list">
          {list.polls.map((poll) => (
            <li key={poll.n} className="adm-row adm-row--stack">
              <div className="adm-row__main">
                <b className="adm-row__title">
                  {poll.n === list.today ? 'Today' : dayWords.format(new Date(`${poll.day}T12:00:00Z`))} · #{poll.n} · {poll.q}
                  {poll.edited ? ' (edited)' : ''}
                </b>
                <span className="adm-row__sub">{poll.options.join(' · ')}</span>
              </div>
              {editing === poll.n ? (
                <Editor
                  poll={poll}
                  onDone={(next) => {
                    setEditing(null)
                    if (next) setList((l) => (l ? { ...l, polls: l.polls.map((p) => (p.n === next.n ? next : p)) } : l))
                  }}
                />
              ) : (
                <div className="adm-row__acts">
                  <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={() => setEditing(poll.n)}>
                    Edit
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
