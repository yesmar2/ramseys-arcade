import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A board you can read all the way down.
 *
 * Boards keep every score, so they no longer stop at a hundred rows — which
 * means a page can no longer hold the whole thing in one fetch and reveal it
 * behind a button. This does both halves: a first page on load, ten rows on
 * screen, and more of both as the reader reaches the bottom.
 *
 * Revealing and fetching are deliberately separate. Rows already in hand cost
 * nothing to show, so scrolling stays smooth through the page you have; only
 * running out of those asks the server for the next one.
 */

/** Rows per request. Large enough that most readers never trigger a second. */
export const PAGE_SIZE = 100

/** Rows on screen before anyone scrolls. */
const INITIAL_ROWS = 10

/** Rows revealed each time the bottom comes into view. */
const REVEAL_STEP = 25

/** Start revealing this far before the reader actually hits the end. */
const LOOKAHEAD_PX = 400

/** Shortest gap between two looks at where the foot is. */
const THROTTLE_MS = 80

export type BoardPage<T> = {
  entries: T[]
  /** Rows that exist, loaded or not. Absent on older API builds. */
  total?: number
}

export type PagedBoard<T, R> = {
  /** Every row fetched so far, in order. */
  entries: T[]
  /** How many of those to render. */
  shown: number
  /** The first page's whole response, for what travels beside the rows. */
  first: R | null
  total: number
  loading: boolean
  /** A further page is in flight — the rows on screen are still good. */
  loadingMore: boolean
  error: string | null
  /** Attach to an element after the last row. */
  sentinelRef: (node: HTMLElement | null) => void
  /** Manual fallback for the reveal, and for anyone not scrolling. */
  showMore: () => void
  /** True while there is anything left to show or fetch. */
  hasMore: boolean
}

export function usePagedBoard<T, R extends BoardPage<T>>(
  fetchPage: (offset: number, limit: number) => Promise<R>,
  deps: unknown[],
  opts: { initial?: number; step?: number; pageSize?: number } = {},
): PagedBoard<T, R> {
  const initial = opts.initial ?? INITIAL_ROWS
  const step = opts.step ?? REVEAL_STEP
  const pageSize = opts.pageSize ?? PAGE_SIZE

  const [entries, setEntries] = useState<T[]>([])
  const [first, setFirst] = useState<R | null>(null)
  const [total, setTotal] = useState(0)
  const [shown, setShown] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The fetcher closes over render-scoped values, so it is read through a ref
  // rather than listed as a dependency — `deps` is what says when to refetch.
  const fetcherRef = useRef(fetchPage)
  fetcherRef.current = fetchPage

  // Guards a page request against a second sentinel hit arriving mid-flight.
  const inFlight = useRef(false)
  // Bumped on every reset, so a slow reply from the last board is dropped.
  const runRef = useRef(0)

  useEffect(() => {
    const run = ++runRef.current
    inFlight.current = true
    setLoading(true)
    setError(null)
    setEntries([])
    setFirst(null)
    setTotal(0)
    setShown(initial)

    fetcherRef
      .current(0, pageSize)
      .then((page) => {
        if (run !== runRef.current) return
        setEntries(page.entries)
        setFirst(page)
        setTotal(page.total ?? page.entries.length)
      })
      .catch((err: unknown) => {
        if (run !== runRef.current) return
        setEntries([])
        setFirst(null)
        setTotal(0)
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (run !== runRef.current) return
        inFlight.current = false
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const loadMore = useCallback(() => {
    if (inFlight.current) return
    const run = runRef.current
    const offset = entries.length
    if (offset >= total) return
    inFlight.current = true
    setLoadingMore(true)
    fetcherRef
      .current(offset, pageSize)
      .then((page) => {
        if (run !== runRef.current) return
        // Offset paging can double up if a score lands between requests;
        // ordering is stable, so dropping what we already hold is enough.
        setEntries((prev) => [...prev, ...page.entries.slice(Math.max(0, prev.length - offset))])
        setTotal(page.total ?? offset + page.entries.length)
      })
      .catch(() => {
        // A failed page leaves the rows already on screen alone: the reader
        // can try again by scrolling, and nothing they were reading moves.
      })
      .finally(() => {
        if (run !== runRef.current) return
        inFlight.current = false
        setLoadingMore(false)
      })
  }, [entries.length, total, pageSize])

  const advance = useCallback(() => {
    if (shown < entries.length) {
      setShown((n) => Math.min(entries.length, n + step))
      return
    }
    if (entries.length < total) loadMore()
  }, [shown, entries.length, total, step, loadMore])

  /*
   * Reveal on scroll.
   *
   * This measures the sentinel rather than observing it. An
   * IntersectionObserver is the tidier tool, but it only reports inside the
   * frame loop, so anywhere that loop is throttled — a background tab, a
   * window behind another one — the board silently stops growing. A rect
   * check on a passive scroll listener costs one measurement per event and
   * works everywhere.
   *
   * It self-gates: a step pushes the sentinel a screen or so further down,
   * back out of reach, so a fast scroll advances once per landing rather
   * than unspooling the whole board.
   */
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  useEffect(() => {
    if (!sentinel) return
    let last = 0
    let timer = 0

    const check = () => {
      last = Date.now()
      const box = sentinel.getBoundingClientRect()
      if (box.top <= window.innerHeight + LOOKAHEAD_PX) advanceRef.current()
    }
    // Throttled on a clock rather than a frame: the frame loop is exactly
    // what goes missing in the cases this fallback exists for.
    const onScroll = () => {
      const wait = THROTTLE_MS - (Date.now() - last)
      if (wait <= 0) {
        check()
        return
      }
      if (!timer) {
        timer = window.setTimeout(() => {
          timer = 0
          check()
        }, wait)
      }
    }

    // The first look is immediate: a short board can have its foot on screen
    // from the start, with no scroll coming to trigger anything.
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (timer) window.clearTimeout(timer)
    }
  }, [sentinel, shown, entries.length, total, loading, loadingMore])

  return {
    entries,
    shown: Math.min(shown, entries.length),
    first,
    total,
    loading,
    loadingMore,
    error,
    sentinelRef: setSentinel,
    showMore: advance,
    hasMore: shown < total,
  }
}
