import { useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { adminHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { gauntletDay, PLANNED_GAUNTLETS } from './daily'
import { courseHeights } from './engine/course'
import { labRounds } from './engine/lab'
import type { Tier } from './engine/types'
import { RoundIcon } from './GauntletDrawing'
import type { RoundLetter } from './gauntletPicture'
import { gauntletRunHref } from './links'
import { freshGauntletSeed, labRoundAfter, type LabPick, type WobbleDay } from './runs'
import { formatRun, splashWords } from './score'

/*
 * The cards of an admin's test run (/games/wobblerun/play?track=<n>, or ?day=YYYY-MM-DD, for today's gauntlet or
 * one still to come, from the admin's Gauntlet Book): the one it opens on, and the one after a run. A test run is
 * for running a gauntlet before its day: its runs go on no board and aren't kept past the tab. Only an admin gets
 * one (WobbleRunGame); anyone else asking is sent to today's gauntlet. A past day's gauntlet is practice, on its
 * own cards (PracticeCards.tsx). The test lab (?lab=1) has cards of its own here too: its picker, and its card after
 * a run.
 */

const SLUG = 'wobblerun'

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/**
 * A card after a run takes presses itself: the overlay it's on lets them through to the course (wobblerun.css),
 * as a past gauntlet's card does with its own rule. Without this, its buttons were under the course's canvas.
 */
const afterRunStyle = (): CSSProperties => ({ ...gameAccentStyle(SLUG), pointerEvents: 'auto' })

/** "Today's gauntlet", "Comes Thu, Oct 15". */
function whenWords(day: string) {
  if (day === gauntletDay()) return 'Today’s gauntlet'
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Comes ${date}`
}

/** "Beat the blue blip by 1.20s", "Tied with the blue blip", "3.04s behind the blue blip". */
function againstBlue(time: number, pace: number) {
  const gap = time - pace
  return Math.abs(gap) < 0.005 ? 'Tied with the blue blip' : gap < 0 ? `Beat the blue blip by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue blip`
}

/** The gauntlets either side, and the way back to the book. A tap here isn't a tap to start. */
function GauntletNav({ n }: { n: number }) {
  return (
    <nav className="wobblerun-test__nav" aria-label="Other gauntlets">
      {n > 1 ? (
        <a href={gauntletRunHref(n - 1)} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={adminHref('gauntlets')} onPointerDown={holdPress}>
        Gauntlet Book
      </a>
      {n < PLANNED_GAUNTLETS ? (
        <a href={gauntletRunHref(n + 1)} onPointerDown={holdPress}>
          #{n + 1} ›
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

/**
 * Under the lab's cards: the way back to the book; after a run of one round, the rounds either side of it (at its
 * tier); for a test gauntlet, a new one. A tap here isn't a tap to start: a new pick opens on the picker.
 */
function LabNav({ pick, onPick, allow }: { pick: LabPick; onPick?: (pick: LabPick) => void; allow?: (e: ReactMouseEvent) => boolean }) {
  const before = onPick && pick.kind === 'round' ? labRoundAfter(pick, -1) : null
  const after = onPick && pick.kind === 'round' ? labRoundAfter(pick, 1) : null
  const go = (next: LabPick) => (e: ReactMouseEvent) => {
    if (!allow || allow(e)) onPick?.(next)
  }
  return (
    <nav className="wobblerun-test__nav" aria-label={!onPick || pick.kind === 'all' ? 'Back to the Gauntlet Book' : pick.kind === 'round' ? 'Other rounds' : 'Another gauntlet'}>
      {/* The arrows keep to their words (no-break spaces): a long name may wrap, an arrow never goes off alone. */}
      {before ? (
        <button type="button" onClick={go(before)}>
          {`‹ ${roundName(before.letter)}`}
        </button>
      ) : (
        <span />
      )}
      <a href={adminHref('gauntlets')} onPointerDown={holdPress}>
        Gauntlet Book
      </a>
      {after ? (
        <button type="button" onClick={go(after)}>
          {`${roundName(after.letter)} ›`}
        </button>
      ) : onPick && pick.kind === 'gauntlet' ? (
        <button type="button" className="wobblerun-lab__new" onClick={(e) => go({ kind: 'gauntlet', seed: freshGauntletSeed() })(e)}>
          {'New gauntlet ›'}
        </button>
      ) : (
        <span />
      )}
    </nav>
  )
}

const roundName = (letter: string) => labRounds().find((r) => r.letter === letter)?.name ?? letter

/** A tier in words: how hot it is, as the start card's chips have it (a pepper on a spicy one). */
const TIER_WORDS: Record<Tier, string> = { 1: 'gentle', 2: 'warm', 3: 'spicy' }

/** What a pick lays, in a kicker's few words. */
function pickWords(pick: LabPick): string {
  return pick.kind === 'round' ? `${roundName(pick.letter)} · T${pick.tier}` : pick.kind === 'gauntlet' ? 'Test gauntlet' : 'Every round'
}

/** The picker's kicker: the kind of thing picked (its title names it). */
function modeWords(pick: LabPick): string {
  return pick.kind === 'round' ? 'one round' : pick.kind === 'gauntlet' ? 'test gauntlet' : 'every round'
}

/** A test gauntlet's ups and downs in words: "Up 11 m and down 7 m on the way; the star 26 m over the soda sea." */
function heightsWords(wobble: WobbleDay): string {
  const h = courseHeights(wobble.course)
  return `Up ${h.climb.toFixed(0)} m and down ${h.drop.toFixed(0)} m on the way; the star ${(h.star - h.sea).toFixed(0)} m over the soda sea.`
}

const MODES: { kind: LabPick['kind']; label: string }[] = [
  { kind: 'round', label: 'One round' },
  { kind: 'gauntlet', label: 'Test gauntlet' },
  { kind: 'all', label: 'Every round' },
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="game-pause-meta__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

/** A test run's start card: like the game's own, it starts on a tap anywhere but its links. `chips`, the gauntlet's rounds. */
export function TestStartCard({ wobble, best, chips }: { wobble: WobbleDay; best: number | null; chips: ReactNode }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start wobblerun-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · gauntlet {wobble.n} of {PLANNED_GAUNTLETS}
        </span>
        <h2 className="game-card__title game-card__title--big">{wobble.name}</h2>
        <p className="game-card__blurb">
          {whenWords(wobble.day)}. Runs here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            {chips}
            <Row label="Blue blip">{formatRun(wobble.pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <GauntletNav n={wobble.n} />
    </div>
  )
}

/** After a test run: its time, against your best here and the blue blip's. */
export function TestResultCard({
  wobble,
  time,
  splats,
  best,
  improved,
  onAgain,
  onDone,
}: {
  wobble: WobbleDay
  time: number
  splats: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  return (
    <div
      ref={fitCardToSpace}
      className="game-card wobblerun-test"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`${wobble.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · #{wobble.n} {wobble.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {againstBlue(time, wobble.pace)}, with {splashWords(splats)}.
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue blip">{formatRun(wobble.pace)}</Row>
      </div>
      <p className="game-card__hint">A test run: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Run it again
        </button>
        <button
          type="button"
          className="panel__btn panel__btn--ghost"
          onClick={(e) => {
            if (allow(e)) onDone()
          }}
        >
          Done
        </button>
      </div>
      {/* On to the next one, or back, without going through the start card. */}
      <GauntletNav n={wobble.n} />
    </div>
  )
}

/**
 * The test lab's start card (?lab=1, an admin's, from the Gauntlet Book): its picker. One round at a tier (every
 * built round and the finales, by the names players see, each with its hint), a test gauntlet (a day-style gauntlet
 * by the newest rules, its rounds picked as a day's are, a new one each time), or every round in a row at all three
 * tiers. A pick lays its course at once (it's behind the card, the camera touring it) and the device remembers it.
 * The card takes its own presses, so a tap on it picks and never starts: Start starts. Nothing here is saved, and
 * there's no blue blip to race.
 */
export function LabStartCard({
  pick,
  wobble,
  best,
  chips,
  onPick,
  onStart,
}: {
  pick: LabPick
  wobble: WobbleDay
  best: number | null
  /** The test gauntlet's rounds (the game's chips). */
  chips: ReactNode
  onPick: (pick: LabPick) => void
  onStart: () => void
}) {
  const rounds = labRounds()
  const round = pick.kind === 'round' ? rounds.find((r) => r.letter === pick.letter) : undefined
  const tier: Tier = pick.kind === 'round' ? pick.tier : 3
  const letter = pick.kind === 'round' ? pick.letter : 'n'
  const title = pick.kind === 'round' ? (round?.name ?? pick.letter) : pick.kind === 'gauntlet' ? wobble.name : 'Every round'
  const hint = round ? `${round.hint[0]!.toUpperCase()}${round.hint.slice(1)}` : 'One round'
  const blurb =
    pick.kind === 'round'
      ? round?.family === 'finale'
        ? `${hint}: the finale, tier ${tier}, ${TIER_WORDS[tier]}. A lead-in, its checkpoint, then the climb to its star.`
        : `${hint}: tier ${tier}, ${TIER_WORDS[tier]}. The start, the round, a checkpoint and the star.`
      : pick.kind === 'gauntlet'
        ? 'A day’s gauntlet by the new rules, ups and downs and all: its rounds picked as a day’s are. A new one each time.'
        : `Every round at all three tiers, gentle to spicy, a checkpoint before each, then ${rounds.find((r) => r.family === 'finale')?.name ?? 'the finale'}. Five minutes or so.`
  // A pick mounts the game (and this card) afresh: on a phone, where the tiles scroll in a box of their own, the one
  // picked is brought into view (once the card has fitted itself, lib/cardFit).
  const tilesRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const box = tilesRef.current
      const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!box || !on || box.scrollHeight <= box.clientHeight + 1) return
      const b = box.getBoundingClientRect()
      const t = on.getBoundingClientRect()
      if (t.top < b.top || t.bottom > b.bottom) box.scrollTop += t.top - b.top - (b.height - t.height) / 2
    })
    return () => cancelAnimationFrame(raf)
  }, [])
  const choose = (kind: LabPick['kind']) => {
    // The one it's on already: nothing (a new test gauntlet is the strip's "New gauntlet").
    if (kind === pick.kind) return
    if (kind === 'round') onPick({ kind: 'round', letter, tier })
    else if (kind === 'gauntlet') onPick({ kind: 'gauntlet', seed: freshGauntletSeed() })
    else onPick({ kind: 'all' })
  }
  return (
    <div
      ref={fitCardToSpace}
      className="game-card wobblerun-test wobblerun-lab"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`Test lab: ${title}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">Test lab · {modeWords(pick)}</span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">{blurb}</p>
      </div>
      <div className="wobblerun-lab__seg" role="group" aria-label="What to test">
        {MODES.map((m) => (
          <button key={m.kind} type="button" className="wobblerun-lab__seg-btn" aria-pressed={pick.kind === m.kind} onClick={() => choose(m.kind)}>
            {m.label}
          </button>
        ))}
      </div>
      {pick.kind === 'round' ? (
        <>
          <div ref={tilesRef} className="wobblerun-lab__rounds" role="group" aria-label="Round">
            {rounds.map((r) => (
              <button
                key={r.letter}
                type="button"
                className="wobblerun-lab__round"
                aria-pressed={r.letter === pick.letter}
                title={`${r.name}${r.family === 'finale' ? ' (a finale)' : ''} · ${r.hint}`}
                onClick={() => onPick({ kind: 'round', letter: r.letter, tier })}
              >
                <RoundIcon letter={r.letter as RoundLetter} size={22} />
                <span className="wobblerun-lab__round-name">{r.name}</span>
                <span className="wobblerun-lab__round-hint">{r.hint}</span>
              </button>
            ))}
          </div>
          <div className="wobblerun-lab__seg" role="group" aria-label="Tier">
            {([1, 2, 3] as const).map((t) => (
              <button key={t} type="button" className="wobblerun-lab__seg-btn" aria-pressed={t === tier} onClick={() => onPick({ kind: 'round', letter, tier: t })}>
                T{t} <span className="wobblerun-lab__tier-word">{TIER_WORDS[t]}</span>
                {t === 3 ? (
                  <span role="img" aria-label="spicy">
                    {' '}
                    🌶️
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : pick.kind === 'gauntlet' ? (
        <>
          <div className="game-pause-meta">{chips}</div>
          <p className="wobblerun-lab__best">{heightsWords(wobble)}</p>
        </>
      ) : null}
      <p className="wobblerun-lab__best">
        Your best here: <strong>{best != null ? formatRun(best) : '–'}</strong> · runs here aren’t saved
      </p>
      <button type="button" className="panel__btn game-card__start" onClick={onStart}>
        Start
      </button>
      {/* A test gauntlet has "New gauntlet" on the strip; a round's neighbours are its tiles. */}
      <LabNav pick={pick} onPick={pick.kind === 'gauntlet' ? onPick : undefined} />
    </div>
  )
}

/**
 * After a run in the test lab: its time and splashes, and your best here. Again, the next round (or a new test
 * gauntlet) on the strip under it, or back to the picker. Not saved.
 */
export function LabResultCard({
  pick,
  time,
  splats,
  best,
  improved,
  onAgain,
  onPick,
  onDone,
}: {
  pick: LabPick
  time: number
  splats: number
  best: number
  improved: boolean
  onAgain: () => void
  onPick: (pick: LabPick) => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  return (
    <div
      ref={fitCardToSpace}
      className="game-card wobblerun-test"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`Test lab: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">Test lab · {pickWords(pick)}</span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">All the way to the star, with {splashWords(splats)}.</p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
      </div>
      <p className="game-card__hint">A test run: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Run it again
        </button>
        <button
          type="button"
          className="panel__btn panel__btn--ghost"
          onClick={(e) => {
            if (allow(e)) onDone()
          }}
        >
          Back to the picker
        </button>
      </div>
      <LabNav pick={pick} onPick={onPick} allow={allow} />
    </div>
  )
}
