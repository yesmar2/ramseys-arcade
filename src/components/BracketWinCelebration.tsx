import { useEffect, useId, useState, type CSSProperties } from 'react'
import { normalizePlayerName } from '../lib/leaderboard'
import { isWinSeen, markWinsSeen } from '../lib/seenWins'
import { eventKind, finalBracketMatch, type PublicBracketMatch, type TournamentDetail } from '../lib/tournaments'
import { eventWinTakeover, type WinTakeoverData } from '../lib/winTakeover'
import { Panel, PanelHead } from './Panel'
import { ReportIconSvg } from './RunReport'
import { WinTakeover } from './WinTakeover'

function wonBy(match: PublicBracketMatch, you: string) {
  return match.players.some(
    (p) => p && normalizePlayerName(p.name) === you && p.id === match.winnerId,
  )
}

/** A finished event's win, on this device, under the event's own id. */
const EVENT_WON = 'won'

const GOLD = { '--celeb-accent': '#f5b942', '--hero-ink': '#1a1204' } as CSSProperties

type Moment =
  | { kind: 'won'; data: WinTakeoverData }
  | { kind: 'match'; opponent: string | null; next: string }

/**
 * Celebrate a win the player was not there for.
 *
 * Submitting a score celebrates on the spot, but a match also resolves when
 * the round clock runs out on an opponent who never played, and an event is
 * won when its clock runs out, both on some other visitor's page load. This
 * catches up the next time the winner opens the event: the whole screen for
 * the event, a panel for a match won on the way.
 */
export function BracketWinCelebration({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  const [moment, setMoment] = useState<Moment | null>(null)
  const titleId = useId()

  useEffect(() => {
    const you = normalizePlayerName(displayName)
    if (!you) return

    if (eventKind(detail) !== 'bracket') {
      if (isWinSeen(detail.id, EVENT_WON)) return
      const data = eventWinTakeover(detail, you)
      if (!data) return
      markWinsSeen(detail.id, [EVENT_WON])
      setMoment({ kind: 'won', data })
      return
    }

    const matches = detail.bracket?.matches ?? []
    const mine = matches.filter((m) => m.winnerId && wonBy(m, you))
    const unseen = mine.filter((m) => !isWinSeen(detail.id, m.id))
    if (unseen.length === 0) return

    // Everything they missed is acknowledged at once; only the best is shown.
    markWinsSeen(
      detail.id,
      mine.map((m) => m.id),
    )

    const data = eventWinTakeover(detail, you)
    if (data) {
      setMoment({ kind: 'won', data })
      return
    }
    const final = finalBracketMatch(matches)
    const latest = unseen.reduce((best, m) => (m.round > best.round ? m : best), unseen[0]!)
    const opponent = latest.players.find((p) => p && normalizePlayerName(p.name) !== you)?.name ?? null
    const toFinal = Boolean(final && final.round === latest.round + 1 && (final.bracket ?? 'w') === (latest.bracket ?? 'w'))
    setMoment({
      kind: 'match',
      opponent: opponent ? normalizePlayerName(opponent) : null,
      next: toFinal ? 'the final' : 'the next round',
    })
  }, [detail, displayName])

  if (!moment) return null
  const close = () => setMoment(null)

  if (moment.kind === 'won') {
    return (
      <WinTakeover
        data={moment.data}
        primary={{ label: 'See the final standings', onClick: close }}
        onClose={close}
      />
    )
  }

  return (
    <Panel onClose={close} labelledBy={titleId} style={GOLD}>
      <PanelHead
        titleId={titleId}
        kicker={detail.title}
        icon={<ReportIconSvg icon="crown" />}
        title={moment.opponent ? `You beat ${moment.opponent}` : 'You won your match'}
        onClose={close}
      />
      <div className="panel__body">
        <p className="panel__text">You’re through to {moment.next} of {detail.title}.</p>
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={close}>
          See the draw
        </button>
      </div>
    </Panel>
  )
}
