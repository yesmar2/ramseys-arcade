import { gameHref, todayHref } from '../hooks/useHashRoute'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { isRankedGame } from '../data/games'
import { DailyKindTag } from './DailyKindTag'
import { GameArt } from './GameArt'
import { CheckIcon } from './TodayCard'
import { FlameIcon } from './TodayChip'
import { streakLine, useTicket } from './todayPunches'
import '../styles/dailiesBar.css'

/*
 * The Dailies bar, over each daily's own page (pages/GameHubPage.tsx): the way to the Dailies page, with
 * how today stands ("Dailies 2/5"), and to each of the day's dailies, the ones done checked and this one
 * marked. Ramsey picked it from the "Dailies and game pages" mock (B). The Dailies page's ticket links back
 * by each game's name. A phone scrolls it, each daily by its short name. Since the puzzles came off the
 * ticket every daily on it is ranked, so a picture carries a ranked or just-for-fun mark (DailyKindTag) only
 * on a ticket with both.
 */
export function DailiesBar({ slug }: { slug: string }) {
  const { signedIn } = useAuth()
  // The ticket is the viewer's, as the Dailies page has it: this device's punches count at once.
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  if (!ticket.punches.length) return null
  // Ranked or just for fun, on each picture only while the ticket has both (a day before the puzzles came off it).
  const mixed = ticket.punches.some((p) => isRankedGame(p.slug)) && ticket.punches.some((p) => !isRankedGame(p.slug))
  return (
    <nav className="dbar" aria-label="Dailies">
      <a className="dbar__home" href={todayHref()} aria-label={`Dailies: ${ticket.done} of ${ticket.total} done today`}>
        <FlameIcon />
        <span className="dbar__word">Dailies</span>
        <b>
          {ticket.done}/{ticket.total}
        </b>
      </a>
      <span className="dbar__rule" aria-hidden="true" />
      <ol className="dbar__games">
        {ticket.punches.map((p) => {
          const here = p.slug === slug
          return (
            <li key={p.key}>
              <a
                className={`dbar__game${here ? ' dbar__game--here' : ''}`}
                href={gameHref(p.slug)}
                aria-current={here ? 'page' : undefined}
                aria-label={`${p.game}${p.done ? ', done today' : ''}`}
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
              {mixed ? <DailyKindTag slug={p.slug} look="badge" className="dbar__kind" /> : null}
            </li>
          )
        })}
      </ol>
      {signedIn ? <span className="dbar__line">{streakLine(ticket)}</span> : null}
    </nav>
  )
}
