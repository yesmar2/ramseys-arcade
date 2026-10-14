import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { useImpersonation } from '../hooks/useImpersonation'
import { usePlayerName } from '../hooks/usePlayerName'
import { useSaveWait } from '../hooks/useSaveWait'
import { getGame } from '../data/games'
import { navigate, tournamentHref } from '../hooks/useHashRoute'
import { exitFullscreen } from '../lib/fullscreen'
import { linkCurrentNameToAccount } from '../lib/auth'
import { scoreText, scoreUnit } from '../lib/gameBoard'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import type { ReportBoardCard, ReportBoardRow, ReportLine, ReportRibbon, ReportTier } from '../lib/runReport'
import { ordinal } from '../lib/scoreboard'
import type { RunTickets } from '../lib/tickets'
import {
  eventKind,
  getTournament,
  getTournamentInvite,
  joinTournament,
  submitTournamentScore,
  triesCountAtStart,
  type StandingRow,
  type TournamentDetail,
} from '../lib/tournaments'
import { eventWinTakeover } from '../lib/winTakeover'
import { ReportSignIn, ReportWho, TagSlots, type ReportAction, type ReportLink } from './RunReport'
import { placeBadge, ReelButton, reelSteps, ReelTickets, RunReel, type ReelBadge } from './RunReel'
import { useLinkShare } from './ChallengeShare'
import { WinTakeover } from './WinTakeover'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { markWinsSeen } from '../lib/seenWins'
import { isRunAssisted } from '../lib/runAchievements'
import { runIdFor } from '../lib/runSession'
import { canShareEvent, eventShareCard, eventShareMessage, eventShareUrl } from '../lib/eventShare'

function attemptsLeftLabel(
  remaining: number | null,
  max: number | null,
  exhausted: boolean,
  outcome: 'champion' | 'match' | null,
): string | null {
  if (outcome) return null
  if (exhausted || remaining === 0) return 'no tries left'
  if (max == null) return 'unlimited tries'
  const left = remaining ?? max
  return `${left} ${left === 1 ? 'try' : 'tries'} left`
}

type TournamentScoreCardProps = {
  tournamentId: string
  gameSlug: string
  score: number
  subtitle?: string
  onDone: () => void
}

export type SubmitSnapshot = {
  improved: boolean
  best: number
  attemptsRemaining: number | null
  maxAttempts: number | null
  exhausted: boolean
  youWonMatch: boolean
  youWonTournament: boolean
  matchOpponent: string | null
  detail: TournamentDetail | null
  /** Tickets the run paid: a run in the day's event pays once a day. */
  tickets: { earned: number; balance: number } | null
}

const recentScoreSubmits = new Map<string, { at: number; promise: Promise<SubmitSnapshot> }>()

function submitCacheKey(tournamentId: string, gameSlug: string, name: string, score: number) {
  return `${tournamentId}|${gameSlug}|${name}|${score}`
}

