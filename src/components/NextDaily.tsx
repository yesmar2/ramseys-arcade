import type { MouseEvent, ReactNode } from 'react'
import { useAccountId } from '../hooks/useAccountId'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { gamePlayHref, navigate, todayHref } from '../hooks/useHashRoute'
import { dailyWords } from '../lib/dailyWords'
import { exitFullscreen } from '../lib/fullscreen'
import { GameArt } from './GameArt'
import { useTicket, type Punch } from './todayPunches'
import '../styles/nextDaily.css'

/*
 * The way on from a daily's result to the next of today's still to play, in the ticket's order after this
 * one, round to the start: a row with its picture, "Up next · 2 of 6 done", its name and day, and its own
 * verb (Race, Roll, Fly). Ramsey picked the row over making it the main button or a strip of the day's
 * punches (2026-10-01). With all of them done, it says so and leads to the ticket. On a run's report
 * (ScoreSaveCard) and Ace Chase's result card, loaded only there: the ticket brings the dailies' plans.
 */

/** The next of today's dailies still to play after `slug`, in the ticket's order, round to the start. */
function nextAfter(punches: readonly Punch[], slug: string): Punch | null {
  const i = punches.findIndex((p) => p.slug === slug)
  const order = i >= 0 ? [...punches.slice(i + 1), ...punches.slice(0, i)] : punches
  return order.find((p) => !p.done && p.slug !== slug) ?? null
}

/** Out of the play screen (and fullscreen, as its back control does) to a page in the app. */
function leaveTo(href: string) {
  void exitFullscreen()
  navigate(href)
}

export type NextDailyViewProps = {
  /** The daily just played. */
  slug: string
  punches: readonly Pick<Punch, 'key' | 'slug' | 'game' | 'kicker' | 'title' | 'done'>[]
  done: number
  total: number
  className?: string
  /**
   * A racing daily's tomorrow (TomorrowTease), under the row once all of today's are done: before that, the next
   * of today's is the better way on (Ramsey, 2026-10-05: the report was "a lot").
   */
  tomorrow?: ReactNode
}

/** What NextDaily shows, given the day's punches: also the dev page's samples. */
export function NextDailyView({ slug, punches, done, total, className = '', tomorrow = null }: NextDailyViewProps) {
  const allow = useDeliberatePress()
  const next = nextAfter(punches as Punch[], slug)
  // Played just now, the ticket may not have this one in yet: it's done all the same.
  const doneNow = Math.min(total, done + (punches.some((p) => p.slug === slug && !p.done) ? 1 : 0))
  const go = (href: string) => (e: MouseEvent) => {
    e.preventDefault()
    if (allow(e)) leaveTo(href)
  }

  if (!next) {
    if (!total || doneNow < total) return null
    return (
      <>
        <div className={`next-daily next-daily--all ${className}`}>
          <span className="next-daily__kicker">The Dailies</span>
          <span className="next-daily__title">All {total} done today</span>
          <a className="next-daily__more" href={todayHref()} onClick={go(todayHref())}>
            See your ticket ›
          </a>
        </div>
        {tomorrow}
      </>
    )
  }

  const verb = dailyWords(next.slug).verb
  const href = gamePlayHref(next.slug)
  const course = `${next.kicker.replace(/^Today’s\s+/, '')} · ${next.title}`

  return (
    <div className={`next-daily ${className}`}>
      <span className="next-daily__pic" aria-hidden="true">
        <GameArt slug={next.slug} className="next-daily__art" />
      </span>
      <span className="next-daily__text">
        <span className="next-daily__kicker">
          Up next · {doneNow} of {total} done
        </span>
        <span className="next-daily__title">{next.game}</span>
        <span className="next-daily__sub">{course}</span>
      </span>
      <a className="panel__btn next-daily__go" href={href} onClick={go(href)} aria-label={`${verb} ${next.game}: ${course}`}>
        {verb} ›
      </a>
    </div>
  )
}

/** After a daily's run: the next of today's still to play, for whoever is playing on this device. */
export default function NextDaily({ slug, className, tomorrow }: { slug: string; className?: string; tomorrow?: ReactNode }) {
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  if (!ticket.punches.length) return null
  return <NextDailyView slug={slug} punches={ticket.punches} done={ticket.done} total={ticket.total} className={className} tomorrow={tomorrow} />
}
