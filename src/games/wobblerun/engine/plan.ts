/**
 * Choosing each day's gauntlet (design-final §4.1, §4.4, §4.6), for the plan script (scripts/wobblerun-daily.mjs)
 * only: the browser never runs any of this, it lays the plan's rounds (dailyPlan.ts `k`) with plannedCourse.
 *
 * pickRounds chooses a day's rounds by the slot rules (an opener from the time-it rounds and Fruit Chute, always
 * T1; then footing-or-flying, timing-or-dodging, footing-or-flying; then the finale) at the weekday's heat, and the
 * variety rules over the days before it. firstGoodCourse lays tries of those rounds until one passes the checks
 * (validate): the blue bean runs it untouched in a fair time, the fast hands leave the medals room without going
 * under the API's floor, and the phone's noisy hands all get to the crown in fair time without being knocked about.
 *
 * A day is picked and laid by its generation (course.ts genOfDay: gen 1 before GEN2_FROM, gen 2 from it): its heat
 * comes from HEAT (gen 1) or HEAT2 (gen 2), and its rounds are laid by that generation's rules. The `gen` options
 * are for trials (a day picked and laid by rules it isn't planned with); left out, every day takes its own.
 */
import { BLUE_PACE, blueRun, fastRun, phoneRuns, type BotRun } from './bots.ts'
import { codeOf, courseName, dayOfN, genOfDay, plannedCourse, weekdayOf, type RoundSpec } from './course.ts'
import { gauntletName } from './names.ts'
import { makeRng } from './rng.ts'
import { ROUNDS } from './rounds/index.ts'
import type { Course, Gen, RoundDef, Tier } from './types.ts'

/** Each slot's heat by weekday, Sunday first (opener · R2 · R3 · R4 · finale): gen 1's days. */
export const HEAT: readonly (readonly Tier[])[] = [
  [1, 1, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 3, 2],
  [1, 2, 3, 3, 3],
]

/**
 * Gen 2's heat (the harder rounds with ups and downs), the same shape: a copy of HEAT until the gen-2 rounds are
 * tuned. It's what gen-2 days (course.ts GEN2_FROM on) and gen-2 trials pick their tiers from; gen 1's days keep
 * HEAT, so changing this never touches a day already planned at gen 1.
 */
export const HEAT2: readonly (readonly Tier[])[] = [
  [1, 1, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 2, 3, 2],
  [1, 2, 3, 3, 3],
]

/** A generation's heat table. */
export function heatOf(gen: Gen): readonly (readonly Tier[])[] {
  return gen >= 2 ? HEAT2 : HEAT
}

/** The rounds that can open a gauntlet: the time-it rounds and Fruit Chute (no goo on the main way). */
const OPENERS = 'gbsf'
/** Touch-thing rounds are never next to each other. */
const TOUCHY = 'wx'
/**
 * A round type at most this many times in any 7 days. The spec's 3 (once all ten rounds are in) can't be kept:
 * every day takes two of the five timing-or-dodging rounds (the opener and R3) and two of the footing-or-flying
 * ones, 14 of each a week, so 3 apiece leaves one to spare and the days soon run out of rounds.
 */
export const MOST_IN_WEEK = 4
/**
 * The same round order (letters, tiers aside) not again within this many days, where any other order will do: a
 * preference, since phase 1's slot rules make only 72 orders, too few to keep 60 days apart and every other rule.
 */
const ORDER_DAYS = 60

/** A blue bean raced in this many seconds makes a fair gauntlet (design-final §4.3). */
export const PACE_FROM = 80
export const PACE_TO = 95
/**
 * The fast hands (gold lines, small margins, no reaction: about as quick as the gauntlet goes) must finish within
 * this share of the blue's raced time, so platinum (0.64 × blue) is there for a great run, and no quicker than
 * FAST_LEAST of it, so the API's floor (0.40 × the pace, in routes.ts and trackLaps.ts) stays under 0.85 × the
 * quickest run there is (design-final §5.3).
 */
