import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { PageShell } from '../components/PageShell'
import { NextDailyView } from '../components/NextDaily'
import { PushAsk } from '../components/PushAsk'
import { RunTicketsLine, RunTicketsWaiting } from '../components/prizes/RunTickets'
import { RaceReport, raceSubWords } from '../components/RaceReport'
import { caveDay } from '../games/lander/daily'
import { formatRun } from '../games/lander/score'
import { boardTime, medalTimes, needsThousandths } from '../lib/raceMedals'
import { TomorrowCave } from '../games/lander/TomorrowCave'
import type { SeasonReward, SeasonRun } from '../lib/season'
import { SeasonRunLine } from '../components/season/SeasonRun'
import type { RunTickets } from '../lib/tickets'
import {
  ReportSignIn,
  ReportWho,
  RunReport,
  FriendDuel,
  RunReportBody,
  TagSlots,
  type RunReportBodyProps,
} from '../components/RunReport'
import { WinTakeover } from '../components/WinTakeover'
import { milestoneSpotlight, milestoneWear } from '../components/MilestoneMoment'
import { Spotlight } from '../components/Spotlight'
import type { FriendsWeek } from '../lib/friendsWeek'
import type { TodayServer, TodayServerDay } from '../lib/today'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { playersFromRuns, type BoardPlayer } from '../lib/gameBoard'
import type { GlobalRankResult, LeaderboardEntry } from '../lib/leaderboard'
import { boardFacts, composeReport, type ReportLine, type ReportMetal, type RunFacts } from '../lib/runReport'
import type { TournamentDetail } from '../lib/tournaments'
import { eventWinTakeover, friendsWeekTakeover, standingsTakeover, type WinTakeoverData } from '../lib/winTakeover'

/**
 * Dev only (`/dev/celebrate`): the end of a run with made-up runs, so the
 * report can be styled without playing a game to the end each time. The
 * cards are composed by the real report logic from fake boards, so their
 * words are the ones a real run would get. Not routed in production builds.
 */

const NOW = Date.now()

