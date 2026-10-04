import { useEffect, useSyncExternalStore } from 'react'
import { AUTH_EVENT } from './accountEvents'
import { api, normalizePlayerName } from './leaderboard'

/*
 * Plus, the membership (the API's plus.ts): the Dailies + Seasons membership since Ramsey's pick on
 * 2026-10-04. Every past day of every daily (lib/archive.ts), every season's Pass+, a members' look each
 * month, new games a week before launch (lib/earlyAccess.ts), and more events and groups to host. By the
 * month or the year, through Stripe's checkout, starting with a free week the first time; Stripe's own
 * portal is where a member changes the card or cancels.
 *
 * It's offered where a player already wants what it gives, never in the way of a game: a locked past day,
 * the Pass+ rewards a level just passed (components/season/PassPlusMissed.tsx), the menu, and the mark
 * beside members' names (components/PlusMark.tsx).
 */

export type PlusYou = {
  plan: 'free' | 'plus'
  /** Stripe's word for the membership: 'trialing' on the free week. */
  status: string | null
  renewsAt: number | null
  cancelsAtEnd: boolean
  source: string | null
  /** Whether joining starts with the free week: never paid for Plus or tried it. Missing from an older API. */
  trialEligible?: boolean
}

/** A month's members' look: every member has it, kept for good. */
export type MembersLook = { id: string; name: string; what: string }

export type PlusInterval = 'month' | 'year'

export type PlusInfo = {
  price: number
  currency: string
  interval: 'month'
  /** Both ways to pay, in cents; missing from an older API, which has the month's alone. */
  prices?: { month: number; year: number }
  /** The free week a first membership starts with, in days. */
  trialDays?: number
  buyable: boolean
  /** This month's members' looks; none from an API before them. */
  looks?: MembersLook[]
  you: PlusYou | null
}

/** Plus's prices kept a minute, for the menu, the Season page and the Plus page alike. */
let infoHeld: { at: number; signedIn: boolean; info: PlusInfo } | null = null
const INFO_HOLD_MS = 60_000

export function fetchPlus(): Promise<PlusInfo> {
  return api<PlusInfo>('/plus').then((info) => {
    infoHeld = { at: Date.now(), signedIn: info.you != null, info }
    return info
  })
}

/** Plus as last asked, if it's fresh and for the same sign-in: what a menu row can show without asking. */
export function heldPlus(signedIn: boolean): PlusInfo | null {
  return infoHeld && infoHeld.signedIn === signedIn && Date.now() - infoHeld.at < INFO_HOLD_MS ? infoHeld.info : null
}

/** Whether joining now starts with the free week: signed out, or an account that has never had Plus. */
export function freeWeekFor(info: PlusInfo | null): boolean {
  if (!info?.trialDays) return false
  return info.you ? info.you.trialEligible === true && info.you.plan !== 'plus' : true
}

/** Stripe's checkout for a membership by the month or the year: its page's address, to go to. */
export async function startPlusMembership(interval: PlusInterval = 'month'): Promise<string> {
  return (await api<{ url: string }>('/plus/checkout', { method: 'POST', body: JSON.stringify({ interval }) })).url
}

/** Back from Stripe: the checkout's subscription, if it's going, makes you a member now. */
export async function confirmPlusMembership(session: string): Promise<{ member: boolean; you: PlusYou }> {
  return api<{ member: boolean; you: PlusYou }>('/plus/confirm', { method: 'POST', body: JSON.stringify({ session }) })
}

/** Stripe's portal for your membership (the card, receipts, cancelling): its page's address. */
export async function managePlusMembership(): Promise<string> {
  return (await api<{ url: string }>('/plus/manage', { method: 'POST', body: '{}' })).url
}

/**
 * The last day a membership gives Founding Member (the API's MEMBERS_LOOKS: October to December 2026). Looks
 * come with the first payment, so a free week has to start a week before it.
 */
export const FOUNDER_UNTIL = '2026-12-31'

/* The members' tags (GET /plus/members), for the mark beside their names: asked once, kept a few minutes. */
const NONE: ReadonlySet<string> = new Set()
let members: { at: number; names: ReadonlySet<string> } | null = null
let asking = false
const MEMBERS_HOLD_MS = 5 * 60_000
const told = new Set<() => void>()

function askMembers() {
  if (asking || (members && Date.now() - members.at < MEMBERS_HOLD_MS)) return
  asking = true
  api<{ names: string[] }>('/plus/members')
    .then((reply) => {
      members = { at: Date.now(), names: new Set(reply.names.map(normalizePlayerName)) }
    })
    .catch(() => {
      // None shown for a while, rather than asking on every name.
      members = { at: Date.now(), names: members?.names ?? NONE }
    })
    .finally(() => {
      asking = false
      for (const tell of told) tell()
    })
}

let listening = false

function subscribeMembers(tell: () => void) {
  told.add(tell)
  // Joining or leaving moves your own mark: a sign-in change asks again, keeping the marks shown meanwhile.
  if (!listening) {
    listening = true
    window.addEventListener(AUTH_EVENT, () => {
      if (members) members = { ...members, at: 0 }
      askMembers()
    })
  }
  return () => {
    told.delete(tell)
  }
}

/** Whether a tag is a Plus member's, as last asked: false until the list has come. */
export function usePlusMember(name: string): boolean {
  const names = useSyncExternalStore(subscribeMembers, () => members?.names ?? NONE)
  useEffect(() => askMembers(), [])
  return names.has(normalizePlayerName(name))
}

const DAY_MS = 86_400_000

/** A season's own days, first to last (not a preview's early start): 66 for Oct 31 to Jan 4. */
function seasonDays(season: { firstDay: string; lastDay: string }): number {
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return Math.round((day(season.lastDay) - day(season.firstDay)) / DAY_MS) + 1
}

/** How many weeks a season runs: about 9. */
export function seasonWeeks(season: { firstDay: string; lastDay: string }): number {
  return Math.round(seasonDays(season) / 7)
}

/**
 * What a monthly price comes to over a season, to the dollar: "$6". A season is about two months, so Plus
 * by the month costs more over one than Pass+ for it does; said plainly, the same $2.99 beside each can't
 * read as the two costing the same.
 */
export function perSeason(cents: number, season: { firstDay: string; lastDay: string }, currency = 'usd'): string {
  const months = seasonDays(season) / 30.44
  return money(Math.round((cents * months) / 100) * 100, currency).replace(/\.00$/, '')
}

/** A price as money: $2.99. */
export function money(cents: number, currency = 'usd'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}
