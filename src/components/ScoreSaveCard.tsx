import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { getGame, isDailyGame, isRankedGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { useSaveWait } from '../hooks/useSaveWait'
import { dailyTabHref, gameBoardHref, gameHref, leaderboardHref, navigate, recordsHref } from '../hooks/useHashRoute'
import { archiveDayWords } from '../lib/archive'
import { currentAccountId, linkCurrentNameToAccount, recallAccountTag } from '../lib/auth'
import {
  challengeMessage,
  challengeOutcome,
  createChallenge,
  noteChallengeRun,
  replyMessage,
  useActiveChallenge,
} from '../lib/challenges'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { inEarlyAccess, plusFirstDay } from '../lib/earlyAccess'
import { exitFullscreen } from '../lib/fullscreen'
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
  type SavedPours,
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
import { dropPendingRun, holdPendingRun, keepPendingRun, pendingCount, releasePendingRun } from '../lib/pendingRuns'
import { runIdFor } from '../lib/runSession'
import { periodCopy } from '../lib/scoreboard'
import { TODAY_DAILIES } from '../lib/today'
import { standingsTakeover } from '../lib/winTakeover'
import { useChallengeShare } from './ChallengeShare'
import { PushAsk, StreakPushAsk } from './PushAsk'
import { RunTicketsLine, RunTicketsWaiting } from './prizes/RunTickets'
import { SeasonRunLine } from './season/SeasonRun'
import { ReportSignIn, ReportWho, RunReport, TagSlots, type ReportAction, type ReportLink } from './RunReport'
import { copyText } from './ShareBoardButton'
import { WinTakeover } from './WinTakeover'

/** The way on to the next daily: only a daily's report shows it, and it brings the day's ticket with it. */
const NextDaily = lazy(() => import('./NextDaily'))

type ScoreSaveProps = {
  gameSlug: string
  score: number
  /** The run's own words for how it ended: Ship down, Run over. */
  title: string
  subtitle?: string
  /** Best at the start of this run, before the engine saved a new record. */
  previousBest?: number
  /** Prize tickets the run picked up on the way (Crosswalk's), paid with the save. */
  pickups?: number
  /** Hot Lap: the day's blue car, in milliseconds, which its ticket ladder goes by. */
  pace?: number
  /** Half Full: the day's five pours, which the API scores the day from (the `score` is only what's shown). */
  pours?: SavedPours
  /** A daily's run to send on, its day's link included (Hot Lap's lap): a Share link under the report. */
  shareLine?: string
  /**
   * A daily's run kept on this device: whose it is (lib/deviceRuns.ts). Left out, the run is saved under
   * whoever is signed in, as every other game's. null, it was played signed out, and whoever signs in
   * saves it as theirs. An account's id, it's saved only while that account is signed in.
   */
  owner?: string | null
  onDone: () => void
  /** Once the save has an answer, saved or not, even after the card has closed: a board to read again. */
  onSettled?: () => void
  /** Once the run is saved (not when the save fails), even after the card has closed: it's the saver's now. */
  onSaved?: () => void
}

type Phase = 'checking' | 'needAuth' | 'needName' | 'saving' | 'saved' | 'assisted' | 'early' | 'error' | 'otherAccount'

/** Where a failed save leaves the card, and what it says. */
function afterFailure(err: unknown): { phase: Phase; error: string | null } {
  // Signed out after all: the sign-in's own words already say it.
  if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') return { phase: 'needAuth', error: null }
  if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
    return { phase: 'needName', error: 'That gamer tag is taken. Pick another.' }
  }
  // A word no tag may carry: back to the tag, with the API's words.
  if (err instanceof ApiError && err.code === 'NAME_NOT_ALLOWED') return { phase: 'needName', error: err.message }
  return { phase: 'error', error: err instanceof Error ? err.message : 'Could not save score' }
}

/** Whether a run stamped `owner` may be saved now: any run but another account's, which waits for that account. */
function ownerSignedIn(owner: string | null | undefined): boolean {
  return typeof owner !== 'string' || currentAccountId() === owner
}

