import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  fetchClientErrors,
  fetchFeedback,
  fetchLaunchList,
  fetchOpenFlags,
  fetchSiteEvents,
  type AdminClientError,
  type AdminFeedback,
  type AdminFlag,
} from '../lib/admin'

/*
 * What the admin page's sidebar counts and its overview's Needs you read (AdminPage.tsx, AdminOverview.tsx):
 * the feedback, site errors and flagged scores waiting, whether the site's own events run, and how long the
 * launch list is. Asked once the API has said you're an admin, again as you move between sections, and again
 * when a card removes or settles something (refresh), so a count never says what's already dealt with.
 */

export type AdminInbox = {
  feedback: AdminFeedback[] | null
  errors: AdminClientError[] | null
  flags: AdminFlag[] | null
  siteEvents: boolean | null
  launchList: number | null
}

const EMPTY: AdminInbox = { feedback: null, errors: null, flags: null, siteEvents: null, launchList: null }

export const AdminInboxContext = createContext<{ inbox: AdminInbox; refresh: () => void }>({ inbox: EMPTY, refresh: () => {} })

export function useAdminInbox() {
  return useContext(AdminInboxContext)
}

function value<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

/** The page's own copy: `ready` once the API has said you're an admin, `section` the one that's open. */
export function useAdminInboxLoader(ready: boolean, section: string | undefined) {
  const [inbox, setInbox] = useState<AdminInbox>(EMPTY)
  const asked = useRef(0)

  const refresh = useCallback(() => {
    if (!ready) return
    const ask = ++asked.current
    void Promise.allSettled([fetchFeedback(), fetchClientErrors(), fetchOpenFlags(), fetchSiteEvents()]).then(([feedback, errors, flags, events]) => {
      if (ask !== asked.current) return
      // What failed to come keeps what it said last.
      setInbox((was) => ({
        ...was,
        feedback: value(feedback) ?? was.feedback,
        errors: value(errors) ?? was.errors,
        flags: value(flags) ?? was.flags,
        siteEvents: value(events) ?? was.siteEvents,
      }))
    })
  }, [ready])

  useEffect(() => {
    refresh()
  }, [refresh, section])

  // The launch list's length, once a visit: the list itself can run long.
  useEffect(() => {
    if (!ready) return
    fetchLaunchList().then(
      (list) => setInbox((was) => ({ ...was, launchList: list.emails.length })),
      () => {},
    )
  }, [ready])

  return { inbox, refresh }
}
