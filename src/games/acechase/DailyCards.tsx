import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { SignInButton } from '../../components/SignInWays'
import { TicketGlyph } from '../../components/prizes/Ticket'
import { StreakPushAsk } from '../../components/PushAsk'
import { SeasonRunLine } from '../../components/season/SeasonRun'

/** The way on to the next of today's dailies, with the day's ticket it brings. */
const NextDaily = lazy(() => import('../../components/NextDaily'))
import { RunLabel } from '../../components/RunLabel'
import { TagSlots } from '../../components/RunReport'
import { copyText } from '../../components/ShareBoardButton'
import { useAccountId } from '../../hooks/useAccountId'
import { useAuth } from '../../hooks/useAuth'
import { gameArchiveHref, navigate, prizesHref, todayShareHref } from '../../hooks/useHashRoute'
import { linkCurrentNameToAccount, recallAccountTag } from '../../lib/auth'
import { ownKey, SIGNED_OUT } from '../../lib/deviceRuns'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { getLastPlayerName, normalizePlayerName } from '../../lib/leaderboard'
import {
  PLACE_NAME,
  claimDay,
  dayResult,
  HOLE_MEDALS,
  holeMedal,
  msUntilNextHole,
  shareText,
  syncDaily,
  type DailyServer,
  type DayProgress,
  type TodaysHole,
} from '../../lib/dailyHole'

/*
 * Today's Hole's two cards, in the panel kit like every game's start and score cards: the one it opens
 * on, and the one a bullseye brings up. Their buttons are the only way on; a tap elsewhere on them does
 * nothing, since there's more than one thing to do.
 *
 * What they show as yours is only ever your own (lib/deviceRuns.ts): your run on this device, and your
 * result on the board. A run played signed out here is offered to take up, and nothing else is.
 */

const SLUG = 'acechase'

