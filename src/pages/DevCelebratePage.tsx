import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { PageShell } from '../components/PageShell'
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
import { composeReport, type RunFacts } from '../lib/runReport'
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
  return { after: playersFromRuns(after), before: playersFromRuns(after.filter((r) => r.id !== 'new')) }
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

function reportSample(key: string, note: string, f: RunFacts, title: string, sub: string): Sample {
  const r = composeReport(f)
  return {
    key,
    note,
    body: {
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
            hit: { id: 'crosswalk:most-coins', label: 'Most coins in a run', value: '34', rank: 1 },
            record: { id: 'most-coins', unit: 'count', label: 'Most coins in a run' } as never,
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
                    leave={{ label: 'Leave', onClick: () => {} }}
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