function runs(rows: [string, number, string?][]): LeaderboardEntry[] {
  return rows
    .map(([name, score, id], i) => ({ id: id ?? `run-${name}-${score}-${i}`, name, score, at: NOW - (i + 1) * 3600_000 }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
}

function standings(rank: number, score: number, nearby: [string, number, number][]): GlobalRankResult {
  return {
    rank,
    score,
    totalPlayers: 40,
    byGame: {},
    nearby: nearby.map(([name, r, s]) => ({ name, rank: r, score: s })),
  }
}

const BOARD = runs([
  ['WES', 441],
  ['VERA', 432],
  ['CHEF', 415],
  ['IVY', 402],
  ['HAWK', 388],
  ['DAD', 350],
])

/** The board before, and after a new run by VERA. */
function withRun(score: number) {
  const after = runs([...BOARD.map((r) => [r.name, r.score] as [string, number]), ['VERA', score, 'new']])
  return boardFacts(playersFromRuns(after), playersFromRuns(after.filter((r) => r.id !== 'new')), 'VERA')
}

/** VERA from the bottom of a board onto its podium: 2nd at 436, 3rd at 410. */
const CLIMB_BOARD = runs([
  ['WES', 441],
  ['CHEF', 430],
  ['IVY', 402],
  ['HAWK', 388],
  ['DAD', 372],
  ['VERA', 350],
])

/** A row on VERA's friends' board, for the friend gone past. */
function friendRow(place: number, name: string, score: number, avatarId?: string): BoardPlayer {
  return { place, name, best: { id: `f-${name}`, name, score, at: NOW, avatarId }, runs: 3 }
}

function climbTo(score: number) {
  const after = runs([...CLIMB_BOARD.map((r) => [r.name, r.score] as [string, number]), ['VERA', score, 'new']])
  return boardFacts(playersFromRuns(after), playersFromRuns(after.filter((r) => r.id !== 'new')), 'VERA')
}

function facts(score: number, extra: Partial<RunFacts>): RunFacts {
  return {
    slug: 'crosswalk',
    score,
    name: 'VERA',
    period: 'monthly',
    priorBest: 432,
    allTimeRank: 12,
    priorAllTimeRank: 14,
    board: withRun(score),
    overall: {
      before: standings(2, 614, [['DAD', 1, 924]]),
      after: standings(2, 614, [
        ['DAD', 1, 924],
        ['VERA', 2, 614],
        ['IVY', 3, 580],
      ]),
    },
    books: [],
    ...extra,
  }
}

/* ---------- the whole-screen wins ---------- */

const DAY = 86_400_000

function standingRow(name: string, points: [number, number, number], places: [number, number, number]) {
  const games = ['simon', 'findbug', 'crumbtrail']
  return {
    playerId: `p-${name}`,
    name,
    totalPoints: points.reduce((a, b) => a + b, 0),
    gamesPlayed: 3,
    byGame: Object.fromEntries(
      games.map((slug, i) => [slug, { score: 1000 - places[i]! * 10, place: places[i]!, points: points[i]! }]),
    ),
  }
}

const TRIPLE = {
  id: 'dev-triple',
  title: 'Weekly Triple',
  blurb: '',
  games: ['simon', 'findbug', 'crumbtrail'],
  startsAt: NOW - 8 * DAY,
  endsAt: NOW - DAY,
  official: true,
  format: 'place-points',
  kind: 'scores',
  status: 'ended',
  playerCount: 38,
  players: [],
  placePoints: {},
  standings: [
    standingRow('VERA', [9, 8, 10], [3, 4, 1]),
    standingRow('IVY', [10, 6, 8], [1, 6, 4]),
    standingRow('HAWK', [7, 10, 6], [5, 1, 6]),
    standingRow('CHEF', [8, 9, 5], [4, 2, 8]),
  ],
} as unknown as TournamentDetail

const BRACKET = {
  id: 'dev-bracket',
  title: 'Friday Bracket',
  blurb: '',
  games: ['snake'],
  startsAt: NOW - 3 * DAY,
  endsAt: NOW,
  official: false,
  format: 'open',
  kind: 'bracket',
  status: 'ended',
  playerCount: 8,
  players: Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: `P${i}`, joinedAt: NOW })),
  placePoints: {},
  standings: [],
  bracket: {
    matches: [
      {
        id: 'final',
        round: 3,
        slot: 0,
        winnerId: 'v',
        players: [
          { id: 'v', name: 'VERA' },
          { id: 'r', name: 'REESE' },
        ],
      },
    ],
  },
} as unknown as TournamentDetail

const TOP: GlobalRankResult = {
  rank: 1,
  score: 924,
  totalPlayers: 41,
  byGame: {
    crosswalk: { place: 1, points: 100 },
    asteroids: { place: 2, points: 96 },
    snake: { place: 4, points: 88 },
  },
  nearby: [
    { name: 'VERA', rank: 1, score: 924 },
    { name: 'DAD', rank: 2, score: 910 },
    { name: 'IVY', rank: 3, score: 862 },
  ],
}

/** Last week among VERA's friends, as GET /friends/week answers: first of six. */
const FRIENDS_WEEK: FriendsWeek = {
  week: '2026-10-05',
  field: 6,
  you: { name: 'VERA', rank: 1, points: 412 },
  podium: [
    { name: 'VERA', rank: 1, points: 412, avatarId: 'a2:e:ufo:0:7:deep:none:none' },
    { name: 'MAYA', rank: 2, points: 380, avatarId: 'a2:m:1:split:3:9:bold:none:none' },
    { name: 'WES', rank: 3, points: 301, avatarId: 'a2:m:1:stripes:4:5:bold:none:none' },
  ],
  games: [
    { game: 'hotlap', place: 1, field: 5 },
    { game: 'swoop', place: 1, field: 4 },
    { game: 'lander', place: 2, field: 5 },
    { game: 'crosswalk', place: 3, field: 6 },
  ],
}

function wins(): { key: string; label: string; data: WinTakeoverData | null; primary: string }[] {
  return [
    { key: 'triple', label: 'Event won · Weekly Triple', data: eventWinTakeover(TRIPLE, 'VERA'), primary: 'See the final standings' },
    { key: 'bracket', label: 'Bracket champion', data: eventWinTakeover(BRACKET, 'VERA'), primary: 'See the final standings' },
    { key: 'standings', label: 'First in the standings', data: standingsTakeover(TOP, 'VERA', 'monthly'), primary: 'See the standings' },
    { key: 'friends', label: 'Won the week among friends', data: friendsWeekTakeover(FRIENDS_WEEK), primary: 'See your friends' },
  ]
}

