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
  slotFeedLabel,
  type BracketSide,
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

function sideTabLabel(side: BracketSide, round: number, maxRound: number) {
  if (side === 'gf') return round === 1 ? 'Title' : 'Reset'
  if (side === 'lb') return round === maxRound ? 'LF' : `L${round}`
  return roundTabLabel(round, maxRound)
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
        const feedLabel = side ? null : slotFeedLabel(match.from?.[idx])
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
            <span
              className={`event-bracket__name${vacant ? ' event-bracket__name--vacant' : ''}${
                feedLabel ? ' event-bracket__name--feed' : ''
              }`}
            >
              {isBye ? 'Bye' : (side?.name ?? feedLabel ?? 'TBD')}
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
 * Connector tree for one side of a draw.
 *
 * Round geometry is read off the actual match counts rather than assuming
 * every round halves the field. The winners bracket does halve, but the
 * losers bracket alternates: minor rounds hold their size while fresh losers
 * drop in from the winners side, and major rounds pair the survivors off. A
 * round that halves gets the usual pair-into-one elbow; a round that holds
 * its size gets a straight carry line.
 */
function BracketTree({
  matches,
  displayName,
  currentYouId,
  scrollerRef,
  labelFor = bracketRoundLabel,
}: {
  matches: PublicBracketMatch[]
  displayName: string
  currentYouId: string | null
  scrollerRef?: RefObject<HTMLDivElement | null>
  labelFor?: (round: number, maxRound: number) => string
}) {
  const sizeOf = new Map<number, number>()
  for (const match of matches) sizeOf.set(match.round, (sizeOf.get(match.round) ?? 0) + 1)
  const rounds = [...sizeOf.keys()].sort((a, b) => a - b)
  const firstRound = rounds[0] ?? 1
  const maxRound = rounds.at(-1) ?? 1
  const leafCount = sizeOf.get(firstRound) ?? 1

  return (
    <div ref={scrollerRef} className="event-bracket-scroller">
      <div
        className="event-bracket"
        style={
          {
            '--round-count': rounds.length,
            '--first-count': leafCount,
          } as CSSProperties
        }
      >
        {rounds.map((round, idx) => (
          <h3
            key={`title-${round}`}
            className="event-bracket__round-title"
            style={{ gridColumn: idx + 1, gridRow: 1 }}
          >
            {labelFor(round, maxRound)}
          </h3>
        ))}
        {matches.map((match) => {
          const column = rounds.indexOf(match.round) + 1
          const size = sizeOf.get(match.round) ?? 1
          const span = Math.max(1, Math.round(leafCount / size))
          const nextSize = sizeOf.get(match.round + 1)
          // Halving round: two matches elbow into one. Same-size round: the
          // winner carries straight across into the next seat.
          const merges = nextSize != null && nextSize < size
          const connector =
            match.round === maxRound
              ? 'event-bracket__slot--final'
              : merges
                ? match.slot % 2 === 0
                  ? 'event-bracket__slot--out-top'
                  : 'event-bracket__slot--out-bot'
                : 'event-bracket__slot--carry'
          // Nothing feeds the opening round, so it gets no incoming line.
          const fed = match.round > firstRound ? ' event-bracket__slot--fed' : ''
          return (
            <div
              key={match.id}
              className={`event-bracket__slot ${connector}${fed}`}
              style={{
                gridColumn: column,
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
                  {merges ? (
                    <span className="event-bracket__wire event-bracket__wire--v" />
                  ) : null}
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
  /*
   * The grand final is the winners bracket's last column, not a separate
   * block: its first seat is whoever won that tree. Renumber its rounds to
   * continue past the winners final so the two draw as one run of columns —
   * the losers side still feeds the other seat from its own section, which is
   * the one relationship a tree cannot show.
   */
  const wbRounds = winners.reduce((m, row) => Math.max(m, row.round), 1)
  /*
   * The decider only happens if the losers-side player wins the grand final,
   * and most of the time it never does. Drawing it up front puts three finals
   * on the board when at most two get played, so it appears once someone is
   * actually seated in it.
   */
  const crown = grandFinal
    .filter((m) => m.round === 1 || resetSeated)
    .map((m) => ({ ...m, round: wbRounds + m.round }))
  const winnersRun = [...winners, ...crown]
  const crownLabel = (round: number) => {
    if (round <= wbRounds) return winnersRoundLabel(round, wbRounds)
    if (round === wbRounds + 1) return 'Grand final'
    return 'Decider'
  }

  const treeMatches = isDouble ? winners : matches
  const maxRound = treeMatches.reduce((m, row) => Math.max(m, row.round), 1)
  const firstCount = treeMatches.filter((m) => m.round === 1).length || 1
  const currentYou = yourCurrentMatch(matches, displayName)
  const youPlaying = Boolean(currentYou)
  const [activeRound, setActiveRound] = useState(currentYou?.round ?? 1)
  const [showTree, setShowTree] = useState(false)
  /** Narrow screens show one half of a double draw at a time. */
  const [narrowSide, setNarrowSide] = useState<BracketSide>('wb')
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
    setNarrowSide(currentYou ? matchSide(currentYou) : 'wb')
    setShowTree(false)
  }, [detail.id, currentYou?.id, currentYou?.round])

  const scrollToYou = () => {
    if (currentYou) {
      setActiveRound(currentYou.round)
      setNarrowSide(matchSide(currentYou))
    }
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

  /*
   * Narrow screens page through one side of the draw. Winners and losers both
   * number their rounds from 1, so the round strip is scoped to the chosen
   * side rather than to the draw as a whole.
   */
  const sideMatches = !isDouble
    ? matches
    : narrowSide === 'lb'
      ? losers
      : narrowSide === 'gf'
        ? grandFinal
        : winners
  const sideRounds = [...new Set(sideMatches.map((m) => m.round))].sort((a, b) => a - b)
  const sideMaxRound = sideRounds.at(-1) ?? 1
  const shownRound = sideRounds.includes(activeRound) ? activeRound : (sideRounds[0] ?? 1)
  const sideOptions: { key: BracketSide; label: string }[] = [
    { key: 'wb', label: 'Winners' },
    ...(losers.length ? [{ key: 'lb' as BracketSide, label: 'Losers' }] : []),
    ...(grandFinal.length ? [{ key: 'gf' as BracketSide, label: 'Grand final' }] : []),
  ]

  const roundMatches = sideMatches
    .filter((match) => match.round === shownRound)
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
        narrow && !showTree
          ? 'event-bracket-wrap--rounds'
          : 'event-bracket-wrap--tree',
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
          {!waiting && (isDouble || maxRound >= 2) ? (
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
      ) : narrow && !showTree ? (
        <>
          {isDouble && sideOptions.length > 1 ? (
            <div
              className="event-bracket-rounds ev-bracket-sides"
              role="tablist"
              aria-label="Bracket"
            >
              {sideOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={narrowSide === opt.key}
                  className={`event-bracket-rounds__tab${
                    narrowSide === opt.key ? ' event-bracket-rounds__tab--on' : ''
                  }`}
                  onClick={() => setNarrowSide(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
          {sideRounds.length > 1 ? (
            <div className="event-bracket-rounds" role="tablist" aria-label="Rounds">
              {sideRounds.map((round) => {
                const selected = round === shownRound
                return (
                  <button
                    key={round}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={
                      isDouble && narrowSide === 'lb'
                        ? loserRoundLabel(round, sideMaxRound)
                        : bracketRoundLabel(round, sideMaxRound)
                    }
                    className={`event-bracket-rounds__tab${
                      selected ? ' event-bracket-rounds__tab--on' : ''
                    }`}
                    onClick={() => {
                      setActiveRound(round)
                      setShowTree(false)
                    }}
                  >
                    {sideTabLabel(isDouble ? narrowSide : 'wb', round, sideMaxRound)}
                  </button>
                )
              })}
            </div>
          ) : null}
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
      ) : isDouble ? (
        <div className="ev-bracket-stack">
          <section className="ev-bracket-half">
            <h3 className="ev-bracket-half__title">Winners bracket</h3>
            <p className="ev-bracket-half__note">
              Lose once and you drop to the losers bracket. The grand final is the last
              column, where the losers-side survivor climbs back in &mdash; often for a
              rematch of the winners final.
            </p>
            <BracketTree
              matches={winnersRun}
              displayName={displayName}
              currentYouId={currentYou?.id ?? null}
              scrollerRef={scrollerRef}
              labelFor={crownLabel}
            />
          </section>
          {losers.length ? (
            <section className="ev-bracket-half">
              <h3 className="ev-bracket-half__title">Losers bracket</h3>
              <p className="ev-bracket-half__note">
                Second chance &mdash; one more loss and you&rsquo;re out. Empty seats name
                the match they are waiting on.
              </p>
              <BracketTree
                matches={losers}
                displayName={displayName}
                currentYouId={currentYou?.id ?? null}
                labelFor={loserRoundLabel}
              />
            </section>
          ) : null}
        </div>
      ) : (
        <BracketTree
          matches={treeMatches}
          displayName={displayName}
          currentYouId={currentYou?.id ?? null}
          scrollerRef={scrollerRef}
        />
      )}
    </section>
  )
}
