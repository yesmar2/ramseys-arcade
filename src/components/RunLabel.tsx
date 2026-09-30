import { dailyWords } from '../lib/dailyWords'
import '../styles/runLabel.css'

/*
 * What a run on a daily counts toward, said the same way everywhere a run can start or end: today's
 * course counts toward your rank; a past course either goes on its own board, which isn't ranked, or is
 * practice that saves nothing. The same words, colour and icon on the game's page, its past days, the
 * start and result cards and the pause card, so "does this count?" never needs asking.
 */

export type RunLabelKind = 'counts' | 'board' | 'practice'

/** The label's words for a game: `full` on a card, `short` on a chip or a row. */
export function runLabelWords(kind: RunLabelKind, slug: string): { full: string; short: string; sub: string } {
  const words = dailyWords(slug)
  if (kind === 'counts') {
    return {
      full: 'Counts toward your rank',
      short: 'Counts',
      sub: `${words.today} goes on today’s board, your week and your rank.`,
    }
  }
  if (kind === 'board') {
    const course = words.course
    return {
      full: `${capital(course)} board only · not your rank`,
      short: `${capital(course)} board only`,
      sub: `Your result goes on this ${course}’s own board. Today’s board, your week and your rank stay as they are.`,
    }
  }
  return {
    full: 'Practice · nothing is saved',
    short: 'Practice',
    sub: 'Nothing here is kept: no board, no tickets, no rank.',
  }
}

function capital(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

const Icon = ({ kind }: { kind: RunLabelKind }) => {
  if (kind === 'counts') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )
  }
  if (kind === 'board') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" />
    </svg>
  )
}

/**
 * The label. `short` for a chip in a row or a strip; the full words otherwise. `withSub` adds the one
 * line under it that says what happens to your result (start and result cards).
 */
export function RunLabel({
  kind,
  slug,
  short = false,
  withSub = false,
  className,
}: {
  kind: RunLabelKind
  slug: string
  short?: boolean
  withSub?: boolean
  className?: string
}) {
  const words = runLabelWords(kind, slug)
  const chip = (
    <span className={`run-label run-label--${kind}${className ? ` ${className}` : ''}`}>
      <Icon kind={kind} />
      {short ? words.short : words.full}
    </span>
  )
  if (!withSub) return chip
  return (
    <span className="run-label-block">
      {chip}
      <span className="run-label-block__sub">{words.sub}</span>
    </span>
  )
}

/**
 * The chip on the play screen while a past course is played: "Past track · not ranked". `kind` says
 * when this run is practice on a game whose past courses keep a board (a hole you already have a result
 * on, or anything signed out): "Past hole · practice".
 */
export function PastRunChip({ slug, kind }: { slug: string; kind?: 'board' | 'practice' }) {
  const words = dailyWords(slug)
  const shown: RunLabelKind = kind ?? (words.past === 'board' ? 'board' : 'practice')
  const text = shown === 'practice' && words.past === 'board' ? `Past ${words.course} · practice` : words.hudPast
  return (
    <span className={`run-label run-label--${shown} run-label--hud`} role="status">
      <Icon kind={shown} />
      {text}
    </span>
  )
}
