import { useLayoutEffect, useRef, type CSSProperties } from 'react'
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

function MatchCard({
  match,
  displayName,
}: {
  match: PublicBracketMatch
  displayName: string
}) {
  return (
    <article
      className={`event-bracket__match${
        youInMatch(match, displayName) ? ' event-bracket__match--you' : ''
      }${match.winnerId ? ' event-bracket__match--done' : ''}`}
    >
      {match.players.map((side, idx) => {
        const isBye = side?.name === 'BYE'
        const won = Boolean(side && !isBye && match.winnerId === side.id)
        const lost = Boolean(side && !isBye && match.winnerId && match.winnerId !== side.id)
        return (
          <div
            key={side?.id || `empty-${idx}`}
            className={`event-bracket__side${won ? ' event-bracket__side--won' : ''}${
              lost ? ' event-bracket__side--lost' : ''
            }${isBye ? ' event-bracket__side--bye' : ''}`}
          >
            <span className="event-bracket__name">{side?.name ?? 'TBD'}</span>
            <span className="event-bracket__score">
              {isBye ? '' : side?.score != null ? side.score.toLocaleString() : '—'}
            </span>
          </div>
        )
      })}
    </article>
  )
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
  const rounds = waiting ? [] : Array.from({ length: maxRound }, (_, i) => i + 1)
  const firstCount = matches.filter((m) => m.round === 1).length || 1
  const scrollerRef = useRef<HTMLDivElement>(null)
  const youPlaying = matches.some((match) => youInMatch(match, displayName))

  const scrollToYou = () => {
    const root = scrollerRef.current
    const you = root?.querySelector('.event-bracket__match--you')
    if (!root || !(you instanceof HTMLElement)) return
    const cr = you.getBoundingClientRect()
    const sr = root.getBoundingClientRect()
    root.scrollTo({
      left: root.scrollLeft + cr.left - sr.left - (sr.width - cr.width) / 2,
      top: root.scrollTop + cr.top - sr.top - (sr.height - cr.height) / 2,
      behavior: 'smooth',
    })
  }

  useLayoutEffect(() => {
    const root = scrollerRef.current
    if (!root || waiting) return
    const you = root.querySelector('.event-bracket__match--you')
    if (!(you instanceof HTMLElement)) return
    if (root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight) return
    const cr = you.getBoundingClientRect()
    const sr = root.getBoundingClientRect()
    root.scrollTo({
      left: root.scrollLeft + cr.left - sr.left - (sr.width - cr.width) / 2,
      top: root.scrollTop + cr.top - sr.top - (sr.height - cr.height) / 2,
      behavior: 'instant',
    })
  }, [detail.id, displayName, waiting, firstCount, maxRound])

  return (
    <section className={className} aria-label="Bracket">
      <div className="event-bracket__heading">
        <h2 className="event-detail__section-title">Bracket</h2>
        {!waiting && youPlaying ? (
          <button type="button" className="event-bracket__jump" onClick={scrollToYou}>
            Your match
          </button>
        ) : null}
      </div>
      {waiting ? (
        <p className="lb-empty">
          {cap > 0
            ? `Waiting for ${Math.max(0, cap - detail.playerCount)} more to draw the bracket.`
            : 'Waiting for the roster to fill.'}
        </p>
      ) : (
        <>
          {maxRound >= 2 ? (
            <p className="event-bracket__hint">Swipe to see later rounds</p>
          ) : null}
          <div ref={scrollerRef} className="event-bracket-scroller">
            <div
              className="event-bracket"
              style={
                {
                  '--round-count': rounds.length,
                  '--first-count': firstCount,
                } as CSSProperties
              }
            >
              {rounds.map((round) => (
                <h3
                  key={`title-${round}`}
                  className="event-bracket__round-title"
                  style={{ gridColumn: round, gridRow: 1 }}
                >
                  {bracketRoundLabel(round, maxRound)}
                </h3>
              ))}
              {matches.map((match) => {
                const span = 1 << (match.round - 1)
                const connector =
                  match.round === maxRound
                    ? 'event-bracket__slot--final'
                    : match.slot % 2 === 0
                      ? 'event-bracket__slot--out-top'
                      : 'event-bracket__slot--out-bot'
                return (
                  <div
                    key={match.id}
                    className={`event-bracket__slot ${connector}`}
                    style={{
                      gridColumn: match.round,
                      gridRow: `${2 + match.slot * span} / span ${span}`,
                    }}
                  >
                    <MatchCard match={match} displayName={displayName} />
                    {match.round !== maxRound ? (
                      <span className="event-bracket__wires" aria-hidden="true">
                        <span className="event-bracket__wire event-bracket__wire--h" />
                        <span className="event-bracket__wire event-bracket__wire--v" />
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
