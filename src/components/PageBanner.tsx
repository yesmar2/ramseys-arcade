import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { inkOn } from '../lib/color'
import { BackChevronIcon } from './PageBackLink'

export type Crumb = {
  href?: string
  label: string
}

type PageBannerProps = {
  /** The colour the banner is washed in. The site's own when a page has none. */
  accent?: string
  /** The small line above the title, set in a pill with a dot. Plain text or `.ev-kicker__bit`s. */
  kicker?: ReactNode
  title: ReactNode
  blurb?: ReactNode
  /** Buttons and links under the blurb: `.home-banner__cta`, `__ghost`, `__state`, `__hint`. */
  actions?: ReactNode
  /** Under the actions: a `<dl class="home-banner__figures">`, or a row of tiles. */
  figures?: ReactNode
  /** What stands on the leaning card: a game's mark, a cluster of thumbs, a character, a glyph. */
  art?: ReactNode
  /** The card is a button when there is something to do with it, like editing an avatar. */
  onArtClick?: () => void
  artLabel?: string
  /** A way back, in a bar across the top. */
  back?: { href: string; label: string }
  /** Tools for the bar's right end: share, copy invite, add friend. */
  tools?: ReactNode
  /** Where this page sits, above the banner: Games › Asteroids › Top scores. The last one is here. */
  crumbs?: Crumb[]
  /**
   * The full banner opens a page on one thing; the compact one heads a page
   * that is mostly a list or a form, at half the height with a smaller card.
   */
  size?: 'full' | 'compact'
  className?: string
  ariaLabel?: string
}

/**
 * The site's banner, for any page that opens on one thing: the boards, the
 * record books, an event, a player, a group. The home page and the game
 * page draw the same banner by hand; this is the same markup for pages
 * whose art is not a game's mark. A wash of the accent with the words on
 * the left and the art on a leaning card on the right, coloured through the
 * banner tokens in home.css so the theme follows. A page that needs a way
 * back or tools gets a bar across the top; a page that sits under others
 * gets breadcrumbs above.
 */
export function PageBanner({
  accent,
  kicker,
  title,
  blurb,
  actions,
  figures,
  art,
  onArtClick,
  artLabel,
  back,
  tools,
  crumbs,
  size = 'full',
  className,
  ariaLabel,
}: PageBannerProps) {
  const style = accent
    ? ({ '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties)
    : undefined
  const barred = Boolean(back || tools)
  const card = art ? (
    onArtClick ? (
      <button type="button" className="home-banner__card home-banner__card--btn" onClick={onArtClick} aria-label={artLabel}>
        {art}
      </button>
    ) : (
      <span className="home-banner__card" aria-hidden="true">
        {art}
      </span>
    )
  ) : null
  const classes = [
    'home-banner',
    'page-banner',
    barred ? 'page-banner--barred' : '',
    size === 'compact' ? 'page-banner--compact' : '',
    card ? '' : 'page-banner--bare',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {crumbs && crumbs.length > 0 ? (
        <nav className="page-crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <Fragment key={i}>
              {i > 0 ? <span aria-hidden="true">›</span> : null}
              {crumb.href && i < crumbs.length - 1 ? (
                <a href={crumb.href}>{crumb.label}</a>
              ) : (
                <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      ) : null}
      <section className={classes} style={style} aria-label={ariaLabel}>
        {barred ? (
          <div className="home-banner__bar">
            {back ? (
              <a className="home-banner__back" href={back.href}>
                <BackChevronIcon size={18} />
                {back.label}
              </a>
            ) : (
              <span />
            )}
            {tools ? <div className="home-banner__tools">{tools}</div> : null}
          </div>
        ) : null}
        <div className="home-banner__text">
          {kicker ? <p className="home-banner__kicker">{kicker}</p> : null}
          <h1 className="home-banner__name">{title}</h1>
          {blurb ? <p className="home-banner__blurb">{blurb}</p> : null}
          {actions ? <div className="home-banner__acts">{actions}</div> : null}
          {figures}
        </div>
        {card ? <div className="home-banner__art">{card}</div> : null}
      </section>
    </>
  )
}
