import { useEffect, useRef, useState } from 'react'
import { loadDayCourse, type DayCourse } from '../lib/dayBoard'

/*
 * What a daily's board on one past day is drawn from (components/DayBoard.tsx): the game's courses, and
 * boards read a page at a time, as far down as the page has been asked to show.
 */

/** A daily's courses (lib/dayBoard.ts): null while they load; `failed` when they couldn't. */
export function useDayCourse(slug: string): { course: DayCourse | null; failed: boolean } {
  const [answer, setAnswer] = useState<{ slug: string; course: DayCourse | null; failed: boolean }>({ slug, course: null, failed: false })
  useEffect(() => {
    let live = true
    loadDayCourse(slug)
      .then((course) => {
        if (live) setAnswer({ slug, course, failed: false })
      })
      .catch(() => {
        if (live) setAnswer({ slug, course: null, failed: true })
      })
    return () => {
      live = false
    }
  }, [slug])
  return answer.slug === slug ? answer : { course: null, failed: false }
}

/** One page of a board: its rows, how many are on it in all, and what the first page says about the rest. */
export type BoardPageOf<R, M> = { rows: R[]; total: number; meta: M }

export type PagedBoard<R, M> = {
  rows: R[]
  total: number
  /** The first page's word on the board (you, whether it counted): null until it comes. */
  meta: M | null
  /** The first page is on its way. */
  loading: boolean
  /** A page further down is on its way. */
  more: boolean
  /** Why the first page didn't come, or a later one. */
  error: unknown
  retry: () => void
}

/** Rows asked for at a time: more than the page first shows, so the first Show more has them already. */
const PAGE = 50

type Kept<R, M> = { key: string; rows: R[]; total: number; meta: M | null; error: unknown }

/**
 * A board read a page at a time, `want` rows down (or all of it, if it has fewer). `key` names the board
 * and who's asking: a new key starts over; null asks for nothing.
 */
export function usePagedBoard<R, M>(
  key: string | null,
  fetchPage: (offset: number, limit: number) => Promise<BoardPageOf<R, M>>,
  want: number,
): PagedBoard<R, M> {
  const [kept, setKept] = useState<Kept<R, M> | null>(null)
  const [asks, setAsks] = useState(0)
  const [more, setMore] = useState(false)
  // The latest way to ask: the key says when the board changes, not the function's identity.
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  // The page further down being asked for, so a render while it's on its way doesn't ask twice.
  const asking = useRef<string | null>(null)

  // The first page: again for a new key, or when asked to try again. How far down is the next effect's.
  useEffect(() => {
    if (key == null) return
    let live = true
    setKept(null)
    fetchRef
      .current(0, PAGE)
      .then((page) => {
        if (live) setKept({ key, rows: page.rows, total: page.total, meta: page.meta, error: null })
      })
      .catch((error: unknown) => {
        if (live) setKept({ key, rows: [], total: 0, meta: null, error })
      })
    return () => {
      live = false
    }
  }, [key, asks])

  const current = kept?.key === key ? kept : null
  const have = current?.rows.length ?? 0
  const need = current && current.meta != null ? Math.min(want, current.total) : 0

  useEffect(() => {
    if (!current || current.error || have >= need) return
    const ask = `${current.key}|${have}`
    if (asking.current === ask) return
    asking.current = ask
    setMore(true)
    const from = have
    fetchRef
      .current(from, Math.max(PAGE, need - from))
      .then((page) => {
        // Only onto the rows it follows: a board asked again since starts from its own first page.
        setKept((prev) =>
          prev && prev.key === current.key && prev.rows.length === from ? { ...prev, rows: [...prev.rows, ...page.rows], total: page.total } : prev,
        )
      })
      .catch((error: unknown) => {
        setKept((prev) => (prev && prev.key === current.key ? { ...prev, error } : prev))
      })
      .finally(() => {
        if (asking.current !== ask) return
        asking.current = null
        setMore(false)
      })
  }, [current, have, need])

  const retry = () => {
    // A later page that didn't come is asked again from where the rows stop; a first page, from the top.
    if (current && current.meta != null && current.error) setKept({ ...current, error: null })
    else setAsks((n) => n + 1)
  }

  return {
    rows: current?.rows ?? [],
    total: current?.total ?? 0,
    meta: current?.meta ?? null,
    loading: key != null && (!current || (current.meta == null && !current.error)),
    more: more && current != null,
    error: current?.error ?? null,
    retry,
  }
}
