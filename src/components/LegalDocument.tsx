import type { ReactNode } from 'react'
import { CONTACT_EMAIL } from '../lib/brand'
import { homeHref } from '../hooks/useHashRoute'
import { PageBanner } from './PageBanner'
import { PageShell } from './PageShell'

type LegalDocumentProps = {
  title: string
  updated: string
  children: ReactNode
}

/** A policy page: the compact banner, then the document at a reading measure. */
export function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  return (
    <PageShell innerClassName="lb-page__inner">
      <div className="page-stack">
        <PageBanner
          size="compact"
          crumbs={[{ href: homeHref(), label: 'Home' }, { label: title }]}
          kicker="Legal"
          title={title}
          blurb={`Last updated ${updated}.`}
        />
        <article className="legal-prose">{children}</article>
      </div>
    </PageShell>
  )
}

export function LegalContact() {
  return (
    <p>
      Questions about these policies?{' '}
      {CONTACT_EMAIL ? (
        <>
          Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      ) : (
        <>Use the sign-in menu on the site to reach the operator.</>
      )}
    </p>
  )
}
