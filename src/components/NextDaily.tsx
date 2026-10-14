import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { gamePlayHref, navigate, todayHref } from '../hooks/useHashRoute'
import { dailyWords } from '../lib/dailyWords'
import { exitFullscreen } from '../lib/fullscreen'
import { GameArt } from './GameArt'
import { ReelButton } from './RunReel'
import type { ReportAction } from './RunReport'
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
  /**
   * The run reel's last page (B, "Up next first"): the next daily as its poster, its name big, its picture, and its
   * own button the main one, with Play again under it. All of today's done, Play again is the main one again.
   */
  variant?: 'row' | 'poster'
  /** The poster's Play again. */
  playAgain?: ReportAction
  /** The poster's stand-in while the day's ticket isn't in, or there's no next daily: the place to beat. */
  fallback?: ReactNode
}

/** What NextDaily shows, given the day's punches: also the dev page's samples. */
export function NextDailyView({
  slug,
  punches,
  done,
  total,
  className = '',
  tomorrow = null,
  variant = 'row',
  playAgain,
  fallback = null,
}: NextDailyViewProps) {
  const allow = useDeliberatePress()
  const next = nextAfter(punches as Punch[], slug)
  // Played just now, the ticket may not have this one in yet: it's done all the same.
  const doneNow = Math.min(total, done + (punches.some((p) => p.slug === slug && !p.done) ? 1 : 0))
  // The poster comes in after its stand-in (the place to beat, or Play again) had focus, and that went with it:
  // its own main button takes it.
  const posterRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (variant !== 'poster') return
    const active = document.activeElement
    if (!active || active === document.body) posterRef.current?.querySelector<HTMLElement>('.reel-btn')?.focus({ preventScroll: true })
  }, [variant, next?.slug, doneNow, total])
  const go = (href: string) => (e: MouseEvent) => {
    e.preventDefault()
    if (allow(e)) leaveTo(href)
  }

  if (variant === 'poster') {
    if (!next) {
      if (!total || doneNow < total) return <>{fallback}</>
      // All of today's done: the ticket's word, tomorrow's tease, and Play again the main way on.
      return (
        <div ref={posterRef} className={`next-daily-poster ${className}`}>
          <section className="next-daily--poster next-daily--poster-all">
            <p className="reel__kick">The Dailies</p>
            <p className="next-daily__headline">All {total} done</p>
            <a className="reel-link" href={todayHref()} onClick={go(todayHref())}>
              See your ticket ›
            </a>
          </section>
          {tomorrow}
          {playAgain ? <ReelButton action={playAgain} /> : null}
        </div>
      )
    }
    const verb = dailyWords(next.slug).verb
    const href = gamePlayHref(next.slug)
    const course = `${next.kicker.replace(/^Today’s\s+/, '')} · ${next.title}`
    const played = getGame(slug)?.name ?? 'it'
    return (
      <div ref={posterRef} className={`next-daily-poster ${className}`}>
        <section className="next-daily--poster" aria-label={`Up next: ${next.game}`}>
          <p className="reel__kick">
            Up next · {doneNow} of {total} done
          </p>
          <p className="next-daily__headline">{next.game}</p>
          <p className="next-daily__course">{course}</p>
          <div className="next-daily__card">
            <span className="next-daily__poster-art" aria-hidden="true">
              <GameArt slug={next.slug} shape="card" className="next-daily__art" />
            </span>
            <a className="reel-btn reel-btn--play next-daily__race" href={href} onClick={go(href)}>
              {verb} {next.game}
            </a>
          </div>
        </section>
        {/* Play again under it, not the main way on now: focus goes to the next daily's button. */}
        {playAgain ? (
          <ReelButton
            action={{ ...playAgain, buttonRef: undefined, label: playAgain.busy ? playAgain.label : `Play ${played} again` }}
            variant="ghost"
          />
        ) : null}
      </div>
    )
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
export default function NextDaily({
  slug,
  className,
  tomorrow,
  variant = 'row',
  playAgain,
  fallback = null,
}: {
  slug: string
  className?: string
  tomorrow?: ReactNode
  variant?: 'row' | 'poster'
  playAgain?: ReportAction
  fallback?: ReactNode
}) {
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  if (!ticket.punches.length) return variant === 'poster' ? <>{fallback}</> : null
  return (
    <NextDailyView
      slug={slug}
      punches={ticket.punches}
      done={ticket.done}
      total={ticket.total}
      className={className}
      tomorrow={tomorrow}
      variant={variant}
      playAgain={playAgain}
      fallback={fallback}
    />
  )
}