/** A Today whose streak is `kept` days ending today, with one day on a freeze `frozenAgo` days back if asked. */
function streakToday(kept: number, frozenAgo: number | null = null): TodayServer {
  const span = kept + (frozenAgo == null ? 0 : 1)
  const end = Date.UTC(2026, 9, 11)
  const days: TodayServerDay[] = Array.from({ length: 35 }, (_, n) => {
    const ago = 34 - n
    const day = new Date(end - ago * 86_400_000).toISOString().slice(0, 10)
    return { day, kept: ago < span && ago !== frozenAgo, frozen: ago === frozenAgo }
  })
  return {
    day: '2026-10-11',
    done: { hole: false, track: true, wanted: false },
    results: { hole: null, track: null, wanted: null },
    streak: { current: kept, best: kept },
    week: days.slice(-7),
    days,
  }
}

/** The Dailies streak milestones' spotlights (MilestoneMoment), from made-up streaks. */
function spots(): { key: string; label: string; server: TodayServer; day: number }[] {
  return [
    { key: 'streak3', label: '3 days · tickets', server: streakToday(3), day: 3 },
    { key: 'streak7', label: '7 days · the Dailies pin', server: streakToday(7), day: 7 },
    { key: 'streak30', label: '30 days · gold finish, one freeze', server: streakToday(30, 12), day: 30 },
    { key: 'streak100', label: '100 days · the title', server: streakToday(100), day: 100 },
  ]
}

type Sample = {
  key: string
  note: string
  /** A 2nd's or a 3rd's metal, for the card and its confetti. */
  metal?: ReportMetal | null
  body: Omit<RunReportBodyProps, 'titleId' | 'primary'> & { primary?: RunReportBodyProps['primary'] }
}

/** What each sample run paid in tickets, as a save would answer. */
const SAMPLE_TICKETS: Partial<Record<string, RunTickets>> = {
  quiet: {
    earned: 3,
    lines: [{ reason: 'run', amount: 3 }],
    balance: 1287,
    reached: { at: 46, tickets: 3 },
    next: { at: 69, tickets: 5 },
    base: 1,
    step: 3,
    paidBefore: 0,
    capped: 0,
    todayLeft: 180,
  },
  best: {
    earned: 15,
    lines: [
      { reason: 'run', amount: 7 },
      { reason: 'best', amount: 5 },
      { reason: 'pickup', amount: 3 },
    ],
    balance: 1301,
    reached: { at: 93, tickets: 7 },
    next: { at: 120, tickets: 10 },
    base: 1,
    step: 7,
    paidBefore: 0,
    capped: 0,
    todayLeft: 166,
  },
  top: {
    earned: 20,
    lines: [
      { reason: 'run', amount: 10 },
      { reason: 'best', amount: 5 },
      { reason: 'pickup', amount: 5 },
    ],
    balance: 1321,
    reached: { at: 120, tickets: 10 },
    next: null,
    base: 1,
    step: 10,
    paidBefore: 0,
    capped: 0,
    todayLeft: 146,
  },
  capped: {
    earned: 0,
    lines: [],
    balance: 1500,
    reached: { at: 46, tickets: 3 },
    next: { at: 69, tickets: 5 },
    base: 1,
    step: 3,
    paidBefore: 0,
    capped: 3,
    todayLeft: 0,
  },
}