export const FAST_MOST = 0.6
export const FAST_LEAST = 0.48
/**
 * The phone check (design-final §4.6): PHONE_SEEDS runs by the phone's hands (late, noisy, main edges only) all
 * finish within PHONE_MOST × the blue's raced time, with at most PHONE_HITS knocks and yeets and PHONE_SPLATS
 * splats at the median.
 */
export const PHONE_SEEDS = 20
export const PHONE_MOST = 1.6
export const PHONE_HITS = 2
export const PHONE_SPLATS = 1

export type PickOptions = {
  /** Stand-in rounds may be picked (until every round is built). */
  stubs?: boolean
  /** The phase 2 rounds, once they're built and wanted: Roll On in the deck; Slime Climb the finale on Tuesday, Thursday and Saturday (Crown Peak every day otherwise). */
  roll?: boolean
  slime?: boolean
  /** The rounds of our own (OURS, phase 2 until Ramsey approves them) in the deck too: the lab's test gauntlets. */
  ours?: boolean
  /** Rounds not to give, in any order (codes of a day whose every try of them failed its checks). */
  avoid?: readonly string[]
  /** The generation whose heat the tiers come from (the day's own, course.ts genOfDay, by default): for trials. */
  gen?: Gen
}

/** The rounds of our own (2026-10-09): Fizz Geysers, Piano Steps, Pinball Table, Candy Lifts, Blip Bounce, Sprinkle Drop. */
const OURS = 'vpketd'

/** A round may be picked once it's built (a phase 2 one only when asked for), or (with `stubs`) while it's a phase 1 stand-in. */
const pickable = (r: RoundDef, o: PickOptions) =>
  (r.phase === 1 || (r.letter === 'r' && !!o.roll) || (r.letter === 'S' && !!o.slime) || (OURS.includes(r.letter) && !!o.ours)) &&
  (!r.stub || (!!o.stubs && r.phase === 1))

function pool(letters: string, o: PickOptions): RoundDef[] {
  return ROUNDS.filter((r) => letters.includes(r.letter) && pickable(r, o))
}

/** A round order the slot rules allow, and how likely drawing it slot by slot is (each slot's rounds alike). */
type Order = { letters: string[]; odds: number }

/** Every round order the slot rules allow (before the finale), with its odds. */
function slotOrders(o: PickOptions): Order[] {
  const family = (l: string) => ROUNDS.find((r) => r.letter === l)!.family
  const fa = ROUNDS.filter((r) => (r.family === 'F' || r.family === 'A') && pickable(r, o)).map((r) => r.letter)
  const td = ROUNDS.filter((r) => (r.family === 'T' || r.family === 'D') && pickable(r, o)).map((r) => r.letter)
  const out: Order[] = []
  const each = (from: string[], order: string[], odds: number, then: (order: string[], odds: number) => void) => {
    const left = from.filter((l) => !order.includes(l))
    for (const l of left) then([...order, l], odds / left.length)
  }
  each(pool(OPENERS, o).map((r) => r.letter), [], 1, (a, p) =>
    each(fa, a, p, (b, q) => {
      // R3: timing or dodging, from the family the opener didn't use (Fruit Chute opens → a timing round).
      const r3 = td.filter((l) => family(l) !== family(b[0]!) && !b.includes(l))
      each(r3.length ? r3 : td, b, q, (c, s) => {
        // R4: footing or flying, the family R2 didn't use if there's one left.
        const r4 = fa.filter((l) => family(l) !== family(c[1]!) && !c.includes(l))
        each(r4.length ? r4 : fa, c, s, (d, u) => out.push({ letters: d, odds: u }))
      })
    }),
  )
  return out
}

/**
 * Day n's rounds, by the slot rules, the weekday's heat (its generation's: HEAT or HEAT2) and the variety rules over
 * `history` (the codes of the days before it, oldest first). Every order the slot rules allow is weighed as likely
 * as drawing it slot by slot, the ones the rules rule out are dropped, and the day's own seed draws one of the rest,
 * preferring an order not seen for ORDER_DAYS days, else the one seen longest ago. Deterministic: the same day and
 * history give the same rounds.
 */
