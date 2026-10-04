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

/** A price as money: $3.99. */
export function money(cents: number, currency = 'usd'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}
