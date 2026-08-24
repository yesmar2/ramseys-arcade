type PageBackLinkProps = {
  href: string
  /** Accessible name — keep text out of the visual control. */
  label: string
}

/** Compact chevron back control for centered page headers. */
export function PageBackLink({ href, label }: PageBackLinkProps) {
  return (
    <a className="page-back" href={href} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.5 5.5L8 12l6.5 6.5"
        />
      </svg>
    </a>
  )
}
