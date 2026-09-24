import { games, getGame, type Game } from '../data/games'
import { howToPlayFor, howToPlaySentences } from '../data/howToPlay'
import {
  aboutHref,
  gameHref,
  gamePlayHref,
  homeHref,
  plusHref,
  privacyHref,
  rankHref,
  recordsIndexHref,
  siteRecordsHref,
  statsHref,
  termsHref,
  tournamentCreateHref,
  tournamentHref,
  tournamentPlayHref,
  tournamentsHref,
  type Route,
} from '../hooks/useHashRoute'
import { APP_NAME } from './brand'
import { groupHref, groupsIndexHref } from './groups'
import { LEADERBOARD_GAMES, type LeaderboardGame } from './leaderboard'
import { gameHasRecords } from './records'

/**
 * What each page tells the outside world: the tab title, the description
 * search engines quote, the share image, and the one URL the page should be
 * known by. `index.html` carries the home page's version of the same tags so
 * a crawler that does not run scripts still gets something sensible.
 */
export type PageMeta = {
  title: string
  description: string
  /** Path (no origin) the page should be known by. */
  path: string
  /** Path (no origin) of the share image. */
  image: string
  /** A page that is somebody's own, or needs an invite, stays out of search. */
  noindex?: boolean
}

export const SITE_TAGLINE = 'Simple games, no ads, just play'

export const SITE_DESCRIPTION =
  'Free browser games with no ads and nothing to install. Snake, Asteroids, Crosswalk and more, with daily, weekly and all-time leaderboards, record books, and events to play with friends.'

export const DEFAULT_IMAGE = '/og.png'

/** The origin pages are published at; the build bakes it in, dev uses wherever it runs. */
export function siteOrigin(): string {
  const local = typeof window !== 'undefined' ? window.location.origin : ''
  if (import.meta.env.DEV) return local
  const baked = (import.meta.env.VITE_SITE_ORIGIN as string | undefined)?.trim().replace(/\/$/, '')
  return baked || local
}

function titled(name: string) {
  return `${name} · ${APP_NAME}`
}

/** Under about 160 characters, ending at a sentence where there is one. */
export function clipDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const sentenceEnd = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  )
  if (sentenceEnd > max / 2) return cut.slice(0, sentenceEnd + 1)
  const wordEnd = cut.lastIndexOf(' ')
  return `${cut.slice(0, wordEnd > 0 ? wordEnd : max).replace(/[,;:—-]+$/, '')}…`
}

/** The game's goal, unless its description already says it (Putt's opens with it). */
function goalBeyond(game: Game): string | null {
  const goal = howToPlayFor(game.slug)?.goal
  if (!goal) return null
  const bare = goal.replace(/[.!]+$/, '').toLowerCase()
  return game.description.toLowerCase().includes(bare) ? null : goal
}

export function gameDescription(game: Game): string {
  return clipDescription(`${game.description} ${goalBeyond(game) ?? ''}`)
}

/** Share image for a game; the site's own for anything that has none. */
export function gameImagePath(slug: string): string {
  const game = getGame(slug)
  if (!game || game.hidden) return DEFAULT_IMAGE
  return `/og/${game.slug}.png`
}

function gameMeta(slug: string, path: string, verb?: string): PageMeta {
  const game = getGame(slug)
  if (!game || game.hidden) {
    return { title: titled('Game'), description: SITE_DESCRIPTION, path, image: DEFAULT_IMAGE }
  }
  return {
    title: titled(verb ? `${verb} ${game.name}` : game.name),
    description: gameDescription(game),
    path,
    image: gameImagePath(slug),
  }
}

function gameName(slug: string) {
  return getGame(slug)?.name ?? 'Game'
}

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

/** Boards and record books carry a period in the app; the page is known without one. */
function gameBoardPath(slug: string) {
  return `/leaderboards/${encodeURIComponent(slug)}`
}

function gameRecordsPath(slug: string) {
  return `/records/${encodeURIComponent(slug)}`
}

