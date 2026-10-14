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
import { MedalLadder } from '../components/RaceMedal'
import { ReelButton, ReelChase, reelSteps, ReelTickets, RunReel, runRecap, type ReelInput } from '../components/RunReel'
import { eventReelParts, type SubmitSnapshot } from '../components/TournamentScoreCard'
import type { ReportTier } from '../lib/runReport'
import { milestoneSpotlight, milestoneWear } from '../components/MilestoneMoment'
import { Spotlight } from '../components/Spotlight'
import type { FriendsWeek } from '../lib/friendsWeek'
import type { TodayServer, TodayServerDay } from '../lib/today'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { playersFromRuns, type BoardPlayer } from '../lib/gameBoard'
import type { GlobalRankResult, LeaderboardEntry } from '../lib/leaderboard'
import {
  boardCard,
  boardFacts,
  chaseFacts,
  composeReport,
  standingsCard,
  type ReportBoardCard,
  type ReportLine,
  type ReportMetal,
  type RunFacts,
} from '../lib/runReport'
import type { StandingRow, TournamentDetail } from '../lib/tournaments'
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
    // A fifth who played: the arcade's own events give a trophy from five (lib/eventPages trophyGiven).
    standingRow('ROOK', [6, 7, 7], [6, 3, 5]),
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

/* ---------- the reel (RunReel.tsx): the same runs, a step at a time ---------- */

