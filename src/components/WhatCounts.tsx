import { howToPlayFor } from '../data/howToPlay'
import { rankHowHref } from '../hooks/useHashRoute'
import { ChevronRightIcon } from './chromeIcons'
import { RunLabel } from './RunLabel'
import '../styles/whatCounts.css'

/**
 * What a daily's run counts toward, part of How to play: today's course toward your rank, and a past one
 * on its own board or as practice (data/howToPlay.ts `counts`), each wearing the label it wears wherever a
 * run starts. Nothing for a game that isn't a daily.
 */
export function WhatCounts({ slug }: { slug: string }) {
  const counts = howToPlayFor(slug)?.counts
  if (!counts?.length) return null
  return (
    <section className="wc" aria-labelledby={`wc-title-${slug}`}>
      <div className="wc__head">
        <h3 id={`wc-title-${slug}`} className="wc__title">
          What counts
        </h3>
        <a className="wc__link" href={rankHowHref()}>
          How your rank works
          <ChevronRightIcon />
        </a>
      </div>
      <ul className="wc__rows">
        {counts.map((count) => (
          <li key={count.what} className="wc__row">
            <span className="wc__what">{count.what}</span>
            <RunLabel kind={count.kind} slug={slug} />
            <span className="wc__sub">{count.sub}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