function visibleGames() {
  return games.filter((game) => !game.hidden)
}

/**
 * Every page worth a crawler's time: what the build prerenders and what the
 * sitemap lists. Anything that is somebody's own, or needs an invite, is not
 * here.
 */
export function publicRoutes(): Route[] {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'about' },
    { name: 'plus' },
    { name: 'tournaments' },
    { name: 'leaderboards' },
    { name: 'leaderboards', global: true },
    { name: 'recordsIndex' },
    { name: 'siteRecords' },
    { name: 'privacy' },
    { name: 'terms' },
  ]
  for (const game of visibleGames()) {
    routes.push({ name: 'game', slug: game.slug })
    if (game.playable) routes.push({ name: 'gamePlay', slug: game.slug })
    if (isBoardGame(game.slug)) routes.push({ name: 'gameLeaderboard', game: game.slug })
    if (gameHasRecords(game.slug)) routes.push({ name: 'records', game: game.slug })
  }
  return routes
}

export type PageLink = { href: string; label: string }

/** What a page says when nothing runs: a heading, some prose, and where to go next. */
export type PageContent = {
  heading: string
  paragraphs: string[]
  links: PageLink[]
}

function gameLinks(): PageLink[] {
  return visibleGames().map((game) => ({ href: gameHref(game.slug), label: game.name }))
}

function siteLinks(): PageLink[] {
  return [
    { href: '/leaderboards', label: 'Leaderboards' },
    { href: recordsIndexHref(), label: 'Record books' },
    { href: tournamentsHref(), label: 'Events' },
    { href: aboutHref(), label: `About ${APP_NAME}` },
  ]
}

function gameContentLinks(game: Game): PageLink[] {
  const links: PageLink[] = [{ href: gamePlayHref(game.slug), label: `Play ${game.name}` }]
  if (isBoardGame(game.slug)) {
    links.push({ href: gameBoardPath(game.slug), label: `${game.name} leaderboard` })
  }
  if (gameHasRecords(game.slug)) {
    links.push({ href: gameRecordsPath(game.slug), label: `${game.name} record books` })
  }
  links.push({ href: homeHref(), label: 'All games' })
  return links
}

/** The static content the build writes into a public page's shell. */
export function pageContent(route: Route): PageContent {
  const meta = pageMeta(route)
  const heading = meta.title.replace(` · ${APP_NAME}`, '')
  switch (route.name) {
    case 'home':
      return {
        heading: `${APP_NAME}: ${SITE_TAGLINE}`,
        paragraphs: [SITE_DESCRIPTION],
        links: [...gameLinks(), ...siteLinks()],
      }
    case 'game':
    case 'gamePlay': {
      const game = getGame(route.slug)
      if (!game || game.hidden) break
      const [goal, ...rules] = howToPlaySentences(game.slug)
      const paragraphs = [game.description, ...(goal && goalBeyond(game) ? [goal] : []), ...rules]
      return { heading, paragraphs, links: gameContentLinks(game) }
    }
    case 'gameLeaderboard':
    case 'records': {
      const game = getGame(route.game)
      if (!game || game.hidden) break
      return { heading, paragraphs: [meta.description], links: gameContentLinks(game) }
    }
    case 'leaderboards':
    case 'recordsIndex':
    case 'siteRecords':
    case 'tournaments':
      return { heading, paragraphs: [meta.description], links: [...gameLinks(), ...siteLinks()] }
    default:
      break
  }
  return { heading, paragraphs: [meta.description], links: siteLinks() }
}

