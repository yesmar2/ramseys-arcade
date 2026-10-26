import { games, getGame, isDailyGame, isGameListed, isListedGame, isRankedGame, TAG_LABELS, type Game } from '../data/games'
import { howToPlayFor, howToPlaySentences } from '../data/howToPlay'
import {
  aboutHref,
  adminHref,
  blipQuestionsHref,
  dailyTabHref,
  dayBoardHref,
  gameHref,
  gamePlayHref,
  homeHref,
  plusHref,
  privacyHref,
  rankHowHref,
  rankHref,
  recordsIndexHref,
  siteRecordsHref,
  statsHref,
  notificationSettingsHref,
  prizesHref,
  seasonHref,
  termsHref,
  ticketsHref,
  todayHref,
  tournamentCreateHref,
  tournamentHref,
  tournamentPlayHref,
  tournamentsHref,
  type AdminSection,
  type Route,
} from '../hooks/useHashRoute'
import { archiveDayWords } from './archive'
import { challengeHref } from './challenges'
import { seasonOn } from './seasonCalendar'
import { APP_NAME, SITE_LINE } from './brand'
import { BOARD_NAMES, dailyWords } from './dailyWords'
import { FRIENDS_SCOPE, groupHref, groupsIndexHref } from './groups'
import { LEADERBOARD_GAMES, type LeaderboardGame } from './leaderboard'
import { numberWord } from './numberWord'
import { gameHasRecords } from './records'
import { aboutQuestions } from './aboutQuestions'

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
  /**
   * The page search should know this one by, when this one says the same thing: a game's play page repeats its
   * game page's words, so its canonical link is the game page's and it isn't in the sitemap (2026-10-23).
   */
  canonicalPath?: string
  /** Searchable but thin (a game's records, its past courses): left out of the sitemap so the full pages lead. */
  sitemap?: false
}

export const SITE_TAGLINE = 'Simple games, no ads, just play'

export const SITE_DESCRIPTION = `${SITE_LINE} Quick, free original games that start in a tap, on a phone or at a desk, with leaderboards, record books and events to play with friends.`

export const DEFAULT_IMAGE = '/og.png'

/** The Dailies page's card: the day's races as lanes (scripts/gen-og-images.mjs dailiesCard). */
export const DAILIES_IMAGE = '/og/dailies.png'

/** The origin pages are published at; the build bakes it in, dev uses wherever it runs. */
export function siteOrigin(): string {
  const local = typeof window !== 'undefined' ? window.location.origin : ''
  if (import.meta.env.DEV) return local
  const baked = (import.meta.env.VITE_SITE_ORIGIN as string | undefined)?.trim().replace(/\/$/, '')
  return baked || local
}

/** A tab's title: the page's name, then the site's. */
export function titled(name: string) {
  return `${name} · ${APP_NAME}`
}

