import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
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

function yourCurrentMatch(matches: PublicBracketMatch[], displayName: string) {
  const yours = matches.filter((match) => youInMatch(match, displayName))
  return yours.find((match) => !match.winnerId) ?? yours.at(-1) ?? null
}

function isByeMatch(match: PublicBracketMatch) {
  return match.players.some((side) => side?.name === 'BYE')
}

function roundTabLabel(round: number, maxRound: number) {
  if (round === maxRound) return 'Final'
  if (round === maxRound - 1) return 'Semis'
  if (round === maxRound - 2 && maxRound >= 3) return 'Quarters'
  return `R${2 ** (maxRound - round + 1)}`
}

function visibleYouCard(root: ParentNode = document) {
  const nodes = root.querySelectorAll('.event-bracket__match--you')
  return [...nodes].find(
    (el): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0,
  )
}

function flashMatch(el: HTMLElement) {
  el.classList.remove('event-bracket__match--flash')
  void el.offsetWidth
  el.classList.add('event-bracket__match--flash')
}

function MatchCard({
  match,
  displayName,
  isYours,
}: {
  match: PublicBracketMatch
  displayName: string
  isYours: boolean
}) {
  const you = normalizePlayerName(displayName)
  return (
    <article
      className={`event-bracket__match${isYours ? ' event-bracket__match--you' : ''}${
        match.winnerId ? ' event-bracket__match--done' : ''
      }`}
    >
      {isYours ? <span className="event-bracket__you-tag">You</span> : null}
      {match.players.map((side, idx) => {
        const isBye = side?.name === 'BYE'
        const isYouSide = Boolean(side && you && normalizePlayerName(side.name) === you)
        const won = Boolean(side && !isBye && match.winnerId === side.id)
        const lost = Boolean(side && !isBye && match.winnerId && match.winnerId !== side.id)
        return (
          <div
            key={side?.id || `empty-${idx}`}
            className={`event-bracket__side${won ? ' event-bracket__side--won' : ''}${
              lost ? ' event-bracket__side--lost' : ''
            }${isBye ? ' event-bracket__side--bye' : ''}${
              isYouSide ? ' event-bracket__side--you' : ''
            }`}
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

function BracketTree({
  matches,
  rounds,
  maxRound,
  firstCount,
  displayName,
  currentYouId,
  scrollerRef,
}: {
  matches: PublicBracketMatch[]
  rounds: number[]
  maxRound: number
  firstCount: number
  displayName: string
  currentYouId: string | null
  scrollerRef: RefObject<HTMLDivElement | null>
}) {
  return (
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
              <MatchCard
                match={match}
                displayName={displayName}
                isYours={currentYouId === match.id}
              />
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const isBracket = eventKind(detail) === 'bracket'
  const matches = isBracket ? (detail.bracket?.matches ?? []) : []
  const cap = detail.rules.maxPlayers ?? 0
  const waiting = isBracket && !detail.bracket
  const maxRound = matches.reduce((m, row) => Math.max(m, row.round), 1)
  const rounds = waiting ? [] : Array.from({ length: maxRound }, (_, i) => i + 1)
  const firstCount = matches.filter((m) => m.round === 1).length || 1
  const currentYou = yourCurrentMatch(matches, displayName)
  const youPlaying = Boolean(currentYou)
  const [activeRound, setActiveRound] = useState(currentYou?.round ?? 1)
  const [showTree, setShowTree] = useState(false)
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  )
  const jumpPending = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setActiveRound(currentYou?.round ?? 1)
    setShowTree(false)
  }, [detail.id, currentYou?.round])

  const scrollToYou = () => {
    if (currentYou) setActiveRound(currentYou.round)
    setShowTree(false)
    jumpPending.current = true
  }

  useLayoutEffect(() => {
    if (!jumpPending.current) return
    jumpPending.current = false
    const you = visibleYouCard()
    if (!you) return
    you.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    flashMatch(you)
  }, [activeRound, showTree])

  useLayoutEffect(() => {
    if (!showTree) return
    const root = scrollerRef.current
    if (!root || waiting) return
    const you = visibleYouCard(root)
    if (!you) return
    if (root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight) return
    const cr = you.getBoundingClientRect()
    const sr = root.getBoundingClientRect()
    root.scrollTo({
      left: root.scrollLeft + cr.left - sr.left - (sr.width - cr.width) / 2,
      top: root.scrollTop + cr.top - sr.top - (sr.height - cr.height) / 2,
      behavior: 'instant',
    })
  }, [detail.id, displayName, waiting, firstCount, maxRound, showTree])

  if (!isBracket) return null

  const roundMatches = matches
    .filter((match) => match.round === activeRound)
    .sort((a, b) => {
      const ay = a.id === currentYou?.id ? 0 : 1
      const by = b.id === currentYou?.id ? 0 : 1
      if (ay !== by) return ay - by
      const aBye = isByeMatch(a) ? 1 : 0
      const bBye = isByeMatch(b) ? 1 : 0
      if (aBye !== bBye) return aBye - bBye
      return a.slot - b.slot
    })
  const playMatches = roundMatches.filter(
    (match) => match.id === currentYou?.id || !isByeMatch(match),
  )
  const byeMatches = roundMatches.filter(
    (match) => match.id !== currentYou?.id && isByeMatch(match),
  )

  return (
    <section
      className={[
        className,
        showTree ? 'event-bracket-wrap--tree' : 'event-bracket-wrap--rounds',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Bracket"
    >
      <div className="event-bracket__heading">
        <h2 className="event-detail__section-title">Bracket</h2>
        <div className="event-bracket__heading-actions">
          {!waiting && youPlaying ? (
            <button type="button" className="event-bracket__jump" onClick={scrollToYou}>
              Your match
            </button>
          ) : null}
          {!waiting && maxRound >= 2 ? (
            <button
              type="button"
              className="event-bracket__jump event-bracket__view-toggle"
              onClick={() => setShowTree((open) => !open)}
            >
              {showTree ? 'Rounds' : 'Full bracket'}
            </button>
          ) : null}
        </div>
      </div>
      {waiting ? (
        <p className="lb-empty">
          {cap > 0
            ? `Waiting for ${Math.max(0, cap - detail.playerCount)} more to draw the bracket.`
            : 'Waiting for the roster to fill.'}
        </p>
      ) : (
        <>
          {narrow && !showTree ? (
            <>
              <div className="event-bracket-rounds" role="tablist" aria-label="Rounds">
                {rounds.map((round) => {
                  const selected = round === activeRound
                  return (
                    <button
                      key={round}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={bracketRoundLabel(round, maxRound)}
                      className={`event-bracket-rounds__tab${
                        selected ? ' event-bracket-rounds__tab--on' : ''
                      }`}
                      onClick={() => {
                        setActiveRound(round)
                        setShowTree(false)
                      }}
                    >
                      {roundTabLabel(round, maxRound)}
                    </button>
                  )
                })}
              </div>
              <ul className="event-bracket-list">
                {playMatches.map((match) => (
                  <li key={match.id}>
                    <MatchCard
                      match={match}
                      displayName={displayName}
                      isYours={currentYou?.id === match.id}
                    />
                  </li>
                ))}
                {byeMatches.length ? (
                  <li>
                    <details className="event-bracket-byes">
                      <summary>
                        {byeMatches.length} bye{byeMatches.length === 1 ? '' : 's'}
                      </summary>
                      <ul className="event-bracket-list event-bracket-list--byes">
                        {byeMatches.map((match) => (
                          <li key={match.id}>
                            <MatchCard match={match} displayName={displayName} isYours={false} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ) : null}
              </ul>
            </>
          ) : (
            <BracketTree
              matches={matches}
              rounds={rounds}
              maxRound={maxRound}
              firstCount={firstCount}
              displayName={displayName}
              currentYouId={currentYou?.id ?? null}
              scrollerRef={scrollerRef}
            />
          )}
        </>
      )}
    </section>
  )
}