export function pageMeta(route: Route): PageMeta {
  const site = { description: SITE_DESCRIPTION, image: DEFAULT_IMAGE }
  switch (route.name) {
    case 'home':
      return { ...site, title: `${APP_NAME} · ${SITE_TAGLINE}`, path: homeHref() }
    case 'about':
      return {
        ...site,
        title: titled(`About ${APP_NAME}`),
        description: `${APP_NAME} is a small browser arcade built for quick sessions and high scores. Original games inspired by the classics, no ads, no install, and leaderboards that reset daily.`,
        path: aboutHref(),
      }
    case 'plus':
      return {
        ...site,
        title: titled('Plus'),
        description:
          'Playing is free, always. Plus is for whoever runs the events: bigger draws, more events at once, double elimination, and a different game each round. $3 a month.',
        path: plusHref(),
      }
    case 'stats':
      return { ...site, title: titled('Your stats'), path: statsHref(), noindex: true }
    case 'privacy':
      return {
        ...site,
        title: titled('Privacy Policy'),
        description: `How ${APP_NAME} handles your data.`,
        path: privacyHref(),
      }
    case 'terms':
      return {
        ...site,
        title: titled('Terms of Service'),
        description: `The terms for playing on ${APP_NAME}.`,
        path: termsHref(),
      }
    // Boards carry the period in the URL; the page is known by the URL without one.
    case 'leaderboards':
      if (route.global) {
        return {
          ...site,
          title: titled('Global rankings'),
          description: `Every player on ${APP_NAME}, ranked across all games. Daily, weekly, monthly and all-time.`,
          path: '/leaderboards/global',
        }
      }
      return {
        ...site,
        title: titled('Leaderboards'),
        description: `Top scores for every ${APP_NAME} game. Daily, weekly, monthly and all-time boards, plus global rankings.`,
        path: '/leaderboards',
      }
    case 'gameLeaderboard': {
      const meta = gameMeta(route.game, gameBoardPath(route.game))
      return {
        ...meta,
        title: titled(`${gameName(route.game)} leaderboard`),
        description: `Top ${gameName(route.game)} scores on ${APP_NAME}. Daily, weekly, monthly and all-time.`,
      }
    }
    case 'recordsIndex':
      return {
        ...site,
        title: titled('Record books'),
        description: `The record books: the best single runs, streaks and times ever set on ${APP_NAME}.`,
        path: recordsIndexHref(),
      }
    case 'siteRecords':
      return {
        ...site,
        title: titled('House records'),
        description: `The records that belong to the whole arcade rather than one game: longest streaks, busiest days and the widest players on ${APP_NAME}.`,
        path: siteRecordsHref(),
      }
    case 'records': {
      const meta = gameMeta(route.game, gameRecordsPath(route.game))
      return {
        ...meta,
        title: titled(`${gameName(route.game)} records`),
        description: `${gameName(route.game)} record books on ${APP_NAME}: the best runs ever set, and who set them.`,
      }
    }
    case 'rank':
      return {
        ...site,
        title: titled(route.player ?? 'Profile'),
        path: rankHref(route.player, 'all'),
        noindex: true,
      }
    case 'groups':
      return { ...site, title: titled('Groups'), path: groupsIndexHref(), noindex: true }
    case 'group':
      return { ...site, title: titled('Group'), path: groupHref(route.id), noindex: true }
    case 'tournaments':
      return {
        ...site,
        title: titled('Events'),
        description: `Official events and private invite-only tournaments on ${APP_NAME}. Brackets, leagues and score races, any size, free to join.`,
        path: tournamentsHref(),
      }
    case 'tournamentCreate':
      return { ...site, title: titled('Create event'), path: tournamentCreateHref(), noindex: true }
    case 'tournament':
      return { ...site, title: titled('Event'), path: tournamentHref(route.id), noindex: true }
    case 'tournamentPlay':
      return {
        ...gameMeta(route.game, tournamentPlayHref(route.id, route.game), 'Play'),
        noindex: true,
      }
    case 'game':
      return gameMeta(route.slug, gameHref(route.slug))
    case 'gamePlay':
      return gameMeta(route.slug, gamePlayHref(route.slug), 'Play')
    case 'authVerify':
      return { ...site, title: titled('Signing in'), path: homeHref(), noindex: true }
    case 'devCelebrate':
      return { ...site, title: titled('Celebrate (dev)'), path: homeHref(), noindex: true }
  }
}
