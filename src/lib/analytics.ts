import { inject } from '@vercel/analytics'

/*
 * Counting visits, with Vercel Web Analytics: no cookies, and nothing that
 * says who anyone is. It counts a page view each time the router moves.
 * Addresses go without their query and hash, which can carry invite codes.
 *
 * Production builds only, and it counts nothing until Web Analytics is
 * switched on in the Vercel project (its Analytics tab).
 */
export function bootAnalytics() {
  if (!import.meta.env.PROD) return
  inject({
    mode: 'production',
    beforeSend: (event) => {
      try {
        const url = new URL(event.url)
        url.search = ''
        url.hash = ''
        return { ...event, url: url.toString() }
      } catch {
        return event
      }
    },
  })
}