function reportSample(key: string, note: string, f: RunFacts, title: string, sub: string): Sample {
  const r = composeReport(f)
  const paid = SAMPLE_TICKETS[key]
  return {
    key,
    note,
    metal: r.metal,
    body: {
      tickets: paid ? <RunTicketsLine paid={paid} game="crosswalk" /> : null,
      tier: r.tier,
      ribbon: r.ribbon,
      eyebrow: title,
      score: String(f.score),
      unit: 'rows',
      sub: r.ribbon ? `${title} · ${sub}` : sub,
      scoreTone: r.scoreTone,
      lines: r.lines,
      race: r.race,
      // A friend gone past, face to face, and the run to send them (as ScoreSaveCard has it).
      ...(r.friend
        ? { children: <FriendDuel friend={r.friend} />, secondary: { label: `Send ${r.friend.them.name} your run`, icon: 'flag' as const } }
        : {}),
      who: <ReportWho name="VERA" text="Saved as VERA" />,
      links: [
        { label: 'Crosswalk board', onClick: () => {} },
        { label: 'Record book', onClick: () => {} },
      ],
    },
  }
}

/** A day's punches, for the next daily's samples: the hole done, the lap just driven, four to go. */
const SAMPLE_PUNCHES = [
  { key: 'hole', slug: 'acechase', game: 'Ace Chase', kicker: 'Today’s Hole #7', title: 'Meadow Flipper', done: true },
  { key: 'track', slug: 'hotlap', game: 'Hot Lap', kicker: 'Today’s Track #6', title: 'Juniper Circuit', done: false },
  { key: 'wanted', slug: 'findbug', game: 'Find the Bug', kicker: 'Today’s Wanted #5', title: 'Ziggy, Pickle, Rosie, Tiger and Buzz', done: false },
  { key: 'pour', slug: 'halffull', game: 'Half Full', kicker: 'Today’s Pour #4', title: 'Party cup and three more', done: false },
  { key: 'course', slug: 'marblerun', game: 'Marble Run', kicker: 'Today’s Course #3', title: 'Nova Line', done: false },
  { key: 'cave', slug: 'lander', game: 'Lander', kicker: 'Today’s Cave #2', title: 'Nova Drift', done: false },
] as const

/*
 * A racing daily's runs, as ScoreSaveCard puts them together (RaceReport): Lander on a day whose blue ship
 * lands in a minute, so its ladder (the API's ticketLadders.ts) and its medals (lib/raceMedals.ts) go by 60s.
 */
const PACE_MS = 60_000
const shipAt = (ms: number) => 1_000_000 - ms
// Lander's medals (raceMedals.ts MEDAL_STEP and MEDAL_RUNGS): bronze 52.80s, silver 49.20s, gold 45.60s, platinum 42.00s.
const LANDER_STEPS = {
  bronze: { at: shipAt(52_800), tickets: 5, label: 'beating the blue ship by 12%' },
  silver: { at: shipAt(49_200), tickets: 8, label: 'beating the blue ship by 18%' },
  gold: { at: shipAt(45_600), tickets: 11, label: 'beating the blue ship by 24%' },
  platinum: { at: shipAt(42_000), tickets: 15, label: 'beating the blue ship by 30%' },
}

const LANDER_SEASON: SeasonRun = { id: 1, name: 'Space Race', earned: 290, added: 3, level: 2, levels: 30, nextAt: 300, next: null, levelUp: [] }

/** A level past the pass's 30: its tickets (the API's extraReward). */
const extraAt = (level: number, amount: number): SeasonReward => ({ level, kind: 'tickets', id: `tickets-${level}`, name: `${amount} tickets`, what: 'Tickets', amount, ready: true, extra: true })
/** A run that reached Level 31, past the free row's last: said in the season line, quietly. */
const QUIET_SEASON: SeasonRun = { id: 1, name: 'Space Race', earned: 4520, added: 40, level: 31, levels: 30, nextAt: 4650, next: extraAt(32, 25), levelUp: [extraAt(31, 25)] }
/** A run that reached Level 40: every tenth past 30 gets the level-up. */
const TENTH_SEASON: SeasonRun = { id: 1, name: 'Space Race', earned: 5870, added: 45, level: 40, levels: 30, nextAt: 6000, next: extraAt(41, 25), levelUp: [extraAt(40, 100)] }

/** An ordinary saved run with the season's line under it (as ScoreSaveCard has it), for a level past 30. */
function seasonSample(key: string, note: string, run: SeasonRun): Sample {
  const base = reportSample('quiet', note, facts(318, {}), 'Run over', 'Flattened by traffic')
  return { key, note, body: { ...base.body, children: <SeasonRunLine run={run} /> } }
}

