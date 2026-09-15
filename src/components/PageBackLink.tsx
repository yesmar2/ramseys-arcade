type PageBackLinkProps = {
  href: string
  /** Accessible name — keep text out of the visual control. */
  label: string
}

/** The chevron on its own, for text back links inside hero bars. */
export function BackChevronIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 5.5L8 12l6.5 6.5"
      />
    </svg>
  )
}

/** Compact chevron back control for centered page headers. */
export function PageBackLink({ href, label }: PageBackLinkProps) {
  return (
    <a className="page-back" href={href} aria-label={label} title={label}>
      <BackChevronIcon />
    </a>
  )
}
