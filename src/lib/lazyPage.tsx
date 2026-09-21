import { lazy, useState, type ComponentType } from 'react'

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
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>): LazyPage<P> {
  let ready: ComponentType<P> | null = null
  let pending: Promise<void> | null = null
  const Lazy = lazy(async () => ({ default: await load() }))

  const preload = () => {
    if (ready) return Promise.resolve()
    if (!pending) {
      pending = load().then(
        (component) => {
          ready = component
        },
        () => {
          // Offline, or a chunk renamed by a release: the mount will try again through Lazy.
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