async function submitTournamentRun(
  tournamentId: string,
  gameSlug: string,
  name: string,
  score: number,
  /** A racing daily's event: the course the run was on. */
  course: number | null = null,
): Promise<SubmitSnapshot> {
  // A stage-jumped run is not a real attempt; report it like a zero so it
  // posts no score. (Where tries count as they start, its try is already spent.)
  if (score <= 0 || isRunAssisted()) {
    const d = await getTournament(tournamentId, {
      playerName: name,
      game: gameSlug,
      invite: getTournamentInvite(tournamentId) ?? undefined,
    })
    const status = d.playerStatus
    return {
      improved: false,
      best: 0,
      attemptsRemaining: status?.attemptsRemaining ?? null,
      maxAttempts: status?.maxAttempts ?? null,
      exhausted: status ? !status.canPlay : false,
      youWonMatch: false,
      youWonTournament: false,
      matchOpponent: null,
      detail: d,
      tickets: null,
    }
  }

  const key = submitCacheKey(tournamentId, gameSlug, name, score)
  const cached = recentScoreSubmits.get(key)
  if (cached && Date.now() - cached.at < 8000) {
    return cached.promise
  }

  // This run's, taken before the join goes out: Play again meanwhile opens the next.
  const run = runIdFor(gameSlug)
  const promise = (async (): Promise<SubmitSnapshot> => {
    await joinTournament(tournamentId, name)
    const result = await submitTournamentScore(tournamentId, name, gameSlug, score, run, course)
    const d = await getTournament(tournamentId, {
      playerName: name,
      game: gameSlug,
      invite: getTournamentInvite(tournamentId) ?? undefined,
    }).catch(() => null)
    const playerStatus = d?.playerStatus
    const youWonTournament = Boolean(result.youWonTournament)
    const youWonMatch = Boolean(result.youWonMatch || youWonTournament)
    const attemptsRemaining =
      youWonMatch || youWonTournament
        ? 0
        : (result.attemptsRemaining ?? playerStatus?.attemptsRemaining ?? null)
    const maxAttempts = result.maxAttempts ?? playerStatus?.maxAttempts ?? null
    const exhausted =
      youWonMatch ||
      youWonTournament ||
      attemptsRemaining === 0 ||
      (playerStatus ? !playerStatus.canPlay : false)
    return {
      improved: result.improved,
      best: result.best,
      attemptsRemaining,
      maxAttempts,
      exhausted,
      youWonMatch,
      youWonTournament,
      matchOpponent: result.matchOpponent ?? null,
      detail: d,
      tickets: result.tickets ?? null,
    }
  })()

  recentScoreSubmits.set(key, { at: Date.now(), promise })
  return promise
}

/**
 * How many are in it with you: on a game, those who scored on it (the field's own count); in the standings, those
 * who've played. Past a hundred rows the page carries only some of them, so the standings' count isn't known.
 */
function fieldOf(detail: TournamentDetail, gameSlug: string | null): number | null {
  if (gameSlug) return detail.fieldByGame?.[gameSlug] ?? detail.standings.filter((s) => s.byGame[gameSlug]?.score != null).length
  if ((detail.standingsTotal ?? 0) > detail.standings.length) return null
  return detail.standings.filter((s) => s.gamesPlayed > 0).length
}

const outOf = (field: number | null) => (field != null && field > 1 ? `out of ${field}` : null)

