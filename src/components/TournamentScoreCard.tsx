import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
import type { ReportLine, ReportRibbon, ReportTier } from '../lib/runReport'
import { ordinal } from '../lib/scoreboard'
import {
  eventKind,
  getTournament,
  getTournamentInvite,
  joinTournament,
  submitTournamentScore,
  type TournamentDetail,
} from '../lib/tournaments'
import { eventWinTakeover } from '../lib/winTakeover'
import { ReportSignIn, ReportWho, RunReport, TagSlots, type ReportAction } from './RunReport'
import { WinTakeover } from './WinTakeover'
import { markWinsSeen } from '../lib/seenWins'
import { isRunAssisted } from '../lib/runAchievements'
import { runIdFor } from '../lib/runSession'

function attemptsLeftLabel(
  remaining: number | null,
  max: number | null,
  exhausted: boolean,
  outcome: 'champion' | 'match' | null,
): string | null {
  if (outcome) return null
  if (exhausted || remaining === 0) return 'no attempts left'
  if (max == null) return 'unlimited attempts'
  const left = remaining ?? max
  return `${left} attempt${left === 1 ? '' : 's'} left`
}

type TournamentScoreCardProps = {
  tournamentId: string
  gameSlug: string
  score: number
  subtitle?: string
  onDone: () => void
}

type SubmitSnapshot = {
  improved: boolean
  best: number
  attemptsRemaining: number | null
  maxAttempts: number | null
  exhausted: boolean
  youWonMatch: boolean
  youWonTournament: boolean
  matchOpponent: string | null
  detail: TournamentDetail | null
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
): Promise<SubmitSnapshot> {
  // A stage-jumped run is not a real attempt; report it like a zero so it
  // neither posts a score nor burns one of the player's tries.
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
    const result = await submitTournamentScore(tournamentId, name, gameSlug, score, run)
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
    }
  })()

  recentScoreSubmits.set(key, { at: Date.now(), promise })
  return promise
}