export function pickRounds(n: number, history: readonly string[], o: PickOptions = {}): string {
  const day = dayOfN(n)
  const wk = weekdayOf(day)
  const heat = heatOf(o.gen ?? genOfDay(n))[wk]!
  const rng = makeRng(`wobble:pick:${day}`)
  const lettersOf = (k: string) => [...k.matchAll(/([A-Za-z])[123]/g)].map((m) => m[1]!)
  const week = history.slice(-6).map(lettersOf)
  const yesterday = history.length ? lettersOf(history[history.length - 1]!) : []
  const finale = (wk === 2 || wk === 4 || wk === 6) && pool('S', o).length ? 'S' : 'C'
  const codeFor = (letters: string[]) => codeOf([...letters, finale].map((letter, i) => ({ letter, tier: heat[i]! }) as RoundSpec))
  // How many days ago each order was last run (Infinity: not in ORDER_DAYS).
  const ago = new Map<string, number>()
  history.slice(-ORDER_DAYS).forEach((k, i, recent) => ago.set(lettersOf(k).slice(0, -1).join(''), recent.length - i))
  // Rounds that failed are as long in any order at the same tiers (Spin Club T1, Hit Parade, Hex Drop and Lily
  // Leapers T2 are short every way round).
  const setOf = (k: string) => [...k.matchAll(/[A-Za-z][123]/g)].map((m) => m[0]).sort().join('')
  const avoid = new Set((o.avoid ?? []).map(setOf))
  const rules = [
    (l: string[]) => l[0] !== yesterday[0],
    (l: string[]) => ![...l, finale].some((x, i, all) => i > 0 && TOUCHY.includes(x) && TOUCHY.includes(all[i - 1]!)),
    (l: string[]) => !l.some((x) => week.filter((d) => d.includes(x)).length + 1 > MOST_IN_WEEK),
    (l: string[]) => !avoid.has(setOf(codeFor(l))),
  ]
  const all = slotOrders(o).filter((ord) => rules.every((rule) => rule(ord.letters)))
  if (!all.length) throw new Error(`Wobble Run: no rounds for #${n} (${day})`)
  const since = (ord: Order) => ago.get(ord.letters.join('')) ?? Infinity
  const longest = Math.max(...all.map(since))
  const fresh = all.filter((ord) => since(ord) === longest || since(ord) === Infinity)
  let r = rng() * fresh.reduce((sum, ord) => sum + ord.odds, 0)
  for (const ord of fresh) {
    r -= ord.odds
    if (r <= 0) return codeFor(ord.letters)
  }
  return codeFor(fresh[fresh.length - 1]!.letters)
}

/** No name again within this many days (there are 168 names, so not all 180 days can have one of their own). */
export const NAME_DAYS = 120

/**
 * Day n's name: its try's own (courseName), or if one of the last NAME_DAYS days before it (`before`, oldest first)
 * had that, the first drawn after it that none of them had. The name is only a name: the course is laid the same.
 */
export function dayName(n: number, attempt: number, before: readonly string[]): string {
  const recent = new Set(before.slice(-NAME_DAYS))
  let name = courseName(n, attempt)
  for (let j = 1; recent.has(name) && j < 500; j++) name = gauntletName(makeRng(`wobble:name:${dayOfN(n)}:${attempt}:${j}`))
  return name
}

/** What the phone check found: the slowest and the middle run (Infinity for one that never got there), and the middle counts. */
export type PhoneCheck = { worst: number; median: number; hits: number; splats: number; bonks: number }

/** What the checks found of a try (fast and phone only once the checks before them passed). */
export type Checked = { ok: boolean; why: string; blue: BotRun; pace: number; fast?: BotRun; phone?: PhoneCheck }

/** What the plan keeps of a day: the try, the course it laid, and what its checks found. */
export type GoodCourse = Checked & { course: Course; attempt: number }

export type CheckOptions = {
  /** The blue's raced time must be within these, s (PACE_FROM, PACE_TO). */
  from?: number
  to?: number
  /** Leave out the fast hands' check, the phone's, or run the phone's with this many seeds. */
  fast?: boolean
  phone?: boolean
  seeds?: number
}

const middle = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]!
}

