import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/leaderboard'
import type { PollQuestion } from '../lib/poll'

/*
 * Blip's questions on /admin: today's and the ones to come, as planned (the API's pollPlan.ts) or as changed here.
 * Any of them can be edited for its day, or put back to the plan's. One to come can move a day sooner or later, or
 * come out, and each after it then comes a day sooner (Ramsey, 2026-10-30: "can you add ability to reorder
 * questions and delete them in admin?"). Today's stays where it is, and a past day's can't change: their answers are in.
 */

const DAYS = 30

const dayWords = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

/** `total`: how many questions there are before they come round again (an API from before moving them says none). */
type List = { today: number; total?: number; polls: PollQuestion[] }

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
  const [count, setCount] = useState(DAYS)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(false)
    api<List>(`/poll/admin?count=${count}`)
      .then(setList)
      .catch(() => setError(true))
  }, [count])

  useEffect(load, [load])

  /** A question to come, a day sooner or later, or out: the API answers with the list as it now stands. */
  const change = async (poll: PollQuestion, action: 'sooner' | 'later' | 'remove') => {
    if (busy) return
    if (action === 'remove' && !window.confirm(`Delete “${poll.q}”? Blip won’t ask it again, and each question after it comes a day sooner.`)) return
    setBusy(true)
    setNote(null)
    setEditing(null)
    try {
      const next = await api<List>(`/poll/admin/${poll.n}/${action === 'remove' ? 'remove' : 'move'}`, {
        method: 'POST',
        body: JSON.stringify(action === 'remove' ? { count } : { by: action === 'sooner' ? -1 : 1, count }),
      })
      setList(next)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Couldn’t change it')
    } finally {
      setBusy(false)
    }
  }

  const total = list?.total ?? null
  const last = list && total != null ? list.today + total - 1 : null

  return (
    <section className="adm-card" aria-labelledby="adm-polls">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-polls">
          Blip’s questions
        </h2>
      </div>
      <p className="adm-card__sub">
        Today’s question and the ones to come. Move one a day sooner or later, or delete it, and each question after it
        comes a day sooner; today’s stays put, since its answers may be in. Edit any of them for its day, and an edited one
        can go back to the plan’s. Signed-in players answer once, for 5 tickets.
      </p>
      {note ? <p className="adm-note">{note}</p> : null}
      {error ? (
        <p className="adm-note">Couldn’t load the questions.</p>
      ) : !list ? (
        <p className="adm-note">Loading…</p>
      ) : (
        <>
          <ul className="adm-list">
            {/* A round at most: past it the questions come round again, as the ones above. */}
            {list.polls.filter((poll) => last == null || poll.n <= last).map((poll) => {
              // A question to come can move or come out; today's can't.
              const coming = last != null && poll.n > list.today
              return (
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
                      {coming ? (
                        <>
                          <button
                            type="button"
                            className="panel__btn panel__btn--ghost adm-small"
                            disabled={busy || poll.n === list.today + 1}
                            aria-label={`Move “${poll.q}” a day sooner`}
                            title="A day sooner"
                            onClick={() => void change(poll, 'sooner')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="panel__btn panel__btn--ghost adm-small"
                            disabled={busy || poll.n === last}
                            aria-label={`Move “${poll.q}” a day later`}
                            title="A day later"
                            onClick={() => void change(poll, 'later')}
                          >
                            ↓
                          </button>
                        </>
                      ) : null}
                      <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={busy} onClick={() => setEditing(poll.n)}>
                        Edit
                      </button>
                      {coming ? (
                        <button
                          type="button"
                          className="panel__btn panel__btn--ghost adm-small"
                          disabled={busy}
                          onClick={() => void change(poll, 'remove')}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {total != null && count < Math.min(total, 120) ? (
            <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={() => setCount(Math.min(total, 120))}>
              Show all {total}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}