function untilNext(ms: number): string {
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** When the next hole comes, kept fresh. */
function NextHole() {
  const [ms, setMs] = useState(() => msUntilNextHole())
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilNextHole()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return <p className="game-card__hint acechase-daily__next">Next hole in {untilNext(ms)}</p>
}


const END_NAME: Record<string, string> = { b: 'bullseye', i: 'inner ring', o: 'outer ring', n: 'near', x: 'further off', l: 'lost' }

/** The day's tries as marks, one a try: where each ended. */
function Pattern({ pattern }: { pattern: string }) {
  const marks = [...pattern]
  const shown = marks.length > 30 ? [...marks.slice(0, 29), '…', marks[marks.length - 1]!] : marks
  return (
    <div className="acechase-daily__pattern" aria-label={marks.map((c) => END_NAME[c] ?? '').join(', ')}>
      {shown.map((c, i) => (
        <span key={i} className={`acechase-daily__mark acechase-daily__mark--${c === '…' ? 'more' : c}`} aria-hidden="true">
          {c === '…' ? '…' : null}
        </span>
      ))}
    </div>
  )
}

/**
 * The day's medals by tries (lib/dailyHole HOLE_MEDALS: gold in 1–2, silver in 3–4, bronze in 5–7), the one
 * this result took lit, as the racing dailies show theirs by time.
 */
function Medals({ tries }: { tries: number }) {
  const won = holeMedal(tries)
  return (
    <ol className="acechase-medals" aria-label={won ? `${won.name} medal` : 'No medal today'}>
      {HOLE_MEDALS.map((m, i) => {
        const from = i === 0 ? 1 : HOLE_MEDALS[i - 1]!.most + 1
        return (
          <li key={m.medal} className={`acechase-medals__m acechase-medals__m--${m.medal}${won?.medal === m.medal ? ' is-won' : ''}`}>
            <span className="acechase-medals__disc" aria-hidden="true">
              {m.emoji}
            </span>
            <b>{m.name}</b>
            <span>{from === m.most ? `${m.most} tries` : `${from}–${m.most} tries`}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** How everyone did today: how many took one try, two, and so on, yours marked. */
function Spread({ spread, mine }: { spread: number[]; mine: number | null }) {
  const most = Math.max(1, ...spread)
  const at = mine == null ? -1 : Math.min(spread.length, mine) - 1
  return (
    <div className="acechase-daily__spread" role="img" aria-label={spread.map((n, i) => `${n} in ${i + 1 === spread.length ? `${i + 1} or more` : i + 1}`).join(', ')}>
      {spread.map((n, i) => (
        <div key={i} className={`acechase-daily__bar${i === at ? ' is-mine' : ''}`}>
          <span className="acechase-daily__track">
            <span className="acechase-daily__fill" style={{ height: `${Math.max(5, (n / most) * 100)}%` }} />
          </span>
          <span className="acechase-daily__tries">{i + 1 === spread.length ? `${i + 1}+` : i + 1}</span>
        </div>
      ))}
    </div>
  )
}

/** Send the day on: the phone's own share sheet, or copied to paste anywhere. */
export function ShareButton({
  hole,
  tries,
  pattern,
  className = 'panel__btn',
}: {
  hole: TodaysHole
  tries: number
  pattern: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const share = () => {
    // The day's own link, which unfurls into the day's card and opens the Today page.
    const url = `${window.location.origin}${todayShareHref(hole.day)}`
    const text = `${shareText(hole, tries, pattern)}\n${url}`
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      navigator.share({ text }).catch(() => {})
      return
    }
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => copyText(text) && done())
    else if (copyText(text)) done()
  }
  return (
    <button type="button" className={className} onClick={share}>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="game-card acechase-daily"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/** Where today stands for everyone: how many got it, in how many on average. */
function Everyone({ server }: { server: DailyServer | null }) {
  if (!server) return null
  return (
    <div className="game-pause-meta__row">
      <span>Everyone today</span>
      <strong>
        {server.solved === 0 ? 'Nobody yet' : `${server.solved} got it`}
        {server.average != null && server.solved > 0 ? ` · ${server.average} tries on average` : ''}
      </strong>
    </div>
  )
}

/** What the day's result paid for the prize counter. */
function HoleTickets({ tickets }: { tickets: number }) {
  return (
    <p className="acechase-daily__tix">
      <TicketGlyph size={20} />
      <span>
        <b>+{tickets} tickets</b> for today&rsquo;s result.{' '}
        <a
          href={prizesHref()}
          onClick={(e) => {
            e.preventDefault()
            navigate(prizesHref())
          }}
        >
          Prize counter ›
        </a>
      </span>
    </p>
  )
}

/**
 * Signed in without a tag, the day's result is kept but isn't saved under a name yet: a tag does that (it's
 * what the Dailies and your days read). The API catches it up the next time it's asked, which syncDaily
 * does straight after.
 */
function BoardTag() {
  const id = useId()
  const [draft, setDraft] = useState(() => getLastPlayerName())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = normalizePlayerName(draft)
  const submit = async () => {
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      await linkCurrentNameToAccount(name)
      await syncDaily(true)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'That tag didn’t work. Try another.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="acechase-daily__tag">
      <TagSlots id={id} value={draft} onChange={setDraft} onSubmit={() => void submit()} lead="Put your tag on it to save it as today’s result." error={error} />
      <button type="button" className="panel__btn" disabled={!name || busy} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Save it'}
      </button>
    </div>
  )
}

/** A run played as another account on this device, which waits for that account to sign in here again. */
export function PlayedAs({ owner, signedIn }: { owner: string | null; signedIn: boolean }) {
  const tag = owner ? recallAccountTag(owner) : ''
  return (
    <div className="acechase-daily__signin">
      <p>{tag ? `Played as ${tag}. Sign in as ${tag} to put it on the board.` : 'Played as another account. Sign in as that account to put it on the board.'}</p>
      {signedIn ? null : <SignInButton />}
    </div>
  )
}

const triesWords = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`

/** The card Today's Hole opens on. */
export function DailyStartCard({
  hole,
  progress,
  claim,
  server,
  onStart,
  onTakeUp,
  onPractice,
}: {
  hole: TodaysHole
  /** The player's own run today on this device (lib/deviceRuns.ts). */
  progress: DayProgress | null
  /** A run today from signed out on this device, which the account signed in may take up. */
  claim: DayProgress | null
  server: DailyServer | null
  onStart: () => void
  /** Carry on the run from signed out, as theirs. */
  onTakeUp: () => void
  onPractice: () => void
}) {
  const { signedIn } = useAuth()
  const viewer = useAccountId()
  const [putting, setPutting] = useState(false)
  const [putError, setPutError] = useState<string | null>(null)
  const you = server?.day === hole.day ? server.you : undefined
  // Their result: on the board from wherever they played, or their own bullseye here.
  const result = dayResult(progress, you)
  const tries = progress?.tries ?? 0
  // Played signed out here, which the account signed in can make theirs while they've no result or run of their own.
  const open = !result && !progress ? claim : null
  const putOnBoard = async () => {
    if (putting) return
    setPutting(true)
    setPutError(null)
    try {
      if (!(await claimDay(hole.day))) setPutError('It can’t go on the board as yours: you have a result today already.')
    } catch (err) {
      setPutError(err instanceof Error && err.message ? err.message : 'That result didn’t go on the board. Try again.')
    } finally {
      setPutting(false)
    }
  }
  return (
    <Card label={`Today's Hole #${hole.n}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">Today&rsquo;s Hole #{hole.n}</span>
        <h2 className="game-card__title game-card__title--big">{hole.def.name}</h2>
        <p className="game-card__blurb">
          On {PLACE_NAME[hole.pick.style]}. {hole.def.note}
        </p>
      </div>
      <p className="acechase-daily__rules">
        {result
          ? 'That’s your result for today. Play the hole again as much as you like: it’s practice, and your result stands.'
          : 'Everyone plays this hole today. Every try counts, even if you leave and come back; your first bullseye is your result.'}
      </p>
      {/* What a run from here does: the day's tries count until the first bullseye; after it, they're practice.
          Left off while a run from signed out is on offer, as Find the Bug's and Half Full's cards do. */}
      {open ? null : <RunLabel kind={result ? 'practice' : 'fun'} slug={SLUG} className="acechase-daily__label" />}
      <div className="game-pause-meta">
        <div className="game-pause-meta__row">
          <span>You</span>
          <strong>{result ? `Bullseye in ${result.tries}` : tries > 0 ? `${triesWords(tries)} so far` : 'Not played yet'}</strong>
        </div>
        {open ? (
          <div className="game-pause-meta__row">
            <span>Played signed out</span>
            <strong>{open.solved ? `Bullseye in ${open.solved.tries}` : `${triesWords(open.tries)} so far`}</strong>
          </div>
        ) : null}
        <Everyone server={server} />
      </div>
      {result?.pattern ? <Pattern pattern={result.pattern} /> : null}
      {result?.pattern && progress?.tickets ? <HoleTickets tickets={progress.tickets} /> : null}
      {result && signedIn && you?.tries != null && you.tag === null ? <BoardTag /> : null}
      {open ? (
        <p className="game-card__hint">
          {open.solved
            ? 'Someone got it here signed out. Save it as yours, or play your own.'
            : 'Someone played it here signed out. Carry it on as yours, or start your own.'}
        </p>
      ) : null}
      {putError ? <p className="panel__error">{putError}</p> : null}
      <div className="game-card__actions">
        {result ? (
          <>
            {result.pattern ? <ShareButton hole={hole} tries={result.tries} pattern={result.pattern} /> : null}
            <button type="button" className={`panel__btn${result.pattern ? ' panel__btn--ghost' : ''}`} onClick={onPractice}>
              Play it again · doesn&rsquo;t count
            </button>
          </>
        ) : open ? (
          <>
            {open.solved ? (
              <button type="button" className="panel__btn" disabled={putting} onClick={() => void putOnBoard()}>
                {putting ? 'Saving…' : 'Save it as yours'}
              </button>
            ) : (
              <button type="button" className="panel__btn" onClick={onTakeUp}>
                Carry it on
              </button>
            )}
            <button type="button" className="panel__btn panel__btn--ghost" onClick={onStart}>
              {open.solved ? 'Play your own' : 'Start your own'}
            </button>
          </>
        ) : (
          // A counted run is its player's, so it waits until the account signed in is known.
          <button type="button" className="panel__btn" disabled={viewer === undefined} onClick={onStart}>
            {tries > 0 ? 'Carry on' : 'Start'}
          </button>
        )}
      </div>
      <NextHole />
      <a className="acechase-daily__archive" href={gameArchiveHref(SLUG)}>
        Past holes ›
      </a>
    </Card>
  )
}

/**
 * The card a bullseye brings up: the day's result, where it came in, and passing it on. A counted run's
 * result is its own player's (lib/deviceRuns.ts): played signed out, it goes on the board as whoever signs
 * in with this card up, as a save card's would; played as another account, it waits for that account.
 */
export function DailyResultCard({
  hole,
  progress,
  own,
  server,
  practice,
  owner,
  onTakenUp,
  onPractice,
  onLeave,
}: {
  hole: TodaysHole
  /** The counted run that has just ended, as its player has it. */
  progress: DayProgress | null
  /** The player's own run today, for a practice run's result to stand beside. */
  own: DayProgress | null
  server: DailyServer | null
  practice: boolean
  /** Whose the counted run is: its stamp (lib/deviceRuns.ts); null for practice. */
  owner: string | null
  /** A run from signed out went on the board as the account signed in: it's theirs now. */
  onTakenUp: (account: string) => void
  onPractice: () => void
  onLeave: () => void
}) {
  const { signedIn } = useAuth()
  const viewer = useAccountId()
  const [taking, setTaking] = useState<'sending' | 'refused' | 'failed' | null>(null)
  const takenRef = useRef(onTakenUp)
  takenRef.current = onTakenUp
  // Played signed out, and someone signed in with the card up: it's theirs, unless they have a result already.
  const takeUp = !practice && owner === SIGNED_OUT && typeof viewer === 'string' ? viewer : null
  useEffect(() => {
    if (!takeUp) return
    let live = true
    setTaking('sending')
    claimDay(hole.day).then(
      (went) => {
        if (!live) return
        setTaking(went ? null : 'refused')
        if (went) takenRef.current(takeUp)
      },
      () => {
        if (live) setTaking('failed')
      },
    )
    return () => {
      live = false
    }
  }, [takeUp, hole.day])
  const you = server?.day === hole.day ? server.you : undefined
  // What the card is about: the counted run's bullseye, or for practice, the player's result it stands
  // beside (from the board, or their own bullseye here).
  const solved = progress?.solved
  const shown = practice ? dayResult(own, you) : solved ? { tries: solved.tries, pattern: solved.pattern } : null
  if (!practice && !shown) return null
  // The run is the player's own (or practice, beside their own result): its place and streak are theirs.
  const mine = practice || owner === ownKey(viewer)
  // Played as an account that isn't the one signed in now, or signed out now (once that's known).
  const theirs = !practice && owner != null && owner !== SIGNED_OUT && viewer !== undefined && owner !== viewer
  const title = practice ? 'That one didn’t count' : shown?.tries === 1 ? 'First try!' : `Bullseye in ${shown?.tries}`
  return (
    <Card label={`Today's Hole #${hole.n}: ${title}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Today&rsquo;s Hole #{hole.n}
          {practice ? ' · practice' : ''}
        </span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">
          {practice && shown ? `Your result today stands: bullseye in ${shown.tries}.` : `${hole.def.name}, on ${PLACE_NAME[hole.pick.style]}.`}
        </p>
      </div>
      {practice ? <RunLabel kind="practice" slug={SLUG} className="acechase-daily__label" /> : null}
      {shown?.pattern ? <Pattern pattern={shown.pattern} /> : null}
      {shown && !practice ? <Medals tries={shown.tries} /> : null}
      <div className="game-pause-meta">
        {/* Ace Chase is just for fun (data/games.ts Game.ranked): how everyone did, and no place for anyone. */}
        <Everyone server={server} />
        {mine && you && you.streak > 1 ? (
          <div className="game-pause-meta__row">
            <span>Streak</span>
            <strong>{you.streak} days in a row</strong>
          </div>
        ) : null}
      </div>
      {server && server.solved > 0 ? <Spread spread={server.spread} mine={shown?.tries ?? null} /> : null}
      {!practice && mine && progress?.tickets ? <HoleTickets tickets={progress.tickets} /> : null}
      {!practice && mine && server?.season ? <SeasonRunLine run={server.season} /> : null}
      {mine && signedIn && you?.tries != null && you.tag === null ? <BoardTag /> : null}
      {theirs ? <PlayedAs owner={owner} signedIn={signedIn} /> : null}
      {takeUp && taking === 'sending' ? <p className="game-card__hint">Saving it as today&rsquo;s result…</p> : null}
      {takeUp && taking === 'refused' ? (
        <p className="game-card__hint">
          {you?.tries != null ? `Your result today stands: bullseye in ${you.tries}. This one, played signed out, isn’t saved.` : 'This one, played signed out, isn’t saved.'}
        </p>
      ) : null}
      {takeUp && taking === 'failed' ? <p className="panel__error">That result didn&rsquo;t save. Save it from the start card.</p> : null}
      {mine && !signedIn ? (
        <div className="acechase-daily__signin">
          <p>Sign in to save today&rsquo;s result, earn its tickets, and keep a streak going.</p>
          <SignInButton />
        </div>
      ) : null}
      {/* Today kept by this hole: the moment to offer a nudge before a day ends unkept. */}
      <StreakPushAsk active={!practice && mine && signedIn} className="push-ask--in-card" />
      {/* The way on to the next of today's dailies. */}
      {!practice ? (
        <Suspense fallback={null}>
          <NextDaily slug="acechase" className="next-daily--in-card" />
        </Suspense>
      ) : null}
      <div className="game-card__actions">
        {shown?.pattern ? <ShareButton hole={hole} tries={shown.tries} pattern={shown.pattern} /> : null}
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onPractice}>
          Play it again · doesn&rsquo;t count
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          Back to Ace Chase
        </button>
      </div>
      <NextHole />
    </Card>
  )
}
