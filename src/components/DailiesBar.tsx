import { useEffect, useRef } from 'react'
import { gameHref, todayHref } from '../hooks/useHashRoute'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { isRankedGame } from '../data/games'
import { DailyKindTag } from './DailyKindTag'
import { GameArt } from './GameArt'
import { CheckIcon } from './TodayCard'
import { FlameIcon } from './TodayChip'
import { streakLine, useTicket, type Punch } from './todayPunches'
import '../styles/dailiesBar.css'

/*
 * The Dailies bar, over each daily's own page (pages/GameHubPage.tsx): the way to the Dailies page, with
 * how today stands ("Dailies 2/5"), and to each of the day's dailies, the ones done checked and this one
 * marked. Ramsey picked it from the "Dailies and game pages" mock (B). The Dailies page's ticket links back
 * by each game's name. A phone scrolls it, each daily by its short name, and brings this one into view. Since
 * the puzzles came off the ticket every daily on it is ranked, so a picture carries a ranked or just-for-fun
 * mark (DailyKindTag) only on a ticket with both. On a puzzle's own page, off the ticket, the day's puzzles
 * (AlsoToday.tsx) end it, by their pictures, this one marked, where the streak's line (the races') was.
 */

/**
 * A daily in the bar: its picture, checked once done, and its name; this page's marked. A puzzle's name is its
 * tip on a wide screen, where only the one shown is named.
 */
function BarGame({ punch: p, here, kind, also = false }: { punch: Punch; here: boolean; kind: boolean; also?: boolean }) {
  return (
    <li>
      <a
        className={`dbar__game${here ? ' dbar__game--here' : ''}`}
        href={gameHref(p.slug)}
        aria-current={here ? 'page' : undefined}
        aria-label={`${p.game}${p.done ? ', done today' : ''}`}
        title={also && !here ? p.game : undefined}
      >
        <span className="dbar__art" aria-hidden="true">
          <span className="dbar__pic">
            <GameArt slug={p.slug} className="dbar__scene" />
          </span>
          {p.done ? (
            <span className="dbar__check">
              <CheckIcon />
            </span>
          ) : null}
        </span>
        <span className="dbar__name">{p.game}</span>
        <span className="dbar__short">{p.label}</span>
      </a>
      {/* Ranked or just for fun, on its picture's corner: a button of its own, so it sits beside the link. */}
      {kind ? <DailyKindTag slug={p.slug} look="badge" className="dbar__kind" /> : null}
    </li>
  )
}

export function DailiesBar({ slug }: { slug: string }) {
  const { signedIn } = useAuth()
  // The ticket is the viewer's, as the Dailies page has it: this device's punches count at once.
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  const barRef = useRef<HTMLElement>(null)
  const shown = ticket.punches.length > 0

  // A bar too wide for the screen (a phone's) scrolls this daily into view, without moving the page; and again once
  // the fonts are in, as names drawn wider move it along.
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const bring = () => {
      const here = bar.querySelector<HTMLElement>('[aria-current="page"]')
      if (!here) return
      const box = bar.getBoundingClientRect()
      const at = here.getBoundingClientRect()
      const left = at.left - box.left + bar.scrollLeft
      if (left < bar.scrollLeft || left + at.width > bar.scrollLeft + bar.clientWidth) {
        bar.scrollLeft = left - (bar.clientWidth - at.width) / 2
      }
    }
    bring()
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) bring()
    })
    return () => {
      live = false
    }
  }, [slug, shown])

  if (!shown) return null
  // Ranked or just for fun, on each picture only while the ticket has both (a day before the puzzles came off it).
  const mixed = ticket.punches.some((p) => isRankedGame(p.slug)) && ticket.punches.some((p) => !isRankedGame(p.slug))
  // A page of one of the day's puzzles: they end the bar, this one among them, where the streak's line was (the races').
  const puzzle = ticket.also.some((p) => p.slug === slug)
  return (
    <nav className="dbar" aria-label="Dailies" ref={barRef}>
      <a className="dbar__home" href={todayHref()} aria-label={`Dailies: ${ticket.done} of ${ticket.total} done today`}>
        <FlameIcon />
        <span className="dbar__word">Dailies</span>
        <b>
          {ticket.done}/{ticket.total}
        </b>
      </a>
      <span className="dbar__rule" aria-hidden="true" />
      <ol className="dbar__games">
        {ticket.punches.map((p) => (
          <BarGame key={p.key} punch={p} here={p.slug === slug} kind={mixed} />
        ))}
      </ol>
      {puzzle ? (
        <>
          <span className="dbar__rule" aria-hidden="true" />
          <span className="dbar__also" aria-hidden="true">
            Also today
          </span>
          <ol className="dbar__games dbar__games--also" aria-label="Also today">
            {ticket.also.map((p) => (
              <BarGame key={p.key} punch={p} here={p.slug === slug} kind={false} also />
            ))}
          </ol>
        </>
      ) : null}
      {signedIn && !puzzle ? <span className="dbar__line">{streakLine(ticket)}</span> : null}
    </nav>
  )
}
