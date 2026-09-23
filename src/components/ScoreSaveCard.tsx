import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { gameBoardHref, gameHref, leaderboardHref, navigate, recordsHref } from '../hooks/useHashRoute'
import { linkCurrentNameToAccount } from '../lib/auth'
import {
  challengeMessage,
  challengeOutcome,
  createChallenge,
  noteChallengeRun,
  replyMessage,
  useActiveChallenge,
} from '../lib/challenges'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { scoreText, scoreUnit } from '../lib/gameBoard'
import {
  ApiError,
  fetchPlayerBests,
  getLastPlayerName,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { gameHasRecords } from '../lib/records'
import {
  isRunAssisted,
  takeRunAchievements,
  whenRunAchievementsSettled,
  type RunAchievement,
} from '../lib/runAchievements'
import {
  CHALLENGE_WON,
  challengeReportLine,
  composeReport,
  readBookFacts,
  saveRunForReport,
  wouldPlaceOnBoard,
  type RunFacts,
  type RunReportData,
} from '../lib/runReport'
import { periodCopy } from '../lib/scoreboard'
import { standingsTakeover } from '../lib/winTakeover'
import { useChallengeShare } from './ChallengeShare'
import { ReportSignIn, ReportWho, RunReport, TagSlots, type ReportAction, type ReportLink } from './RunReport'
import { WinTakeover } from './WinTakeover'

type ScoreSaveProps = {
  gameSlug: string
  score: number
  /** The run's own words for how it ended: Ship down, Run over. */
  title: string
  subtitle?: string
  /** Best at the start of this run, before the engine saved a new record. */
  previousBest?: number
  onDone: () => void
}

type Phase = 'checking' | 'needAuth' | 'needName' | 'saving' | 'saved' | 'assisted' | 'error'

/** Where a failed save leaves the card, and what it says. */
function afterFailure(err: unknown): { phase: Phase; error: string | null } {
  // Signed out after all: the sign-in's own words already say it.
  if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') return { phase: 'needAuth', error: null }
  if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
    return { phase: 'needName', error: 'That gamer tag is taken. Pick another.' }
  }
  return { phase: 'error', error: err instanceof Error ? err.message : 'Could not save score' }
}

/** Leave the play overlay and open an in-app route. */
function leavePlayTo(href: string) {
  navigate(href)
}

function boardsHref(gameSlug: string, period: LeaderboardPeriod) {
  if ((LEADERBOARD_GAMES as readonly string[]).includes(gameSlug)) {
    return gameBoardHref(gameSlug as LeaderboardGame, period)
  }
  return gameHref(gameSlug)
}

/**
 * The end of a run: one report, saved and told in the same card.
 *
 * The card opens on the score at once, with Play again ready; the save goes
 * on underneath and the lines fill in when it lands. Signed out, it says what
 * the run would win and offers the sign-in; signed in without a tag, it takes
 * one in slots. A run that used the admin stage jump is not saved at all.
 */