/** The phone check's runs, summed up. */
export function phoneCheck(course: Course, seeds = PHONE_SEEDS): PhoneCheck {
  const runs = phoneRuns(course, seeds)
  const times = runs.map((r) => (r.finished ? r.time : Infinity))
  return {
    worst: Math.max(...times),
    median: middle(times),
    hits: middle(runs.map((r) => r.counts.knocks + r.counts.yeets)),
    splats: middle(runs.map((r) => r.counts.splats)),
    bonks: middle(runs.map((r) => r.counts.bonks)),
  }
}

/**
 * Whether a try makes a fair gauntlet: the blue bean runs it untouched, raced in `from` to `to` s; the fast hands
 * finish in FAST_LEAST to FAST_MOST of that; the phone's hands all finish within PHONE_MOST of it, knocked and
 * splatted no more than PHONE_HITS and PHONE_SPLATS times at the median. The cheap checks go first.
 */
export function validate(course: Course, o: CheckOptions = {}): Checked {
  const from = o.from ?? PACE_FROM
  const to = o.to ?? PACE_TO
  const blue = blueRun(course)
  const pace = Math.round(blue.time * BLUE_PACE * 1000)
  const no = (why: string, more: Partial<Checked> = {}): Checked => ({ ok: false, why, blue, pace, ...more })
  if (!blue.finished) return no('the blue bean found no way to the crown')
  if (blue.touched) return no('the blue bean was touched')
  const raced = pace / 1000
  if (raced < from || raced > to) return no(`the blue bean's raced time ${raced.toFixed(2)} s is outside ${from}–${to} s`)
  let fast: BotRun | undefined
  if (o.fast !== false) {
    fast = fastRun(course)
    if (!fast.finished) return no('the fast hands found no way to the crown', { fast })
    const r = fast.time / raced
    if (r > FAST_MOST || r < FAST_LEAST) return no(`the fast hands took ${r.toFixed(3)} × the blue, outside ${FAST_LEAST}–${FAST_MOST}`, { fast })
  }
  let phone: PhoneCheck | undefined
  if (o.phone !== false) {
    phone = phoneCheck(course, o.seeds)
    if (phone.worst > PHONE_MOST * raced) return no(`a phone run took ${(phone.worst / raced).toFixed(2)} × the blue`, { fast, phone })
    if (phone.hits > PHONE_HITS) return no(`the phone runs were knocked ${phone.hits} times at the median`, { fast, phone })
    if (phone.splats > PHONE_SPLATS) return no(`the phone runs splatted ${phone.splats} times at the median`, { fast, phone })
  }
  return { ok: true, why: '', blue, pace, fast, phone }
}

/**
 * Rounds whose first this-many tries never had the blue in a fair time aren't tried further: some sets of rounds
 * are all short (Spin Club, Hex Drop, Hit Parade and Lily Leapers together come to 71–77 s however they're laid).
 */
const PACE_GIVE_UP = 10

/**
 * Day n's gauntlet with rounds `k`: the first try that passes the checks, or why the last one didn't (`unpaced`:
 * no try had the blue in a fair time, so these rounds at these tiers are no good on any day). Each try is laid by
 * the day's own generation (course.ts genOfDay), or `gen` for a trial.
 */
export function firstGoodCourse(n: number, k: string, o: CheckOptions & { tries?: number; gen?: Gen } = {}): GoodCourse | { why: string; tried: number; unpaced: boolean } {
  let last = ''
  let paced = false
  const tries = o.tries ?? 40
  const from = o.from ?? PACE_FROM
  const to = o.to ?? PACE_TO
  const gen = o.gen ?? genOfDay(n)
  for (let attempt = 0; attempt < tries; attempt++) {
    const course = plannedCourse(n, attempt, k, undefined, gen)
    const v = validate(course, o)
    if (v.ok) return { ...v, course, attempt }
    last = v.why
    if (v.blue.finished && !v.blue.touched && v.pace >= from * 1000 && v.pace <= to * 1000) paced = true
    if (!paced && attempt + 1 >= PACE_GIVE_UP) return { why: `${last}, and every try's so far`, tried: attempt + 1, unpaced: true }
  }
  return { why: last, tried: tries, unpaced: !paced }
}