/** What a posted run did in the event, as report lines, and how loud to be about it. */
function eventReport(
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
      ? detail.standings.findIndex((s) => s.playerId === standing.playerId) + 1
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
  if (!isBracket && cell?.place != null) {
    lines.push({
      id: 'game',
      icon: cell.place === 1 ? 'crown' : 'board',
      label: detail && detail.games.length > 1 ? `${game} in this event` : 'In this event',
      detail: cell.points > 0 ? `${cell.points.toLocaleString()} point${cell.points === 1 ? '' : 's'} toward the standings` : null,
      value: `#${cell.place}`,
      tone: cell.place === 1 ? 'gold' : cell.place <= 3 ? 'accent' : 'plain',
    })
  }
  if (!isBracket && overallPlace) {
    lines.push({
      id: 'overall',
      icon: overallPlace === 1 ? 'crown' : 'sum',
      label: 'Event standings',
      detail:
        detail?.format === 'place-points' && standing
          ? `${standing.totalPoints.toLocaleString()} point${standing.totalPoints === 1 ? '' : 's'}`
          : null,
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

export function TournamentScoreCard({
  tournamentId,
  gameSlug,
  score,
  subtitle,
  onDone,
}: TournamentScoreCardProps) {
  const { signedIn, loading: authLoading } = useAuth()
  const impersonation = useImpersonation()
  const canSaveScores = signedIn || Boolean(impersonation)
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
  const playRef = useRef<HTMLButtonElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const tagId = useId()

  useEffect(() => {
    if (knownName && !name) setName(knownName)
  }, [knownName, name])

  useEffect(() => {
    if (status === 'needName') tagRef.current?.focus({ preventScroll: true })
  }, [status])

  useEffect(() => {
    if (authLoading) return
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

    let cancelled = false

    async function run() {
      setStatus('saving')
      setError(null)

      try {
        const next = await submitTournamentRun(tournamentId, gameSlug, name, score)
        if (cancelled) return
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
        if (cancelled) return
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
    return () => {
      cancelled = true
    }
  }, [tournamentId, gameSlug, score, name, authLoading, canSaveScores, knownName])

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
  const eventName = detail?.title?.trim() || null
  const eventTitle = eventName ?? 'Event'
  const isBracket = detail ? eventKind(detail) === 'bracket' : false
  const done = status === 'done' && snapshot
  // A zero, or a run that used the stage jump, posts nothing and costs no attempt.
  const posted = score > 0 && !isRunAssisted()
  const outcome = done ? eventReport(snapshot, gameSlug, name, score, posted) : null
  const ribbon = outcome?.ribbon ?? null
  const standingsHref = tournamentHref(tournamentId)
  // Play again waits on the post, for a while (useSaveWait): a press can't cut the run off before it's in.
  const postWaitOver = useSaveWait(status === 'saving')
  const holding = status === 'saving' && canSaveScores && !postWaitOver

  let primary: ReportAction = {
    label: holding ? 'Posting…' : 'Play again',
    busy: holding,
    onClick: onDone,
    buttonRef: playRef,
  }
  let secondary: ReportAction | null = null
  let block: ReactNode = null
  let who: ReactNode = null
  if (status === 'needAuth') {
    block = (
      <ReportSignIn
        lead={<>Sign in to post {scoreText(gameSlug, score)} to {eventName ?? 'this event'}.</>}
        error={error}
        onSignedIn={() => {
          setError(null)
          if (knownName) setName(knownName)
          else setStatus('needName')
        }}
      />
    )
    who = <ReportWho text="Not posted yet" />
  } else if (status === 'needName') {
    primary = {
      label: 'Post score',
      onClick: () => void submitName(),
      disabled: !normalizePlayerName(nameDraft),
    }
    secondary = { label: 'Skip', onClick: onDone }
    block = (
      <TagSlots
        id={tagId}
        value={nameDraft}
        onChange={setNameDraft}
        onSubmit={() => void submitName()}
        inputRef={tagRef}
        error={error}
        lead={eventName ? `Your tag goes on ${eventName}’s standings.` : 'Your tag goes on the event’s standings.'}
      />
    )
    who = <ReportWho text="Signed in, no tag yet" />
  } else if (status === 'error') {
    block = <p className="panel__error">{error}</p>
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
      block = (
        <p className="report__note">
          {score > 0 ? 'Stage skip used, so this run wasn’t posted.' : 'No score this run, so nothing was posted.'}
        </p>
      )
    }
    const as = posted ? `Posted as ${name}` : 'Not posted'
    who = <ReportWho name={posted ? name : null} text={left ? `${as}, ${left}` : as} />
    if (snapshot.exhausted || snapshot.youWonMatch) {
      primary = {
        label: snapshot.youWonTournament || isBracket ? 'View bracket' : 'View standings',
        href: standingsHref,
      }
    }
  }

  const links =
    done && !snapshot.exhausted && !snapshot.youWonMatch
      ? [{ label: 'Standings', onClick: () => navigate(standingsHref) }]
      : []
  const heading = ribbon?.text ?? eventTitle
  // Winning the event takes the whole screen, once, with the report under it.
  const takeover =
    done && snapshot.youWonTournament && snapshot.detail && !takeoverDone
      ? eventWinTakeover(snapshot.detail, name)
      : null
  return (
    <>
      <RunReport
        label={`${heading}, ${scoreText(gameSlug, score)}`}
        titleId={titleId}
        style={accentStyle}
        accent={accent}
        initialFocus={status === 'needName' ? tagRef : playRef}
        onEscape={status === 'needName' || !done ? undefined : onDone}
        tier={outcome?.tier ?? 'quiet'}
        ribbon={ribbon}
        eyebrow={eventTitle}
        score={formatLeaderboardScore(gameSlug, score)}
        unit={scoreUnit(gameSlug, score)}
        sub={ribbon ? [eventTitle, subtitle].filter(Boolean).join(' · ') : (subtitle ?? null)}
        scoreTone={ribbon?.tone === 'gold' ? 'gold' : ribbon ? 'accent' : 'plain'}
        lines={status === 'saving' ? null : (outcome?.lines ?? [])}
        primary={primary}
        secondary={secondary}
        who={who}
        links={links}
        leave={{
          label: 'Back to event',
          onClick: () => {
            void exitFullscreen()
            navigate(standingsHref)
          },
        }}
      >
        {block}
      </RunReport>
      {takeover ? (
        <WinTakeover
          data={takeover}
          primary={{ label: 'See the final standings', href: standingsHref }}
          onClose={() => setTakeoverDone(true)}
        />
      ) : null}
    </>
  )
}
