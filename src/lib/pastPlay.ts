import { useEffect } from 'react'
import { getGame } from '../data/games'
import { navigate } from '../hooks/useHashRoute'
import { APP_NAME } from './brand'
import { dailyWords, type PastKind } from './dailyWords'
import { exitFullscreen } from './fullscreen'

/*
 * A daily's past course being played: what the play screen says about it and where leaving goes. The
 * game hands one `PastPlay` to its chrome (GameHud's GamePlayChrome) and its pause card (PauseControls'
 * GamePauseOverlay), so the chip, the tab's title, Leave and the pause card's figures all agree that
 * this isn't today's course. The chip and the figures are drawn in components/PastPlay.tsx; the start
 * and result cards are components/PastCourseCards.tsx.
 */

/** One line of a past course's figures: who led it and where you stand, on its Ranked or All time board. */
export type PastFact = {
  /** What the line is of, its board's name (lib/dailyWords.ts BOARD_NAMES): "Ranked", "All time". */
  label: string
  /** Who leads, in bold: "LATTE". */
  who?: string | null
  /** Their result, after the name: "1st in 1:15.31", "1:14.41". With no `who`, the whole line: "Nobody played it". */
  what?: string | null
  /** Your part, in the game's colour: "You 5th of 14", "You 4th of 17 (49.1s)". */
  you?: string | null
  /** Said plainly where you have no part: "You're not on it". Shown when there's no `you`. */
  note?: string | null
}

/** A past course on the play screen. */
export type PastPlay = {
  /** This course's row on the daily's past tab, dailyTabHref(slug, 'past', course): Leave and the pause card's board link go there. */
  href: string
  /** What a run here does; the game's own (dailyWords) when left out. Ace Chase: 'practice' once you have a result on the hole. */
  kind?: PastKind
  /** The course's name for the browser's tab: "Seneca Glen" makes "Hot Lap · Seneca Glen (past track)". */
  title?: string
  /** Its figures on the pause card, the start card's lines: "Ranked", "All time". */
  facts?: readonly PastFact[]
  /** False when the game shows PastPlayChip in its own HUD rather than under the back control. */
  chip?: boolean
}

/** What a run on a past course does: the game's own, unless the game says otherwise. */
export function pastKind(slug: string, kind?: PastKind): PastKind {
  return kind ?? dailyWords(slug).past
}

/** Leave the play screen for a page of the site: out of fullscreen first, as the back control does. */
export function leavePlay(href: string) {
  void exitFullscreen()
  navigate(href)
}

/**
 * The browser's tab names the past course while it's played: "Hot Lap · Seneca Glen (past track)". The
 * route's own title lands after the game's first effects (usePageMeta, in App), so it's put back when
 * anything else writes one while the course is up.
 */
export function usePastPlayTitle(slug: string, title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const game = getGame(slug)?.name ?? 'Game'
    const want = `${game} · ${title} (past ${dailyWords(slug).course}) · ${APP_NAME}`
    const keep = () => {
      if (document.title !== want) document.title = want
    }
    keep()
    const timer = window.setTimeout(keep, 0)
    const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(keep)
    watch?.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      window.clearTimeout(timer)
      watch?.disconnect()
    }
  }, [slug, title])
}
