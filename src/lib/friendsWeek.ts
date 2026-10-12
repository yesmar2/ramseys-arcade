import { api } from './leaderboard'

/*
 * Last week among you and your friends, as the API's GET /friends/week has it (its friendsWeek.ts): the
 * standings of the week that closed, cut to your tags and your friends'. First of three or more is the
 * whole screen, once (components/FriendsWeekMoment.tsx).
 */

export type FriendsWeek = {
  /** The week that closed: its Monday, YYYY-MM-DD. */
  week: string
  /** How many of you and your friends had points in it. */
  field: number
  /** Your best tag's line; null with no points that week. */
  you: { name: string; rank: number; points: number } | null
  /** The top three. */
  podium: { name: string; rank: number; points: number; avatarId: string }[]
  /** Your games that week among your friends, best place first. */
  games: { game: string; place: number; field: number }[]
}

/** You and at least two friends with points: one friend beaten is a head-to-head, not a week won. */
export const FRIENDS_WEEK_FIELD = 3

export function wonFriendsWeek(week: FriendsWeek): boolean {
  return week.you?.rank === 1 && week.field >= FRIENDS_WEEK_FIELD
}

export function fetchFriendsWeek(): Promise<FriendsWeek> {
  return api<FriendsWeek>('/friends/week')
}
