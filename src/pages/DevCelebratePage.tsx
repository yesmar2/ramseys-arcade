import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { PageShell } from '../components/PageShell'
import { NextDailyView } from '../components/NextDaily'
import { PushAsk } from '../components/PushAsk'
import { RunTicketsLine, RunTicketsWaiting } from '../components/prizes/RunTickets'
import { RaceReport, raceSubWords } from '../components/RaceReport'
import { caveDay } from '../games/lander/daily'
import { formatRun } from '../games/lander/score'
import { TomorrowCave } from '../games/lander/TomorrowCave'
import type { SeasonRun } from '../lib/season'
import type { RunTickets } from '../lib/tickets'
import {
  ReportSignIn,
  ReportWho,
  RunReport,
  RunReportBody,
  TagSlots,
  type RunReportBodyProps,
} from '../components/RunReport'
import { WinTakeover } from '../components/WinTakeover'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { playersFromRuns } from '../lib/gameBoard'
import type { GlobalRankResult, LeaderboardEntry } from '../lib/leaderboard'
import { boardFacts, composeReport, type ReportLine, type RunFacts } from '../lib/runReport'
import type { TournamentDetail } from '../lib/tournaments'
import { eventWinTakeover, standingsTakeover, type WinTakeoverData } from '../lib/winTakeover'

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

function wins(): { key: string; label: string; data: WinTakeoverData | null; primary: string }[] {
  return [
    { key: 'triple', label: 'Event won · Weekly Triple', data: eventWinTakeover(TRIPLE, 'VERA'), primary: 'See the final standings' },
    { key: 'bracket', label: 'Bracket champion', data: eventWinTakeover(BRACKET, 'VERA'), primary: 'See the final standings' },
    { key: 'standings', label: 'First in the standings', data: standingsTakeover(TOP, 'VERA', 'monthly'), primary: 'See the standings' },
  ]
}

type Sample = {
  key: string
  note: string
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
// Lander's medals go every 7% (raceMedals.ts MEDAL_STEP): bronze 59.99s, silver 55.80s, gold 51.60s, platinum 47.40s.
const LANDER_STEPS = {
  bronze: { at: shipAt(PACE_MS) + 1, tickets: 5, label: 'beating the blue ship' },
  silver: { at: shipAt(55_800), tickets: 8, label: 'beating the blue ship by 7%' },
  gold: { at: shipAt(51_600), tickets: 11, label: 'beating the blue ship by 14%' },
  platinum: { at: shipAt(47_400), tickets: 15, label: 'beating the blue ship by 21%' },
}

const LANDER_SEASON: SeasonRun = { id: 1, name: 'Space Race', earned: 290, added: 3, level: 2, levels: 30, nextAt: 300, next: null, levelUp: [] }

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
  return {
    key,
    note,
    body: {
      tier: best ? 'lit' : 'quiet',
      ribbon,
      eyebrow: 'Today’s Cave #2',
      score: formatRun(ms / 1000),
      unit: '',
      sub: raceSubWords(ribbon ? 'Today’s Cave #2' : 'Landed', ms, previousMs, formatRun),
      scoreTone: best ? 'accent' : 'plain',
      lines: [],
      tickets: (
        <RaceReport
          game="lander"
          paceMs={PACE_MS}
          format={formatRun}
          ms={ms}
          previousMs={previousMs}
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
      55_500,
      58_000,
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
      57_000,
      55_500,
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
      47_000,
      50_000,
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
    landerSample('medal-signin', 'A racing daily’s run, signed out: the ladder, and the tickets a sign-in pays.', 55_500, null, {
      tickets: <RunTicketsWaiting />,
      signedOut: true,
    }),
    landerSample('medal-saving', 'A racing daily’s run while the save answers: the ladder at once, the rows’ room held.', 55_500, 58_000, {
      pending: true,
    }),
    landerSample('tomorrow', 'The last of today’s dailies: all done, and tomorrow’s cave under it.', 57_000, 55_500, {
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
  ]
}

export function DevCelebratePage() {
  // ?open=top or ?win=triple opens one on load, for a screenshot of the first paint.
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('open'))
  const [win, setWin] = useState<string | null>(() => new URLSearchParams(window.location.search).get('win'))
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
          Sign in and 447 rows goes on the boards. Right now that’s{' '}
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
                <div className={`panel report report--${s.body.tier} report--static`} style={style}>
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

        {opened ? (
          <RunReport
            label={`${opened.body.ribbon?.text ?? opened.body.eyebrow}, ${opened.body.score} rows`}
            titleId="dev-open"
            style={style}
            accent={accent}
            onEscape={() => setOpen(null)}
            primary={{ label: 'Play again', onClick: () => setOpen(null) }}
            leave={{ label: 'Leave', onClick: () => setOpen(null) }}
            {...opened.body}
          />
        ) : null}
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
