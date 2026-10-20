import { useEffect, useState } from 'react'
import { AUTH_EVENT } from './accountEvents'
import { getSessionToken } from './auth'
import { api } from './leaderboard'
import { runFields } from './runSession'

/*
 * Your best time on each course of a racing daily, kept by the API for you alone (courseBests.ts there): the
 * medals on the past tracks (Ramsey picked A and C of the "Medal collection" canvas, 2026-10-09). Each finished
 * run sends its time here, on any course: today's, one from the week after its day, or a Plus member's practice
 * on an older one. Nothing here is a board.
 */

/** Said when a run has kept a new best, so a page showing the medals has it at once. */
export const COURSE_BEST_EVENT = 'skermix:course-best'
export type CourseBestNews = { game: string; course: number; ms: number }

/**
 * A run on a course has finished: keep its time if it's your best there. Quiet and fire and forget: signed out,
 * offline, or the API refusing it (a course over a week old without Plus), nothing happens.
 */
export function noteCourseBest(game: string, course: number, ms: number, run: Promise<string | undefined> | null) {
  if (!getSessionToken() || !run || !Number.isFinite(course) || course < 1 || !(ms > 0)) return
  void (async () => {
    try {
      const runId = await run
      if (!runId) return
      const res = await api<{ improved: boolean }>(`/course-bests/${game}/${course}`, {
        method: 'POST',
        body: JSON.stringify({ ms: Math.round(ms), ...runFields(runId) }),
      })
      if (res.improved) {
        window.dispatchEvent(new CustomEvent<CourseBestNews>(COURSE_BEST_EVENT, { detail: { game, course, ms: Math.round(ms) } }))
      }
    } catch {
      /* kept nowhere: the run still counts wherever else it went */
    }
  })()
}

/** Your best on each of a game's courses, by course number, in ms; null while asked, signed out, or for no game. */
export function useCourseBests(game: string | null): ReadonlyMap<number, number> | null {
  const [bests, setBests] = useState<ReadonlyMap<number, number> | null>(null)
  useEffect(() => {
    let live = true
    const load = () => {
      if (!game || !getSessionToken()) {
        setBests(null)
        return
      }
      api<{ bests: { course: number; ms: number }[] }>(`/course-bests/${game}`)
        .then((res) => {
          if (live) setBests(new Map(res.bests.map((b) => [b.course, b.ms])))
        })
        .catch(() => {
          if (live) setBests(null)
        })
    }
    const onBest = (e: Event) => {
      const news = (e as CustomEvent<CourseBestNews>).detail
      if (news.game !== game) return
      setBests((prev) => {
        const next = new Map(prev ?? [])
        const had = next.get(news.course)
        if (had == null || news.ms < had) next.set(news.course, news.ms)
        return next
      })
    }
    load()
    window.addEventListener(AUTH_EVENT, load)
    window.addEventListener(COURSE_BEST_EVENT, onBest)
    return () => {
      live = false
      window.removeEventListener(AUTH_EVENT, load)
      window.removeEventListener(COURSE_BEST_EVENT, onBest)
    }
  }, [game])
  return bests
}

/** How many of each race medal a player holds, counted by the API from their course bests: anyone's to see. */
export type MedalCounts = { platinum: number; gold: number; silver: number; bronze: number }

/**
 * A player's medals, counted, for their player card (Ramsey made the counts public, 2026-10-20; the times stay
 * the player's own). Asked again when a run keeps a new best on this device. Null until it's in.
 */
export function useMedalCounts(name: string): MedalCounts | null {
  const [got, setGot] = useState<{ name: string; medals: MedalCounts } | null>(null)
  const [ask, setAsk] = useState(0)
  useEffect(() => {
    const again = () => setAsk((n) => n + 1)
    window.addEventListener(COURSE_BEST_EVENT, again)
    return () => window.removeEventListener(COURSE_BEST_EVENT, again)
  }, [])
  useEffect(() => {
    if (!name) return
    let live = true
    api<{ medals: MedalCounts }>(`/course-bests/medals?name=${encodeURIComponent(name)}`)
      .then((r) => {
        if (live) setGot({ name, medals: r.medals })
      })
      .catch(() => {
        if (live) setGot({ name, medals: { platinum: 0, gold: 0, silver: 0, bronze: 0 } })
      })
    return () => {
      live = false
    }
  }, [name, ask])
  return got?.name === name ? got.medals : null
}