/** The admin's tabs past the overview, by the names their pages give them (AdminPage). */
const ADMIN_TITLES: Record<AdminSection, string> = {
  feedback: 'Feedback',
  errors: 'Site errors',
  flags: 'Flagged scores',
  players: 'Who’s playing',
  tickets: 'Tickets',
  bans: 'Bans',
  runs: 'Run check',
  events: 'Site events',
  season: 'Season and Gold Pass',
  blip: 'Blip’s questions',
  alerts: 'Error alerts',
  launch: 'Launch list',
  reset: 'Reset test data',
  dailies: 'Today’s dailies',
  hunt: 'Bug hunt',
  holes: 'Hole Book',
  tracks: 'Track Book',
  courses: 'Course Book',
  caves: 'Cave Book',
  hills: 'Hills Book',
  gauntlets: 'Gauntlet Book',
  towers: 'Tower Book',
  pours: 'Pour Book',
  trophies: 'Trophies',
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

/**
 * What kind of game each one is, in the words people search for: the second half of its page's title ("Space
 * Rocks · Free asteroid shooter"), the start of its description, the line its page opens on for readers that run
 * no scripts (search engines and AI tools mostly read that), its structured data and llms.txt. Plain genre words,
 * never another game's name: a description like "Spin, thrust, clear the rocks" doesn't say what the game is.
 */
const GAME_KINDS: Readonly<Record<string, string>> = {
  asteroids: 'asteroid shooter',
  patriot: 'missile defense game',
  snake: 'classic snake game',
  crosswalk: 'endless road-crossing game',
  stacker: 'block-stacking game',
  pop: 'bubble-popping game',
  pellets: 'maze chase game',
  barrage: 'bullet-hell shooter',
  crumbtrail: 'endless maze climber',
  bop: 'fast reaction game',
  frenzy: 'fish-eat-fish game',
  fireflies: 'light-and-sound memory game',
  pileup: 'falling-block puzzle',
  putt: 'mini golf game',
  centroid: 'daily balance puzzle',
  findbug: 'daily hidden-object puzzle',
  halffull: 'daily pouring puzzle',
  acechase: 'daily trick-shot golf game',
  hotlap: 'daily racing game',
  marblerun: 'daily marble racing game',
  lander: 'daily spaceship landing game',
  swoop: 'daily hill-gliding game',
  wobblerun: 'daily obstacle race',
  sling: 'daily tower-climbing game',
}

/** What kind of game it is, in searchable words ("asteroid shooter"), when it has a kind written. */
export function gameKind(slug: string): string | null {
  return GAME_KINDS[slug] ?? null
}

export function gameDescription(game: Game): string {
  const kind = gameKind(game.slug)
  return clipDescription(`${kind ? `A free ${kind} in your browser, with no ads. ` : ''}${game.description} ${goalBeyond(game) ?? ''}`)
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
  // A game's own page says what kind of game it is, as people search for it: "Space Rocks · Free asteroid shooter".
  const kind = verb ? null : gameKind(slug)
  return {
    title: titled(verb ? `${verb} ${game.name}` : kind ? `${game.name} · Free ${kind}` : game.name),
    description: gameDescription(game),
    path,
    image: gameImagePath(slug),
  }
}

/**
 * The games whose play page is the day's own, by its name: Ace Chase is Today's Hole, Find the Bug Today's
 * Wanted, Half Full Today's Pour.
 */
const PLAY_OF_THE_DAY: Readonly<Record<string, { title: string; description: string }>> = {
  acechase: {
    title: 'Today’s Hole',
    description:
      'A new Ace Chase hole every day, the same for everyone. Every try counts, and your first bullseye is your result. Share it without giving it away.',
  },
  findbug: {
    title: 'Today’s Wanted',
    description:
      'Five new Find the Bug scenes every day, the same for everyone, with a bug wanted in each. Your first run is your result: find them fast, then share how it went.',
  },
  halffull: {
    title: 'Today’s Pour',
    description:
      'Five new Half Full glasses every day, the same for everyone. Fill each exactly half full by what it holds: your first pour is your result. Share it without giving it away.',
  },
  centroid: {
    title: 'Today’s Plates',
    description:
      'Six new Centroid plates every day, the same for everyone. Tap where each one would balance: the closer to its true center, the higher your score. Your first go is your result.',
  },
}

function dailyMeta(slug: string): PageMeta | null {
  const day = PLAY_OF_THE_DAY[slug]
  if (!day) return null
  return {
    ...gameMeta(slug, gamePlayHref(slug), 'Play'),
    title: titled(`${day.title} · ${gameName(slug)}`),
    description: day.description,
  }
}

function gameName(slug: string) {
  return getGame(slug)?.name ?? 'Game'
}

/** Each race on the Dailies ticket in a few words, in the ticket's order (lib/today.ts TODAY_DAILIES). */
const RACE_WORDS: readonly [string, string][] = [
  ['swoop', 'a run over the hills'],
  ['lander', 'a cave to fly down'],
  ['hotlap', 'a lap'],
  ['sling', 'a tower to fling up'],
  ['marblerun', 'a marble course'],
  ['wobblerun', 'a gauntlet to the star'],
]

/**
 * The Dailies page's description, counting the races it has: the ranked dailies that are listed, which are the
 * ticket's races (a just-for-fun daily is under the ticket). "Four races … all four" became five with Wobble Run.
 */
function dailiesDescription(): string {
  const races = RACE_WORDS.filter(([slug]) => isDailyGame(slug) && isRankedGame(slug) && isGameListed(slug)).map(([, words]) => words)
  const count = numberWord(races.length)
  const list = races.length > 1 ? `${races.slice(0, -1).join(', ')} and ${races.at(-1)}` : (races[0] ?? '')
  return `Free daily racing games with no ads: ${count} races, new every day and the same for everyone. ${list.charAt(0).toUpperCase()}${list.slice(1)}. Play any two to keep your streak going, all ${count} for a Full ticket, and three daily puzzles just for fun.`
}

/**
 * A daily's other tabs: its past courses ("Hot Lap · Past tracks") and its records ("Hot Lap ·
 * Records"), in the words lib/dailyWords.ts gives each game.
 */
function dailyTabMeta(slug: string, tab: 'past' | 'records'): PageMeta {
  const name = gameName(slug)
  const { course, pastTab, verb, past } = dailyWords(slug)
  // A tab's words are a line or two: searchable, but not the page to lead with (PageMeta.sitemap).
  const meta: PageMeta = { ...gameMeta(slug, dailyTabHref(slug, tab)), sitemap: false }
  const board = past === 'board'
  if (tab === 'past') {
    return {
      ...meta,
      title: titled(`${name} · ${pastTab}`),
      description: !isRankedGame(slug)
        ? // A daily just for fun (data/games.ts Game.ranked): no boards, only your own results.
          `Every ${name} ${course} since the first, with your own result on each. ${verb} any of them again as practice.`
        : board
          ? `Every ${name} ${course} since the first, with its ${BOARD_NAMES.ranked} and ${BOARD_NAMES.allTime} boards and a way to ${verb.toLowerCase()} it again. Only today’s ${course} counts toward your rank.`
          : `Every ${name} ${course} since the first, and who was 1st on its ${BOARD_NAMES.ranked} board. ${verb} any of them again as practice: only today’s counts toward your rank.`,
    }
  }
  return {
    ...meta,
    title: titled(`${name} · Records`),
    description: board
      ? `${name}’s records over many days: the most days played in a row, the most days won and the most ${course} records held, and every ${course}’s record.`
      : `${name}’s records over many days: the most days played in a row and the most days won.`,
  }
}

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

/** Boards and record books carry a period in the app; the page is known without one. */
/** A game's board: its page, the Board tab (a daily's, its Today tab). */
function gameBoardPath(slug: string) {
  return gameHref(slug)
}

/** A game's records: its page's Records tab. */
function gameRecordsPath(slug: string) {
  return gameHref(slug, 'records')
}

function visibleGames() {
  return games.filter((game) => isListedGame(game))
}

/** The dailies the site lists, races first, as the Dailies page shows them. */
function dailyGames() {
  const dailies = visibleGames().filter((game) => game.daily && game.playable)
  return [...dailies.filter((game) => isRankedGame(game.slug)), ...dailies.filter((game) => !isRankedGame(game.slug))]
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
    { name: 'recordsIndex' },
    { name: 'siteRecords' },
    { name: 'prizes' },
    { name: 'today' },
    { name: 'privacy' },
    { name: 'terms' },
  ]
  for (const game of visibleGames()) {
    routes.push({ name: 'game', slug: game.slug })
    if (game.playable) routes.push({ name: 'gamePlay', slug: game.slug })
    // A daily's past courses and records are tabs of its page; its record book isn't a page of its own. A
    // daily just for fun has no records and no board (data/games.ts Game.ranked).
    const ranked = isRankedGame(game.slug)
    if (game.daily) {
      routes.push({ name: 'game', slug: game.slug, tab: 'past' })
      if (ranked) routes.push({ name: 'game', slug: game.slug, tab: 'records' })
    }
    // Another game's records are its page's Records tab; its board is the page itself (Ramsey picked B of the
    // "Game page: board and records" canvas, 2026-10-11: no board page and no record book of its own).
    if (gameHasRecords(game.slug) && !game.daily && isBoardGame(game.slug)) routes.push({ name: 'game', slug: game.slug, board: 'records' })
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

/** Every listed game, each named with what kind of game it is: "Space Rocks: asteroid shooter". */
function gameLinks(): PageLink[] {
  return visibleGames().map((game) => {
    const kind = gameKind(game.slug)
    return { href: gameHref(game.slug), label: kind ? `${game.name}: ${kind}` : game.name }
  })
}

/** "A free asteroid shooter you play in your browser…": what a game is, in a line a search engine or an AI tool can quote. */
function gameIsLine(game: Game): string | null {
  const kind = gameKind(game.slug)
  return kind
    ? `${game.name} is a free ${kind} you play in your browser, on a phone or a computer: no ads, and nothing to install.`
    : null
}

/** The arcade in numbers, for the home page and llms.txt: "Thirteen games to play any time, four daily races…". */
function arcadeLine(): string {
  const listed = visibleGames().filter((game) => game.playable)
  const anyTime = listed.filter((game) => !game.daily).length
  const races = listed.filter((game) => game.daily && isRankedGame(game.slug)).length
  const puzzles = listed.filter((game) => game.daily && !isRankedGame(game.slug)).length
  const count = numberWord(anyTime)
  return `${count.charAt(0).toUpperCase()}${count.slice(1)} original games to play any time, plus ${numberWord(races)} daily races and ${numberWord(puzzles)} daily puzzles, new every day and the same for everyone. All free to play, with nothing to install.`
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
  // A daily just for fun has no board and no records (data/games.ts Game.ranked).
  const ranked = isRankedGame(game.slug)
  if (game.daily) {
    links.push(
      { href: gameHref(game.slug), label: `${game.name} today` },
      { href: dailyTabHref(game.slug, 'past'), label: `${game.name} · ${dailyWords(game.slug).pastTab}` },
    )
    if (ranked) links.push({ href: dailyTabHref(game.slug, 'records'), label: `${game.name} records` })
  } else if (gameHasRecords(game.slug)) {
    links.push({ href: gameRecordsPath(game.slug), label: `${game.name} records` })
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
        paragraphs: [SITE_DESCRIPTION, arcadeLine()],
        links: [...gameLinks(), ...siteLinks()],
      }
    case 'game':
    case 'gamePlay': {
      const game = getGame(route.slug)
      if (!game || game.hidden) break
      // A daily's other tabs say what they hold, and lead to the rest of its pages.
      if (route.name === 'game' && ((route.tab && game.daily) || route.board === 'records')) {
        return { heading, paragraphs: [meta.description], links: gameContentLinks(game) }
      }
      const [goal, ...rules] = howToPlaySentences(game.slug)
      const isLine = gameIsLine(game)
      const paragraphs = [...(isLine ? [isLine] : []), game.description, ...(goal && goalBeyond(game) ? [goal] : []), ...rules]
      return { heading, paragraphs, links: gameContentLinks(game) }
    }
    case 'gameLeaderboard':
    case 'records': {
      const game = getGame(route.game)
      if (!game || game.hidden) break
      return { heading, paragraphs: [meta.description], links: gameContentLinks(game) }
    }
    // The day's dailies, each a way in: its own page, by what kind of game it is.
    case 'today':
      return {
        heading,
        paragraphs: [meta.description],
        links: [
          ...dailyGames().map((game) => ({ href: gameHref(game.slug), label: `${game.name}: ${gameKind(game.slug) ?? 'daily game'}` })),
          ...siteLinks(),
        ],
      }
    // What the site is, then its questions answered, as the page asks them (lib/aboutQuestions.ts).
    case 'about':
      return {
        heading,
        paragraphs: [meta.description, arcadeLine(), ...aboutQuestions().map(({ q, a }) => `${q} ${a}`)],
        links: [...gameLinks(), ...siteLinks()],
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
        // The site's name once: "About Blipka · Blipka" said it twice.
        title: `About ${APP_NAME}`,
        description: `${SITE_LINE} Original games inspired by the classics that start in a tap, nothing to install, and leaderboards for the week, the month, the season and all time.`,
        path: aboutHref(),
      }
    case 'plus':
      return {
        ...site,
        title: titled('Plus'),
        // The page's own pitch, at the API's prices (its plus.ts): true whether or not Plus is on sale yet, so no free week.
        description:
          'Playing stays free for everyone. Plus includes every season’s Gold Pass, every past daily, anyone’s ghost to race, a new look every month and new games a week early. $2.99 a month or $24.99 a year.',
        path: plusHref(),
      }
    case 'admin':
      return {
        ...site,
        title: titled(route.section ? ADMIN_TITLES[route.section] : 'Admin'),
        path: adminHref(route.section),
        noindex: true,
      }
    case 'stats':
      return { ...site, title: titled('Your stats'), path: statsHref(), noindex: true }
    case 'notificationSettings':
      return { ...site, title: titled('Notifications'), path: notificationSettingsHref(), noindex: true }
    case 'prizes':
      return {
        ...site,
        title: titled('Prize counter'),
        description:
          'Every run pays tickets. Trade them at the prize counter for looks that show on the boards: avatars, name styles, backgrounds, confetti, signs and skins. Earned by playing, never bought.',
        path: prizesHref(),
      }
    case 'tickets':
      return { ...site, title: titled('Your tickets'), path: ticketsHref(), noindex: true }
    case 'blipQuestions':
      return { ...site, title: titled('Blip’s questions'), path: blipQuestionsHref(), noindex: true }
    case 'season':
      return {
        ...site,
        // The season of the day (Space Race, then Cold Snap from Jan 5), as the prerender's build sees it.
        title: titled(`Season ${seasonOn().id}: ${seasonOn().name}`),
        description:
          'A free season pass of 30 levels. Every ticket you win in any game moves you up, with ships, avatars and titles to win on the way. Looks only, never score.',
        path: seasonHref(),
        // Not on the sitemap until the season starts with the launch.
        noindex: true,
      }
    case 'today':
      return {
        ...site,
        // A past day picked on the page is known by its day: "Dailies · Mon, Sep 28".
        // The page itself as people search for it (2026-10-23): nobody had "daily racing game" in a browser.
        title: titled(route.day ? `Dailies · ${archiveDayWords(route.day)}` : 'Dailies · Free daily racing games'),
        description: dailiesDescription(),
        path: todayHref(route.day),
        image: DAILIES_IMAGE,
        // A past day's ticket is the viewer's own: only the page itself is for search.
        ...(route.day ? { noindex: true } : {}),
      }
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
      if (route.period === 'season') {
        return {
          ...site,
          title: titled('Season standings'),
          description: `The season's standings on ${APP_NAME}: points from each player's ten best games over the season, and who's in line for its cup.`,
          path: '/leaderboards/season',
        }
      }
      return {
        ...site,
        title: titled('Leaderboards'),
        description: `Top scores for every ${APP_NAME} game, and the standings across all of them, for the week, the month, the season and all time.`,
        path: '/leaderboards',
      }
    case 'gameLeaderboard': {
      // A daily's board on a past day is known by its day: "Hot Lap · Mon, Sep 28 · Ranked board".
      if (route.day) {
        const when = archiveDayWords(route.day)
        return {
          ...gameMeta(route.game, dayBoardHref(route.game, route.day)),
          title: titled(`${gameName(route.game)} · ${when} · ${BOARD_NAMES.ranked} board`),
          description: `How ${gameName(route.game)} finished on ${when}: every player’s place on its ${BOARD_NAMES.ranked} board, in full.`,
        }
      }
      const meta = gameMeta(route.game, gameBoardPath(route.game))
      return {
        ...meta,
        title: titled(`${gameName(route.game)} leaderboard`),
        // A daily's boards are the day's, the week's and the month's (lib/allTime.ts); the others', the week's on.
        description: `Top ${gameName(route.game)} scores on ${APP_NAME}. ${isDailyGame(route.game) ? 'Daily, weekly and monthly' : 'Weekly, monthly and all-time'}.`,
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
        description: `The records that belong to the whole arcade rather than one game: the most days played in a row, the most games in a day and the most boards held on ${APP_NAME}.`,
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
    case 'rankHow':
      return {
        ...site,
        title: titled(route.player ? `How ${route.player}’s rank works` : 'How your rank works'),
        path: rankHowHref(route.player, 'all'),
        noindex: true,
      }
    case 'groups':
      return { ...site, title: titled('Friends & groups'), path: groupsIndexHref(), noindex: true }
    case 'group':
      return { ...site, title: titled(route.id === FRIENDS_SCOPE ? 'Friends' : 'Group'), path: groupHref(route.id), noindex: true }
    case 'tournaments':
      return {
        ...site,
        title: titled('Events'),
        // True whether or not the arcade's own events are running (siteEvents), and of every plan's size limit.
        description: `Invite-only events on ${APP_NAME} for you and your friends: a bracket, or a top-score race on up to five games. Free to join.`,
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
      if (route.tab && isDailyGame(route.slug)) return dailyTabMeta(route.slug, route.tab)
      // A game's Records tab, known by its records.
      if (route.board === 'records' && !isDailyGame(route.slug)) {
        return {
          ...gameMeta(route.slug, gameRecordsPath(route.slug)),
          sitemap: false,
          title: titled(`${gameName(route.slug)} records`),
          description: `${gameName(route.slug)} records on ${APP_NAME}: the best runs ever set, and who set them.`,
        }
      }
      return gameMeta(route.slug, gameHref(route.slug))
    case 'gamePlay':
      // A daily asked for another day's course (?day=, ?hole=, ?track=): a plain title, since the page may still
      // play today's course, or an admin's trial of one to come. A past course that really opens names itself
      // in the tab, "Hot Lap · Seneca Glen (past track)", through its PastPlay (lib/pastPlay.ts).
      if ((route.track || route.hole || route.day) && isDailyGame(route.slug)) {
        return { ...gameMeta(route.slug, gamePlayHref(route.slug), 'Play'), noindex: true }
      }
      // A day's own puzzle page ("Today's Pour") says something of its own; any other play page repeats its game
      // page, which search should know it by.
      return dailyMeta(route.slug) ?? { ...gameMeta(route.slug, gamePlayHref(route.slug), 'Play'), canonicalPath: gameHref(route.slug) }
    // A friend's challenge link, in the words of its prerendered page (scripts/prerender.mjs), hidden games too.
    // Somebody's link to somebody, never a search result.
    case 'challenge': {
      const game = getGame(route.slug)
      return {
        title: titled(game ? `Can you beat it? A challenge on ${game.name}` : 'A challenge'),
        description: game
          ? `A friend has a score for you to beat on ${game.name}. It plays right here in your browser, no account needed.`
          : SITE_DESCRIPTION,
        path: challengeHref(route.slug, route.id),
        image: gameImagePath(route.slug),
        noindex: true,
      }
    }
    case 'authVerify':
    case 'authDiscord':
    case 'authGoogle':
      return { ...site, title: titled('Signing in'), path: homeHref(), noindex: true }
    case 'devCelebrate':
      return { ...site, title: titled('Celebrate (dev)'), path: homeHref(), noindex: true }
    // A place the site doesn't have: its Game Over screen, an easter egg.
    case 'notFound':
      return { ...site, title: titled(route.killScreen ? 'Level 256' : 'Game Over'), path: homeHref(), noindex: true }
  }
}

const capital = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

/**
 * Structured data (schema.org, as JSON-LD) for a page the build writes: on the home page, what the site is and who
 * makes it; on a game's own page, that it's a free game played in a web browser, what kind, and where to play it.
 * Search engines and AI tools read it to know what a page is. Null for every other page. `origin` is the build's,
 * as the prerender has it (scripts/prerender.mjs).
 */
export function pageStructuredData(route: Route, origin: string): Record<string, unknown> | null {
  const orgId = `${origin}/#org`
  const org = { '@type': 'Organization', '@id': orgId, name: APP_NAME, url: `${origin}/`, logo: `${origin}/apple-touch-icon.png`, description: SITE_LINE }
  if (route.name === 'home') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${origin}/#site`, name: APP_NAME, url: `${origin}/`, description: SITE_DESCRIPTION, inLanguage: 'en', publisher: { '@id': orgId } },
        org,
      ],
    }
  }
  // The About page's questions, answered (lib/aboutQuestions.ts): what AI tools are asked about the site.
  if (route.name === 'about') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'FAQPage',
          '@id': `${origin}${aboutHref()}#faq`,
          url: `${origin}${aboutHref()}`,
          mainEntity: aboutQuestions().map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
          publisher: { '@id': orgId },
        },
        org,
      ],
    }
  }
  // The Dailies page: the list of the day's games, races first, each by what kind of game it is.
  if (route.name === 'today' && !route.day) {
    const url = `${origin}${todayHref()}`
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${url}#page`,
          url,
          name: pageMeta(route).title,
          description: dailiesDescription(),
          isAccessibleForFree: true,
          publisher: { '@id': orgId },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: dailyGames().map((game, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'VideoGame',
                '@id': `${origin}${gameHref(game.slug)}#game`,
                name: game.name,
                url: `${origin}${gameHref(game.slug)}`,
                ...(gameKind(game.slug) ? { genre: capital(gameKind(game.slug)!) } : {}),
                gamePlatform: 'Web browser',
                isAccessibleForFree: true,
              },
            })),
          },
        },
        org,
      ],
    }
  }
  if (route.name !== 'game' || route.tab || route.board) return null
  const game = getGame(route.slug)
  if (!game || game.hidden) return null
  const meta = pageMeta(route)
  const url = `${origin}${meta.path}`
  const kind = gameKind(game.slug)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame',
        '@id': `${url}#game`,
        name: game.name,
        url,
        description: gameDescription(game),
        image: `${origin}${meta.image}`,
        genre: [...(kind ? [capital(kind)] : []), ...(game.tags ?? []).map((tag) => TAG_LABELS[tag])],
        gamePlatform: 'Web browser',
        applicationCategory: 'Game',
        operatingSystem: 'Any',
        playMode: 'SinglePlayer',
        inLanguage: 'en',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': orgId },
        potentialAction: { '@type': 'PlayAction', target: `${origin}${gamePlayHref(game.slug)}` },
      },
      org,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: APP_NAME, item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: game.name, item: url },
        ],
      },
    ],
  }
}