/** The run's place on today's board, as runReport.ts's board line says it. */
const landerPlace = (value: string, detail: string, tone: ReportLine['tone']): ReportLine => ({
  id: 'board',
  icon: tone === 'plain' ? 'board' : 'up',
  label: 'Lander today',
  detail,
  value,
  tone,
})

function landerSample(
  key: string,
  note: string,
  ms: number,
  previousMs: number | null,
  {
    tickets = null,
    place = null,
    children,
    pending = false,
    signedOut = false,
  }: { tickets?: ReactNode; place?: ReportLine | null; children?: ReactNode; pending?: boolean; signedOut?: boolean },
): Sample {
  const best = previousMs != null && ms < previousMs
  const ribbon = best ? ({ icon: 'up', text: 'New personal best', tone: 'accent' } as const) : null
  // As ScoreSaveCard says the times: the clock's hundredths, or the thousandths when two would read the same.
  const fine = needsThousandths([ms, previousMs, PACE_MS, ...Object.values(medalTimes('lander', PACE_MS))], formatRun)
  const format = fine ? (seconds: number) => boardTime('lander', seconds) : formatRun
  return {
    key,
    note,
    body: {
      tier: best ? 'lit' : 'quiet',
      ribbon,
      eyebrow: 'Today’s Cave #2',
      score: format(ms / 1000),
      unit: '',
      sub: raceSubWords(ribbon ? 'Today’s Cave #2' : 'Landed', ms, previousMs, format),
      scoreTone: best ? 'accent' : 'plain',
      lines: [],
      tickets: (
        <RaceReport
          game="lander"
          paceMs={PACE_MS}
          format={format}
          ms={ms}
          previousMs={previousMs}
          signedOut={signedOut}
          pending={pending}
          tickets={tickets}
          place={place}
          onBoard={() => {}}
        />
      ),
      children,
      who: signedOut ? <ReportWho text="Not saved yet" /> : pending ? <ReportWho name="VERA" text="Saving…" /> : <ReportWho name="VERA" text="Saved as VERA" />,
    },
  }
}

/** An ordinary saved run with the arcade's ask for alerts under it (components/PushAsk.tsx). */
function askSample(key: string, note: string, ask: ReactNode, secondary?: string): Sample {
  const base = reportSample('quiet', note, facts(318, {}), 'Run over', 'Flattened by traffic')
  return { key, note, body: { ...base.body, children: ask, ...(secondary ? { secondary: { label: secondary, icon: 'flag' } } : {}) } }
}

