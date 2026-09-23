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
import { bracketCelebrationPayload, ScoreCelebration } from '../components/ScoreSaveCard'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { playersFromRuns } from '../lib/gameBoard'
import type { GlobalRankResult, LeaderboardEntry } from '../lib/leaderboard'
import { composeReport, type RunFacts } from '../lib/runReport'

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
      note: 'Saving: the score at once, the lines on their way, Play again ready.',
      body: {
        tier: 'quiet',
        ribbon: null,
        eyebrow: 'Run over',
        score: '318',
        unit: 'rows',
        sub: 'Flattened by traffic',
        scoreTone: 'plain',
        lines: null,
        who: <ReportWho name="VERA" text="Saving…" />,
      },
    },
  ]
}

export function DevCelebratePage() {
  const [open, setOpen] = useState<string | null>(null)
  const [champ, setChamp] = useState(false)
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
                  <RunReportBody titleId={`dev-${s.key}`} primary={{ label: 'Play again' }} {...s.body} />
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

        <section className="lst-block" aria-label="Event win">
          <div className="lst-block__head">
            <h2 className="lst-block__title">Event win</h2>
            <p className="lst-block__note">the bracket catch-up</p>
          </div>
          <div className="hero__actions" style={{ flexDirection: 'row' }}>
            <button type="button" className="hero__ghost" onClick={() => setChamp(true)}>
              Champion
            </button>
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
            {...opened.body}
          />
        ) : null}
        {champ ? (
          <ScoreCelebration
            payload={bracketCelebrationPayload({ champion: true, matchWon: true, opponent: 'REESE', eventTitle: 'Friday Bracket' })!}
            onDone={() => setChamp(false)}
          />
        ) : null}
      </div>
    </PageShell>
  )
}
