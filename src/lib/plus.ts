import { api } from './leaderboard'

/*
 * Plus, the membership (the API's plus.ts): every season's Pass+ while you're a member, and more events and
 * groups to host. Monthly, through Stripe's checkout; Stripe's own portal is where a member changes the card
 * or cancels.
 */

export type PlusYou = { plan: 'free' | 'plus'; status: string | null; renewsAt: number | null; cancelsAtEnd: boolean; source: string | null }

export type PlusInfo = { price: number; currency: string; interval: 'month'; buyable: boolean; you: PlusYou | null }

export function fetchPlus(): Promise<PlusInfo> {
  return api<PlusInfo>('/plus')
}

/** Stripe's checkout for a monthly membership: its page's address, to go to. */
export async function startPlusMembership(): Promise<string> {
  return (await api<{ url: string }>('/plus/checkout', { method: 'POST', body: '{}' })).url
}

/** Back from Stripe: the checkout's subscription, if it's going, makes you a member now. */
export async function confirmPlusMembership(session: string): Promise<{ member: boolean; you: PlusYou }> {
  return api<{ member: boolean; you: PlusYou }>('/plus/confirm', { method: 'POST', body: JSON.stringify({ session }) })
}

/** Stripe's portal for your membership (the card, receipts, cancelling): its page's address. */
export async function managePlusMembership(): Promise<string> {
  return (await api<{ url: string }>('/plus/manage', { method: 'POST', body: '{}' })).url
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
