import type { ReactNode } from 'react'
export function BoardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ol className="lb-list lb-list--skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="lb-skel">
          <span className="lb-skel__rank" />
          <span className="lb-skel__name" />
          <span className="lb-skel__score" />
        </li>
      ))}
    </ol>
  )
}

export function BoardEmpty({
  title,
  detail,
  action,
}: {
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="lb-empty-state">
      <p className="lb-empty-state__title">{title}</p>
      {detail ? <p className="lb-empty-state__detail">{detail}</p> : null}
      {action ? <div className="lb-empty-state__action">{action}</div> : null}
    </div>
  )
}
