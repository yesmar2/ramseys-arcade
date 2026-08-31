import type { ReactNode } from 'react'
import { CONTACT_EMAIL } from '../lib/brand'
import { PageShell } from './PageShell'

type LegalDocumentProps = {
  title: string
  updated: string
  children: ReactNode
}

export function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  return (
    <PageShell innerClassName="legal-page__inner">
      <header className="legal-page__header">
        <a className="legal-page__back" href="#/">
          ← Home
        </a>
        <h1 className="legal-page__title">{title}</h1>
        <p className="legal-page__updated">Last updated: {updated}</p>
      </header>
      <article className="legal-prose">{children}</article>
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
