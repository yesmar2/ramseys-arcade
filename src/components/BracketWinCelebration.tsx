import { useEffect, useState } from 'react'
import { normalizePlayerName } from '../lib/leaderboard'
import { isWinSeen, markWinsSeen } from '../lib/seenWins'
import {
  eventKind,
  finalBracketMatch,
  type PublicBracketMatch,
  type TournamentDetail,
} from '../lib/tournaments'
import { bracketCelebrationPayload, ScoreCelebration, type CelebPayload } from './ScoreSaveCard'

function wonBy(match: PublicBracketMatch, you: string) {
  return match.players.some(
    (p) => p && normalizePlayerName(p.name) === you && p.id === match.winnerId,
  )
}

/**
 * Celebrate a win the player was not present for.
 *
 * Submitting a score celebrates on the spot, but a match also resolves when the
 * round clock runs out on an opponent who never played — and that happens on
 * some other visitor's page load, so the winner gets nothing. This catches up
 * the next time they open the event.
 */
export function BracketWinCelebration({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  const [payload, setPayload] = useState<CelebPayload | null>(null)

  useEffect(() => {
    if (eventKind(detail) !== 'bracket') return
    const you = normalizePlayerName(displayName)
    if (!you) return
    const matches = detail.bracket?.matches ?? []
    const mine = matches.filter((m) => m.winnerId && wonBy(m, you))
    const unseen = mine.filter((m) => !isWinSeen(detail.id, m.id))
    if (unseen.length === 0) return

    // Everything they missed is acknowledged at once; only the best is shown.
    markWinsSeen(
      detail.id,
      mine.map((m) => m.id),
    )

    const final = finalBracketMatch(matches)
    const champion = Boolean(final?.winnerId && wonBy(final, you))
    const latest = unseen.reduce((best, m) => (m.round > best.round ? m : best), unseen[0]!)
    const opponent = latest.players.find(
      (p) => p && normalizePlayerName(p.name) !== you,
    )
    setPayload(
      bracketCelebrationPayload({
        champion,
        matchWon: true,
        opponent: opponent?.name ?? null,
        eventTitle: detail.title,
      }),
    )
  }, [detail, displayName])

  if (!payload) return null
  return <ScoreCelebration payload={payload} onDone={() => setPayload(null)} />
}
