import { useId, type ReactNode } from 'react'
import { rankHowHref } from '../hooks/useHashRoute'
import { pastHowLines, pastHowTitle, type PastHowLine } from '../lib/dailyPast'
import { dailyWords } from '../lib/dailyWords'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { isRankedGame } from '../data/games'
import { ChevronRightIcon, LockIcon, PlayIcon } from './chromeIcons'
import { Panel, PanelHead } from './Panel'
import { AllTimeIcon, CalendarIcon, PracticeIcon, RankedIcon } from './pastIcons'
import { openSiteMenu } from './siteNav'
import '../styles/dailyPast.css'

/*
 * "How past tracks work" (Past holes, days, courses), from the ⓘ beside a daily's past tab's title: the way
 * of a past course in three short lines, each with its mark, so the tab itself needs no words about it.
 * Signed out, it says once that signing in is what puts you on the boards.
 */

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </svg>
)

const MARKS: Record<PastHowLine['mark'], ReactNode> = {
  play: <PlayIcon />,
  allTime: <AllTimeIcon />,
  practice: <PracticeIcon />,
  ranked: <RankedIcon />,
  fun: <SparkleIcon />,
  plus: <LockIcon />,
}

export function PastHowModal({ slug, signedIn, onClose }: { slug: string; signedIn: boolean; onClose: () => void }) {
  const titleId = useId()
  const boards = dailyWords(slug).past === 'board'
  // A daily just for fun places nobody (data/games.ts Game.ranked): no places to sign in for, no rank to explain.
  const ranked = isRankedGame(slug)
  return (
    <Panel labelledBy={titleId} onClose={onClose} style={gameAccentStyle(slug)} className="dp-modal phm">
      <PanelHead titleId={titleId} title={pastHowTitle(slug)} icon={<CalendarIcon />} onClose={onClose} />
      <div className="panel__body phm-body">
        <ul className="phm-lines">
          {pastHowLines(slug).map((line) => (
            <li key={line.mark} className="phm-line">
              <span className={`phm-mark phm-mark--${line.mark}`}>{MARKS[line.mark]}</span>
              {line.text}
            </li>
          ))}
        </ul>
        {signedIn ? null : (
          <p className="phm-signin">
            <button
              type="button"
              className="dp-link-btn"
              onClick={() => {
                onClose()
                // Once the panel has gone and given focus back, so the menu's own focus stands.
                window.setTimeout(openSiteMenu, 0)
              }}
            >
              Sign in
            </button>{' '}
            {ranked ? `to see your places${boards ? ' and go on the All time boards' : ''}.` : 'to see your result on each day.'}
          </p>
        )}
        {ranked ? (
          <a className="phm-how" href={rankHowHref()}>
            How your rank works
            <ChevronRightIcon />
          </a>
        ) : null}
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </Panel>
  )
}