/** Leave the play overlay and open an in-app route, out of fullscreen as the play screen's back control does. */
function leavePlayTo(href: string) {
  void exitFullscreen()
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
 * The card opens on the score at once; the save goes on underneath, Play
 * again waits for it (useSaveWait), and the lines fill in when it lands.
 * Signed out, it says what the run would win and offers the sign-in; signed
 * in without a tag, it takes one in slots. A run that used the admin stage
 * jump is not saved at all. Leave, top left, goes to the game's page.
 */
export function ScoreSaveCard({ gameSlug, score, title, subtitle, previousBest, pickups, pace, pours, shareLine, owner, onDone, onSettled, onSaved }: ScoreSaveProps) {
  const { signedIn, loading: authLoading } = useAuth()
  const impersonation = useImpersonation()
  const canSaveScores = signedIn || Boolean(impersonation)
  const accountId = useAccountId()
  // Another account's run is saved only once that account is signed in, and looked at again whenever that changes.
  const ownerIn = typeof owner !== 'string' || accountId === owner
  const defaultPeriod = useDefaultPeriod()
  // A daily's board is the day's (the API keeps it so, whatever the period): its places are today's,
  // in the report as on the card.
  const period: LeaderboardPeriod = isDailyGame(gameSlug) ? 'daily' : defaultPeriod
  // A daily just for fun places nobody (data/games.ts Game.ranked): its save is today's result, on no board.
  const ranked = isRankedGame(gameSlug)
  const saveWords = ranked ? 'goes on the boards' : 'is saved as today’s result'
  // The Standings line keeps the header's period, so it never says "today" beside the header's weekly rank.
  // Read as the save goes out, as the run's other extras are.
  const standingsPeriodRef = useRef(defaultPeriod)
  standingsPeriodRef.current = defaultPeriod
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
  /** A challenge went out from this card: the moment to offer an alert for when it's beaten. */
  const [challenged, setChallenged] = useState(false)
  const [copied, setCopied] = useState(false)
  const recordRef = useRef(previousBest ?? 0)
  /** Which pass of the save is the live one; an older pass bows out. */
  const savePass = useRef(0)
  /** The run this card is about, taken as it ended (see runIdFor). */
  const runRef = useRef<Promise<string | undefined> | null>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  // Read when the save goes out; the run's count doesn't change once it's over.
  const pickupsRef = useRef(pickups)
  pickupsRef.current = pickups
  const paceRef = useRef(pace)
  paceRef.current = pace
  const poursRef = useRef(pours)
  poursRef.current = pours
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled
  const savedRef = useRef(onSaved)
  savedRef.current = onSaved
  // Read as the save goes out: a run taken up by whoever saved it may be handed back stamped as theirs.
  const ownerRef = useRef(owner)
  ownerRef.current = owner
  // A daily's run that has saved (one with an owner): it never goes out again, under anyone.
  const landedRef = useRef(false)
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
    // Saved already: a later sign-in or switch leaves its report up and sends nothing.
    if (ownerRef.current !== undefined && landedRef.current) return
    const pass = ++savePass.current
    // Off the screen, or handed to a newer pass: stop telling, not saving.
    let closed = false
    // This run's, taken as it ends. Play again begins the next run, and a save
    // still waiting on the network must go out under this one.
    const run = runIdFor(gameSlug)
    runRef.current = run
    const assisted = isRunAssisted()
    setPhase('checking')
    setError(null)
    setReport(null)

    async function save() {
      if (authLoading) return
      // Signed in as someone else: this run waits for its own player. Signed out, it asks for a sign-in below.
      if (canSaveScores && !ownerSignedIn(ownerRef.current)) {
        if (!closed) setPhase('otherAccount')
        return
      }
      const against = facingRef.current
      if (against && score > 0) noteChallengeRun(gameSlug, score)
      const name = normalizePlayerName(getLastPlayerName())
      if (name) {
        try {
          // A daily's best is today's, on the day's board this run goes on.
          const bests = await fetchPlayerBests(name, isDailyGame(gameSlug) ? 'daily' : 'all')
          recordRef.current = bests[gameSlug] ?? 0
        } catch {
          /* keep this device's best */
        }
      }
      // A newer pass has the run: the score or the sign-in changed under this
      // one. A card that only closed carries on, so Play again pressed at once
      // doesn't cost the run its save.
      if (savePass.current !== pass) return

      // Stage-jumped runs never reach a board or a record book: the score was
      // not earned, and nor were the record-book wins queued along the way.
      if (assisted) {
        if (closed) return
        takeRunAchievements()
        setPhase('assisted')
        return
      }

      // In early access, Plus plays it first as practice: its boards open to everyone on its day (lib/earlyAccess.ts).
      if (inEarlyAccess(gameSlug)) {
        if (closed) return
        takeRunAchievements()
        setPhase('early')
        return
      }

      if (score <= 0) {
        if (closed) return
        // Nothing to save, but a record the run set still gets said.
        await whenRunAchievementsSettled()
        const hits: RunAchievement[] = takeRunAchievements()
        const books = name && hits.length ? await readBookFacts(gameSlug, name, hits) : []
        if (closed) return
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
        if (!closed) setPhase('needAuth')
        return
      }
      if (!name) {
        if (!closed) setPhase('needName')
        return
      }
      // Asked again as it goes out: another tab may have signed in as someone else meanwhile.
      if (!ownerSignedIn(ownerRef.current)) {
        if (!closed) setPhase('otherAccount')
        return
      }
      if (!closed) setPhase('saving')
      const facts = await saveRunForReport({
        slug: gameSlug,
        name,
        score,
        period,
        standingsPeriod: standingsPeriodRef.current,
        priorBest: recordRef.current,
        challengeId: against?.id,
        run,
        pickups: pickupsRef.current,
        pace: paceRef.current,
        pours: poursRef.current,
      })
      landedRef.current = true
      settledRef.current?.()
      savedRef.current?.()
      if (closed) return
      setSavedAs(facts.name)
      setFacts(facts)
      setReport(composeReport(facts))
      setPhase('saved')
    }

    save().catch((err: unknown) => {
      settledRef.current?.()
      if (closed) return
      const next = afterFailure(err)
      setError(next.error)
      setPhase(next.phase)
    })
    return () => {
      closed = true
    }
  }, [gameSlug, score, period, authLoading, canSaveScores, ownerIn])

  // A signed-out run is kept on this device until its player signs in, here or anywhere (lib/pendingRuns.ts).
  // Signing in here, this card saves it itself, so the saver holds off while the card is up. A daily's runs
  // are kept their own way (deviceRuns.ts).
  const pendingRef = useRef<string | null>(null)
  const [othersPending, setOthersPending] = useState(0)
  const keepable = !isDailyGame(gameSlug) && score > 0
  useEffect(() => {
    if (phase !== 'needAuth' || !keepable || pendingRef.current) return
    let live = true
    void (runRef.current ?? runIdFor(gameSlug)).then((runId) => {
      if (!live || pendingRef.current) return
      const id = keepPendingRun({ slug: gameSlug, score, runId, pickups: pickupsRef.current })
      pendingRef.current = id
      holdPendingRun(id)
      setOthersPending(pendingCount(id))
    })
    return () => {
      live = false
    }
  }, [phase, keepable, gameSlug, score])
  // Saved here, it's no longer waiting; the card gone, the saver may take it.
  useEffect(() => {
    if (phase !== 'saved' || !pendingRef.current) return
    dropPendingRun(pendingRef.current)
    releasePendingRun(pendingRef.current)
    pendingRef.current = null
  }, [phase])
  useEffect(
    () => () => {
      if (pendingRef.current) releasePendingRun(pendingRef.current)
    },
    [],
  )

  // Signed out or tagless: what the run would win, to lead the ask with. A daily just for fun wins no place.
  useEffect(() => {
    if (phase !== 'needAuth' && phase !== 'needName') return
    if (!ranked) return
    let cancelled = false
    void wouldPlaceOnBoard(gameSlug, period, score).then((place) => {
      if (!cancelled) setWouldPlace(place)
    })
    return () => {
      cancelled = true
    }
  }, [phase, gameSlug, period, score, ranked])

  const submitName = async () => {
    const name = normalizePlayerName(nameDraft)
    if (!name || phase === 'saving') return
    if (!canSaveScores) {
      setPhase('needAuth')
      return
    }
    if (!ownerSignedIn(ownerRef.current)) {
      setPhase('otherAccount')
      return
    }
    setPhase('saving')
    setError(null)
    try {
      if (signedIn && !impersonation) await linkCurrentNameToAccount(name)
      if (!ownerSignedIn(ownerRef.current)) {
        setPhase('otherAccount')
        return
      }
      const facts = await saveRunForReport({
        slug: gameSlug,
        name,
        score,
        period,
        standingsPeriod: standingsPeriodRef.current,
        priorBest: recordRef.current,
        challengeId: facingRef.current?.id,
        run: runRef.current ?? runIdFor(gameSlug),
        pickups: pickupsRef.current,
        pace: paceRef.current,
        pours: poursRef.current,
      })
      landedRef.current = true
      settledRef.current?.()
      savedRef.current?.()
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
  // Play again waits on the save, for a while; a run that isn't being saved doesn't wait.
  const saveWaitOver = useSaveWait(pending)
  const holding = pending && canSaveScores && !saveWaitOver
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
    label: holding ? 'Saving…' : outcome && !outcome.won ? 'Try again' : 'Play again',
    busy: holding,
    onClick: onDone,
    buttonRef: playRef,
  }
  let primary = playAgain
  let secondary: ReportAction | null = null
  let block: ReactNode = null
  let who: ReactNode = null
  let links: ReportLink[] = []

  if (phase === 'needAuth') {
    // The other runs kept on this device go on with it.
    const others =
      othersPending > 0
        ? ` Your ${othersPending} other ${othersPending === 1 ? 'run' : 'runs'} from the last few hours ${othersPending === 1 ? 'goes' : 'go'} on too.`
        : null
    block = (
      <ReportSignIn
        lead={
          facing && outcome?.won ? (
            <>
              Sign in and {facing.name} hears you won, and {scoreText(gameSlug, score)} {saveWords}. {winLead}
              {others}
            </>
          ) : (
            <>
              Sign in and {scoreText(gameSlug, score)} {saveWords}. {winLead}
              {others}
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
      label: ranked ? 'Save to the board' : 'Save it',
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
          ) : ranked ? (
            'Put your name on the boards.'
          ) : (
            'Put your tag on it to save it as today’s result.'
          )
        }
      />
    )
    who = <ReportWho text="Signed in, no tag yet" />
  } else if (phase === 'otherAccount') {
    // Played under another account on this device: it goes on the board as theirs, once they're back.
    const tag = typeof owner === 'string' ? recallAccountTag(owner) : ''
    block = (
      <p className="report__note">
        {tag
          ? `Played as ${tag}. Sign in as ${tag} to ${ranked ? 'put it on the board' : 'save it'}.`
          : `Played as another account. Sign in as that account to ${ranked ? 'put it on the board' : 'save it'}.`}
      </p>
    )
    who = <ReportWho text="Not saved yet" />
  } else if (phase === 'assisted') {
    block = <p className="report__note">Stage skip used, so this run wasn’t saved to the boards or the record books.</p>
    who = <ReportWho text="Not saved" />
  } else if (phase === 'early') {
    const opens = plusFirstDay(gameSlug)
    block = (
      <p className="report__note">
        Early access: runs are practice{opens ? ` until ${archiveDayWords(opens)}` : ''}, when its boards open for everyone at once.
      </p>
    )
    who = <ReportWho text="Practice" />
  } else if (phase === 'error') {
    block = <p className="panel__error">{error}</p>
    who = <ReportWho text="Not saved" />
  } else if (pending) {
    who = (
      <ReportWho
        name={getLastPlayerName() || null}
        text={saveWaitOver ? 'Still saving. It finishes even if you play on.' : 'Saving…'}
      />
    )
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
        onClick: () => {
          share({
            game: gameSlug,
            id: replyId,
            score,
            name: savedAs,
            message: replyMessage(gameSlug, facing.score, score),
            title: `Send it back to ${facing.name}`,
          })
          setChallenged(true)
        },
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
            .then((made) => {
              share({ game: gameSlug, id: made.id, score, name: savedAs, message: challengeMessage(gameSlug, score) })
              setChallenged(true)
            })
            .catch(() => setSendError('Couldn’t make the challenge link. Try again in a moment.'))
            .finally(() => setSending(false))
        },
      }
    }
    if (sendError) block = <p className="panel__error">{sendError}</p>
    else if (challenged) block = <PushAsk reason="challenge" />
  }
  // A daily of the Dailies just saved: once today is kept, the moment to offer a nudge before a day ends unkept.
  const onTicket = TODAY_DAILIES.some((d) => d.slug === gameSlug)
  if (phase === 'saved' && signedIn && !impersonation && onTicket && !block) {
    block = <StreakPushAsk active />
  }
  // And the way on to the next of today's dailies: first, or after the sign-in for a run that isn't saved yet.
  if (onTicket && (phase === 'saved' || phase === 'needAuth')) {
    const next = (
      <Suspense fallback={null}>
        <NextDaily slug={gameSlug} />
      </Suspense>
    )
    block = phase === 'needAuth' ? (
      <>
        {block}
        {next}
      </>
    ) : (
      <>
        {next}
        {block}
      </>
    )
  }

  // A daily just for fun has no board and no records to go to.
  if (ranked && (phase === 'saved' || phase === 'assisted' || phase === 'error')) {
    links = [{ label: `${game} board`, onClick: () => leavePlayTo(boardsHref(gameSlug, period)) }]
    // A daily's records are on its page's Records tab, not in the record books.
    if (isDailyGame(gameSlug)) {
      links.push({ label: 'Records', onClick: () => leavePlayTo(dailyTabHref(gameSlug, 'records')) })
    } else if (gameHasRecords(gameSlug)) {
      links.push({ label: 'Record book', onClick: () => leavePlayTo(recordsHref(gameSlug)) })
    }
  }
  // A daily's run goes on whether it's saved or not, as the other dailies' cards send theirs:
  // the phone's own share sheet, or copied to paste anywhere.
  if (shareLine) {
    const sendOn = () => {
      const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
      if (touch && typeof navigator.share === 'function') {
        navigator.share({ text: shareLine }).catch(() => {})
        return
      }
      const done = () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(shareLine).then(done, () => copyText(shareLine) && done())
      else if (copyText(shareLine)) done()
    }
    links = [{ label: copied ? 'Copied' : 'Share', onClick: sendOn }, ...links]
  }

  const lines = pending ? null : (data?.lines ?? [])
  const heading = ribbon?.text ?? title
  // First in the standings takes the whole screen, once, with the report under it, in the standings' own period.
  const standingsPeriod = facts?.standingsPeriod ?? period
  const takeover =
    data?.standingsTop && facts?.overall.after && !takeoverDone
      ? standingsTakeover(facts.overall.after, facts.name, standingsPeriod)
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
            : phase === 'assisted' || phase === 'early' || phase === 'error'
              ? []
              : lines
        }
        race={data?.race ?? null}
        tickets={
          phase === 'saved' && facts?.tickets ? (
            <>
              <RunTicketsLine paid={facts.tickets} game={gameSlug} />
              {facts.season ? <SeasonRunLine run={facts.season} /> : null}
            </>
          ) : unsaved && score > 0 ? (
            <RunTicketsWaiting runs={phase === 'needAuth' ? 1 + othersPending : 1} />
          ) : null
        }
        primary={primary}
        secondary={secondary}
        who={who}
        links={links}
        leave={{ label: 'Leave', onClick: () => leavePlayTo(gameHref(gameSlug)) }}
      >
        {block}
      </RunReport>
      {sharePanel}
      {takeover ? (
        <WinTakeover
          data={takeover}
          primary={{ label: 'See the standings', href: leaderboardHref(standingsPeriod) }}
          onClose={() => setTakeoverDone(true)}
        />
      ) : null}
    </>
  )
}
