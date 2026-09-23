import { rankHref, statsHref } from '../hooks/useHashRoute'
import { CardIcon, LockIcon, StatsIcon } from './chromeIcons'

/**
 * The two sides of your own profile: the player card anyone can see, and your
 * stats, which only you can. Someone else's card has no switch.
 */
export function ProfileViews({ on }: { on: 'card' | 'stats' }) {
  return (
    <nav className="pviews" aria-label="Your profile">
      <a className={`pviews__view${on === 'card' ? ' pviews__view--on' : ''}`} href={rankHref()} aria-current={on === 'card' ? 'page' : undefined}>
        <CardIcon />
        Player card
      </a>
      <a className={`pviews__view${on === 'stats' ? ' pviews__view--on' : ''}`} href={statsHref()} aria-current={on === 'stats' ? 'page' : undefined}>
        <StatsIcon />
        Stats
        <span className="pviews__only" title="Only you can see your stats">
          <LockIcon />
          <span className="pviews__only-text">Only you</span>
        </span>
      </a>
    </nav>
  )
}
