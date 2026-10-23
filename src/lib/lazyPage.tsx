import { lazy, useState, type ComponentType } from 'react'
import { isMissingFile, loadOrUpdate, noteNewRelease } from './appUpdate'

export type LazyPage<P extends object> = ComponentType<P> & {
  /** Fetch the chunk now, so a later mount needs no fallback. Safe to call any number of times. */
  preload: () => Promise<void>
}

/**
 * A component that ships as its own chunk, with a way to fetch it early.
 *
 * Until it has arrived it renders through React.lazy, which suspends to the
 * nearest fallback while the chunk downloads. Once preload() has finished it
 * renders the real component directly, so a page fetched ahead of the tap
 * (a hub page warming its game, a Play link pointed at) mounts without even
 * a frame of fallback. Which of the two a mount uses is fixed when it
 * mounts: a preload landing while a game is in play must not swap the
 * element type under it and start the game over.
 *
 * A chunk gone in a release since this tab opened keeps the fallback up while the page reloads onto the new
 * release (lib/appUpdate.ts).
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>): LazyPage<P> {
  let ready: ComponentType<P> | null = null
  let pending: Promise<void> | null = null
  const Lazy = lazy(async () => ({ default: await loadOrUpdate(load) }))

  const preload = () => {
    if (ready) return Promise.resolve()
    if (!pending) {
      pending = load().then(
        (component) => {
          ready = component
        },
        (error: unknown) => {
          // Offline, or a chunk renamed by a release: the mount will try again through Lazy. A renamed one means
          // the next link tapped opens on the new release.
          if (isMissingFile(error) && navigator.onLine !== false) noteNewRelease()
          pending = null
        },
      )
    }
    return pending
  }

  function Page(props: P) {
    const [Component] = useState<ComponentType<P>>(() => ready ?? Lazy)
    return <Component {...props} />
  }
  Page.preload = preload
  return Page
}

/**
 * React.lazy for a part of a page (a celebration, the next-daily card): when its chunk is gone in a release since
 * this tab opened, the part stays on its Suspense fallback rather than breaking the page around it, and the next
 * link tapped opens on the new release (lib/appUpdate.ts).
 */
// `any`: React.lazy's own bound, so a part's props type comes through as it is.
export function lazyPart<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((error: unknown) => {
      if (!import.meta.env.PROD || !isMissingFile(error) || navigator.onLine === false) throw error
      noteNewRelease()
      return new Promise<{ default: T }>(() => {})
    }),
  )
}
