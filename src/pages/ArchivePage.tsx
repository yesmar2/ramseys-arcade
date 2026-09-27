import { Suspense } from 'react'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { getGame, isDailyGame } from '../data/games'
import { gameHref, homeHref } from '../hooks/useHashRoute'
import { lazyPage } from '../lib/lazyPage'
import '../styles/archive.css'

/*
 * A daily game's archive, /games/<slug>/archive: every day since its first, newest first, each one
 * playable again as practice. Each game's list comes in a chunk of its own, with its plan.
 */

const HoleArchive = lazyPage(() => import('../components/archive/HoleArchive').then((m) => m.HoleArchive))
const TrackArchive = lazyPage(() => import('../components/archive/TrackArchive').then((m) => m.TrackArchive))

/** What each daily game's archive is called, and says about itself. */
const ARCHIVES: Record<string, { title: string; blurb: string }> = {
  acechase: {
    title: 'Past holes',
    blurb: 'Every day’s hole since the first, and how it went. Play any of them again: here they’re practice, so they don’t count for boards, tickets or records.',
  },
  hotlap: {
    title: 'Past tracks',
    blurb: 'Every day’s track since the first, and who was fastest. Drive any of them again: here a lap is practice, so it doesn’t count for boards, tickets or records.',
  },
}

export function ArchivePage({ slug }: { slug: string }) {
  const game = getGame(slug)
  const words = game && isDailyGame(slug) ? ARCHIVES[slug] : undefined
  return (
    <PageShell innerClassName="lb-page__inner">
      <PageBanner
        size="compact"
        crumbs={[{ href: homeHref(), label: 'Home' }, ...(game ? [{ href: gameHref(slug), label: game.name }] : []), { label: 'Archive' }]}
        kicker={game ? `${game.name} archive` : 'Archive'}
        title={words?.title ?? 'No archive here'}
        blurb={words?.blurb ?? 'Only the daily games keep one: a new one every day, and every one before it.'}
      />
      {words ? (
        <Suspense fallback={<ul className="arch-grid" aria-busy="true" />}>{slug === 'acechase' ? <HoleArchive /> : <TrackArchive />}</Suspense>
      ) : null}
    </PageShell>
  )
}
