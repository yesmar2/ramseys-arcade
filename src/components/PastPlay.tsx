import { type PastKind } from '../lib/dailyWords'
import { pastKind, type PastFact } from '../lib/pastPlay'
import { PastRunChip } from './RunLabel'
import '../styles/pastCourse.css'

/*
 * What the play screen shows while a daily's past course is played (lib/pastPlay.ts): the chip, and the
 * course's figures on the start and pause cards.
 */

/**
 * The chip on the play screen for the whole of a past course's run: "Past track · not ranked". A past
 * hole played as practice says "Past hole · practice" in practice's colour.
 */
export function PastPlayChip({ slug, kind }: { slug: string; kind?: PastKind }) {
  return <PastRunChip slug={slug} kind={pastKind(slug, kind) === 'board' ? 'board' : 'practice'} />
}

/** A past course's figures, a line each: the start card's, and the pause card's while it's played. */
export function PastFacts({ facts }: { facts: readonly PastFact[] }) {
  if (facts.length === 0) return null
  return (
    <div className="past-facts">
      {facts.map((fact) => {
        const lead = fact.who || fact.what
        const mine = fact.you ? (
          <span className="past-fact__you">{fact.you}</span>
        ) : fact.note ? (
          <span className="past-fact__note">{fact.note}</span>
        ) : null
        return (
          <div key={fact.label} className="past-fact">
            <span className="past-fact__k">{fact.label}</span>
            <span className="past-fact__v">
              {fact.who ? <b>{fact.who}</b> : null}
              {fact.who && fact.what ? ' ' : null}
              {fact.what}
              {lead && mine ? (
                <>
                  {' '}
                  <span className="past-fact__dot" aria-hidden="true">
                    ·
                  </span>{' '}
                </>
              ) : null}
              {mine}
            </span>
          </div>
        )
      })}
    </div>
  )
}