type ReelSample = {
  key: string
  label: string
  game: string
  slug: string
  tier: ReportTier
  metal: ReportMetal | null
  /** The last step's way on when it isn't Play again: an event's standings once its tries are spent. */
  primary?: string
  /** The way out on the last step: Leave, or an event's Back to event. */
  leave?: string
  input: Omit<ReelInput, 'primary'>
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A saved Crosswalk run, as ScoreSaveCard puts its reel together. */
function arcadeReel(key: string, label: string, f: RunFacts, title: string, sub: string, extra: Partial<ReelInput> = {}): ReelSample {
  const r = composeReport(f)
  const paid = SAMPLE_TICKETS[key] ?? SAMPLE_TICKETS.quiet!
  const best = r.lines.find((l) => l.id === 'best') ?? null
  const season = extra.season ?? null
  const standingsNow = standingsCard(f)
  const chase = chaseFacts(f)
  return {
    key,
    label,
    game: 'Crosswalk',
    slug: 'crosswalk',
    tier: r.tier,
    metal: r.metal,
    input: {
      phase: 'saved',
      run: {
        titleId: `reel-${key}`,
        tier: r.tier,
        metal: r.metal,
        ribbon: r.ribbon,
        eyebrow: title,
        score: String(f.score),
        unit: 'rows',
        sub: r.ribbon ? `${title} · ${sub}` : sub,
        scoreTone: r.scoreTone,
      },
      board: boardCard(f, r.lines.find((l) => l.id === 'board') ?? null),
      friend: r.friend,
      standings: standingsNow,
      onStandings: () => {},
      books: r.lines.filter((l) => l.id.startsWith('book-')).sort((a, b) => Number(b.id === r.lead) - Number(a.id === r.lead)),
      onBooks: () => {},
      tickets:
        paid.earned > 0 ? <ReelTickets paid={paid} game="crosswalk" season={extra.season && !extra.season.levelUp.length ? extra.season : null} /> : null,
      recap: runRecap({
        score: { value: `${f.score} rows`, label: r.ribbon?.text ?? (best?.detail ? capital(best.detail) : title), best: best?.tone === 'accent' },
        lines: r.lines,
        lead: r.lead,
        tickets: paid.earned,
        standings: standingsNow,
        season,
      }),
      poster: chase ? <ReelChase chase={chase} primary={{ label: 'Play again' }} /> : undefined,
      block: paid.earned <= 0 ? <RunTicketsLine paid={paid} game="crosswalk" /> : null,
      secondary: r.friend ? { label: `Send ${r.friend.them.name} your run`, icon: 'flag' } : { label: 'Challenge a friend', icon: 'flag' },
      who: <ReportWho name="VERA" text="Saved as VERA" />,
      links: [
        { label: 'Board', onClick: () => {} },
        { label: 'Records', onClick: () => {} },
      ],
      ...extra,
    },
  }
}

/** Lander's run of 49.00s over a best of 52.00s: Silver, new; 4th today; 3 tickets; the pass moved. */
function landerReel(key: string, label: string, season: SeasonRun): ReelSample {
  const format = formatRun
  const paid: RunTickets = {
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
  }
  const place = landerPlace('#4', 'up from 7th · 0.31s behind PILOT for 3rd', 'accent')
  const card: ReportBoardCard = {
    label: 'Lander today',
    value: '4th',
    gold: false,
    move: 'up from 7th',
    detail: '0.31s behind PILOT for 3rd',
    rows: [
      { place: 3, name: 'PILOT', score: format(48.69), you: false },
      { place: 4, name: 'VERA', score: format(49), you: true, avatarId: 'a2:e:ufo:0:7:deep:none:none' },
      { place: 5, name: 'WES', score: format(49.4), you: false, mark: 'passed' },
    ],
  }
  return {
    key,
    label,
    game: 'Lander',
    slug: 'lander',
    tier: 'lit',
    metal: null,
    input: {
      phase: 'saved',
      run: {
        titleId: `reel-${key}`,
        tier: 'lit',
        ribbon: { icon: 'up', text: 'New personal best', tone: 'accent' },
        eyebrow: 'Today’s Cave #2',
        score: format(49),
        unit: '',
        sub: raceSubWords('Today’s Cave #2', 49_000, 52_000, format),
        scoreTone: 'accent',
        medal: 'silver',
        ladder: <MedalLadder game="lander" paceMs={PACE_MS} ms={49_000} previousMs={52_000} format={format} />,
      },
      board: card,
      boardCompact: true,
      tickets: <ReelTickets paid={paid} game="lander" medal="silver" season={season.levelUp.length ? null : season} />,
      season,
      recap: runRecap({ score: { value: format(49), label: 'New personal best', best: true }, lines: [place], medal: 'silver', tickets: 3, season }),
      poster: <NextDailyView variant="poster" slug="lander" punches={SAMPLE_PUNCHES} done={2} total={6} playAgain={{ label: 'Play again' }} />,
      secondary: { label: 'Challenge a friend', icon: 'flag' },
      who: <ReportWho name="VERA" text="Saved as VERA" />,
      links: [
        { label: 'Share', onClick: () => {} },
        { label: 'Board', onClick: () => {} },
        { label: 'Records', onClick: () => {} },
      ],
    },
  }
}

function reelSamples(tag: ReactNode, signIn: ReactNode): ReelSample[] {
  const quietRun = (key: string, score: number) => ({
    titleId: `reel-${key}`,
    tier: 'quiet' as const,
    ribbon: null,
    eyebrow: 'Run over',
    score: String(score),
    unit: 'rows',
    sub: 'The train got you',
    scoreTone: 'plain' as const,
  })
  const unsaved = (key: string, label: string, phase: ReelInput['phase'], extra: Partial<ReelInput>): ReelSample => ({
    key,
    label,
    game: 'Crosswalk',
    slug: 'crosswalk',
    tier: 'quiet',
    metal: null,
    input: { phase, run: quietRun(key, 447), recap: [{ key: 'score', kind: 'score', value: '447 rows', label: 'Run over' }], ...extra },
  })
  return [
    arcadeReel('quiet', 'An ordinary run', facts(318, {}), 'Run over', 'Flattened by traffic'),
    arcadeReel('best', 'A personal best', facts(440, {}), 'Run over', 'Fell in the water'),
    arcadeReel(
      'top',
      'Top of the board',
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
    arcadeReel('silver', 'Onto the podium, 2nd', facts(436, { board: climbTo(436), priorBest: 350 }), 'Run over', 'The train got you'),
    arcadeReel(
      'friend',
      'A friend gone past',
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
    arcadeReel(
      'record',
      'A new record',
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
    // A record book's 2nd on an ordinary run: the stamp names the book, and Where it landed leads with it.
    arcadeReel(
      'book-2nd',
      '2nd in a record book',
      facts(318, {
        books: [
          {
            hit: { id: 'crosswalk:longest-chain', label: 'Longest chain', value: '41', rank: 2 },
            record: { id: 'longest-chain', unit: 'count', label: 'Longest chain' } as never,
            holder: { id: 'h1', name: 'CHEF', score: 44, at: NOW },
          },
        ],
      }),
      'Run over',
      'Flattened by traffic',
    ),
    // Every page: the board, the standings it moved, a record book's 2nd, the tickets, a level.
    arcadeReel(
      'all-pages',
      'Every page',
      facts(447, {
        overall: {
          before: standings(21, 470, []),
          after: standings(18, 498, [
            ['DAD', 16, 540],
            ['HAWK', 17, 512],
            ['VERA', 18, 498],
            ['IVY', 19, 471],
            ['CHEF', 20, 455],
          ]),
        },
        books: [
          {
            hit: { id: 'crosswalk:longest-chain', label: 'Longest chain', value: '41', rank: 2 },
            record: { id: 'longest-chain', unit: 'count', label: 'Longest chain' } as never,
            holder: { id: 'h1', name: 'CHEF', score: 44, at: NOW },
          },
        ],
      }),
      'Run over',
      'The train got you',
      { season: TENTH_SEASON },
    ),
    arcadeReel('season-40', 'Level 40 on the pass', facts(318, {}), 'Run over', 'Flattened by traffic', { season: TENTH_SEASON }),
    arcadeReel('season-31', 'Level 31, past the free row', facts(318, {}), 'Run over', 'Flattened by traffic', { season: QUIET_SEASON }),
    arcadeReel('capped', 'Past the day’s cap', facts(318, {}), 'Run over', 'Flattened by traffic'),
    unsaved('signin', 'Signed out', 'ask', {
      ask: (
        <>
          {signIn}
          <RunTicketsWaiting />
        </>
      ),
      askGoLabel: 'Not now',
      block: signIn,
      who: <ReportWho text="Not saved yet" />,
    }),
    unsaved('tag', 'Signed in, no tag yet', 'ask', {
      ask: (
        <>
          {tag}
          <ReelButton action={{ label: 'Save to the board' }} />
          <RunTicketsWaiting tag />
        </>
      ),
      askGoLabel: 'Skip',
      block: (
        <>
          {tag}
          <ReelButton action={{ label: 'Save to the board' }} />
        </>
      ),
      who: <ReportWho text="Signed in, no tag yet" />,
    }),
    unsaved('saving', 'Still saving', 'pending', { who: <ReportWho name="VERA" text="Saving…" /> }),
    landerReel('lander', 'A racing daily: Silver, new', LANDER_SEASON),
    landerReel('lander-31', 'A racing daily that reached Level 31', QUIET_SEASON),
  ]
}

/* ---------- an event's run on the reel (TournamentScoreCard.tsx) ---------- */

/** A row of an event's standings: each game's score and its place on it. */
function eventRow(name: string, cells: Record<string, [number, number]>, place: number): StandingRow {
  // Each game's place is worth 11 less it (1st 10, 2nd 9), as a Triple counts them.
  const byGame = Object.fromEntries(Object.entries(cells).map(([slug, [score, at]]) => [slug, { score, place: at, points: Math.max(0, 11 - at) }]))
  return {
    playerId: `e-${name}`,
    name,
    totalPoints: Object.values(byGame).reduce((sum, cell) => sum + cell.points, 0),
    gamesPlayed: Object.keys(cells).length,
    place,
    byGame,
  }
}

function eventDetail(id: string, title: string, games: string[], standings: StandingRow[], kind = 'scores'): TournamentDetail {
  return {
    id,
    title,
    blurb: '',
    games,
    startsAt: NOW - DAY,
    endsAt: NOW + DAY,
    official: true,
    format: 'open',
    kind,
    status: 'active',
    playerCount: standings.length,
    players: [],
    placePoints: {},
    standings,
  } as unknown as TournamentDetail
}

const CUP_FIELD: [string, number][] = [
  ['WES', 470],
  ['CHEF', 431],
  ['IVY', 402],
  ['HAWK', 388],
  ['DAD', 350],
  ['ROOK', 333],
  ['MAYA', 301],
  ['JUNO', 288],
  ['PIP', 240],
  ['OWEN', 210],
  ['ZED', 160],
]

/** A one-game event of Crosswalk, with VERA's best here at `best` among the rest. */
function cup(best: number, id = 'dev-cup', title = 'Friday Cup'): TournamentDetail {
  const rows = [...CUP_FIELD, ['VERA', best] as [string, number]].sort((a, b) => b[1] - a[1])
  return eventDetail(id, title, ['crosswalk'], rows.map(([name, score], i) => eventRow(name, { crosswalk: [score, i + 1] }, i + 1)))
}

/** A Triple under way: VERA 2nd in the standings, 3rd on Crosswalk. */
function tripleLive(): TournamentDetail {
  return eventDetail('dev-triple-live', 'Weekly Triple', ['crosswalk', 'snake', 'frenzy'], [
    eventRow('IVY', { crosswalk: [470, 1], snake: [88, 2], frenzy: [41_000, 1] }, 1),
    eventRow('VERA', { crosswalk: [447, 3], snake: [95, 1], frenzy: [36_000, 2] }, 2),
    eventRow('HAWK', { crosswalk: [455, 2], snake: [70, 3] }, 3),
    eventRow('CHEF', { crosswalk: [402, 4], frenzy: [22_000, 3] }, 4),
    eventRow('ROOK', { snake: [51, 4] }, 5),
  ])
}

/** The event's answer to a post, as submitTournamentRun puts it. */
function eventPost(detail: TournamentDetail, best: number, extra: Partial<SubmitSnapshot> = {}): SubmitSnapshot {
  return {
    improved: false,
    best,
    attemptsRemaining: null,
    maxAttempts: null,
    exhausted: false,
    youWonMatch: false,
    youWonTournament: false,
    matchOpponent: null,
    detail,
    tickets: null,
    ...extra,
  }
}

/** An event's run of Crosswalk, posted, as TournamentScoreCard puts its reel together. */
function eventReel(key: string, label: string, post: SubmitSnapshot, score: number, primary?: string): ReelSample {
  const parts = eventReelParts(post, 'crosswalk', 'VERA', score, true)
  const bracket = post.detail?.kind === 'bracket'
  const counted = parts.recap.some((item) => item.key === 'tries') || post.youWonMatch
  return {
    key,
    label,
    game: post.detail?.title ?? 'Event',
    slug: 'crosswalk',
    tier: parts.tier,
    metal: null,
    primary,
    leave: 'Back to event',
    input: {
      phase: 'saved',
      run: {
        titleId: `reel-${key}`,
        tier: parts.tier,
        ribbon: parts.ribbon,
        eyebrow: 'Crosswalk',
        score: String(score),
        unit: 'rows',
        sub: 'The train got you',
        scoreTone: parts.ribbon?.tone === 'gold' ? 'gold' : parts.ribbon ? 'accent' : 'plain',
      },
      board: parts.board,
      tickets: parts.paid ? <ReelTickets paid={parts.paid} game="crosswalk" /> : null,
      recap: parts.recap,
      secondary: primary ? null : { label: 'Share', icon: 'share' },
      who: <ReportWho name="VERA" text={counted ? 'Posted as VERA' : 'Posted as VERA, unlimited tries'} />,
      links: primary ? [] : [{ label: bracket ? 'Bracket' : 'Standings', onClick: () => {} }],
    },
  }
}

function eventReels(tag: ReactNode, signIn: ReactNode): ReelSample[] {
  const unposted = (key: string, label: string, phase: ReelInput['phase'], extra: Partial<ReelInput>): ReelSample => ({
    key,
    label,
    game: 'Friday Cup',
    slug: 'crosswalk',
    tier: 'quiet',
    metal: null,
    leave: 'Back to event',
    input: {
      phase,
      wait: { said: 'Posting to Friday Cup…', slow: 'Still posting. It finishes even if you play on.' },
      run: { titleId: `reel-${key}`, tier: 'quiet', ribbon: null, eyebrow: 'Crosswalk', score: '447', unit: 'rows', sub: 'The train got you', scoreTone: 'plain' },
      recap: [{ key: 'score', kind: 'score', value: '447 rows', label: 'Crosswalk' }],
      ...extra,
    },
  })
  const tagAsk = (
    <>
      {tag}
      <ReelButton action={{ label: 'Post score' }} />
    </>
  )
  const match = eventDetail('dev-bracket-live', 'Friday Bracket', ['crosswalk'], [], 'bracket')
  return [
    eventReel('event-2nd', 'Event: 2nd, a new best', eventPost(cup(447), 447, { improved: true }), 447),
    eventReel('event-1st', 'Event: 1st', eventPost(cup(480), 480, { improved: true }), 480),
    eventReel('event-quiet', 'Event: an ordinary run', eventPost(cup(352), 352), 318),
    eventReel('event-triple', 'Event: a Triple, 2nd', eventPost(tripleLive(), 447, { improved: true }), 447),
    eventReel(
      'event-match',
      'Event: a bracket match won',
      eventPost(match, 447, { improved: true, youWonMatch: true, matchOpponent: 'REESE', attemptsRemaining: 0, exhausted: true }),
      447,
      'View bracket',
    ),
    eventReel(
      'event-daily',
      'Event: the day’s, +10 tickets',
      eventPost(cup(398, 'daily-2026-10-14', 'Today’s event · Crosswalk'), 398, { improved: true, tickets: { earned: 10, balance: 1331 } }),
      398,
    ),
    eventReel('event-tries', 'Event: 2 tries left', eventPost(cup(352), 352, { maxAttempts: 3, attemptsRemaining: 2 }), 318),
    eventReel('event-out', 'Event: the last try', eventPost(cup(352), 352, { maxAttempts: 1, attemptsRemaining: 0, exhausted: true }), 318, 'View standings'),
    unposted('event-signin', 'Event: signed out', 'ask', { ask: signIn, askGoLabel: 'Not now', block: signIn, who: <ReportWho text="Not posted yet" /> }),
    unposted('event-tag', 'Event: no tag yet', 'ask', { ask: tagAsk, askGoLabel: 'Skip', block: tagAsk, who: <ReportWho text="Signed in, no tag yet" /> }),
    unposted('event-posting', 'Event: still posting', 'pending', { who: <ReportWho name="VERA" text="Posting…" /> }),
  ]
}

export function DevCelebratePage() {
  // ?open=top or ?win=triple opens one on load, for a screenshot of the first paint.
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('open'))
  const [win, setWin] = useState<string | null>(() => new URLSearchParams(window.location.search).get('win'))
  const [spot, setSpot] = useState<string | null>(() => new URLSearchParams(window.location.search).get('spot'))
  // ?reel=best opens one of the reel's runs on load.
  const [reel, setReel] = useState<string | null>(() => new URLSearchParams(window.location.search).get('reel'))
  const [tag, setTag] = useState('VERA')
  const tagId = useId()
  const style = gameAccentStyle('crosswalk')
  const accent = String((style as Record<string, string>)['--celeb-accent'])
  const tagNode = (
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
    />
  )
  const signInNode = (
    <ReportSignIn
      lead={
        <>
          Sign in to put 447 rows on the boards. Right now that’s{' '}
          <strong className="report__win report__win--gold">#1 on Crosswalk this month</strong>.
        </>
      }
      onSignedIn={() => {}}
    />
  )
  const eventTagNode = (
    <TagSlots id={tagId} value={tag} onChange={setTag} onSubmit={() => {}} lead="Your tag goes on Friday Cup’s standings." />
  )
  const eventSignInNode = <ReportSignIn lead="Sign in to post 447 rows to Friday Cup." onSignedIn={() => {}} />
  const list = samples(tagNode, signInNode)
  const opened = list.find((s) => s.key === open)
  const reels = [...reelSamples(tagNode, signInNode), ...eventReels(eventTagNode, eventSignInNode)]
  const reeled = reels.find((r) => r.key === reel)

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

        <section className="lst-block" aria-label="Run reel">
          <div className="lst-block__head">
            <h2 className="lst-block__title">Run reel</h2>
            <p className="lst-block__note">the end of a run a step at a time (RunReel.tsx) · ?reel=best opens one on load</p>
          </div>
          <div className="hero__actions" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {reels.map((r) => (
              <button key={r.key} type="button" className="hero__ghost" onClick={() => setReel(r.key)}>
                {r.label}
              </button>
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
        {reeled ? (
          <RunReel
            key={reeled.key}
            label={`${reeled.input.run.ribbon?.text ?? reeled.input.run.eyebrow}, ${reeled.input.run.score}`}
            style={gameAccentStyle(reeled.slug)}
            accent={String((gameAccentStyle(reeled.slug) as Record<string, string>)['--celeb-accent'])}
            game={reeled.game}
            tier={reeled.tier}
            metal={reeled.metal}
            steps={reelSteps({ ...reeled.input, primary: { label: reeled.primary ?? 'Play again', onClick: () => setReel(null) } })}
            leave={{ label: reeled.leave ?? 'Leave', onClick: () => setReel(null) }}
            onEscape={() => setReel(null)}
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
