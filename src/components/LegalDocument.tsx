import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { CONTACT_EMAIL } from '../lib/brand'
import { openFeedback } from '../lib/feedback'
import { currentHref, homeHref, privacyHref, termsHref } from '../hooks/useHashRoute'
import { PageShell } from './PageShell'
import '../styles/feedback.css'
import '../styles/info.css'

type LegalDocumentProps = {
  title: string
  updated: string
  children: ReactNode
}

type Part = { id: string; label: string }

/** A heading's words as an address's #anchor: "Plus membership" → plus-membership. */
function slug(words: string): string {
  return words
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * A policy page: a head with Terms · Privacy to switch between them, then the document in a card at a reading
 * measure, with its parts listed beside it (above it on a phone, folded). The parts come from the document's own
 * headings, which are numbered and given anchors here, so the pages keep writing plain <h2>s.
 */
export function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  const docRef = useRef<HTMLElement>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [current, setCurrent] = useState('')

  useEffect(() => {
    const doc = docRef.current
    if (!doc) return
    const heads = [...doc.querySelectorAll('h2')]
    const found: Part[] = heads.map((h) => {
      const label = h.textContent?.trim() ?? ''
      if (!h.id) h.id = slug(label)
      return { id: h.id, label }
    })
    setParts(found)
    if (!('IntersectionObserver' in window) || heads.length === 0) return
    // The part being read is the last heading above a line a quarter of the way down the screen.
    const seen = new Set<Element>()
    const watch = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.boundingClientRect.top < window.innerHeight * 0.25) seen.add(e.target)
          else seen.delete(e.target)
        }
        const last = heads.filter((h) => seen.has(h)).at(-1)
        setCurrent(last?.id ?? heads[0].id)
      },
      { rootMargin: '0px 0px -75% 0px', threshold: [0, 1] },
    )
    heads.forEach((h) => watch.observe(h))
    return () => watch.disconnect()
  }, [])

  const goTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const place = document.getElementById(id)
    if (!place) return
    e.preventDefault()
    // A tap in the folded list on a phone closes it first, so the part is aimed at where it will be once the list
    // has gone from above it.
    e.currentTarget.closest('details')?.removeAttribute('open')
    place.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(history.state, '', `${currentHref()}#${id}`)
    setCurrent(id)
  }

  const list = (
    <ol className="legal-toc__list">
      {parts.map((p, i) => (
        <li key={p.id}>
          <a
            className={`legal-toc__link${p.id === current ? ' legal-toc__link--on' : ''}`}
            href={`#${p.id}`}
            aria-current={p.id === current ? 'location' : undefined}
            onClick={goTo(p.id)}
          >
            <span className="legal-toc__num">{String(i + 1).padStart(2, '0')}</span>
            {p.label}
          </a>
        </li>
      ))}
    </ol>
  )

  const onTerms = title.startsWith('Terms')

  return (
    <PageShell innerClassName="lb-page__inner info-page info-page--legal">
      <header className="info-head info-head--legal">
        <nav className="info-crumbs" aria-label="Breadcrumb">
          <a href={homeHref()}>Home</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{title}</span>
        </nav>
        <div className="info-head__row">
          <div className="info-head__text">
            <p className="info-kicker">Legal</p>
            <h1 className="info-title">{title}</h1>
            <p className="info-updated">
              <span className="info-updated__dot" aria-hidden="true" />
              Last updated {updated}
            </p>
          </div>
          <nav className="seg legal-switch" aria-label="Policies">
            <a className={`seg__item${onTerms ? ' seg__item--active' : ''}`} href={termsHref()} aria-current={onTerms ? 'page' : undefined}>
              Terms
            </a>
            <a className={`seg__item${onTerms ? '' : ' seg__item--active'}`} href={privacyHref()} aria-current={onTerms ? undefined : 'page'}>
              Privacy
            </a>
          </nav>
        </div>
      </header>

      <div className="legal-layout">
        <aside className="legal-toc" aria-label="On this page">
          <p className="legal-toc__head">On this page</p>
          {list}
        </aside>
        <details className="legal-fold">
          <summary className="legal-fold__summary">
            <span>On this page</span>
            <span className="legal-fold__count">{parts.length > 0 ? `${parts.length} parts` : ''}</span>
          </summary>
          {list}
        </details>
        <article ref={docRef} className="legal-prose">
          {children}
        </article>
      </div>
    </PageShell>
  )
}

export function LegalContact() {
  return (
    <div className="legal-contact">
      <span className="legal-contact__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16h0a2.5 2.5 0 0 1-2-2.5z" />
          <path d="M8.5 9h7M8.5 12h4.5" />
        </svg>
      </span>
      <p>
        Questions about these policies?{' '}
        {CONTACT_EMAIL ? (
          <>
            Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </>
        ) : (
          <>
            Write to us with{' '}
            <button type="button" className="feedback-link legal-prose__contact" onClick={() => openFeedback('idea')}>
              Send feedback
            </button>
            , also at the bottom of the site’s menu.
          </>
        )}
      </p>
    </div>
  )
}
