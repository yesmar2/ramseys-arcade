import { Fragment, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { lazyPart } from '../lib/lazyPage'
import { getGame, isDailyGame, isRankedGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { useSaveWait } from '../hooks/useSaveWait'
import { boardPlaceHref, gameHref, leaderboardHref, navigate, recordsPlaceHref } from '../hooks/useHashRoute'
import { archiveDayWords } from '../lib/archive'
import { RACE_GHOST_GAMES } from '../lib/raceGhost'
import { currentAccountId, linkCurrentNameToAccount, recallAccountTag } from '../lib/auth'
import {
  challengeMessage,
  challengeOutcome,
  challengeUrl,
  createChallenge,
  ghostShareText,
  noteChallengeRun,
  replyMessage,
  useActiveChallenge,
} from '../lib/challenges'
import { boardPeriodFor } from '../lib/allTime'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { beforeLaunch, launchDayOf } from '../lib/earlyAccess'
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
  type SavedPlates,
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
  boardCard,
  CHALLENGE_WON,
  chaseFacts,
  composeReport,
  hasPeriodStrip,
  standingsCard,
  readBookFacts,
  saveRunForReport,
  wouldPlaceOnBoard,
  type RunFacts,
  type RunReportData,
} from '../lib/runReport'
import { dropPendingRun, holdPendingRun, keepPendingRun, pendingCount, releasePendingRun } from '../lib/pendingRuns'
import { rememberDeviceBest } from '../lib/personalBest'
import { runIdFor } from '../lib/runSession'
import { periodCopy } from '../lib/scoreboard'
import { boardDay } from '../lib/rankHow'
import { alsoDailies, liveDailies } from '../lib/today'
import { standingsTakeover } from '../lib/winTakeover'
import { useChallengeShare } from './ChallengeShare'
import { boardTime, isRaceGame, medalBeats, medalFor, medalTimes, needsThousandths } from '../lib/raceMedals'
import { PushAsk, StreakPushAsk } from './PushAsk'
import { RunTicketsLine, RunTicketsWaiting } from './prizes/RunTickets'
import { MedalLadder } from './RaceMedal'
import { raceSubWords } from './RaceReport'
import { ReportSignIn, ReportWho, TagSlots, type ReportAction, type ReportLink } from './RunReport'
import { ReelButton, ReelChase, reelSteps, ReelTickets, RunReel, runRecap } from './RunReel'
import { useShare } from './SharePanel'
import { WinTakeover } from './WinTakeover'

/** The way on to the next daily: only a daily's report shows it, and it brings the day's ticket with it. */
const NextDaily = lazyPart(() => import('./NextDaily'))

type ScoreSaveProps = {
  gameSlug: string
  score: number
  /** The run's own words for how it ended: Ship down, Run over. */
  title: string
  subtitle?: string
  /** The best before this run. Read once, as the card opens on the run: the card goes on to keep the run as the best. */
  previousBest?: number
  /** Prize tickets the run picked up on the way (Crosswalk's), paid with the save. */
  pickups?: number
  /** Hot Lap: the day's blue car, in milliseconds, which its ticket ladder goes by. */
  pace?: number
  /** Half Full: the day's five pours, which the API scores the day from (the `score` is only what's shown). */
  pours?: SavedPours
  /** Centroid: the day's six taps, which the API scores the day from. */
  plates?: SavedPlates
  /** A daily's run to send on, its day's link included (Hot Lap's lap): a Share link under the report. */
  shareLine?: string
  /**
   * A racing daily's day: its blue's time in ms from the day's plan, and how the game says a time, for the
   * run's medals (lib/raceMedals.ts) on the report (RaceReport).
   */
  medalPace?: number
  /** The day's own platinum, where its course sets one (Hot Lap's tracks: hotlap/medalLap.ts). */
  medalPlatinum?: number
  medalFormat?: (seconds: number) => string
  /** A racing daily's course, "Today's Cave #6": over the score when the run won nothing, else under it. */
  kicker?: string
  /** A racing daily's tease of tomorrow's course (TomorrowTease), under the way on to the next daily. */
  tomorrow?: ReactNode
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

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Leave the play overlay and open an in-app route, out of fullscreen as the play screen's back control does. */
function leavePlayTo(href: string) {
  void exitFullscreen()
  navigate(href)
}

function boardsHref(gameSlug: string, period: LeaderboardPeriod) {
  if ((LEADERBOARD_GAMES as readonly string[]).includes(gameSlug)) {
    return boardPlaceHref(gameSlug as LeaderboardGame, period)
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
export function ScoreSaveCard({
  gameSlug,
  score,
  title,
  subtitle,
  previousBest,
  pickups,
  pace,
  pours,
  plates,
  shareLine,
  medalPace,
  medalPlatinum,
  medalFormat,
  kicker,
  tomorrow,
  owner,
  onDone,
  onSettled,
  onSaved,
}: ScoreSaveProps) {
  const { signedIn, signedOut, loading: authLoading } = useAuth()
  const impersonation = useImpersonation()
  // Saving needs a session, and acting as a tag (dev) doesn't give one: a borrowed tag left on a device
  // signed out showed "Signed in, no tag yet" and a tag box the API then refused. A session whose account
  // couldn't be asked for (/auth/me not reached) saves all the same: the API knows whose it is, and its 401
  // would mean signed out after all. No run is lost to a hiccup there.
  const canSaveScores = !signedOut
  // The save waits for the account's first answer only: asked again later (the window coming back), it never
  // goes out a second time.
  const [authAsked, setAuthAsked] = useState(!authLoading)
  useEffect(() => {
    if (!authLoading) setAuthAsked(true)
  }, [authLoading])
  const accountId = useAccountId()
  // Another account's run is saved only once that account is signed in, and looked at again whenever that changes.
  const ownerIn = typeof owner !== 'string' || accountId === owner
  const defaultPeriod = useDefaultPeriod()
  // A daily's board is the day's (the API keeps it so, whatever the period): its places are today's,
  // in the report as on the card.
  const period: LeaderboardPeriod = isDailyGame(gameSlug) ? 'daily' : defaultPeriod
  // A daily just for fun places nobody (data/games.ts Game.ranked): its save is today's result, on no board.
  const ranked = isRankedGame(gameSlug)
  // The Standings line keeps the header's period, so it never says "today" beside the header's weekly rank, but a
  // daily's run can't move all time, which leaves the dailies out: its month instead (lib/allTime.ts).
  // Read as the save goes out, as the run's other extras are.
  const movesStandings = boardPeriodFor(gameSlug, defaultPeriod)
  const standingsPeriodRef = useRef(movesStandings)
  standingsPeriodRef.current = movesStandings
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
  /** The daily's line going on (`shareLine`), the way every Share goes. */
  const lineShare = useShare()
  // The best before this run, as the card opened on it. The card goes on to keep the run as the best (signed out
  // as this device's, signed in once it's saved), and a game that reads its best live hands the run back as the
  // best before it: a signed-out first run of the day said "tied your best today".
  const [bestBefore] = useState(previousBest)
  const recordRef = useRef(bestBefore ?? 0)
  /** Which pass of the save is the live one; an older pass bows out. */
  const savePass = useRef(0)
  /** The run this card is about, taken as it ended (see runIdFor). */
  const runRef = useRef<Promise<string | undefined> | null>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  /** The board's card had its shape standing in while the save was out: it fades in there when it comes. */
  const boardWaitedRef = useRef(false)
  // Read when the save goes out; the run's count doesn't change once it's over.
  const pickupsRef = useRef(pickups)
  pickupsRef.current = pickups
  const paceRef = useRef(pace)
  paceRef.current = pace
  const poursRef = useRef(pours)
  poursRef.current = pours
  const platesRef = useRef(plates)
  platesRef.current = plates
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled
  const savedRef = useRef(onSaved)
  savedRef.current = onSaved
  // Read as the save goes out: a run taken up by whoever saved it may be handed back stamped as theirs.
  const ownerRef = useRef(owner)
  ownerRef.current = owner
  // A run that has saved: it never goes out again, under anyone.
  const landedRef = useRef(false)
  // A save out now: none other goes while it is, whatever changes under the card, and its answer is the card's.
  const sendingRef = useRef(false)
  const shownRef = useRef(true)
  useEffect(() => {
    shownRef.current = true
    return () => {
      shownRef.current = false
    }
  }, [])
  // Signed in on the card: the run goes out again under the new session, though nothing else may have changed
  // (a session the save's 401 ended, replaced by another).
  const [signIns, setSignIns] = useState(0)
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
  const [share, sharePanel, challengeCopied] = useChallengeShare()
  const accentStyle = gameAccentStyle(gameSlug)
  const accent = String((accentStyle as Record<string, string>)['--celeb-accent'] ?? '#2eb8a0')

  useEffect(() => {
    if (phase === 'needName') tagRef.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    // Saved already: a later sign-in or switch, or the account asked for again, leaves its report up and sends
    // nothing. A save out now answers for the run itself: nothing else goes while it is.
    if (landedRef.current || sendingRef.current) return
    const pass = ++savePass.current
    // Off the screen, or handed to a newer pass: stop telling, not saving.
    let closed = false
    // This pass's save once it's out: its answer is the card's while the card is up, whatever changed meanwhile
    // (a sign-out as it went said "Not saved yet" of a run that landed).
    let sent = false
    // This run's, taken as it ends. Play again begins the next run, and a save
    // still waiting on the network must go out under this one.
    const run = runIdFor(gameSlug)
    runRef.current = run
    const assisted = isRunAssisted()
    setPhase('checking')
    setError(null)
    setReport(null)

    async function save() {
      if (!authAsked) return
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

      // Before launch, a new game is practice: its boards open to everyone on launch day (lib/earlyAccess.ts).
      if (beforeLaunch(gameSlug)) {
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
      sent = true
      sendingRef.current = true
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
        plates: platesRef.current,
      }).finally(() => {
        sendingRef.current = false
      })
      landedRef.current = true
      settledRef.current?.()
      savedRef.current?.()
      if (!shownRef.current) return
      setSavedAs(facts.name)
      setFacts(facts)
      setReport(composeReport(facts))
      setPhase('saved')
    }

    save().catch((err: unknown) => {
      settledRef.current?.()
      if (sent ? !shownRef.current : closed) return
      const next = afterFailure(err)
      setError(next.error)
      setPhase(next.phase)
    })
    return () => {
      closed = true
    }
  }, [gameSlug, score, period, authAsked, canSaveScores, ownerIn, signIns])

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
  // Signed out, the run still counts toward this device's best (lib/personalBest.ts), so Your best moves as you play.
  useEffect(() => {
    if (phase === 'needAuth' && score > 0) rememberDeviceBest(gameSlug, score)
  }, [phase, gameSlug, score])
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
    if (!name || phase === 'saving' || sendingRef.current || landedRef.current) return
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
      if (!signedOut && !impersonation) await linkCurrentNameToAccount(name)
      if (!ownerSignedIn(ownerRef.current)) {
        setPhase('otherAccount')
        return
      }
      sendingRef.current = true
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
        plates: platesRef.current,
      }).finally(() => {
        sendingRef.current = false
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
  // A racing daily's run (RaceReport): its medals as a ladder, its tickets and season in one row, its place in
  // another. Its best goes under the score, and its Standings line is left to the header. The racing dailies
  // keep a million less the ms (their score.ts), and `bestBefore` is today's best before this run. Every time on
  // it reads one way: to the hundredth, as its clock and its medals say it, or to the thousandth, as the boards
  // keep them, when it shows other runs from the boards (a friend passed, the podium) or when two of its times
  // would read the same without being the same (a run 3ms short of bronze, beside bronze's time).
  const race = (() => {
    if (!isRaceGame(gameSlug) || !medalPace || !medalFormat || score <= 0) return null
    const ms = 1_000_000 - score
    const previousMs = bestBefore && bestBefore > 0 ? 1_000_000 - bestBefore : null
    const boards = Boolean(data?.friend || data?.race)
    const fine = boards || needsThousandths([ms, previousMs, medalPace, ...Object.values(medalTimes(gameSlug, medalPace, medalPlatinum))], medalFormat)
    const format = fine ? (seconds: number) => boardTime(gameSlug, seconds) : medalFormat
    return { game: gameSlug, paceMs: medalPace, platinumMs: medalPlatinum ?? null, format, ms, previousMs }
  })()
  // The run as this card says it in a sentence: 74 points, 1:00.90.
  const said = race ? race.format(race.ms / 1000) : scoreText(gameSlug, score)
  // What a sign-in does with it: it goes on the boards, or a daily just for fun keeps it as the day's result.
  const putWords = ranked ? `put ${said} on the boards` : `save ${said} as today’s result`
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
  let secondary: ReportAction | null = null
  /** What the save waits on, a step of its own after the run: the sign-in, or a tag. */
  let ask: ReactNode = null
  /** A word on a run that isn't saved and won't be: another account's, a stage skip, practice, a failed save. */
  let note: ReactNode = null
  /** What the moment offers once it's saved: an alert, or why a challenge link didn't come. */
  let moment: ReactNode = null
  let who: ReactNode = null
  let links: ReportLink[] = []
  /** A racing daily's Share run (Ramsey picked it, 2026-10-23): a pill in place of the Share link. */
  const ghostShare = Boolean(shareLine) && RACE_GHOST_GAMES.has(gameSlug)
  let shareRun: ReportAction | null = null
  /** A saved run's way to a friend, also on the run's own page: no waiting for the last page to send it. */
  let sendRun: ReportAction | null = null
  /** It sends a run to beat (a ghost to race, a challenge), not a reply or a friend's name, so news can say Dare. */
  let sendDares = false

  if (phase === 'needAuth') {
    // The other runs kept on this device go on with it.
    const others =
      othersPending > 0
        ? ` Your ${othersPending} other ${othersPending === 1 ? 'run' : 'runs'} from the last few hours ${othersPending === 1 ? 'goes' : 'go'} on too.`
        : null
    ask = (
      <ReportSignIn
        lead={
          facing && outcome?.won ? (
            <>
              Sign in to tell {facing.name} you won and {putWords}. {winLead}
              {others}
            </>
          ) : (
            <>
              Sign in to {putWords}. {winLead}
              {others}
            </>
          )
        }
        error={error}
        onSignedIn={() => {
          setError(null)
          setPhase('checking')
          setSignIns((n) => n + 1)
        }}
      />
    )
    // Beating the best kept on this device says so: the moment a signed-in run's report calls a new best.
    who = <ReportWho text={recordRef.current > 0 && score > recordRef.current ? 'New best on this device · not saved yet' : 'Not saved yet'} />
  } else if (phase === 'needName') {
    // The tag in slots, and the way to save it: the reel's own Skip goes on without.
    ask = (
      <>
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
                {said} is{' '}
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
        <ReelButton
          action={{
            label: ranked ? 'Save to the board' : 'Save it',
            onClick: () => void submitName(),
            disabled: !normalizePlayerName(nameDraft),
          }}
        />
      </>
    )
    who = <ReportWho text="Signed in, no tag yet" />
  } else if (phase === 'otherAccount') {
    // Played under another account on this device: it goes on the board as theirs, once they're back.
    const tag = typeof owner === 'string' ? recallAccountTag(owner) : ''
    note = (
      <p className="report__note">
        {tag
          ? `Played as ${tag}. Sign in as ${tag} to ${ranked ? 'put it on the board' : 'save it'}.`
          : `Played as another account. Sign in as that account to ${ranked ? 'put it on the board' : 'save it'}.`}
      </p>
    )
    who = <ReportWho text="Not saved yet" />
  } else if (phase === 'assisted') {
    note = <p className="report__note">Stage skip used, so this run wasn’t saved to the boards or the record books.</p>
    who = <ReportWho text="Not saved" />
  } else if (phase === 'early') {
    const opens = launchDayOf(gameSlug)
    note = (
      <p className="report__note">
        Played before launch, so this run is practice. {game}’s boards open for everyone on launch day{opens ? `, ${archiveDayWords(opens)}` : ''}.
      </p>
    )
    who = <ReportWho text="Practice" />
  } else if (phase === 'error') {
    note = <p className="panel__error">{error}</p>
    who = <ReportWho text="Not saved" />
  } else if (pending) {
    who = (
      <ReportWho
        name={getLastPlayerName() || null}
        text={saveWaitOver ? 'Still saving. It finishes even if you play on.' : 'Saving…'}
      />
    )
  } else if (phase === 'saved' && score <= 0) {
    // A run that scored nothing goes on no board, signed in or out, and isn't kept as a best here either.
    who = <ReportWho text="No score · not saved" />
  } else if (savedAs) {
    who = <ReportWho name={savedAs} avatarId={data?.avatarId} text={`Saved as ${savedAs}`} />
  }

  // A saved run can go to a friend; one that beat a friend's goes straight back, and one that went past a
  // friend on the board goes to them.
  const runId = facts?.runId ?? null
  const reply = facts?.challenge?.won ? facts.challenge : null
  const passedFriend = data?.friend ? (facts?.friends?.passed[0] ?? null) : null
  if (phase === 'saved' && signedIn && savedAs && runId && !(outcome && !outcome.won)) {
    if (reply?.replyId && facing) {
      const replyId = reply.replyId
      secondary = {
        label: challengeCopied ? 'Copied' : 'Send it back',
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
    } else if (passedFriend) {
      // A friend gone past: the run goes to them, to take it back (FriendDuel, under the board, says who and by how much).
      secondary = {
        label: sending ? 'Making the link…' : challengeCopied ? 'Copied' : `Send ${passedFriend.name} your run`,
        icon: 'flag',
        disabled: sending,
        onClick: () => {
          setSending(true)
          setSendError(null)
          createChallenge({ game: gameSlug, scoreId: runId, name: savedAs })
            .then((made) => {
              share({
                game: gameSlug,
                id: made.id,
                score,
                name: savedAs,
                message: replyMessage(gameSlug, passedFriend.best.score, score),
                title: `Send ${passedFriend.name} your run`,
              })
              setChallenged(true)
            })
            .catch(() => setSendError('Couldn’t make the link. Try again in a moment.'))
            .finally(() => setSending(false))
        },
      }
    } else if (ghostShare && shareLine) {
      // A racing daily's run goes on as a link that races your ghost, with the run's own lines.
      const line = shareLine
      shareRun = {
        label: sending ? 'Making the link…' : lineShare.copied ? 'Copied' : 'Share run',
        icon: 'share',
        disabled: sending,
        onClick: () => {
          setSending(true)
          setSendError(null)
          createChallenge({ game: gameSlug, scoreId: runId, name: savedAs })
            .then((made) => {
              lineShare.share({ text: ghostShareText(line, challengeUrl(gameSlug, made.id)) })
              setChallenged(true)
            })
            .catch(() => setSendError('Couldn’t make the link. Try again in a moment.'))
            .finally(() => setSending(false))
        },
      }
      secondary = shareRun
      sendDares = true
    } else {
      secondary = {
        label: sending ? 'Making the link…' : challengeCopied ? 'Copied' : 'Challenge a friend',
        shortLabel: sending ? 'Wait…' : challengeCopied ? 'Copied' : 'Challenge',
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
      sendDares = true
    }
    sendRun = secondary
    if (sendError) moment = <p className="panel__error">{sendError}</p>
    else if (challenged) moment = <PushAsk reason="challenge" />
  }
  // A daily of the Dailies just saved: once today is kept, the moment to offer a nudge before a day ends unkept.
  const today = boardDay()
  const onTicket = liveDailies(today).some((d) => d.slug === gameSlug)
  if (phase === 'saved' && signedIn && !impersonation && onTicket && !moment) {
    moment = <StreakPushAsk active />
  }
  // And the way on to the next of today's dailies, saved or waiting on the sign-in: the last page's poster. One of
  // the day's puzzles (Also today) leads on to the races too. Once all of today's are done, a racing daily's tomorrow.
  const nextOnTicket = (onTicket || alsoDailies(today).some((d) => d.slug === gameSlug)) && (phase === 'saved' || phase === 'needAuth')

  // A daily just for fun has no board and no records to go to.
  if (ranked && (phase === 'saved' || phase === 'assisted' || phase === 'error')) {
    links = [{ label: 'Board', icon: 'board', onClick: () => leavePlayTo(boardsHref(gameSlug, period)) }]
    // A daily's records are on its page's Records tab, not in the record books; either way the dock says Records.
    if (isDailyGame(gameSlug) || gameHasRecords(gameSlug)) {
      links.push({ label: 'Records', icon: 'book', onClick: () => leavePlayTo(recordsPlaceHref(gameSlug)) })
    }
  }
  // A daily's run goes on whether it's saved or not, as the other dailies' cards send theirs:
  // the phone's own share sheet, or copied to paste anywhere. A racing daily's is a pill, not a link.
  if (shareLine && ghostShare && !secondary) {
    const line = shareLine
    shareRun = { label: lineShare.copied ? 'Copied' : 'Share run', icon: 'share', onClick: () => lineShare.share({ text: line }) }
    secondary = shareRun
  }
  if (shareLine && !shareRun) {
    links = [{ label: lineShare.copied ? 'Copied' : 'Share', icon: 'share', onClick: () => lineShare.share({ text: shareLine }) }, ...links]
  }

  const heading = ribbon?.text ?? title
  const saved = phase === 'saved'
  const paidTickets = saved ? (facts?.tickets ?? null) : null
  // Tickets get a step of their own when the run paid some; a run that paid none says why in a line at the end.
  const paid = paidTickets && paidTickets.earned > 0 ? paidTickets : null
  // The season's pass only when the run moved it: what it added, or a level it reached.
  const seasonMoved = saved && facts?.season && (facts.season.added > 0 || facts.season.levelUp.length > 0) ? facts.season : null
  const raceSub = race ? raceSubWords(ribbon ? (kicker ?? title) : title, race.ms, race.previousMs, race.format) : null
  // A racing daily's medal: the one the day's best now holds, and whether this run won it.
  const medalHeld = race ? medalFor(race.game, race.paceMs, Math.min(race.ms, race.previousMs ?? race.ms), race.platinumMs) : null
  const medalNew = race && medalHeld && medalBeats(medalHeld, medalFor(race.game, race.paceMs, race.previousMs, race.platinumMs)) ? medalHeld : null
  // First in the standings takes the whole screen, once, over the reel, in the standings' own period.
  const standingsPeriod = facts?.standingsPeriod ?? period
  const takeover =
    data?.standingsTop && facts?.overall.after && !takeoverDone
      ? standingsTakeover(facts.overall.after, facts.name, standingsPeriod)
      : null

  // The reel (RunReel.tsx), in Ramsey's order: the run and where it landed on its board; then, when they have news,
  // the standings, the record books, the tickets, a level; then what next.
  const bestLine = saved ? (data?.lines.find((line) => line.id === 'best') ?? null) : null
  const boardLine = saved ? (data?.lines.find((line) => line.id === 'board') ?? null) : null
  const board = saved && facts ? boardCard(facts, boardLine) : null
  // While the save is out, a run that will land on a board holds its card's place with the card's shape: signed
  // in, on a game with boards, with a score, not a stage skip or practice. Nothing moves when the board comes.
  const boardLoading = pending && ranked && canSaveScores && score > 0 && !isRunAssisted() && !beforeLaunch(gameSlug)
  if (boardLoading) boardWaitedRef.current = true
  // A racing daily's standings are its header's, as its report always had them.
  const standings = saved && facts && !race ? standingsCard(facts) : null
  // The record books the run got into, the one its stamp spoke of first.
  const books = (saved ? (data?.lines ?? []) : [])
    .filter((line) => line.id.startsWith('book-'))
    .sort((a, b) => Number(b.id === data?.lead) - Number(a.id === data?.lead))
  const recap = runRecap({
    score: {
      value: unit ? `${figure} ${unit}` : race ? said : figure,
      label: ribbon?.text ?? (bestLine?.detail ? capital(bestLine.detail) : title),
      best: bestLine?.tone === 'accent',
    },
    lines: saved ? (data?.lines ?? []) : [],
    lead: data?.lead ?? null,
    medal: saved ? medalHeld : null,
    tickets: paid?.earned ?? 0,
    standings,
    season: seasonMoved,
  })
  // What next's poster: the next of today's dailies, the place to beat standing in till the day's ticket is in; on
  // any other game, the place to beat. Each carries Play again.
  const chase = saved && facts ? chaseFacts(facts) : null
  const chasePoster = chase ? <ReelChase chase={chase} primary={playAgain} /> : null
  const poster = nextOnTicket ? (
    <Suspense fallback={chasePoster ?? <ReelButton action={playAgain} />}>
      <NextDaily
        variant="poster"
        slug={gameSlug}
        tomorrow={tomorrow}
        playAgain={playAgain}
        fallback={chasePoster ?? <ReelButton action={playAgain} />}
      />
    </Suspense>
  ) : chasePoster
  // A run not saved yet carries its ask to the end too, for whoever went past it.
  const waiting = unsaved && score > 0 ? <RunTicketsWaiting runs={phase === 'needAuth' ? 1 + othersPending : 1} tag={phase === 'needName'} /> : null
  const lastBits = [
    note,
    unsaved ? ask : null,
    moment,
    paidTickets && !paid ? <RunTicketsLine paid={paidTickets} game={gameSlug} race={race ? { medal: medalHeld, season: null } : null} /> : null,
  ].filter(Boolean)
  const steps = reelSteps({
    phase: pending ? 'pending' : unsaved ? 'ask' : saved ? 'saved' : 'done',
    slow: saveWaitOver,
    run: {
      titleId,
      tier,
      metal: data?.metal ?? null,
      ribbon,
      eyebrow: race && kicker ? kicker : title,
      // A racing daily's time as the rest of its report says one (59.00s, or 59.004s).
      score: race ? said : figure,
      unit,
      sub: race ? raceSub : ribbon ? [title, subtitle].filter(Boolean).join(' · ') : (subtitle ?? null),
      scoreTone: data?.scoreTone ?? (unsavedWin ? 'gold' : 'plain'),
      medal: medalNew,
      ladder: race ? (
        <MedalLadder
          game={race.game}
          paceMs={race.paceMs}
          platinumMs={race.platinumMs}
          ms={race.ms}
          previousMs={race.previousMs}
          format={race.format}
          signedOut={phase === 'needAuth'}
        />
      ) : null,
    },
    board,
    boardCompact: Boolean(race),
    boardLoading,
    boardStrip: hasPeriodStrip(gameSlug),
    boardWaited: boardWaitedRef.current,
    friend: saved ? (data?.friend ?? null) : null,
    standings,
    onStandings: () => leavePlayTo(leaderboardHref(standingsPeriod)),
    books,
    onBooks: isDailyGame(gameSlug) || gameHasRecords(gameSlug) ? () => leavePlayTo(recordsPlaceHref(gameSlug)) : undefined,
    tickets: paid ? (
      <ReelTickets paid={paid} game={gameSlug} medal={race ? medalHeld : null} season={seasonMoved && !seasonMoved.levelUp.length ? seasonMoved : null} />
    ) : null,
    season: seasonMoved,
    ask: ask ? (
      <>
        {ask}
        {waiting}
      </>
    ) : null,
    askGoLabel: phase === 'needName' ? 'Skip' : 'Not now',
    askFocus: phase === 'needName' ? tagRef : undefined,
    recap,
    poster,
    block: lastBits.length ? lastBits.map((bit, i) => <Fragment key={i}>{bit}</Fragment>) : null,
    // Not saved yet, the sign-in (or the tag) comes before the next daily.
    blockFirst: unsaved,
    primary: playAgain,
    secondary,
    secondaryLook: secondary && secondary === shareRun ? 'share' : 'ghost',
    // Every saved run can go to a friend from its own page, not only the last one (a tester, 2026-10-29, didn't
    // want to wait to share): the same button as the last page's. A new best or a new medal says Dare, while it's news.
    dare:
      sendRun && sendDares && (medalNew || bestLine?.tone === 'accent')
        ? {
            ...sendRun,
            label: sending ? 'Making the link…' : (sendRun === shareRun ? lineShare.copied : challengeCopied) ? 'Copied' : `Dare a friend to beat ${said}`,
          }
        : sendRun,
    who,
    links,
  })
  return (
    <>
      <RunReel
        label={`${heading}, ${said}`}
        style={accentStyle}
        accent={accent}
        game={game}
        tier={tier}
        metal={data?.metal ?? null}
        steps={steps}
        primaryRef={playRef}
        leave={{ label: 'Leave', onClick: () => leavePlayTo(gameHref(gameSlug)) }}
        // Esc goes back to the start card, except while a tag is being typed.
        onEscape={phase === 'needName' ? undefined : onDone}
      />
      {sharePanel}
      {lineShare.panel}
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