/** What a posted run did in the event, as report lines, and how loud to be about it. */
export function eventReport(
  snapshot: SubmitSnapshot,
  gameSlug: string,
  name: string,
  score: number,
  posted: boolean,
): { tier: ReportTier; ribbon: ReportRibbon | null; lines: ReportLine[] } {
  const { detail, improved, best } = snapshot
  const game = getGame(gameSlug)?.name ?? gameSlug
  const title = detail?.title?.trim() || 'the event'
  const you = normalizePlayerName(name)
  const standing = detail?.standings.find((s) => normalizePlayerName(s.name) === you)
  const cell = standing?.byGame[gameSlug]
  const isBracket = detail ? eventKind(detail) === 'bracket' : false
  const overallPlace =
    detail && standing && detail.games.length > 1
      ? (standing.place ?? detail.standings.findIndex((s) => s.playerId === standing.playerId) + 1)
      : null
  const lines: ReportLine[] = []

  if (snapshot.youWonMatch) {
    lines.push({
      id: 'match',
      icon: 'crown',
      label: snapshot.youWonTournament ? 'The final' : 'Your match',
      detail: snapshot.youWonTournament
        ? 'Bracket complete'
        : snapshot.matchOpponent
          ? `beat ${snapshot.matchOpponent}, through to the next round`
          : 'Through to the next round',
      value: 'Won',
      tone: 'gold',
    })
  }
  if (posted) {
    lines.push({
      id: 'best',
      icon: improved ? 'up' : 'target',
      label: 'Your best here',
      detail: improved ? 'A new best in this event' : best > score ? `${scoreText(gameSlug, best - score)} more to beat it` : 'Tied it',
      value: formatLeaderboardScore(gameSlug, best),
      tone: improved ? 'accent' : 'plain',
    })
  }
  // Places, not what each place is worth toward the event, and out of how many.
  if (detail && !isBracket && cell?.place != null) {
    lines.push({
      id: 'game',
      icon: cell.place === 1 ? 'crown' : 'board',
      label: detail.games.length > 1 ? `${game} in this event` : 'In this event',
      detail: outOf(fieldOf(detail, gameSlug)),
      value: `#${cell.place}`,
      tone: cell.place === 1 ? 'gold' : cell.place <= 3 ? 'accent' : 'plain',
    })
  }
  if (detail && !isBracket && overallPlace) {
    lines.push({
      id: 'overall',
      icon: overallPlace === 1 ? 'crown' : 'sum',
      label: 'Event standings',
      detail: outOf(fieldOf(detail, null)),
      value: `#${overallPlace}`,
      tone: overallPlace === 1 ? 'gold' : overallPlace <= 3 ? 'accent' : 'plain',
    })
  }

  // A bracket has no standings worth celebrating until it is decided: leading
  // on score means nothing while your opponent has not played.
  if (snapshot.youWonTournament) return { tier: 'big', ribbon: { icon: 'crown', text: 'Champion', tone: 'gold' }, lines }
  if (snapshot.youWonMatch) {
    return {
      tier: 'big',
      ribbon: { icon: 'crown', text: snapshot.matchOpponent ? `You beat ${snapshot.matchOpponent}` : 'Match won', tone: 'gold' },
      lines,
    }
  }
  if (!isBracket && posted) {
    if (overallPlace === 1) return { tier: 'big', ribbon: { icon: 'crown', text: `1st in ${title}`, tone: 'gold' }, lines }
    if (overallPlace && overallPlace <= 3) {
      return { tier: 'lit', ribbon: { icon: 'up', text: `${ordinal(overallPlace)} in ${title}`, tone: 'accent' }, lines }
    }
    if (!overallPlace && cell?.place === 1) {
      return { tier: 'big', ribbon: { icon: 'crown', text: `1st in ${title}`, tone: 'gold' }, lines }
    }
    if (cell?.place != null && cell.place <= 3) {
      return { tier: 'lit', ribbon: { icon: 'up', text: `${ordinal(cell.place)} on ${game}`, tone: 'accent' }, lines }
    }
  }
  if (improved && posted) return { tier: 'lit', ribbon: { icon: 'up', text: 'New best in the event', tone: 'accent' }, lines }
  return { tier: 'quiet', ribbon: null, lines }
}

/** Tries left where the event counts them: none to say where they're unlimited, or the run's match was won. */
function triesLeft(snapshot: SubmitSnapshot): number | null {
  if (snapshot.youWonMatch || snapshot.youWonTournament || snapshot.maxAttempts == null) return null
  if (snapshot.exhausted) return 0
  return snapshot.attemptsRemaining ?? snapshot.maxAttempts
}