/**
 * llms.txt (llmstxt.org): the site in plain Markdown for AI tools, which mostly read a page without running it. What
 * the arcade is, then every listed game by kind with a line about it, and the main pages. The build writes it beside
 * the sitemap, from the same games, so it never lists one that's held back.
 */
export function llmsText(origin: string): string {
  const listed = visibleGames().filter((game) => game.playable)
  const line = (game: Game) => {
    const kind = gameKind(game.slug)
    return `- [${game.name}](${origin}${gameHref(game.slug)}): ${kind ? `${capital(kind)}. ` : ''}${clipDescription(game.description, 220)}`
  }
  const page = (route: Route, label: string) => `- [${label}](${origin}${pageMeta(route).path}): ${pageMeta(route).description}`
  return [
    `# ${APP_NAME}`,
    '',
    `> ${SITE_LINE} ${arcadeLine()} It plays in a web browser, on a phone or a computer, with leaderboards, record books, seasons and invite-only events.`,
    '',
    '## Daily races',
    '',
    'New every day and the same for everyone, each against the clock. Playing any two keeps a streak going.',
    '',
    ...listed.filter((game) => game.daily && isRankedGame(game.slug)).map(line),
    '',
    '## Daily puzzles',
    '',
    'New every day and the same for everyone, just for fun.',
    '',
    ...listed.filter((game) => game.daily && !isRankedGame(game.slug)).map(line),
    '',
    '## Games',
    '',
    ...listed.filter((game) => !game.daily).map(line),
    '',
    '## More',
    '',
    page({ name: 'today' }, 'The Dailies'),
    page({ name: 'leaderboards' }, 'Leaderboards'),
    page({ name: 'recordsIndex' }, 'Record books'),
    page({ name: 'prizes' }, 'Prize counter'),
    page({ name: 'plus' }, 'Plus'),
    page({ name: 'about' }, `About ${APP_NAME}`),
    '',
  ].join('\n')
}
