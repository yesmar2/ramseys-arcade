import { Suspense } from 'react'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { getGame, isDailyGame } from '../data/games'
import { gameHref, homeHref } from '../hooks/useHashRoute'
import { lazyPage } from '../lib/lazyPage'
import '../styles/archive.css'

/*
 * A daily game's archive, /games/<slug>/archive: every day since its first, newest first, each one
 * playable again as practice, except Hot Lap's tracks, which keep boards of their own for good (lib/
 * trackBoards.ts). Each game's list comes in a chunk of its own, with its plan.
 */

const HoleArchive = lazyPage(() => import('../components/archive/HoleArchive').then((m) => m.HoleArchive))
const TrackArchive = lazyPage(() => import('../components/archive/TrackArchive').then((m) => m.TrackArchive))
const BugArchive = lazyPage(() => import('../components/archive/BugArchive').then((m) => m.BugArchive))

/** What each daily game's archive is called, and says about itself. */
const ARCHIVES: Record<string, { title: string; blurb: string }> = {
  acechase: {
    title: 'Past holes',
    blurb: 'Every day’s hole since the first, and how it went. Play any of them again: here they’re practice, so they don’t count for boards, tickets or records.',
  },
  hotlap: {
    title: 'Past tracks',
    blurb: 'Every day’s track since the first, and its record. Each track keeps its board for good: drive any of them again and your best lap goes on it. Points and tickets are for today’s track.',
  },
  findbug: {
    title: 'Past days',
    blurb: 'Every day’s Today’s Wanted since the first, and who was quickest. Play any of them again: here they’re practice, so they don’t count for boards, tickets or records.',
  },
}

/** Each daily game's list of its days. */
const LISTS: Record<string, typeof HoleArchive> = { acechase: HoleArchive, hotlap: TrackArchive, findbug: BugArchive }

export function ArchivePage({ slug }: { slug: string }) {
  const game = getGame(slug)
  const words = game && isDailyGame(slug) ? ARCHIVES[slug] : undefined
  const List = LISTS[slug]
  return (
    <PageShell innerClassName="lb-page__inner">
      <PageBanner
        size="compact"
        crumbs={[{ href: homeHref(), label: 'Home' }, ...(game ? [{ href: gameHref(slug), label: game.name }] : []), { label: 'Archive' }]}
        kicker={game ? `${game.name} archive` : 'Archive'}
        title={words?.title ?? 'No archive here'}
        blurb={words?.blurb ?? 'Only the daily games keep one: a new one every day, and every one before it.'}
      />
      {words && List ? (
        <Suspense fallback={<ul className="arch-grid" aria-busy="true" />}>
          <List />
        </Suspense>
      ) : null}
    </PageShell>
  )
}