/** The day's event pays once a day: its tickets as a run's, for the reel's tickets step. */
function eventTickets(paid: SubmitSnapshot['tickets']): RunTickets | null {
  if (!paid || paid.earned <= 0) return null
  return {
    earned: paid.earned,
    lines: [{ reason: 'daily', amount: paid.earned }],
    balance: paid.balance,
    reached: null,
    next: null,
    base: 0,
    step: 0,
    paidBefore: 0,
    capped: 0,
    todayLeft: 0,
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * What the event's answer gives the reel: the report, the line Where it landed makes much of (the match, else the
 * place in the standings, else on the game), the tickets it paid, and the last step's badges and note.
 */
/**
 * The event's card on the run's first page: the match it won, or its place in the event (the standings for a
 * Triple, the game's for a one-game event) with the players either side of you.
 */
function eventBoardCard(snapshot: SubmitSnapshot, gameSlug: string, name: string, lines: ReportLine[]): ReportBoardCard | null {
  const line = (id: string) => lines.find((l) => l.id === id) ?? null
  const match = line('match')
  if (match) return { label: match.label, value: 'Won', gold: true, move: null, detail: match.detail, rows: [] }
  const { detail } = snapshot
  const place = line('overall') ?? line('game')
  if (!detail || !place) return null
  const multi = detail.games.length > 1
  const you = normalizePlayerName(name)
  const ranked = detail.standings
    .map((s, i) => ({ s, at: multi ? (s.place ?? i + 1) : (s.byGame[gameSlug]?.place ?? null) }))
    .filter((r): r is { s: StandingRow; at: number } => r.at != null)
    .sort((a, b) => a.at - b.at)
  const mine = ranked.findIndex((r) => normalizePlayerName(r.s.name) === you)
  const rows: ReportBoardRow[] = (mine < 0 ? [] : ranked.slice(Math.max(0, mine - 1), mine + 2)).map(({ s, at }) => ({
    place: at,
    name: s.name,
    score: multi ? `${s.totalPoints.toLocaleString()} pts` : formatLeaderboardScore(gameSlug, s.byGame[gameSlug]?.score ?? 0),
    avatarId: s.avatarId,
    you: normalizePlayerName(s.name) === you,
  }))
  const at = Number(place.value.replace('#', ''))
  return { label: place.label, value: ordinal(at), gold: at === 1, move: null, detail: place.detail, rows }
}

/**
 * What the event's answer gives the reel: the report, the card under the score, the tickets it paid, and the last
 * page's recap.
 */
export function eventReelParts(snapshot: SubmitSnapshot, gameSlug: string, name: string, score: number, posted: boolean) {
  const report = eventReport(snapshot, gameSlug, name, score, posted)
  const line = (id: string) => report.lines.find((l) => l.id === id) ?? null
  const best = line('best')
  const paid = eventTickets(snapshot.tickets)
  const game = getGame(gameSlug)?.name ?? gameSlug
  const figure = formatLeaderboardScore(gameSlug, score)
  const unit = scoreUnit(gameSlug, score)
  // The last page's recap: the score, the match won, the places, the tickets, the tries left.
  const recap: ReelBadge[] = [
    {
      key: 'score',
      kind: 'score',
      value: unit ? `${figure} ${unit}` : figure,
      label: report.ribbon?.text ?? (best?.detail ? capital(best.detail) : game),
      icon: snapshot.improved ? 'up' : 'target',
    },
  ]
  const match = line('match')
  if (match) recap.push({ key: 'won', kind: 'won', value: 'Won', label: match.label })
  const overall = line('overall')
  if (overall) recap.push(placeBadge(overall, 'overall'))
  const onGame = line('game')
  if (onGame) recap.push(placeBadge(onGame, 'game'))
  if (paid) recap.push({ key: 'tickets', kind: 'tickets', value: `+${paid.earned}`, label: paid.earned === 1 ? 'Ticket' : 'Tickets' })
  const left = triesLeft(snapshot)
  if (left != null) recap.push({ key: 'tries', kind: 'tries', value: String(left), label: left === 1 ? 'Try left' : 'Tries left' })
  return { ...report, board: eventBoardCard(snapshot, gameSlug, name, report.lines), paid, recap }
}

export function TournamentScoreCard({
  tournamentId,
  gameSlug,
  score,
  subtitle,
  onDone,
}: TournamentScoreCardProps) {
  const { signedOut, loading: authLoading } = useAuth()
  // A racing daily's event: the course its runs are raced on.
  const playing = useTournamentPlay()
  const impersonation = useImpersonation()
  // Saving needs a session, and acting as a tag (dev) doesn't give one: a borrowed tag left on a device
  // signed out showed "Signed in, no tag yet" and a tag box the API then refused. A session whose account
  // couldn't be asked for posts all the same: the API knows whose it is, and its 401 would mean signed out.
  const canSaveScores = !signedOut
  // The post waits for the account's first answer only: asked again later, it never goes out a second time.
  const [authAsked, setAuthAsked] = useState(!authLoading)
  useEffect(() => {
    if (!authLoading) setAuthAsked(true)
  }, [authLoading])
  const playerName = usePlayerName()
  const knownName = (playerName || getLastPlayerName()).trim().toUpperCase()
  const [name, setName] = useState(knownName)
  const [nameDraft, setNameDraft] = useState('')
  const [status, setStatus] = useState<'needAuth' | 'needName' | 'saving' | 'done' | 'error'>(
    () => (authLoading ? 'saving' : !canSaveScores ? 'needAuth' : knownName ? 'saving' : 'needName'),
  )
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<SubmitSnapshot | null>(null)
  const [takeoverDone, setTakeoverDone] = useState(false)
  // The run's post: out now, or in. Never a second for the same run, whatever changes under the card, and its
  // answer is the card's while the card is up.
  const postRef = useRef<'out' | 'in' | null>(null)
  const shownRef = useRef(true)
  useEffect(() => {
    shownRef.current = true
    return () => {
      shownRef.current = false
    }
  }, [])
  // Signed in on the card: the run goes to the event again under the new session, though its name and the rest
  // may not have changed (a session the post's 401 ended, replaced by another).
  const [signIns, setSignIns] = useState(0)
  const playRef = useRef<HTMLButtonElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const tagId = useId()
  const [shareLink, sharePanel, shareCopied] = useLinkShare()

  useEffect(() => {
    if (knownName && !name) setName(knownName)
  }, [knownName, name])

  useEffect(() => {
    if (status === 'needName') tagRef.current?.focus({ preventScroll: true })
  }, [status])

  useEffect(() => {
    if (!authAsked || postRef.current) return
    if (!canSaveScores) {
      setStatus('needAuth')
      setName('')
      return
    }
    if (!name && knownName) {
      setName(knownName)
      return
    }
    if (!name) {
      setStatus('needName')
      return
    }

    async function run() {
      postRef.current = 'out'
      setStatus('saving')
      setError(null)

      try {
        const next = await submitTournamentRun(tournamentId, gameSlug, name, score, playing?.course ?? null)
        postRef.current = 'in'
        if (!shownRef.current) return
        setSnapshot(next)
        setStatus('done')
        if (next.youWonTournament || next.youWonMatch) {
          // Seen here, so the event page does not celebrate it again.
          const mine = (next.detail?.bracket?.matches ?? []).filter(
            (m) =>
              m.winnerId &&
              m.players.some(
                (p) => p && normalizePlayerName(p.name) === normalizePlayerName(name) && p.id === m.winnerId,
              ),
          )
          markWinsSeen(tournamentId, mine.map((m) => m.id))
        }
      } catch (err) {
        // Not in: a sign-in, or a new tag, may send it again.
        postRef.current = null
        if (!shownRef.current) return
        const code =
          err instanceof ApiError
            ? err.code
            : (err as Error & { code?: string }).code
        if (code === 'AUTH_REQUIRED') {
          // The sign-in's own words already say it.
          setStatus('needAuth')
          setError(null)
          return
        }
        if (code === 'NAME_TAKEN') {
          setName('')
          setNameDraft('')
          setStatus('needName')
          setError('That gamer tag is taken. Pick another.')
          return
        }
        if (code === 'INVITE_REQUIRED') {
          setStatus('error')
          setError('Could not submit. Reopen the event from your invite link.')
          return
        }
        if (code === 'TRY_NOT_STARTED') {
          setStatus('error')
          setError('This run didn’t start as a try in the event, so it can’t post here.')
          return
        }
        if (code === 'ATTEMPTS_EXHAUSTED') {
          setSnapshot((prev) => ({
            improved: false,
            best: prev?.best ?? 0,
            attemptsRemaining: 0,
            maxAttempts: prev?.maxAttempts ?? 1,
            exhausted: true,
            youWonMatch: false,
            youWonTournament: false,
            matchOpponent: null,
            detail: prev?.detail ?? null,
            tickets: null,
          }))
          setStatus('done')
          setError(null)
          return
        }
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not submit score')
      }
    }

    void run()
  }, [tournamentId, gameSlug, score, name, authAsked, canSaveScores, knownName, signIns])

  const submitName = async () => {
    const cleaned = normalizePlayerName(nameDraft)
    if (!cleaned) return
    if (!canSaveScores) {
      setStatus('needAuth')
      return
    }
    setError(null)
    try {
      if (impersonation) {
        setName(cleaned)
        return
      }
      await linkCurrentNameToAccount(cleaned)
      setName(cleaned)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError('That gamer tag is taken. Pick another.')
      } else if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') {
        setStatus('needAuth')
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : 'Could not save gamer tag')
      }
    }
  }

  const accentStyle = gameAccentStyle(gameSlug)
  const accent = String((accentStyle as Record<string, string>)['--celeb-accent'] ?? '#2eb8a0')
  const detail = snapshot?.detail ?? null
  // The event's name from the page it's played from, before the post's answer brings it.
  const eventName = detail?.title?.trim() || playing?.title?.trim() || null
  const eventTitle = eventName ?? 'Event'
  const game = getGame(gameSlug)?.name ?? gameSlug
  const isBracket = detail ? eventKind(detail) === 'bracket' : false
  const done = status === 'done' && snapshot
  // A zero, or a run that used the stage jump, posts nothing; it costs a try only where tries count as they start.
  const posted = score > 0 && !isRunAssisted()
  const spentTry = detail ? triesCountAtStart(detail) : false
  const parts = done ? eventReelParts(snapshot, gameSlug, name, score, posted) : null
  const ribbon = parts?.ribbon ?? null
  const tier = parts?.tier ?? 'quiet'
  const standingsHref = tournamentHref(tournamentId)
  const toEvent = () => {
    void exitFullscreen()
    navigate(standingsHref)
  }
  // Play again waits on the post, for a while (useSaveWait): a press can't cut the run off before it's in.
  const postWaitOver = useSaveWait(status === 'saving')
  const holding = status === 'saving' && canSaveScores && !postWaitOver
  const unposted = status === 'needAuth' || status === 'needName'

  let primary: ReportAction = {
    label: holding ? 'Posting…' : 'Play again',
    busy: holding,
    onClick: onDone,
    buttonRef: playRef,
  }
  let secondary: ReportAction | null = null
  /** What the post waits on, a step of its own after the run: the sign-in, or a tag. */
  let ask: ReactNode = null
  /** A word on a run that wasn't posted: no score, a stage skip, a failed post. */
  let note: ReactNode = null
  let who: ReactNode = null
  if (status === 'needAuth') {
    ask = (
      <ReportSignIn
        lead={<>Sign in to post {scoreText(gameSlug, score)} to {eventName ?? 'this event'}.</>}
        error={error}
        onSignedIn={() => {
          setError(null)
          if (knownName) setName(knownName)
          else setStatus('needName')
          setSignIns((n) => n + 1)
        }}
      />
    )
    who = <ReportWho text="Not posted yet" />
  } else if (status === 'needName') {
    // The tag in slots, and the way to post with it: the reel's own Skip goes on without.
    ask = (
      <>
        <TagSlots
          id={tagId}
          value={nameDraft}
          onChange={setNameDraft}
          onSubmit={() => void submitName()}
          inputRef={tagRef}
          error={error}
          lead={eventName ? `Your tag goes on ${eventName}’s standings.` : 'Your tag goes on the event’s standings.'}
        />
        <ReelButton
          action={{
            label: 'Post score',
            onClick: () => void submitName(),
            disabled: !normalizePlayerName(nameDraft),
          }}
        />
      </>
    )
    who = <ReportWho text="Signed in, no tag yet" />
  } else if (status === 'error') {
    note = <p className="panel__error">{error}</p>
    who = <ReportWho text="Not posted" />
  } else if (status === 'saving') {
    who = <ReportWho name={name || null} text="Posting…" />
  } else if (done) {
    const left = attemptsLeftLabel(
      snapshot.attemptsRemaining,
      snapshot.maxAttempts,
      snapshot.exhausted,
      snapshot.youWonTournament ? 'champion' : snapshot.youWonMatch ? 'match' : null,
    )
    if (!posted) {
      note = (
        <p className="report__note">
          {score > 0
            ? 'Stage skip used, so this run wasn’t posted.'
            : spentTry
              ? 'No score this run, so nothing was posted. The try still counts.'
              : 'No score this run, so nothing was posted.'}
        </p>
      )
    }
    const as = posted ? `Posted as ${name}` : 'Not posted'
    // Tries the recap counts aren't said again under it.
    const tail = left && !parts?.recap.some((item) => item.key === 'tries') ? left : null
    who = <ReportWho name={posted ? name : null} text={tail ? `${as}, ${tail}` : as} />
    if (snapshot.exhausted || snapshot.youWonMatch) {
      primary = {
        label: snapshot.youWonTournament || isBracket ? 'View bracket' : 'View standings',
        href: standingsHref,
      }
    }
    // Where this puts you, as a link that unfurls into your place: for a public event of scores, once you're on it.
    const message = posted && snapshot.detail && canShareEvent(snapshot.detail) ? eventShareMessage(snapshot.detail, gameSlug, name) : null
    if (message) {
      secondary = {
        label: shareCopied ? 'Copied' : 'Share',
        icon: 'share',
        onClick: () =>
          shareLink({
            game: gameSlug,
            url: eventShareUrl(tournamentId, name),
            message,
            cards: [eventShareCard(tournamentId, name), '/og.png'],
            cardAlt: `The card the link shows: where you stand on ${eventTitle}`,
            title: 'Share where you stand',
            kicker: `${eventTitle} · ${scoreText(gameSlug, score)}`,
          }),
      }
    }
  }

  const links: ReportLink[] =
    done && !snapshot.exhausted && !snapshot.youWonMatch ? [{ label: isBracket ? 'Bracket' : 'Standings', icon: 'board', onClick: toEvent }] : []
  // The reel (RunReel.tsx), as a game's run has it: the run, then what it did in the event, the tickets the day's
  // event paid, then what next. The event's name is over every step, and the game's over the score.
  const lastBits = [note, unposted ? ask : null].filter(Boolean)
  const steps = reelSteps({
    phase: status === 'saving' ? 'pending' : unposted ? 'ask' : done ? 'saved' : 'done',
    slow: postWaitOver,
    wait: { said: `Posting to ${eventName ?? 'the event'}…`, slow: 'Still posting. It finishes even if you play on.' },
    run: {
      titleId,
      tier,
      ribbon,
      eyebrow: game,
      score: formatLeaderboardScore(gameSlug, score),
      unit: scoreUnit(gameSlug, score),
      sub: subtitle ?? null,
      scoreTone: ribbon?.tone === 'gold' ? 'gold' : ribbon ? 'accent' : 'plain',
    },
    board: parts?.board ?? null,
    tickets: parts?.paid ? <ReelTickets paid={parts.paid} game={gameSlug} /> : null,
    ask,
    askGoLabel: status === 'needName' ? 'Skip' : 'Not now',
    askFocus: status === 'needName' ? tagRef : undefined,
    recap: parts?.recap ?? [
      { key: 'score', kind: 'score', value: [formatLeaderboardScore(gameSlug, score), scoreUnit(gameSlug, score)].filter(Boolean).join(' '), label: game },
    ],
    block: lastBits.length ? lastBits.map((bit, i) => <Fragment key={i}>{bit}</Fragment>) : null,
    primary,
    secondary,
    who,
    links,
  })
  // Winning the event takes the whole screen, once, over the reel.
  const takeover =
    done && snapshot.youWonTournament && snapshot.detail && !takeoverDone
      ? eventWinTakeover(snapshot.detail, name)
      : null
  return (
    <>
      <RunReel
        label={`${ribbon?.text ?? eventTitle}, ${scoreText(gameSlug, score)}`}
        style={accentStyle}
        accent={accent}
        game={eventTitle}
        tier={tier}
        steps={steps}
        primaryRef={playRef}
        leave={{ label: 'Back to event', onClick: toEvent }}
        // Esc goes back to the game once the run is in, never while a tag is being typed.
        onEscape={status === 'needName' || !done ? undefined : onDone}
      />
      {takeover ? (
        <WinTakeover
          data={takeover}
          primary={{ label: 'See the final standings', href: standingsHref }}
          onClose={() => setTakeoverDone(true)}
        />
      ) : null}
      {sharePanel}
    </>
  )
}
