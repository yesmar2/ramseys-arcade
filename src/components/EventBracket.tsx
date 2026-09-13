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
  matchSide,
  type PublicBracketMatch,
  type TournamentDetail,
} from '../lib/tournaments'

/** Losers rounds have no neat "semis/quarters" names; number them instead. */
function loserRoundLabel(round: number, maxRound: number) {
  if (round === maxRound) return 'Losers final'
  if (round === maxRound - 1) return 'Losers semis'
  return `Losers R${round}`
}

function winnersRoundLabel(round: number, maxRound: number) {
  if (round === maxRound) return 'Winners final'
  if (round === maxRound - 1) return 'Winners semis'
  return bracketRoundLabel(round, maxRound)
}

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
        const isTbd = !side
        const vacant = isBye || isTbd
        const isYouSide = Boolean(side && you && normalizePlayerName(side.name) === you)
        const won = Boolean(side && !isBye && match.winnerId === side.id)
        const lost = Boolean(side && !isBye && match.winnerId && match.winnerId !== side.id)
        return (
          <div
            key={side?.id || `empty-${idx}`}
            className={`event-bracket__side${won ? ' event-bracket__side--won' : ''}${
              lost ? ' event-bracket__side--lost' : ''
            }${isBye ? ' event-bracket__side--bye' : ''}${
              isTbd ? ' event-bracket__side--tbd' : ''
            }${isYouSide ? ' event-bracket__side--you' : ''}`}
          >
            <span className={`event-bracket__name${vacant ? ' event-bracket__name--vacant' : ''}`}>
              {isBye ? 'Bye' : side?.name ?? 'TBD'}
            </span>
            {vacant ? null : (
              <span className="event-bracket__score">
                {side?.score != null ? side.score.toLocaleString() : '—'}
              </span>
            )}
          </div>
        )
      })}
    </article>
  )
}

/**
 * Plain round-columns layout. The losers bracket is fed from two places at
 * once (its own survivors plus fresh drops from the winners side), so tree
 * connectors would draw relationships that aren't true — columns stay honest.
 */