function samples(tag: ReactNode, signIn: ReactNode): Sample[] {
  return [
    reportSample('quiet', 'An ordinary run: nothing new, so nothing lights.', facts(318, {}), 'Run over', 'Flattened by traffic'),
    reportSample('best', 'A personal best: the card lights in the game’s colour.', facts(440, {}), 'Run over', 'Fell in the water'),
    reportSample(
      'top',
      'Top of the board: gold, the race it won, confetti once.',
      facts(447, {
        overall: {
          before: standings(4, 598, []),
          after: standings(2, 616, [
            ['DAD', 1, 924],
            ['VERA', 2, 616],
            ['IVY', 3, 580],
          ]),
        },
      }),
      'Run over',
      'The train got you',
    ),
    reportSample(
      'silver',
      'Onto the podium, 2nd: big, in silver, the top three under it.',
      facts(436, { board: climbTo(436), priorBest: 350 }),
      'Run over',
      'The train got you',
    ),
    reportSample(
      'bronze',
      'Onto the podium, 3rd: big, in bronze.',
      facts(410, { board: climbTo(410), priorBest: 350 }),
      'Run over',
      'Swept off the edge',
    ),
    reportSample(
      'friend',
      'A friend gone past: their face in the ribbon, the two of you face to face, and the run to send them.',
      facts(436, {
        friends: {
          you: friendRow(2, 'VERA', 436, 'a2:e:ufo:0:7:deep:none:none'),
          passed: [friendRow(3, 'MAYA', 433, 'a2:m:1:split:3:9:bold:none:none')],
          next: friendRow(1, 'WES', 441),
        },
      }),
      'Run over',
      'The train got you',
    ),
    reportSample(
      'record',
      'A new record in the book, naming whose it was. The score was no best, so it stays plain.',
      facts(296, {
        books: [
          {
            hit: { id: 'crosswalk:most-coins', label: 'Most tickets in a run', value: '34', rank: 1 },
            record: { id: 'most-coins', unit: 'count', label: 'Most tickets in a run' } as never,
            holder: { id: 'r1', name: 'VERA', score: 34, at: NOW },
            previous: { id: 'r0', name: 'CHEF', score: 33, at: NOW - 86_400_000 },
          },
        ],
      }),
      'Run over',
      'Swept off the edge',
    ),
    {
      key: 'signin',
      note: 'Signed out: the ask leads with what the run would win.',
      body: {
        tier: 'quiet',
        ribbon: null,
        eyebrow: 'Run over',
        score: '447',
        unit: 'rows',
        sub: 'The train got you',
        scoreTone: 'plain',
        lines: [],
        tickets: <RunTicketsWaiting />,
        children: signIn,
        who: <ReportWho text="Not saved yet" />,
      },
    },
    {
      key: 'tag',
      note: 'Signed in, no tag yet: letters in slots.',
      body: {
        tier: 'quiet',
        ribbon: null,
        eyebrow: 'Run over',
        score: '447',
        unit: 'rows',
        sub: 'The train got you',
        scoreTone: 'plain',
        lines: [],
        children: tag,
        primary: { label: 'Save to the board' },
        secondary: { label: 'Skip' },
        who: <ReportWho text="Signed in, no tag yet" />,
      },
    },
    {
      key: 'saving',
      note: 'Saving: the score at once, the lines on their way, Play again waiting on the save.',
      body: {
        tier: 'quiet',
        ribbon: null,
        eyebrow: 'Run over',
        score: '318',
        unit: 'rows',
        sub: 'Flattened by traffic',
        scoreTone: 'plain',
        lines: null,
        primary: { label: 'Saving…', busy: true },
        who: <ReportWho name="VERA" text="Saving…" />,
      },
    },
    askSample(
      'ask-streak',
      'A daily that keeps the day: the ask for a nudge before a day ends unkept.',
      <PushAsk reason="streak" streak={3} preview="ask" />,
    ),
    askSample(
      'ask-challenge',
      'A challenge just sent: the ask for an alert when it’s beaten.',
      <PushAsk reason="challenge" preview="ask" />,
      'Challenge a friend',
    ),
    askSample(
      'ask-iphone',
      'An iPhone in Safari: alerts need the Home Screen first, so the ask says how.',
      <PushAsk reason="streak" streak={1} preview="home-screen" />,
    ),
    askSample(
      'next',
      'A daily done: the way on to the next one (components/NextDaily.tsx).',
      <NextDailyView slug="hotlap" punches={SAMPLE_PUNCHES} done={1} total={6} />,
      'Challenge a friend',
    ),
    landerSample(
      'medal',
      'A racing daily’s run that paid: the medal ladder lights Silver, new, and dashes Gold; the tickets and the season in one row; the place.',
      49_000,
      52_000,
      {
        tickets: (
          <RunTicketsLine
            paid={{
              earned: 3,
              lines: [{ reason: 'run', amount: 3 }],
              balance: 1290,
              reached: LANDER_STEPS.silver,
              next: LANDER_STEPS.gold,
              base: 3,
              baseLabel: 'a run today',
              step: 8,
              paidBefore: 5,
              capped: 0,
              todayLeft: 170,
            }}
            game="lander"
            race={{ medal: 'silver', season: LANDER_SEASON }}
          />
        ),
        place: landerPlace('#4', 'up from 7th · 0.31s behind PILOT for 3rd', 'accent'),
      },
    ),
    landerSample(
      'medal-none',
      'A racing daily’s slower run: the day’s best keeps Silver, one quiet line for the tickets.',
      52_000,
      49_000,
      {
        tickets: (
          <RunTicketsLine
            paid={{
              earned: 0,
              lines: [],
              balance: 1290,
              reached: LANDER_STEPS.bronze,
              next: LANDER_STEPS.silver,
              base: 3,
              baseLabel: 'a run today',
              step: 5,
              paidBefore: 8,
              capped: 0,
              todayLeft: 170,
            }}
            game="lander"
            race={{ medal: 'silver', season: null }}
          />
        ),
        place: landerPlace('#4', '0.31s behind PILOT for 3rd', 'plain'),
      },
    ),
    landerSample(
      'medal-top',
      'A racing daily’s run to the top medal: Platinum, and nothing past it.',
      41_000,
      45_000,
      {
        tickets: (
          <RunTicketsLine
            paid={{
              earned: 4,
              lines: [{ reason: 'run', amount: 4 }],
              balance: 1301,
              reached: LANDER_STEPS.platinum,
              next: null,
              base: 3,
              baseLabel: 'a run today',
              step: 15,
              paidBefore: 11,
              capped: 0,
              todayLeft: 166,
            }}
            game="lander"
            race={{ medal: 'platinum', season: null }}
          />
        ),
        place: landerPlace('#1', 'passed DAD by 0.42s', 'gold'),
      },
    ),
    landerSample(
      'medal-first',
      'A racing daily’s first run, short of Bronze: no medal yet, the 3 for a run today.',
      62_000,
      null,
      {
        tickets: (
          <RunTicketsLine
            paid={{
              earned: 3,
              lines: [{ reason: 'run', amount: 3 }],
              balance: 1290,
              reached: null,
              next: LANDER_STEPS.bronze,
              base: 3,
              baseLabel: 'a run today',
              step: 3,
              paidBefore: 0,
              capped: 0,
              todayLeft: 170,
            }}
            game="lander"
            race={{ medal: null, season: null }}
          />
        ),
        place: landerPlace('#9', '0.40s behind NOVA for 8th', 'plain'),
      },
    ),
    landerSample('medal-signin', 'A racing daily’s run, signed out: the ladder, and the tickets a sign-in pays.', 49_000, null, {
      tickets: <RunTicketsWaiting />,
      signedOut: true,
    }),
    landerSample(
      'medal-missed',
      'A racing daily’s run 3ms short of Bronze: its times to the thousandth, so the miss shows (Bronze 52.800s, the run 52.803s).',
      52_803,
      null,
      { tickets: <RunTicketsWaiting />, signedOut: true },
    ),
    landerSample('medal-saving', 'A racing daily’s run while the save answers: the ladder at once, the rows’ room held.', 49_000, 52_000, {
      pending: true,
    }),
    landerSample('tomorrow', 'The last of today’s dailies: all done, and tomorrow’s cave under it.', 52_000, 49_000, {
      place: landerPlace('#4', '0.31s behind PILOT for 3rd', 'plain'),
      children: (
        <NextDailyView
          slug="lander"
          punches={SAMPLE_PUNCHES.map((p) => ({ ...p, done: true }))}
          done={6}
          total={6}
          tomorrow={<TomorrowCave day={caveDay()} />}
        />
      ),
    }),
    reportSample('capped', 'A run past the day’s cap: the quiet line, no box.', facts(318, {}), 'Run over', 'Flattened by traffic'),
    seasonSample('season-31', 'A run past the pass’s 30 levels: Level 31’s tickets said in the season line, with no level-up.', QUIET_SEASON),
    seasonSample('season-40', 'A run that reached Level 40: every tenth past 30 gets the level-up, and 100 tickets.', TENTH_SEASON),
    landerSample(
      'medal-31',
      'A racing daily’s run that reached Level 31: the season in the ticket row says the level’s tickets.',
      49_000,
      52_000,
      {
        tickets: (
          <RunTicketsLine
            paid={{
              earned: 3,
              lines: [{ reason: 'run', amount: 3 }],
              balance: 1290,
              reached: LANDER_STEPS.silver,
              next: LANDER_STEPS.gold,
              base: 3,
              baseLabel: 'a run today',
              step: 8,
              paidBefore: 5,
              capped: 0,
              todayLeft: 170,
            }}
            game="lander"
            race={{ medal: 'silver', season: QUIET_SEASON }}
          />
        ),
        place: landerPlace('#4', 'up from 7th · 0.31s behind PILOT for 3rd', 'accent'),
      },
    ),
  ]
}

