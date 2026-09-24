import { getGame } from '../data/games'
import { avatarWashColor, resolveAvatar } from './avatars'
import type { LeaderboardEntry, LeaderboardPeriod, YouEntry } from './leaderboard'
import { recordBrief, recordGap, recordKind, recordTime, recordValue, type RecordKind } from './recordBook'
import type { RecordDef, RecordSummary } from './records'
import { boardToday, ordinal, type Stat } from './scoreboard'

/*
 * One record's page in words and numbers: whose name is on it and for how
 * long, what the record is, where the viewer stands and what the next place
 * takes, every time it was broken, and the records beside it in its book. The
 * page only fetches and lays out; this says it.
 */

type Rec = Pick<RecordDef, 'id' | 'label' | 'unit' | 'direction'>
type Moment = { score: number; at: number }

const DAY_MS = 86_400_000

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** this week, this month, all time */
export function recordWhen(period: LeaderboardPeriod): string {
  if (period === 'weekly') return 'this week'
  if (period === 'monthly') return 'this month'
  if (period === 'daily') return 'today'
  return 'all time'
}

/** The period where a sentence needs it: this week, or yet for all time. */
function soFar(period: LeaderboardPeriod): string {
  return period === 'all' ? 'yet' : recordWhen(period)
}

/** Sep 14, in the reader's own calendar. */
export function recordDay(at: number): string {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/** Calendar days from one moment to another, where the boards keep time. */
function daysBetween(a: number, b: number): number {
  return Math.round((boardToday(b) - boardToday(a)) / DAY_MS)
}

/** How long something lasted, in words: under an hour, 7 hours, 1 day, 32 days. */
export function heldFor(from: number, to: number): string {
  const days = daysBetween(from, to)
  if (days <= 0) {
    const hours = Math.floor((to - from) / 3_600_000)
    return hours < 1 ? 'under an hour' : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** Whether a beats b on this record. */
export function recordBetter(record: Rec, a: number, b: number): boolean {
  return record.direction === 'lower' ? a < b : a > b
}

/** What beats a result: under 3:51.2, or 13 in a row. */
export function recordBeat(record: Rec, score: number): string {
  return record.unit === 'ms' ? `under ${recordTime(score)}` : recordValue(record, score + 1)
}

/** The milestone a clock record times: wave 12, length 40, 100 rows. */
function milestone(game: string, label: string): string {
  const n = /(\d[\d,]*)/.exec(label)?.[1] ?? ''
  if (game === 'asteroids') return `wave ${n}`
  if (game === 'snake') return `length ${n}`
  if (game === 'crosswalk') return `${n} rows`
  return label.toLowerCase()
}

/** The score a threshold streak asks for, where its label says one: 1,000 in Scores over 1,000 in a row. */
function threshold(label: string): string {
  return /over ([\d,]+)/i.exec(label)?.[1] ?? ''
}

const RUN_SUBJECTS: Partial<Record<string, string>> = {
  'highest-combo': 'The biggest combo anyone has chained in a single run',
  longest: 'The longest anyone has grown in a single run',
  'most-coins': 'The most coins anyone has picked up in a single run',
  'near-misses': 'The most close calls anyone has survived in a single run',
  'most-rows': 'The most rows anyone has climbed in a single run',
  'chasers-eaten': 'The most chasers anyone has eaten in a single run',
  'longest-chain': 'The longest chain anyone has built in a single run',
}

/**
 * What a record is, in a sentence, with its number when it has one: The
 * fastest anyone has cleared wave 12 is 3:51.2, timed from the wave’s start.
 */
export function recordRule(game: string, record: Rec, period: LeaderboardPeriod, score?: number): string {
  const kind = recordKind(record)
  let subject: string
  let qualifier = ''
  if (kind === 'clock') {
    const verb = game === 'asteroids' ? 'cleared' : game === 'snake' ? 'grown to' : 'reached'
    subject = `The fastest anyone has ${verb} ${milestone(game, record.label)}`
    qualifier = game === 'asteroids' ? 'timed from the wave’s start' : 'timed from the start of the run'
  } else if (record.id === 'play-days-streak') {
    subject = `The most days in a row anyone has played ${gameName(game)}`
  } else if (record.id === 'threshold-streak' && threshold(record.label)) {
    subject = `The most runs in a row anyone has scored over ${threshold(record.label)}`
  } else if (kind === 'streaks') {
    subject = `The most ${record.label.replace(/ in a row$/i, '').toLowerCase()} in a row anyone has strung together`
  } else {
    subject = RUN_SUBJECTS[record.id] ?? 'The most anyone has managed in a single run'
  }
  if (period !== 'all') subject += ` ${recordWhen(period)}`
  const text = score === undefined ? subject : `${subject} is ${recordBrief(record, score)}`
  return qualifier ? `${text}, ${qualifier}.` : `${text}.`
}

/** What puts a player on a record's board at all: Clear wave 12 once. */
export function onTheBoard(game: string, record: Rec): string {
  const kind = recordKind(record)
  if (kind === 'clock') return `${game === 'asteroids' ? 'Clear' : 'Reach'} ${milestone(game, record.label)} once`
  if (record.id === 'play-days-streak') return 'Play one day'
  if (record.id === 'threshold-streak' && threshold(record.label)) return `Score over ${threshold(record.label)} once`
  if (record.id === 'highest-combo') return 'Chain any combo'
  if (kind === 'streaks') return 'Start a streak'
  return 'Finish a run'
}

/* ---------- the banner ---------- */

/** Whose name is on it and for how long, with the name apart so it can wear the gold. */
export function recordHeadline(
  top: LeaderboardEntry | null,
  period: LeaderboardPeriod,
  now = Date.now(),
): { name: string; rest: string } {
  if (!top) return { name: '', rest: period === 'all' ? 'Nobody has set it yet.' : `Nobody has set it ${recordWhen(period)}.` }
  const days = daysBetween(top.at, now)
  return {
    name: top.name,
    rest: days <= 0 ? ' set it today.' : days === 1 ? ' has held it since yesterday.' : ` has held it for ${days} days.`,
  }
}

/** The line under it: what the record is and what it leads by, or how to take an empty one. */
export function recordLede(game: string, record: Rec, period: LeaderboardPeriod, entries: LeaderboardEntry[]): string {
  const [top, second] = entries
  if (!top) {
    const clock =
      recordKind(record) !== 'clock'
        ? ''
        : game === 'asteroids'
          ? ' Each wave is timed from its own start.'
          : ' Times run from the start of the run.'
    const when = period === 'all' ? '' : ` ${recordWhen(period)}`
    return `${onTheBoard(game, record)}${when} and it’s yours, until someone beats it.${clock}`
  }
  const rule = recordRule(game, record, period, top.score)
  if (!second) return `${rule} Nobody else is on it ${soFar(period)}.`
  if (second.score === top.score) return `${rule} ${second.name} has matched it, but ${top.name} got there first.`
  return `${rule} It leads ${second.name}’s ${recordValue(record, second.score)} by ${recordGap(record, second.score, top.score)}.`
}

/* ---------- you ---------- */

export type RecordStanding =
  | { mode: 'held'; big: string; of: string; line: string; stats: Stat[]; callout: string }
  | { mode: 'on'; big: string; of: string; line: string; stats: Stat[]; callout: string; heldBefore: string | null }
  | { mode: 'off'; line: string; callout: string; best: string | null }

/** Holders one stretch at a time: a player who beat their own record keeps one stretch. */
function stints(progression: LeaderboardEntry[]): { name: string; from: number; to: number | null; taker: LeaderboardEntry | null }[] {
  const out: { name: string; from: number; to: number | null; taker: LeaderboardEntry | null }[] = []
  for (const [i, moment] of progression.entries()) {
    if (i > 0 && progression[i - 1].name === moment.name) continue
    const last = out[out.length - 1]
    if (last) {
      last.to = moment.at
      last.taker = moment
    }
    out.push({ name: moment.name, from: moment.at, to: null, taker: null })
  }
  return out
}

/**
 * Where the viewer stands on a record: holding it, on its board, or not on it
 * yet, with the numbers and the next thing to aim at.
 */
export function recordStanding(
  game: string,
  record: Rec,
  period: LeaderboardPeriod,
  board: { entries: LeaderboardEntry[]; total: number; you: YouEntry | null; progression: LeaderboardEntry[] },
  me: string,
  allTimeYou: YouEntry | null,
  now = Date.now(),
): RecordStanding {
  const { entries, total, you, progression } = board
  const [top, second] = entries
  if (you && top && you.rank === 1) {
    const stats: Stat[] = []
    if (second) stats.push({ value: recordGap(record, second.score, top.score), label: `ahead of ${second.name}` })
    const held = stints(progression)
    if (held.length) stats.push({ value: ordinal(held.length), label: 'to hold it' })
    if (total > 1) stats.push({ value: (total - 1).toLocaleString(), label: total === 2 ? 'player chasing' : 'players chasing' })
    return {
      mode: 'held',
      big: 'It’s yours',
      of: `#1 of ${total.toLocaleString()}`,
      line: `${recordValue(record, top.score)} · set ${recordDay(top.at)} · held ${heldFor(top.at, now)}`,
      stats,
      callout: second ? `${second.name} is ${recordGap(record, second.score, top.score)} behind.` : 'Nobody else is on it yet.',
    }
  }
  if (you && top) {
    const rank = you.rank
    const next = entries[rank - 2]
    const below = entries[rank]
    const stats: Stat[] = [{ value: recordGap(record, you.score, top.score), label: 'off the record' }]
    if (next && rank > 2) {
      stats.push(
        next.score === you.score
          ? { value: 'Tied', label: `with ${next.name}` }
          : { value: recordGap(record, you.score, next.score), label: `behind ${next.name}` },
      )
    }
    if (below) stats.push({ value: recordGap(record, below.score, you.score), label: `ahead of ${below.name}` })
    const callout = !next
      ? `${capital(recordBeat(record, top.score))} takes the record.`
      : next.score === you.score
        ? `Tied with ${next.name}, who got there first. ${capital(recordBeat(record, next.score))} passes them.`
        : rank === 2
          ? `${capital(recordBeat(record, top.score))} takes the record from ${top.name}.`
          : `${capital(recordBeat(record, next.score))} passes ${next.name} for ${ordinal(rank - 1)}.`
    // Held it once and lost it: the last stretch, and who took it.
    const mine = stints(progression).filter((s) => s.name === me && s.taker)
    const lost = mine[mine.length - 1]
    const heldBefore = lost?.taker
      ? `You held it for ${heldFor(lost.from, lost.to!)} from ${recordDay(lost.from)}, until ${lost.taker.name}’s ${recordValue(record, lost.taker.score)}.`
      : null
    return {
      mode: 'on',
      big: `#${rank.toLocaleString()}`,
      of: `of ${total.toLocaleString()}`,
      line: `Best ${recordValue(record, you.score)} · set ${recordDay(you.at)}`,
      stats,
      callout,
      heldBefore,
    }
  }
  const when = period === 'all' ? '' : ` ${recordWhen(period)}`
  const line = total
    ? `${total.toLocaleString()} ${total === 1 ? 'player is' : 'players are'} on it${when}. ${onTheBoard(game, record)} and you’re one of them.`
    : `Nobody is on it ${soFar(period)}. ${onTheBoard(game, record)} and the record is yours.`
  const callout =
    entries.length >= 3
      ? `${capital(recordBeat(record, entries[2].score))} makes the podium; ${recordBeat(record, top.score)} takes the record.`
      : top
        ? `${capital(recordBeat(record, top.score))} takes the record from ${top.name}.`
        : 'Any result takes it.'
  let best: string | null = null
  if (period !== 'all' && allTimeYou) {
    const place = 1 + entries.filter((e) => !recordBetter(record, allTimeYou.score, e.score)).length
    best = `Your best of all time, ${recordValue(record, allTimeYou.score)}, would ${place === 1 ? 'take the record' : `place ${ordinal(place)}`}.`
  }
  return { mode: 'off', line, callout, best }
}

export type RecordTake = { what: string; beat: string; who: string; done: boolean }

/** What each rung takes: the record, the podium, the top half, and getting on at all, ticked where the viewer is. */
export function recordTakes(game: string, record: Rec, entries: LeaderboardEntry[], rank: number | null): RecordTake[] {
  const takes: RecordTake[] = []
  const at = rank ? `you’re ${ordinal(rank)}` : ''
  const [top] = entries
  if (top) {
    takes.push({
      what: 'Take the record',
      beat: capital(recordBeat(record, top.score)),
      who: rank === 1 ? 'it’s yours' : `from ${top.name}`,
      done: rank === 1,
    })
  }
  if (entries.length >= 3) {
    const done = Boolean(rank && rank <= 3)
    takes.push({
      what: 'Make the podium',
      beat: capital(recordBeat(record, entries[2].score)),
      who: done ? at : `past ${entries[2].name}, now 3rd`,
      done,
    })
  }
  if (entries.length >= 6) {
    const half = Math.ceil(entries.length / 2)
    const done = Boolean(rank && rank <= half)
    takes.push({
      what: 'The top half',
      beat: capital(recordBeat(record, entries[half - 1].score)),
      who: done ? at : `past ${entries[half - 1].name}, now ${ordinal(half)}`,
      done,
    })
  }
  takes.push({
    what: 'Get on it',
    beat: onTheBoard(game, record),
    who: rank ? 'you’re on it' : 'one result, any result',
    done: Boolean(rank),
  })
  return takes
}

/* ---------- the story ---------- */

/** A piece of the chart's line, in percent of the plot: a stretch held (run) or the step between two (drop). */
export type StorySeg = {
  key: string
  kind: 'run' | 'drop'
  left: number
  bottom: number
  width: number
  height: number
  color: string
  mine: boolean
}

export type StoryDot = {
  key: string
  left: number
  bottom: number
  name: string
  avatarId?: string
  value: string
  mine: boolean
  current: boolean
}

export type StoryRow = {
  key: string
  at: number
  name: string
  avatarId?: string
  value: string
  change: string
  held: string
  mine: boolean
  current: boolean
}

export type RecordStory = {
  title: string
  chip: string
  sub: string
  legend: string
  best: string
  worst: string
  flat: boolean
  start: number
  segs: StorySeg[]
  yours: StorySeg[]
  dots: StoryDot[]
  /** Newest first. */
  rows: StoryRow[]
  /** The chart in words, for a screen reader. */
  summary: string
}

function holderColor(name: string, avatarId?: string): string {
  return avatarWashColor(resolveAvatar(avatarId, name))
}

/**
 * Every time the record was broken, as a step line from the first setting to
 * today, each stretch in its holder's colour, with the viewer's own best
 * beside it; and the same as a list, newest first.
 */
export function recordStory(
  record: Rec,
  progression: LeaderboardEntry[],
  yours: Moment[],
  period: LeaderboardPeriod,
  me: string,
  now = Date.now(),
): RecordStory | null {
  if (!progression.length) return null
  const t0 = progression[0].at
  const span = Math.max(1, now - t0)
  const scores = [...progression, ...yours].map((m) => m.score)
  const lower = record.direction === 'lower'
  const best = lower ? Math.min(...scores) : Math.max(...scores)
  const worst = lower ? Math.max(...scores) : Math.min(...scores)
  const range = Math.abs(worst - best)
  const x = (at: number) => 2 + ((at - t0) / span) * 94
  const y = (score: number) => (range ? 10 + (Math.abs(score - worst) / range) * 78 : 50)

  const line = (moments: (Moment & { name: string; avatarId?: string; id?: string })[], prefix: string): StorySeg[] => {
    const segs: StorySeg[] = []
    moments.forEach((m, i) => {
      const next = moments[i + 1]
      const x0 = x(m.at)
      const x1 = next ? x(next.at) : 97
      const mine = Boolean(me) && m.name === me
      const color = holderColor(m.name, m.avatarId)
      segs.push({ key: `${prefix}r${i}`, kind: 'run', left: x0, bottom: y(m.score), width: Math.max(0.5, x1 - x0), height: 0, color, mine })
      if (next) {
        const y0 = y(m.score)
        const y1 = y(next.score)
        segs.push({ key: `${prefix}d${i}`, kind: 'drop', left: x1, bottom: Math.min(y0, y1), width: 0, height: Math.abs(y1 - y0), color, mine })
      }
    })
    return segs
  }

  const dots: StoryDot[] = progression.map((m, i) => ({
    key: m.id,
    left: x(m.at),
    bottom: y(m.score),
    name: m.name,
    avatarId: m.avatarId,
    value: recordValue(record, m.score),
    mine: Boolean(me) && m.name === me,
    current: i === progression.length - 1,
  }))

  const rows: StoryRow[] = progression.map((m, i) => {
    const prev = progression[i - 1]
    const next = progression[i + 1]
    const change = !prev
      ? 'first set'
      : record.unit === 'ms'
        ? `${recordGap(record, m.score, prev.score)} faster`
        : `+${recordGap(record, m.score, prev.score)}`
    const held = heldFor(m.at, next ? next.at : now)
    return {
      key: m.id,
      at: m.at,
      name: m.name,
      avatarId: m.avatarId,
      value: recordValue(record, m.score),
      change,
      held: next ? held : `${held} so far`,
      mine: Boolean(me) && m.name === me,
      current: !next,
    }
  })

  const first = progression[0]
  const top = progression[progression.length - 1]
  const breaks = progression.length - 1
  const holders = new Set(progression.map((m) => m.name)).size
  const within = period === 'all' ? '' : ` ${recordWhen(period)}`
  const sub = breaks
    ? `${first.name} set the first${within}, ${recordValue(record, first.score)}, on ${recordDay(first.at)}. ${top.name} has held it since ${recordDay(top.at)}.`
    : `${first.name} set it on ${recordDay(first.at)}${within}, and nobody has beaten it since.`
  return {
    title: breaks ? `Broken ${breaks} ${breaks === 1 ? 'time' : 'times'}` : 'Set once, never broken',
    chip: `${holders} ${holders === 1 ? 'holder' : 'holders'}`,
    sub,
    legend: `Each step is a new record, drawn in its holder’s colour.${yours.length ? ' The thin line is your own best.' : ''}`,
    best: recordValue(record, best),
    worst: recordValue(record, worst),
    flat: range === 0,
    start: t0,
    segs: line(progression, 's'),
    yours: line(
      yours.map((m) => ({ ...m, name: me })),
      'y',
    ),
    dots,
    rows: rows.reverse(),
    summary: progression.map((m) => `${m.name}, ${recordValue(record, m.score)}, on ${recordDay(m.at)}`).join('; '),
  }
}

/** Where a step's label sits: above or below its mark, and how many label-heights further out. */
export type LabelSpot = { below: boolean; tier: number }

/** The chart as drawn, in pixels: the plot, the room around it, and the sizes of what goes in it. */
export type ChartMetrics = {
  width: number
  height: number
  /** How far above the plot a label may reach. */
  headroom: number
  /** How far below it, before the dates along the bottom. */
  footroom: number
  mark: number
  gap: number
  step: number
  labelHeight: number
  /** Rough widths of a character of a label's value and of its name. */
  valueChar: number
  nameChar: number
  pad: number
}

/**
 * Where each shown step's label goes. The standing record's and the viewer's
 * are placed first; each takes the first place, above or below its mark and
 * then a tier further out, that stays in the chart and clears every mark and
 * every label placed before it. Those two always get one, the least crowded if
 * none is clear; any other step without clear room goes unlabelled, since the
 * list under the chart names every step. A step with a neighbour above it at
 * about the same moment labels below, and the neighbour above, so the two
 * don't meet in the middle.
 */
export function placeStoryLabels(
  dots: StoryDot[],
  m: ChartMetrics,
  shown: (dot: StoryDot) => boolean = () => true,
): Map<string, LabelSpot> {
  type Box = { x0: number; x1: number; y0: number; y1: number }
  const margin = 5
  const clash = (a: Box, b: Box) =>
    a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.y0 < b.y1 + margin && b.y0 < a.y1 + margin
  const at = dots.map((d) => ({ cx: (d.left / 100) * m.width, cy: (d.bottom / 100) * m.height }))
  const marks: Box[] = at.map(({ cx, cy }) => ({
    x0: cx - m.mark / 2,
    x1: cx + m.mark / 2,
    y0: cy - m.mark / 2,
    y1: cy + m.mark / 2,
  }))
  const placed: Box[] = []
  const spots = new Map<string, LabelSpot>()
  const key = (dot: StoryDot) => dot.current || dot.mine
  const order = dots.map((dot, i) => ({ dot, i })).sort((a, b) => Number(key(b.dot)) - Number(key(a.dot)) || a.i - b.i)
  order.forEach(({ dot, i }) => {
    if (!shown(dot)) return
    const { cx, cy } = at[i]
    const width = Math.max(dot.value.length * m.valueChar, dot.name.length * m.nameChar) + m.pad
    const x0 = dot.left < 10 ? cx - m.mark / 2 : dot.left > 90 ? cx + m.mark / 2 - width : cx - width / 2
    const box = (below: boolean, tier: number): Box => {
      const reach = m.mark / 2 + m.gap + tier * m.step
      const y0 = below ? cy - reach - m.labelHeight : cy + reach
      return { x0, x1: x0 + width, y0, y1: y0 + m.labelHeight }
    }
    const beside = at.filter((o, j) => j !== i && Math.abs(o.cx - cx) < width / 2 + m.mark)
    const higher = beside.some((o) => o.cy > cy)
    const lower = beside.some((o) => o.cy < cy)
    const first = cy > m.height * 0.72 || (higher && !lower)
    const tries = [0, 1, 2, 3]
      .flatMap((tier) => [
        { below: first, tier },
        { below: !first, tier },
      ])
      .map((t) => ({ ...t, box: box(t.below, t.tier) }))
      .filter((t) => t.box.y0 >= -m.footroom && t.box.y1 <= m.height + m.headroom)
      .map((t) => ({
        ...t,
        hits: placed.filter((p) => clash(p, t.box)).length + marks.filter((k, j) => j !== i && clash(k, t.box)).length,
      }))
    const clear = tries.find((t) => t.hits === 0)
    if (!clear && !key(dot)) return
    const spot = clear ?? [...tries].sort((a, b) => a.hits - b.hits)[0] ?? { below: first, tier: 0, box: box(first, 0) }
    placed.push(spot.box)
    spots.set(dot.key, { below: spot.below, tier: spot.tier })
  })
  return spots
}

/* ---------- the field, and the book around it ---------- */

/** Everyone's best on a line, better to the right, stacked where they crowd. */
export function recordField(record: Rec, entries: LeaderboardEntry[], me: string) {
  const scores = entries.map((e) => e.score)
  const lower = record.direction === 'lower'
  const best = lower ? Math.min(...scores) : Math.max(...scores)
  const worst = lower ? Math.max(...scores) : Math.min(...scores)
  const range = Math.abs(worst - best) || 1
  const placed: number[] = []
  const dots = entries.map((e, i) => {
    const left = 2 + (Math.abs(e.score - worst) / range) * 96
    const row = Math.min(3, placed.filter((p) => Math.abs(p - left) < 2.2).length)
    placed.push(left)
    return { key: e.id, left, row, mine: Boolean(me) && e.name === me, top: i === 0 }
  })
  return {
    dots,
    low: recordValue(record, worst),
    high: recordValue(record, best),
    sub: `From ${recordValue(record, worst)} to the record, ${recordValue(record, best)}. Better is to the right.`,
  }
}

const GROUP_ORDER: Record<RecordKind, number> = { streaks: 0, run: 1, clock: 2 }

/**
 * The records beside this one in its book: its neighbours on the clock, or
 * the rest of its group, made up to five from the book's other records.
 */
export function nearbyRecords(record: Rec, book: RecordSummary[]): RecordSummary[] {
  const kind = recordKind(record)
  const group = book.filter((r) => recordKind(r) === kind)
  const at = group.findIndex((r) => r.id === record.id)
  let near = kind === 'clock' && at >= 0 ? group.slice(Math.max(0, at - 2), at + 3) : group
  if (near.length < 5) {
    const rest = book
      .filter((r) => !near.includes(r))
      .sort((a, b) => GROUP_ORDER[recordKind(a)] - GROUP_ORDER[recordKind(b)])
    near = [...near, ...rest.slice(0, 5 - near.length)]
  }
  return near
}
