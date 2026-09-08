import type { CSSProperties } from 'react'
import { normalizePlayerName } from '../lib/leaderboard'
import {
  bracketRoundLabel,
  eventKind,
  type PublicBracketMatch,
  type TournamentDetail,
} from '../lib/tournaments'

function youInMatch(match: PublicBracketMatch, displayName: string) {
  const you = normalizePlayerName(displayName)
  return Boolean(you && match.players.some((p) => p && normalizePlayerName(p.name) === you))
}

export function EventBracket({
  detail,
  displayName,
  className,
}: {
  detail: TournamentDetail
  displayName: string
  className?: string
}) {
  if (eventKind(detail) !== 'bracket') return null
  const matches = detail.bracket?.matches ?? []
  const cap = detail.rules.maxPlayers ?? 0
  const waiting = !detail.bracket
  const maxRound = matches.reduce((m, row) => Math.max(m, row.round), 1)
  const rounds = waiting
    ? []
    : Array.from({ length: maxRound }, (_, i) => i + 1)

  return (
    <section className={className} aria-label="Bracket">
      <h2 className="event-detail__section-title">Bracket</h2>
      {waiting ? (
        <p className="lb-empty">
          {cap > 0
            ? `Waiting for ${Math.max(0, cap - detail.playerCount)} more to draw the bracket.`
            : 'Waiting for the roster to fill.'}
        </p>
      ) : (
        <div className="event-bracket" style={{ '--round-count': rounds.length } as CSSProperties}>
          {rounds.map((round) => {
            const rows = matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.slot - b.slot)
            return (
              <div key={round} className="event-bracket__round">
                <h3 className="event-bracket__round-title">
                  {bracketRoundLabel(round, maxRound)}
                </h3>
                <ul className="event-bracket__list">
                  {rows.map((match) => (
                    <li key={match.id}>
                      <article
                        className={`event-bracket__match${
                          youInMatch(match, displayName) ? ' event-bracket__match--you' : ''
                        }${match.winnerId ? ' event-bracket__match--done' : ''}`}
                      >
                        {match.players.map((side, idx) => {
                          const won = Boolean(side && match.winnerId === side.id)
                          const lost = Boolean(side && match.winnerId && match.winnerId !== side.id)
                          return (
                            <div
                              key={side?.id ?? `empty-${idx}`}
                              className={`event-bracket__side${won ? ' event-bracket__side--won' : ''}${
                                lost ? ' event-bracket__side--lost' : ''
                              }`}
                            >
                              <span className="event-bracket__name">
                                {side?.name ?? 'TBD'}
                              </span>
                              <span className="event-bracket__score">
                                {side?.score != null ? side.score.toLocaleString() : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </article>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