export function ScoreSaveCard({ gameSlug, score, title, subtitle, previousBest, onDone }: ScoreSaveProps) {
  const { signedIn, loading: authLoading } = useAuth()
  const impersonation = useImpersonation()
  const canSaveScores = signedIn || Boolean(impersonation)
  const period = useDefaultPeriod()
  const [phase, setPhase] = useState<Phase>('checking')
  const [error, setError] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [report, setReport] = useState<RunReportData | null>(null)
  const [facts, setFacts] = useState<RunFacts | null>(null)
  const [takeoverDone, setTakeoverDone] = useState(false)
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const [wouldPlace, setWouldPlace] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const recordRef = useRef(previousBest ?? 0)
  const playRef = useRef<HTMLButtonElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const tagId = useId()

  const game = getGame(gameSlug)?.name ?? gameSlug
  const copy = periodCopy(period)
  // A friend's challenge this run was played against; your own played back is just a run.
  const challenge = useActiveChallenge(gameSlug)
  const facing =
    challenge && normalizePlayerName(challenge.name) !== normalizePlayerName(getLastPlayerName()) ? challenge : null
  const facingRef = useRef(facing)
  facingRef.current = facing
  const outcome = facing ? challengeOutcome(facing, score) : null
  const [share, sharePanel] = useChallengeShare()
  const accentStyle = gameAccentStyle(gameSlug)
  const accent = String((accentStyle as Record<string, string>)['--celeb-accent'] ?? '#2eb8a0')

  useEffect(() => {
    if (phase === 'needName') tagRef.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    let cancelled = false
    setPhase('checking')
    setError(null)
    setReport(null)

    async function run() {
      if (authLoading) return
      const against = facingRef.current
      if (against && score > 0) noteChallengeRun(gameSlug, score)
      const name = normalizePlayerName(getLastPlayerName())
      if (name) {
        try {
          const bests = await fetchPlayerBests(name)
          if (cancelled) return
          recordRef.current = bests[gameSlug] ?? 0
        } catch {
          /* keep this device's best */
        }
      }
      if (cancelled) return

      // Stage-jumped runs never reach a board or a record book: the score was
      // not earned, and nor were the record-book wins queued along the way.
      if (isRunAssisted()) {
        takeRunAchievements()
        setPhase('assisted')
        return
      }

      if (score <= 0) {
        // Nothing to save, but a record the run set still gets said.
        await whenRunAchievementsSettled()
        const hits: RunAchievement[] = takeRunAchievements()
        const books = name && hits.length ? await readBookFacts(gameSlug, name, hits) : []
        if (cancelled) return
        setReport(
          composeReport({
            slug: gameSlug,
            score,
            name,
            period,
            priorBest: recordRef.current,
            allTimeRank: null,
            priorAllTimeRank: null,
            board: null,
            overall: { before: null, after: null },
            books,
            challenge: against ? { name: against.name, score: against.score, won: false, replyId: null } : null,
          }),
        )
        setPhase('saved')
        return
      }

      if (!canSaveScores) {
        setPhase('needAuth')
        return
      }
      if (!name) {
        setPhase('needName')
        return
      }
      setPhase('saving')
      const facts = await saveRunForReport({
        slug: gameSlug,
        name,
        score,
        period,
        priorBest: recordRef.current,
        challengeId: against?.id,
      })
      if (cancelled) return
      setSavedAs(facts.name)
      setFacts(facts)
      setReport(composeReport(facts))
      setPhase('saved')
    }

    run().catch((err: unknown) => {
      if (cancelled) return
      const next = afterFailure(err)
      setError(next.error)
      setPhase(next.phase)
    })
    return () => {
      cancelled = true
    }
  }, [gameSlug, score, period, authLoading, canSaveScores])

  // Signed out or tagless: what the run would win, to lead the ask with.
  useEffect(() => {
    if (phase !== 'needAuth' && phase !== 'needName') return
    let cancelled = false
    void wouldPlaceOnBoard(gameSlug, period, score).then((place) => {
      if (!cancelled) setWouldPlace(place)
    })
    return () => {
      cancelled = true
    }
  }, [phase, gameSlug, period, score])

  const submitName = async () => {
    const name = normalizePlayerName(nameDraft)
    if (!name || phase === 'saving') return
    if (!canSaveScores) {
      setPhase('needAuth')
      return
    }
    setPhase('saving')
    setError(null)
    try {
      if (signedIn && !impersonation) await linkCurrentNameToAccount(name)
      const facts = await saveRunForReport({
        slug: gameSlug,
        name,
        score,
        period,
        priorBest: recordRef.current,
        challengeId: facingRef.current?.id,
      })
      setSavedAs(facts.name)
      setFacts(facts)
      setReport(composeReport(facts))
      setPhase('saved')
    } catch (err) {
      const next = afterFailure(err)
      setError(next.error)
      setPhase(next.phase)
    }
  }

  const pending = phase === 'checking' || phase === 'saving'
  const data = phase === 'saved' ? report : null
  // Before a save (signed out, no tag yet), a friend's challenge is still said: it's why they played.
  const unsaved = phase === 'needAuth' || phase === 'needName'
  const unsavedWin = unsaved && Boolean(outcome?.won)
  const tier = data?.tier ?? (unsavedWin ? 'big' : 'quiet')
  const ribbon = data?.ribbon ?? (unsavedWin ? CHALLENGE_WON : null)
  const figure = formatLeaderboardScore(gameSlug, score)
  const unit = scoreUnit(gameSlug, score)
  const place = wouldPlace
  const winLead = place ? (
    <>
      Right now that’s{' '}
      <strong className={place === 1 ? 'report__win report__win--gold' : 'report__win'}>
        #{place} on {game} {copy.phrase}
      </strong>
      .
    </>
  ) : null

  // Short of a friend's challenge, the way on is another go at it.
  const playAgain: ReportAction = {
    label: outcome && !outcome.won ? 'Try again' : 'Play again',
    onClick: onDone,
    buttonRef: playRef,
  }
  let primary = playAgain
  let secondary: ReportAction | null = null
  let block: ReactNode = null
  let who: ReactNode = null
  let links: ReportLink[] = []

  if (phase === 'needAuth') {
    block = (
      <ReportSignIn
        lead={
          facing && outcome?.won ? (
            <>
              Sign in and {facing.name} hears you won, and {scoreText(gameSlug, score)} goes on the boards. {winLead}
            </>
          ) : (
            <>
              Sign in and {scoreText(gameSlug, score)} goes on the boards. {winLead}
            </>
          )
        }
        error={error}
        onSignedIn={() => {
          setError(null)
          setPhase('checking')
        }}
      />
    )
    who = <ReportWho text="Not saved yet" />
  } else if (phase === 'needName') {
    primary = {
      label: 'Save to the board',
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
        lead={
          place ? (
            <>
              {scoreText(gameSlug, score)} is{' '}
              <strong className={place === 1 ? 'report__win report__win--gold' : 'report__win'}>
                #{place} on {game} {copy.phrase}
              </strong>
              . Put your name on it.
            </>
          ) : (
            'Put your name on the boards.'
          )
        }
      />
    )
    who = <ReportWho text="Signed in, no tag yet" />
  } else if (phase === 'assisted') {
    block = <p className="report__note">Stage skip used, so this run wasn’t saved to the boards or the record books.</p>
    who = <ReportWho text="Not saved" />
  } else if (phase === 'error') {
    block = <p className="panel__error">{error}</p>
    who = <ReportWho text="Not saved" />
  } else if (pending) {
    who = <ReportWho name={getLastPlayerName() || null} text="Saving…" />
  } else if (savedAs) {
    who = <ReportWho name={savedAs} avatarId={data?.avatarId} text={`Saved as ${savedAs}`} />
  }

  // A saved run can go to a friend; one that beat a friend's goes straight back.
  const runId = facts?.runId ?? null
  const reply = facts?.challenge?.won ? facts.challenge : null
  if (phase === 'saved' && signedIn && savedAs && runId && !(outcome && !outcome.won)) {
    if (reply?.replyId && facing) {
      const replyId = reply.replyId
      secondary = {
        label: 'Send it back',
        icon: 'flag',
        onClick: () =>
          share({
            game: gameSlug,
            id: replyId,
            score,
            name: savedAs,
            message: replyMessage(gameSlug, facing.score, score),
            title: `Send it back to ${facing.name}`,
          }),
      }
    } else {
      secondary = {
        label: sending ? 'Making the link…' : 'Challenge a friend',
        shortLabel: sending ? 'Wait…' : 'Challenge',
        icon: 'flag',
        disabled: sending,
        onClick: () => {
          setSending(true)
          setSendError(null)
          createChallenge({ game: gameSlug, scoreId: runId, name: savedAs })
            .then((made) =>
              share({ game: gameSlug, id: made.id, score, name: savedAs, message: challengeMessage(gameSlug, score) }),
            )
            .catch(() => setSendError('Couldn’t make the challenge link. Try again in a moment.'))
            .finally(() => setSending(false))
        },
      }
    }
    if (sendError) block = <p className="panel__error">{sendError}</p>
  }

  if (phase === 'saved' || phase === 'assisted' || phase === 'error') {
    links = [{ label: `${game} board`, onClick: () => leavePlayTo(boardsHref(gameSlug, period)) }]
    if (gameHasRecords(gameSlug)) {
      links.push({ label: 'Record book', onClick: () => leavePlayTo(recordsHref(gameSlug)) })
    }
  }

  const lines = pending ? null : (data?.lines ?? [])
  const heading = ribbon?.text ?? title
  // First in the standings takes the whole screen, once, with the report under it.
  const takeover =
    data?.standingsTop && facts?.overall.after && !takeoverDone
      ? standingsTakeover(facts.overall.after, facts.name, period)
      : null
  return (
    <>
      <RunReport
        label={`${heading}, ${scoreText(gameSlug, score)}`}
        titleId={titleId}
        style={accentStyle}
        accent={accent}
        initialFocus={phase === 'needName' ? tagRef : playRef}
        // Esc goes back to the start card, except while a tag is being typed.
        onEscape={phase === 'needName' ? undefined : onDone}
        tier={tier}
        ribbon={ribbon}
        eyebrow={title}
        score={figure}
        unit={unit}
        sub={ribbon ? [title, subtitle].filter(Boolean).join(' · ') : (subtitle ?? null)}
        scoreTone={data?.scoreTone ?? (unsavedWin ? 'gold' : 'plain')}
        lines={
          unsaved
            ? facing
              ? [challengeReportLine(gameSlug, score, facing)]
              : []
            : phase === 'assisted' || phase === 'error'
              ? []
              : lines
        }
        race={data?.race ?? null}
        primary={primary}
        secondary={secondary}
        who={who}
        links={links}
      >
        {block}
      </RunReport>
      {sharePanel}
      {takeover ? (
        <WinTakeover
          data={takeover}
          primary={{ label: 'See the standings', href: leaderboardHref(period) }}
          onClose={() => setTakeoverDone(true)}
        />
      ) : null}
    </>
  )
}
