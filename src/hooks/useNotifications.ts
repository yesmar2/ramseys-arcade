import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
  type AppNotification,
} from '../lib/notifications'

/** How often the badge asks how many are unread, while the tab is in front. */
const POLL_MS = 60_000
/** A list this fresh is shown as it is: a new page doesn't fetch it again. */
const FRESH_MS = 30_000
/** Opening the inbox fetches the list unless it came in this recently. */
const OPEN_FRESH_MS = 5_000

/*
 * The inbox, kept roughly current, and shared: one copy for the whole tab.
 *
 * The header mounts again on every page, and each mount used to fetch the
 * whole list, on top of fetching it again every minute. Now a page change
 * uses the list if it is under half a minute old, the minute's poll asks only
 * how many are unread (fetching the list when that number moves), and
 * opening the inbox fetches it unless it just came in. A hidden tab doesn't
 * poll at all, and the one alert that is actually time-critical arrives by
 * push instead of by poll.
 */
type Inbox = {
  items: AppNotification[]
  unread: number
  loaded: boolean
  loading: boolean
  listedAt: number
  countedAt: number
}

const emptyInbox: Inbox = { items: [], unread: 0, loaded: false, loading: false, listedAt: 0, countedAt: 0 }
let inbox: Inbox = emptyInbox
/** Moves on sign-out, so an answer asked for before it isn't kept after it. */
let generation = 0
let listing: Promise<void> | null = null
let counting: Promise<void> | null = null
let mounted = 0
let timer: number | null = null
const listeners = new Set<() => void>()

function set(next: Partial<Inbox>) {
  inbox = { ...inbox, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getInbox = () => inbox

/** The whole list, unless the one held is fresher than `freshMs`. */
function loadList(freshMs = 0): Promise<void> {
  if (listing) return listing
  if (freshMs > 0 && inbox.loaded && Date.now() - inbox.listedAt < freshMs) return Promise.resolve()
  const asked = generation
  if (!inbox.loaded) set({ loading: true })
  listing = fetchNotifications()
    .then((body) => {
      if (asked !== generation) return
      const now = Date.now()
      set({ items: body.notifications, unread: body.unread, loaded: true, listedAt: now, countedAt: now })
    })
    .catch(() => {
      // A missing inbox is not worth an error state in the header.
    })
    .finally(() => {
      listing = null
      if (asked === generation && inbox.loading) set({ loading: false })
    })
  return listing
}

/** The poll: just the count, and the list when the count has moved. */
function checkCount() {
  if (counting || listing || !inbox.loaded) return
  const asked = generation
  counting = fetchUnreadCount()
    .then((unread) => {
      if (asked !== generation) return
      if (unread !== inbox.unread) return loadList()
      set({ countedAt: Date.now() })
    })
    .catch(() => {})
    .finally(() => {
      counting = null
    })
}

function tick() {
  if (document.hidden) return
  if (!inbox.loaded) {
    void loadList()
    return
  }
  // Coming back to the tab is the moment a stale badge is most obvious.
  if (Date.now() - Math.max(inbox.countedAt, inbox.listedAt) >= FRESH_MS) checkCount()
}

function start() {
  if (mounted++ > 0) return
  timer = window.setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', tick)
}

function stop() {
  if (--mounted > 0) return
  if (timer != null) window.clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', tick)
}

function clear() {
  generation++
  if (inbox !== emptyInbox) set(emptyInbox)
}

export function useNotifications(enabled: boolean) {
  const snap = useSyncExternalStore(subscribe, getInbox, getInbox)

  useEffect(() => {
    if (!enabled) {
      clear()
      return
    }
    start()
    void loadList(FRESH_MS)
    return stop
  }, [enabled])

  const refresh = useCallback(async () => {
    if (enabled) await loadList()
  }, [enabled])

  /** The inbox is opening: fetch the list unless it just came in. */
  const freshen = useCallback(() => {
    if (enabled) void loadList(OPEN_FRESH_MS)
  }, [enabled])

  const markAllRead = useCallback(async () => {
    if (inbox.unread === 0) return
    // Optimistic: the badge should clear the instant the panel opens.
    const now = Date.now()
    set({ items: inbox.items.map((n) => (n.readAt ? n : { ...n, readAt: now })), unread: 0 })
    try {
      await markNotificationsRead()
    } catch {
      void loadList()
    }
  }, [])

  const items = enabled ? snap.items : emptyInbox.items
  return {
    items,
    unread: enabled ? snap.unread : 0,
    loading: enabled && snap.loading,
    refresh,
    freshen,
    markAllRead,
  }
}

export type NotificationsState = ReturnType<typeof useNotifications>

/**
 * One look at the inbox, from opening it to closing it.
 *
 * Opening fetches the list unless it just came in, and clears the badge
 * straight away, but what was new when it opened stays marked until it
 * closes, so the player can still see what came in. Anything that arrives
 * while it's open is new too, and read once it closes.
 */
export function useInboxLook(notes: NotificationsState, open: boolean) {
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())
  const latest = useRef(notes)
  latest.current = notes

  useEffect(() => {
    if (open) latest.current.freshen()
  }, [open])

  // Whenever something unread is on screen: remember it as new, and read it.
  useEffect(() => {
    if (!open) return
    const { items, unread, markAllRead } = latest.current
    if (unread === 0) return
    const ids = items.filter((n) => !n.readAt).map((n) => n.id)
    setFresh((prev) => new Set([...prev, ...ids]))
    void markAllRead()
  }, [open, notes.unread])

  useEffect(() => {
    if (!open) setFresh(new Set())
  }, [open])

  return useCallback((n: AppNotification) => fresh.has(n.id), [fresh])
}