function BracketColumns({
  matches,
  displayName,
  currentYouId,
  labelFor,
}: {
  matches: PublicBracketMatch[]
  displayName: string
  currentYouId: string | null
  labelFor: (round: number, maxRound: number) => string
}) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const maxRound = rounds.at(-1) ?? 1

  return (
    <div className="event-bracket-scroller">
      <div className="ev-bracket-cols" style={{ '--col-count': rounds.length } as CSSProperties}>
        {rounds.map((round) => (
          <div key={round} className="ev-bracket-col">
            <h3 className="event-bracket__round-title">{labelFor(round, maxRound)}</h3>
            <ul className="ev-bracket-col__list">
              {matches
                .filter((m) => m.round === round)
                .sort((a, b) => a.slot - b.slot)
                .map((match) => (
                  <li key={match.id}>
                    <MatchCard
                      match={match}
                      displayName={displayName}
                      isYours={currentYouId === match.id}
                    />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
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
  labelFor = bracketRoundLabel,
}: {
  matches: PublicBracketMatch[]
  rounds: number[]
  maxRound: number
  firstCount: number
  displayName: string
  currentYouId: string | null
  scrollerRef: RefObject<HTMLDivElement | null>
  labelFor?: (round: number, maxRound: number) => string
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
            {labelFor(round, maxRound)}
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
          // Round 1 has nothing feeding it, so it gets no incoming line.
          const fed = match.round > 1 ? ' event-bracket__slot--fed' : ''
          return (
            <div
              key={match.id}
              className={`event-bracket__slot ${connector}${fed}`}
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
  /** Roster still filling — shape is a cosmetic preview, not yet the real draw. */
  const locked = isBracket && Boolean(detail.bracket?.lockedAt)
  const waiting = isBracket && matches.length === 0

  // Single-elim matches carry no side, so these stay empty and the original
  // single-bracket rendering below is untouched.
  const winners = matches.filter((m) => matchSide(m) === 'wb')
  const losers = matches.filter((m) => matchSide(m) === 'lb')
  const grandFinal = matches.filter((m) => matchSide(m) === 'gf')
  const isDouble = losers.length > 0 || grandFinal.length > 0
  /*
   * The reset only happens if the losers-side challenger wins the title match,
   * so until someone is actually seated in it, say so rather than promising it.
   */
  const resetSeated = grandFinal.some((m) => m.round > 1 && m.players.some(Boolean))
  const grandFinalLabel = (round: number) =>
    round === 1 ? 'Title match' : resetSeated ? 'Bracket reset' : 'Reset (if needed)'

  const treeMatches = isDouble ? winners : matches
  const maxRound = treeMatches.reduce((m, row) => Math.max(m, row.round), 1)
  const rounds = waiting ? [] : Array.from({ length: maxRound }, (_, i) => i + 1)
  const firstCount = treeMatches.filter((m) => m.round === 1).length || 1
  const currentYou = yourCurrentMatch(matches, displayName)
  const youPlaying = Boolean(currentYou)
  const [activeRound, setActiveRound] = useState(currentYou?.round ?? 1)
  const [showTree, setShowTree] = useState(false)
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  )
  const jumpPending = useRef(false)
  const [jumpTick, setJumpTick] = useState(0)

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
    setJumpTick((n) => n + 1)
  }

  useLayoutEffect(() => {
    if (!jumpPending.current) return
    jumpPending.current = false
    const you = visibleYouCard()
    if (!you) return
    you.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    flashMatch(you)
  }, [activeRound, showTree, jumpTick])

  useLayoutEffect(() => {
    if (!showTree && !isDouble) return
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
  }, [detail.id, displayName, waiting, firstCount, maxRound, showTree, isDouble])

  if (!isBracket) return null

  const roundMatches = treeMatches
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
        // Double elim has no single round strip to tab through, so it always
        // shows the full draw rather than the narrow-screen rounds view.
        showTree || isDouble ? 'event-bracket-wrap--tree' : 'event-bracket-wrap--rounds',
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
          {!waiting && !isDouble && maxRound >= 2 ? (
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
      {!locked ? (
        <p className="event-bracket__note">
          {cap > 0
            ? `Preview — locks when ${Math.max(0, cap - detail.playerCount)} more join.`
            : 'Preview — locks when the roster fills.'}
        </p>
      ) : null}
      {waiting ? (
        <p className="lb-empty">
          {cap > 0
            ? `Waiting for ${Math.max(0, cap - detail.playerCount)} more to draw the bracket.`
            : 'Waiting for the roster to fill.'}
        </p>
      ) : isDouble ? (
        <div className="ev-bracket-stack">
          <section className="ev-bracket-half">
            <h3 className="ev-bracket-half__title">Winners bracket</h3>
            <p className="ev-bracket-half__note">Lose once and you drop to the losers bracket.</p>
            <BracketTree
              matches={winners}
              rounds={rounds}
              maxRound={maxRound}
              firstCount={firstCount}
              displayName={displayName}
              currentYouId={currentYou?.id ?? null}
              scrollerRef={scrollerRef}
              labelFor={winnersRoundLabel}
            />
          </section>
          {losers.length ? (
            <section className="ev-bracket-half">
              <h3 className="ev-bracket-half__title">Losers bracket</h3>
              <p className="ev-bracket-half__note">
                Second chance &mdash; one more loss and you&rsquo;re out.
              </p>
              <BracketColumns
                matches={losers}
                displayName={displayName}
                currentYouId={currentYou?.id ?? null}
                labelFor={loserRoundLabel}
              />
            </section>
          ) : null}
          {grandFinal.length ? (
            <section className="ev-bracket-half">
              <h3 className="ev-bracket-half__title">Grand final</h3>
              <p className="ev-bracket-half__note">
                The winners-side finalist needs one win. The challenger has to win twice.
              </p>
              <BracketColumns
                matches={grandFinal}
                displayName={displayName}
                currentYouId={currentYou?.id ?? null}
                labelFor={grandFinalLabel}
              />
            </section>
          ) : null}
        </div>
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
              matches={treeMatches}
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