export function DevCelebratePage() {
  // ?open=top or ?win=triple opens one on load, for a screenshot of the first paint.
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('open'))
  const [win, setWin] = useState<string | null>(() => new URLSearchParams(window.location.search).get('win'))
  const [spot, setSpot] = useState<string | null>(() => new URLSearchParams(window.location.search).get('spot'))
  const [tag, setTag] = useState('VERA')
  const tagId = useId()
  const style = gameAccentStyle('crosswalk')
  const accent = String((style as Record<string, string>)['--celeb-accent'])
  const list = samples(
    <TagSlots
      id={tagId}
      value={tag}
      onChange={setTag}
      onSubmit={() => {}}
      lead={
        <>
          447 rows is <strong className="report__win report__win--gold">#1 on Crosswalk this month</strong>. Put your
          name on it.
        </>
      }
    />,
    <ReportSignIn
      lead={
        <>
          Sign in to put 447 rows on the boards. Right now that’s{' '}
          <strong className="report__win report__win--gold">#1 on Crosswalk this month</strong>.
        </>
      }
      onSignedIn={() => {}}
    />,
  )
  const opened = list.find((s) => s.key === open)

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev" style={{ '--event-accent': accent } as CSSProperties}>
        <section className="lst-block" aria-label="Run report">
          <div className="lst-block__head">
            <h2 className="lst-block__title">Run report</h2>
            <p className="lst-block__note">dev only · press a card’s note to open it over the page</p>
          </div>
          <div className="dev-reports">
            {list.map((s) => (
              <figure key={s.key} className="dev-reports__item">
                <div className={`panel report report--${s.body.tier}${s.metal ? ` report--${s.metal}` : ''} report--static`} style={style}>
                  <RunReportBody
                    titleId={`dev-${s.key}`}
                    primary={{ label: 'Play again' }}
                    leave={{ label: 'Back to event', onClick: () => {} }}
                    {...s.body}
                  />
                </div>
                <figcaption>
                  <button type="button" className="hero__ghost" onClick={() => setOpen(s.key)}>
                    {s.note}
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="lst-block" aria-label="The whole screen">
          <div className="lst-block__head">
            <h2 className="lst-block__title">The whole screen</h2>
            <p className="lst-block__note">an event won, or first in the standings</p>
          </div>
          <div className="hero__actions" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {wins().map((w) => (
              <button key={w.key} type="button" className="hero__ghost" onClick={() => setWin(w.key)}>
                {w.label}
              </button>
            ))}
          </div>
        </section>

        <section className="lst-block" aria-label="The spotlight">
          <div className="lst-block__head">
            <h2 className="lst-block__title">The spotlight</h2>
            <p className="lst-block__note">a Dailies streak milestone (?spot=streak30 opens one on load)</p>
          </div>
          <div className="hero__actions" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {spots().map((sp) => (
              <button key={sp.key} type="button" className="hero__ghost" onClick={() => setSpot(sp.key)}>
                {sp.label}
              </button>
            ))}
          </div>
        </section>

        {opened ? (
          <RunReport
            label={`${opened.body.ribbon?.text ?? opened.body.eyebrow}, ${opened.body.score} rows`}
            titleId="dev-open"
            style={style}
            accent={accent}
            onEscape={() => setOpen(null)}
            primary={{ label: 'Play again', onClick: () => setOpen(null) }}
            leave={{ label: 'Leave', onClick: () => setOpen(null) }}
            metal={opened.metal}
            {...opened.body}
          />
        ) : null}
        {(() => {
          const shown = spots().find((sp) => sp.key === spot)
          if (!shown) return null
          return (
            <Spotlight
              data={milestoneSpotlight(shown.server, shown.day)}
              primary={milestoneWear(shown.day) ? { label: 'Put it on', onClick: () => setSpot(null) } : null}
              onClose={() => setSpot(null)}
            />
          )
        })()}
        {(() => {
          const shown = wins().find((w) => w.key === win)
          if (!shown?.data) return null
          return (
            <WinTakeover
              data={shown.data}
              primary={{ label: shown.primary, onClick: () => setWin(null) }}
              onClose={() => setWin(null)}
            />
          )
        })()}
      </div>
    </PageShell>
  )
}
