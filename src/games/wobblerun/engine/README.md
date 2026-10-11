# Wobble Run engine

The physics, the course builder, the rounds, the bots and the lab, as Node-runnable TypeScript (erasable syntax,
`.ts` imports, no DOM or three). The scene, the shell, the site and the plan script all build on what's here.
The game's spec is `design-final.md`; the build contract (names, formats, who owns what) overrides it where they
differ.

| File | What it is |
|---|---|
| `types.ts` | Every shape the others share. Types only: safe to import anywhere. |
| `sim.ts` | Constants, closed-form motions and telegraphs, poses, the broad phase, runs, `step()`. |
| `course.ts` | Laying a gauntlet: `plannedCourse(n, a, k)`, `courseFromCode(k, seed)`, `assemble`, themes, day numbers. |
| `rounds/index.ts` | The round registry, by letter. |
| `rounds/kit.ts` | The builders' kit. |
| `rounds/pads.ts` | Start pad + start slide, checkpoint pads, the slide down, the bounce-up; gen 2's connectors (ramp, stairs, slide down, drop, lift, bounce-up). |
| `rounds/<round>.ts` | One module per round (see "Rounds" for who owns which). |
| `rounds/stub.ts` | The safe stand-in a round lays until it's built. |
| `bots.ts` | Route graph walking: the edge executor, BLUE / FAST / PHONE / NAIVE hands, route strings, the autopilot. |
| `plan.ts` | The plan script's helpers: `pickRounds`, `validate`, `firstGoodCourse`, `HEAT` / `HEAT2`. Never runs in the browser. |
| `lab.ts` | The admin test lab's courses: every built round at T1, T2, T3 (`labCourse`), one round alone (`soloCourse`, timed by `roundTimer`), a day-style test gauntlet (`testGauntlet`), the picker's rounds (`labRounds`). |
| `rng.ts`, `names.ts` | Seeded randomness (string seeds); gauntlet names (ADJ + NOUN). |

Node runs any of it directly: `import { plannedCourse } from '../src/games/wobblerun/engine/course.ts'`.

## Ground rules

- **Units and axes**: metres, seconds, m/s, radians. x across the track (screen right is −x), y up, z down the
  course; the camera always looks +z.
- **Yaw is three.js `rotation.y`** everywhere (solids, hazards, decos, the bean): yaw θ turns local +x to
  (cos θ, 0, −sin θ) and local +z to (sin θ, 0, cos θ). The bean faces local +z, so its yaw is
  `atan2(vx, vz)`.
- **The clock** `run.t` is 0 at GO, negative in the countdown, and always `(steps − go) × STEP` (exactly 0 at GO).
  `STEP` is 1/120 s.
- **Clock things** (doors, bars, gloves, fans, fruit, moving pads) are pure functions of `t`. **Touch things**
  (crumbling tiles, see-saw planks, the slime) answer the player's bean only, live in `run.world`, and reset when
  the bean respawns into their round or an earlier one. Nothing in the engine uses `Math.random`.
- **Pushes are carries** (design-final §3.0): platforms, belts, see-saw slides, wind, hoops and bounce-pad
  throws move the bean as carries, never as accelerations, so the 62 m/s² run controller can't cancel them.
- **Never change anything a played day depends on.** A course is laid from its code, its day and its try, through
  every builder and every physics constant here. New rules go in behind a generation (below), which a day's number
  fixes; a planned day's stored blue route must keep replaying to the millisecond.

## Generations

A course's generation (`types.ts Gen`) is the set of rules it's laid by: **1** is every round, pad and connector as
the first planned days were laid; **2** is the harder rounds with ups and downs. It reaches every builder in its slot
(`slot.gen`, also `k.gen` on the kit; a slot made by hand without one counts as 1), the pads and connectors in their
kits (`startPiece(rng, gen)`, `checkPiece(i, gen)`, `slidePiece(drop, rng, gen)`, `bounceUpPiece(gen)`), and the
course keeps it (`course.gen`).

| Who lays | Generation |
|---|---|
| `plannedCourse(n, a, k)` (the game, the plan) | the day's own, `genOfDay(n)`: 2 from `GEN2_FROM` on, else 1 (`GEN2_FROM` is null: every day is 1) |
| `courseFromCode(k, seed, name, gen?)`, `labCourse({ gen })`, `soloCourse(l, t, { gen })`, `testGauntlet(n, gen?)` | `gen`, the newest (`LATEST_GEN`, 2) when left out, so the lab and test courses show the new rules |
| `scripts/wobblerun-daily.mjs` | each day by its own; `trial <n> [days] [gen]` and `show <n> <gen>` by another, writing nothing |

From gen 2 a gauntlet also has ups and downs between its rounds (below), laid by `assemble` (`AssembleOpts.ups`, on
from gen 2); a solo course keeps gen 1's joins at any generation, so it differs between generations only where its
round does.

Writing a gen-2 rule:

```ts
build(slot, rng, tier) {
  const k = kit(slot, tier)
  const gaps = byGen(k.gen, [2.4, 3.0])        // kit.ts byGen: gen 1's value first; a later gen takes the last
  if (k.gen >= 2) { /* ramps, steps, a new hazard … */ }
}
```

- **Gen 1 lays exactly what it always has**, bit for bit: the same solids, hazards, route graph and rng draws in the
  same order. Put every new `rng` draw inside a `gen >= 2` branch (or after all of gen 1's), and never change a
  shared helper, a kit default or a sim.ts constant in a way gen 1 would see. Check with the scratchpad's
  `replay-all.mjs`: `replayed 180, bad 0, worst diff 0 ms`.
- A builder that never reads `gen` lays the same at every generation.
- Turning it on: once Ramsey says yes, set `course.ts GEN2_FROM` to a day nobody has played and run
  `node scripts/wobblerun-daily.mjs replan <GEN2_FROM>`: the days from it are picked with `plan.ts HEAT2` (gen 2's
  heat, a copy of `HEAT` for now) and laid at gen 2, and every day before it stays as it is. Before then,
  `trial <n> [days]` picks and checks gen-2 days without writing anything.
- A third generation is a new number in `Gen`, a `GEN3_FROM` and a line in `genOfDay`.

## Ups and downs (gen 2)

Gen 1 is flat between rounds (a slide only after a round ending 3 m up, a bounce-up when one would start 2 m down).
From gen 2 every gauntlet has an elevation profile, Fall Guys style: it climbs toward its finale with a big way down
in the middle. `assemble` lays it (course.ts `profileOf`, `connectorFor`), from the course's own stream
(`seed + ':ups'` for the plan, `seed + ':ups:' + g` for each gap's pieces), and only inside gen ≥ 2 branches.

- **Where**: between each round and the next, one connector, straight after the round (its `out` node stands on the
  connector's 2 m lead), then the checkpoint pad as ever: the checkpoint is always the next round's flat pad before,
  at the next round's height, and the centreline shift across it is gen 1's. Nothing a connector does can lose you
  anything: walls the whole way, no gap anywhere, at worst a wait (a fall is impossible, so where the respawn is
  doesn't matter).
- **The plan** (`profileOf`): most gaps climb 2–3.5 m from the round before's base; one in a day's middle (the gap
  before round 2 or 3, drawn; every third on a longer course; never the gap into the finale) is the **plunge**, 3–5 m
  down from wherever the round ended, a slide (60%) or a 3 m drop (40%). So a day goes 0 → up → up → down → up into
  the finale, or 0 → up → down → up → up.
- **Any exit height**: a round can end higher or lower than it starts (`k.done({ x, y, z })`; gen 2's Wall Rush,
  Melon Hill, Piano Steps and Pinball Table end 2–6 m up). The connector takes the course from the round's exit to
  the height wanted: a round ending 4 m up before a 2.5 m climb gets a 1.5 m drop after it; one that overshot by less
  than 1.4 m keeps its height (no stairs down straight after a climb).
- **The band**: a round's base stays within −1.5 … 6.5 m (7.5 for the finale's; Star Peak climbs ~10 m on from
  there), a connector climbs at most 4 m and comes down at most 6, and within 0.6 m the rounds just meet. The soda sea
  stays 9 m under the lowest solid (`course.gooY`), as ever; every connector's own landing has its own splat height
  6 m under it.

| Connector (pads.ts) | When | What | Route |
|---|---|---|---|
| `rampPiece(rise, rng)` | 1.6–3.4 m up (or down) | TILT floor at 14–16° (6–12 m), a 2 m lead, a short landing, white lines at its foot and brow; a long one going up (≥ 8 m) has a boost hoop off to one side half way up | `a`, `b` (passed through); gold: through the hoop (`via`) |
| `stairsPiece(rise, rng)` | up to 4 m up; 0.6–1.4 m down | steps ≤ 0.42 m up (the step-up is 0.5) or ≤ 0.3 m down (within the 0.3 m the bean keeps to the floor by), treads 0.8–1.0 m, every step's body down below the lowest floor | none: the way on runs straight up them |
| `slideDownPiece(drop, rng)` | 2.5–6 m down, and the slide plunge | gen 1's slick chute at 15–18° (steeper the further), 1 hoop or 2 on a long one, a 2 m landing at the top, straight onto the pad below | `top` (passed through); the way on runs or (gold) belly slides |
| `dropPiece(drop)` | 1.4–2.5 m down, and the drop plunge (3 m) | a 2.5 m deck ending in a cliff face, a white line at its edge, the full-width pad below 5 m long before the checkpoint pad's 6 (a run off lands 2–3 m out, a jump 6–7 m); from the deck the camera sees the pad's far end and the checkpoint's flags, not its foot | none: the way on runs off the edge |
| `bouncePiece(rise)` | 2.5–3.5 m up | gen 1's teal pad (vy 15, aimed) after a 2 m lead, onto a 3.5 m pad; floor up to the upper pad's face (gen 1's leaves a gap there), so walking past the pad meets a wall | `low`, `high` (both passed through), a `bounce` edge |
| `liftPiece(rise, rng)` | 2.8–3.5 m up, never into the finale | twin lifts, each 4.25 m wide with a tall rail between them, half a turn apart (one is down or on its way while the other is up): platform columns (look `lift`: Candy Lifts' candy lift) rising on the clock (`liftAt`: 1 s at the bottom, 1.8 s up, 1.2 s at the top, 1.6 s down, eased; 2.9 m/s at most, ledge off) with a telegraph (`liftTele`: warn 0.6 s before one moves off); tall rails up the shaft | `low` (passed), `left` / `right` (on a lift: a bot waits there), `top`; gold: jump on early from a take-off spot, jump off early |

Climbs are weighed ramp 3 : stairs 3 : bounce-up 2 : lift 1 (where each fits), never the last climb's kind again
when there's another. Each piece is laid in its own frame and placed as a round is; the course joins its route in at
its first node and on from the one furthest along (none: the way on crosses it). `course.pieces` gets its kind
(`ramp`, `stairs`, `slide`, `drop`, `bounce-up`, `lift`), z range, start height and camera (`climb` on lifts, `slide`
on a slide).

What it costs (planned days' rounds at gen 2, with and without ups and downs, 2026-10-09): the blue +4.1 s a day,
the fast hands +4.4 s, fast ÷ blue 0.550 → 0.574. Each connector costs the blue 1.1–2.8 s (lifts 2.4–4.7), the fast
hands 0.7–2.3 (lifts 1.4–4.0). It's less than the connectors' own time because gen 1's joins at gen 2 already slide
all the way down after every round that ends high. See the gen-2 requests for the pace window.

## For the scene

A `Course` (types.ts) is flat arrays the scene builds once and poses each frame:

| Array | Each item | Pose it each frame with |
|---|---|---|
| `course.solids` | something to stand on or bump: `box` (hx × hz, turned by yaw) or `cyl` (r, `sides` to draw: 6 is a hex tile); top at `y` at its centre, sloped by `pitch` (rising toward local +z) and `roll` (rising toward local +x); body `2·hy` deep below the top | `solidPose(course, run.world, i, t, pose)` (`run.world` null on the menu) |
| `course.hazards` | something that hits: `sphere` (r), `post` (r, from its body's y up `h`), `box` (hx, hy, hz, centred), `bar` (a capsule of radius r along its yaw's local x, `len` each way) | `hazardBodies(h, t, bodies)`: returns how many bodies (path hazards like fruit and boulders have several live at once); each body has x, y, z, yaw, `on`, `hy` (≥ 0: a half height in place of the hazard's) |
| `course.volumes` | `wind` (box, `duty(t)` 0–1), `hoop` (ring of radius r, facing `dir`), `crown` (sphere r), `slime` | crown: `crownAt(v, t, out)`; wind: `v.duty(t)`; slime: `slimeY(run)` (NaN until it starts) |
| `course.decos` | dressing with no collision: x, y, z, yaw, size sx × sy × sz, `params`, maybe `ref` to the solid / hazard / volume whose telegraph drives it | static, or from its ref's `tele` |

- **Static or not**: a solid with no `move` and no `touch` never moves: merge those per round. Moving solids and
  touch things (`touch.kind` 'tile' / 'plank') are posed each frame. `pose.crack` is a tile's 0–1 state (pastel →
  amber → red, shake); `pose.on` false means it's gone (a dropped tile falls, posed below its place).
- **Culling**: every solid, hazard and volume has `z0`/`z1`, the z it can ever reach. `course.rounds[i]` and
  `course.pieces` give each stretch's z range (draw the current round ± 1). Every item has `round` (pads belong to
  the round after them).
- **Telegraphs**: `teleOf(thing, t)` → `{ state: 'rest' | 'warn' | 'act' | 'hold' | 'back', u }` for any solid,
  hazard or wind volume (rest for things without one). A door: rest = open (green), warn = closing soon (blinking
  amber, judder), act = slamming, hold = shut (red), back = rising. A glove: warn = the 0.6 s wind-up. A fan: warn
  = spin-up, act = blowing. A cannon or chute (`releaseTele`): warn for 0.8 s before each release. A pendulum
  stripe: warn as the head comes down, act while it's low. Lamps, cannons, chutes and fans are decos with a
  `ref` to their thing.
- **Pendulums**: the hazard's anchor (`h.x, h.y, h.z`) is the pivot; draw the arm from it to the body.
- **Boulders, fruit**: a path hazard's body `yaw` is a rolling angle the builder chose (boulders: distance / r).
- **Gold**: `gold: true` on solids (gold frames, gold pads) means the gold edge and sparkle.
- **Checkpoint flags**: decos `flag` with `params.checkpoint = k` (the k-th checkpoint, 1-based) turn green
  once `run.splits.length ≥ k`. `stripe` decos with the same param are the flag lines.
- **Theme**: `course.theme` (weekday, design-final §4.5): `floors[tint]` / `bodies[tint]` for anything with
  `tint ≥ 0`, `goo`, `night` (Neon Night: night in either site theme), `perRound` (Big Show), `scenery`.
  `course.gooY` is where the goo plane goes (9 m below the lowest floor), drawn as the teal soda sea.
- **Camera**: `cameraAt(course, z)` → 'default' | 'wide' | 'climb' | 'slide' (blend over 0.8 s).

### Looks

Every solid, hazard, volume and deco has a `look` and a `role`. The role is the colour code (design-final
§1.5), the same in every theme: `jump` orange #f2813a up-chevrons, `dive` violet #8a6ad4 down-chevrons, `dodge`
red #e8564f white bands, `bouncy` teal #3ec8cf dots, `helps` green #3ecf8e forward chevrons, `pushes` indigo
#6b74e8 arrows, `warn` amber flash, `gold` #f4c53e edge strip, `check` white, `jelly` translucent (0.55) on a solid
frame, `floor` the theme's pastel, `deco` scenery. A look the scene doesn't know yet is drawn by its shape and
role, so a round can use a new look before the scene has one; tell the scene engineer about it.

| Look | On | Draws | Reads |
|---|---|---|---|
| `floor`, `pad`, `terrace`, `island`, `summit`, `basement` | solid | pastel top slab on a mid-tone body | tint, size, pitch/roll |
| `start-pad`, `check-pad` | solid | white pad | size |
| `slide` | solid (slick) | glossy chute, stripes down the fall line | pitch |
| `belt` | solid (`belt`) | indigo arrows scrolling with `solid.belt` (local frame) | belt |
| `plank` | solid (plank touch) | long candy plank, bright pivot stripe along local z; low side glows amber past 8° | pose.roll |
| `tile`, `tile-star` | solid (cyl, sides 6) | hex tile; star: white with a star, never drops | pose.crack, pose.on |
| `pad-lily`, `pad-gold` | solid (cyl) | lily pad; gold-rimmed small pad | r, motion |
| `drum`, `disc`, `turntable` | solid | Roll On drum; sweeper stage disc; spinning disc with stripes and arrows | pose.yaw |
| `rail`, `fence`, `divider` | solid (noGround) | low walls | size |
| `cushion` | solid | teal bumper rail (Big Fans) | size |
| `barrier` | solid | the start's jelly barrier (sinks at GO) | pose |
| `frame`, `header` | solid | door posts and header (gold frames when `gold`) | size |
| `door` | solid (door) | jelly door | pose.y, tele (its lamp) |
| `wall-jelly` | hazard (box) | Block Party wall piece, gold-outlined cut-outs | body, hy |
| `tooth`, `tooth-tall` | solid | Roll On fence teeth (orange hurdle / jelly) | pose.on |
| `bar-low`, `bar-high` | hazard (bar) | sweeper bars, white caps, hop/duck icons | body.yaw, len |
| `hub`, `bumper` | hazard (post) | yellow hub; teal mushroom bumper | r, h |
| `pendulum` | hazard (sphere) | red ball with white band, arm to the anchor | anchor, body |
| `glove`, `glove-low`, `glove-high` | hazard (box) | boxing glove block (red / orange / violet), face flashes white in the wind-up | body, tele |
| `fruit-melon`, `fruit-orange`, `banana` | hazard (sphere / sphere / bar) | fruit | body |
| `boulder`, `gumball` | hazard (sphere) | striped boulder (rolls by body.yaw); gumball | body |
| `bounce` | solid (bounce) | teal pad | — |
| `launch-pad` | solid (bounce with `lit`) | grey, green while `solid.bounce.lit(t)` | lit |
| `wind` | volume | streaks while duty > 0 | duty |
| `fan` | deco (ref wind) | fan on a pylon, blades blur in the spin-up | ref tele |
| `hoop` | volume | green boost ring | r, dir |
| `crown` | volume | the Blip star (players never see a crown: the trigger keeps the name), bobbing: a mint five-point star, a lighter star inside, the glowing white blip at its centre, a soft mint glow | crownAt |
| `slime` | volume | the soda sea rising up Tide Tower: teal, fizzing | slimeY(run) |
| `flag` | deco | checkpoint / start flag (amber → green) | params.checkpoint / start |
| `stripe` | deco | painted floor line (a checkpoint's flag line) | params |
| `gold-edge`, `gold-flag` | deco | gold strip; crown flag at a gold line's entry | — |
| `lamp` | deco (ref door) | lamp over a door | ref tele |
| `arch` | deco | arch over the track (`params.text`: a stand-in round's name) | params |
| `cannon`, `chute` | deco (ref hazard) | fruit cannon (swells and glows in warn); boulder chute (light in warn) | ref tele |
| `gantry`, `pillar`, `pylon`, `pedestal`, `arrow`, `lip` | deco | dressing (arrow: painted indigo arrow, `params.dir`) | size, params |

## For the shell

```ts
import { newRun, step, GHOST_RATE } from './engine/sim.ts'
import { plannedCourse, roundAt } from './engine/course.ts'

const course = plannedCourse(n, plan.a, plan.k, plan.name)
const run = newRun(course, { ghost: true, cues: true })   // 3 s countdown: run.t starts at −3
// each fixed step:
step(run, { x, y, jump, dive })                           // stick x right / y forward in [−1, 1]; presses
for (const e of run.ev) …                                 // this step's events
```

- **Input**: `x` right, `y` forward (stick up), each −1..1 (the engine clamps the length to 1). `jump` / `dive`
  are presses: true only on the step the key or button went down (the engine buffers them 0.15 s, with 0.12 s of
  coyote time). Input is ignored before GO (the bean waits behind the barrier), while splatted, and once done.
- **State**: `run.bean` has x, y, z, yaw, its own velocity (vx, vy, vz; carries are apart: gcx/gcz from the floor,
  acx/acz from the air), `ground` (solid index or −1), `diving`, `slide` (belly slide time left), `stun`,
  `yeet`, `dead` (> 0 while splatted), `ledge` (a ledge catch's pop-up), `air`, `landV` (the last landing's
  speed, for squash), `spawn`. `prone(bean)` says it's 0.84 m tall (diving or belly sliding).
- **Where it is**: `course.spawns[run.bean.spawn]` is the last checkpoint or flag reached; `roundAt(course, z)`
  is the round index (−1 on the start, a pad or a slide) for "Round 2 · Pad Hop" (`course.rounds[i].name`).
- **Splits and finish**: `run.splits` gets each checkpoint's flag-line crossing (interpolated inside the step),
  then the crown's touch; `course.splitCount` is how many a finished run has (5 on a day). `run.done` and
  `run.time` (the crown's touch, interpolated inside the step) end the run; keep stepping for the celebration
  (input is ignored). The clock never stops and never gets anything added: a splat costs real time only.
- **Respawning** is automatic: 0.75 s after the bean falls below its stretch's splat height (`deathY`), it drops
  in 3 m above its spawn. Restart = a new run.
- **Ghost**: with `ghost: true`, `run.ghost` gets `x, y, z, state` (`GHOST_STRIDE` 4) every 6 steps from GO
  (`GHOST_RATE` 20/s), the finish moment last. State: 0 grounded, 1 air or dive, 2 respawning, 3 stunned. The
  contract sends every other sample (10 Hz), the finish last.
- **Counts**: `run.counts` (splats, knocks, bonks, yeets, close calls, ledges, bounces, perfect bounces, hoops)
  for the run report; `run.touched` is true once anything hit it.

### Events (`run.ev`, refilled each step; empty when `quiet`)

`{ k, x, y, z, i, v }`: x, y, z is the bean (a cue's or a dropping tile's is its thing's).

| k | When | i / v |
|---|---|---|
| `go` | the step GO comes | |
| `jump`, `dive`, `bellyHop` | it jumps, dives, hops off a belly slide | |
| `land` | it lands | i solid, v landing speed |
| `slide` | a dive lands into a belly slide | i solid |
| `bonk`, `knock`, `yeet` | a hazard (or a closing door: `bonk`) hits it | i hazard (a door's solid for a door bonk) |
| `closeCall` | a hazard passes within 0.35 m at over 4 m/s (one per 1.5 s) | i hazard, v speed |
| `ledge` | it catches a ledge ("Phew!") | i solid |
| `bounce`, `perfectBounce` | a bounce pad throws it | i solid |
| `hoop` | through a boost hoop | i volume |
| `tileCrack`, `tileDrop` | a tile is touched; drops | i solid |
| `fall` | it fell below its splat height (or the slime caught it) | |
| `splat` | it reached the goo (or 0.6 s after falling) | |
| `respawn` | it drops in again | i spawn |
| `checkpoint` | across a checkpoint's line | i spawn, v split time |
| `flag` | a mid flag reached | i spawn |
| `crown` | the crown touched: the run is done | i volume, v time |
| `cue` | (with `cues: true`) a telegraph near the bean changes phase | `what` 'solid' / 'hazard' / 'volume', i, `look`, `state` |

Cues are the sound's second telegraph: a door going `warn` (ding-ding), a glove going `warn` (rattle), a cannon or
chute going `warn` (thoomp, thunk), a fan going `warn` (whine). Pan them by the event's x.

### The blue bean

The plan keeps each day's blue route (blueRoutes.ts: one string a day, as `encodeRoute` makes it). In the game:

```ts
import { replayBlue } from './engine/bots.ts'
const blue = replayBlue(course, BLUE_ROUTES[n - 1])   // { finished, time, splits, ghost } in one pass (~20 ms)
```

`blue.ghost` is a ghost path like a player's. Its time is the hands' time, and the plan's `pace` is that time ×
`BLUE_PACE`, which is 1 and stays 1: the blue timed itself to every door and pendulum on its way, so racing it
quicker or slower would put it out of step with them. `standIn` to the plan's pace (as Swoop does) then changes
nothing unless the engine has changed since the plan.

The blue is slow because it's careful, not because it's stretched: it stops at every safe spot (`brake`) and looks
round there for 0.4 s (`BLUE_HANDS.dwell`) before it goes on, and once it has had to wait for a way it sets off a
reaction (0.35 s) after the way opens, and only if the way is still open then.

**Route strings**: one step per safe node the blue left, comma-separated: the segment's index there (base 36),
then `:wait` (base 36, in 30ths of a second) if it waited. "0,1,0:c,2" = segment 0, segment 1, wait 12/30 s then
segment 0, segment 2. Segments are the ways out of a safe node through any `no`-wait nodes, numbered in the
graph's own order (`segmentsFrom`), so a route only means something on the course it was planned on.

### The dev autopilot

```ts
import { liveHands, FAST_HANDS } from './engine/bots.ts'
const auto = liveHands(course, FAST_HANDS)   // or BLUE_HANDS
step(run, auto.input(run))                   // instead of the player's input
```

It chooses at each safe node by trying each way on a copy of the run (a few ms), and gets back on its route from
wherever a splat drops it. It can take over mid-run.

## For the round builders

A round module exports `ROUND: RoundDef`:

```ts
export const ROUND: RoundDef = {
  letter: 'b', name: 'Wall Rush', hint: 'find the gap', family: 'T', phase: 1,
  build(slot, rng, tier, base) { const k = kit(slot, tier); …; return k.done({ x: 0, y: 0, z: len }) },
}
```

### Names players see

`name` and `hint` are display only: `assemble` copies them onto `course.rounds[i]` for the HUD, the cards and the
lab's start card, and nothing that lays, runs, seeds or plans a course reads them (seeds are the day, the try and the
slot; plan.ts works from letters). The modules keep the names they were built under (`gateCrash.ts` and so on, and
the names in this file's notes); players see their own names. The site's pictures and chips name them from
`gauntletPicture.ts ROUNDS`, which says the same.

| Letter | Module | Name | Hint |
|---|---|---|---|
| `g` | `gateCrash.ts` | Slam Doors | time the doors |
| `b` | `blockParty.ts` | Wall Rush | find the gap |
| `s` | `spinClub.ts` | Sweeper Spin | hop the bars |
| `h` | `hitParade.ts` | Bonk Alley | dodge the swings |
| `f` | `fruitChute.ts` | Melon Hill | climb the belt |
| `w` | `seeSaw.ts` | Tippy Planks | stay on the stripe |
| `x` | `hexDrop.ts` | Crumble Tiles | keep moving |
| `l` | `lilyLeapers.ts` | Pad Hop | hop the pads |
| `r` | `rollOn.ts` | Barrel Roll | run the barrels |
| `n` | `bigFans.ts` | Gust Gaps | wait out the wind |
| `C` | `crownPeak.ts` | Star Peak (finale) | grab the star |
| `S` | `slimeClimb.ts` | Tide Tower (finale) | beat the rising sea |

The runner players see is Blip (the engine's `run.bean`), the pace runner is "the blue blip", the `crown` trigger
at the top of a finale is drawn and named as the Blip star ("Star!", "Got the star"), and what you fall into (the
goo plane, and the `slime` volume rising up Tide Tower) is the teal soda sea, where a fall says "Fizz!". The engine
keeps its identifiers (`crown`, `slime`, `goo`, `splat`, `bean`) as they are.

Drop `stub: true` when it's built and the lab picks it up. Who builds what: Gate Crash (`gateCrash.ts`), Lily
Leapers (`lilyLeapers.ts`) and Crown Peak (`crownPeak.ts`) are the references, built; `blockParty.ts`,
`spinClub.ts`, `hitParade.ts`, `fruitChute.ts`, `seeSaw.ts`, `hexDrop.ts`, `bigFans.ts` (and maybe `rollOn.ts`,
`slimeClimb.ts`) are stand-ins for the round engineers to replace. **Don't edit sim.ts**: every feature the
rounds need is in it (below); ask the engine owner for anything missing.

### The frame and the slot

- Build in the round's own frame: z from its start edge (the pad before ends at z 0: 9 m wide, |x| ≤ 4.5, at
  y 0), x from its centreline, y from its base. The pad after starts at `exit` (return it from `k.done(exit)`).
  The course moves everything into place: static positions, aims, nodes, points. Motions are offsets, so they
  never need moving.
- `slot.period` is the round's base period (one of 2.9, 3.2, 3.4, 3.7, 4.1, 4.4 s, never shared within a course):
  time the round's main rhythm by it. `slot.i` is its place (0 the opener), `slot.finale` whether it ends at the
  crown, `rng` its own seeded randomness (only `rng`, never `Math.random`), `tier` 1–3, `slot.gen` (or `k.gen`)
  the course's generation: gate every new rule on it and leave gen 1 as it is ("Generations"). `base` is where the
  round's origin sits in the course (for interest only).
- Refer to solids by the index `k.box` / `k.cyl` return (nodes' and points' `on`, decos' refs); the course renumbers.

### The kit (`rounds/kit.ts`)

| Call | Makes |
|---|---|
| `k.box({ x, z, top, hx, hz, hy?, yaw?, pitch?, roll?, look?, role?, tint?, gold?, move?, tele?, ledge?, noGround?, door?, duck?, slick?, slip?, belt?, bounce?, touch? })` | a box solid (returns its index) |
| `k.cyl({ …, r, sides? })` | a disc solid |
| `k.floor(z0, z1, { hx = 4.5, top = 0, … })` | a flat floor |
| `k.ramp(z0, z1, y0, rise, { hx = 4.5, … })` | a TILT box from y0 to y0 + rise |
| `k.walls(z0, z1, { hx = 4.5, x, y, h = 1.0, rise, gaps: [[z0, z1]…], sides, look = 'rail' })` | side walls just outside a track hx half wide, never stood on |
| `k.hazard({ shape, x, y, z, yaw, r, h, hx, hy, hz, len, hit, move?, path?, tele?, look, role? })` | a hazard |
| `k.wind({ x, y, z, hx, hy, hz, carry, up?, duty, tele? })`, `k.hoop({ x, y, z, r?, dir?, boost?, dur? })`, `k.crown({ x, y, z, r?, bob })`, `k.slime({ z0, z1, depth, rate })` | volumes |
| `k.deco({ look, x, y, z, yaw, sx, sy, sz, role?, ref?, params? })` | dressing |
| `k.node(id, x, z, { y, wait = 'safe', on?, r? })`, `k.edge(from, to, move = 'run', { tier, window, takeoff, inset, via, diveAt, stick, maxT, dur })`, `k.at(x, y, z, on?)` | the route graph |
| `k.flag(x, z, node, y)` | a mid flag (respawn point; not a split) at a route node |
| `k.gold(name, z0, z1, x)` | names a gold line for the start card and the run report |
| `k.death(z0, z1, y)` | splat below y on that stretch (6 m below the base elsewhere) |
| `k.camera(preset)`, `k.done(exit)` | the camera; the finished round (checks the route) |
| `byTier(tier, [t1, t2, t3])` | a tier's value |

Defaults worth knowing: `hy` 0.6 (bodies 1.2 m deep); `ledge` on unless `noGround` or `door` (turn it off for
anything moving faster than 1.6 m/s); a floor's `tint` is the slot's; `role` comes from the look (`ROLE_OF`).

### Features and how to say them

| Round needs | Say it with |
|---|---|
| sliding / bobbing pad | `move: wave('x' \| 'y', a, T, ph)` (y-carry and higher jumps off rising pads are automatic) |
| spinning disc, turntable | `move: spin(w, ph)`; things riding it: `orbit(rho, a0, w)` with the same w (local start (rho·cos a0, −rho·sin a0)) |
| Gate Crash door | box with `door: true, duck: true, noGround: true, ledge: false, move: doorMove(spec), tele: doorTele(spec)`: the descending-door rule (pushed out along the door's z to the side the bean's centre is on, a bonk) |
| sweeper bar, low / high | hazard `shape: 'bar'`, y 0.40 (low, top 0.65) or 1.55 (high, underside 1.30), r 0.25, `len`, `move: spin(w, ph)`, `hit: knock(…)`; diving beans are 0.84 m tall to hazards |
| bumper, hub | hazard `shape: 'post'`, `hit: bonk(kn)` (bonks always, moving or not) |
| pendulum | hazard `shape: 'sphere'` at the pivot, `move: pendulumMove({ L, A, T, ph })`, `tele: pendulumTele(…)` |
| punching glove | hazard `shape: 'box'` at its rest place, `move: gloveMove({ T, ph, side, reach })` (wind-up 0.6, punch 0.12, hold 0.5, back 0.7), `tele: gloveTele(…)`, `hit: knock(6, 0.45, 5.5)`; a glove not moving toward you only shoves |
| Block Party wall | hazard boxes on `path: { P, ph, life, at(τ, k, o) }`, one path per layout piece (layout j of n repeats every n·P from t₀ + j·P); sink by lowering `o.y` and setting `o.hy`; `hit: yeet({ x: 0, y: 10, z: 0 }, 0.6)` (a yeeted bean sails over the walls until it lands) |
| fruit, boulders, gumballs | hazards on `path` (release k at ph + k·P, alive `life` s; `at` writes the body's offset from the anchor and `o.on = false` to hide); `tele: releaseTele(P, ph, 0.8)` on the cannon / chute |
| belt (also on a ramp) | `belt: { x, z }` in the solid's frame: `{ x: 0, z: -v }` runs toward the start |
| slide | `slick: true` on a ramp: belly slides don't run out on it and speed up to 14 m/s; `k.hoop` for boosts |
| see-saw plank | box with `touch: { kind: 'plank', k, max }` (rate 35°/s, back 12°/s, dead 0.35 m) and `slip: true` (slides you toward the low side past 8°); nodes on it `wait: 'no'`, edges `stick: 0.75` for the blue |
| crumbling tiles | cyl with `sides: 6, touch: { kind: 'tile', crumble }` (`star: true` never drops); reset on respawn into the round |
| bounce pad, launch pad, summit pad | solid with `bounce: { vy, perfectVy?, fwd?, perfectFwd?, aim?, perfectAim?, lit? }`; an aimed or forward throw is ballistic (no steering until it lands); a JUMP within 0.15 s before or 0.10 s after the touch is perfect |
| wind, fans | `k.wind` with `duty: fanDuty(spec)`, `tele: fanTele(spec)` (OFF, 0.7 s spin-up with no wind, BLOW, 0.4 s spin-down); `up` for the tail wind's lift (m/s², the one push that's an acceleration) |
| Roll On teeth | small solids with a `move` that wraps x round the drum and sets `o.on = false` while hidden |
| slime | `k.slime({ z0, z1, depth, rate })`: starts as the bean crosses the finale's checkpoint, restarts under any finale flag it respawns at (`k.flag` in a finale) |
| crown | `k.crown({ x, y, z, bob })` and a route node `crown` (the goal) |
| rails that keep knocks out of the goo | `k.walls(…, { gaps })` |

Hit presets: `bonk(kn = 6, pop = 2.5)`, `knock(kn = 6, kv = 0.6, pop = 5.5, vcap = 11)`, `yeet(fling, kv)`.

### The route graph (what the bots walk)

- Every round has a safe node `in` (on the pad before: `(0, 0, -1.5)`) and `out` (on the pad after:
  `(exit.x, exit.y, exit.z + 1.5)`); a finale has `crown` instead of `out`. The course joins them to the pads.
- `wait: 'safe'` means a bot may stop there (every wait is still simulated: a wait that gets touched is refused),
  `'no'` that it must pass straight through (tiles, see-saws). Branch at safe nodes: at a `no` node give the main
  way one edge on.
- `tier: 'main'` is the blue's way; `'gold'` is a gold line or an expert move. The blue takes only main edges.
- Moves: `run` (pure pursuit, through `via` spots); `jump` / `dive` / `lateDive` from `takeoff` (a spot, or
  `'edge'`: wherever the bean is `inset` m from the edge of what it stands on, heading for the target; good for
  moving pads); a lateDive dives when the dive would land it about 1.1 m short of the target (its belly slide carries it
  on) unless `diveAt` says; `bounce` / `perfectBounce` onto the pad in `via[0]`; `slide`; `ride`.
- `window(t)`: optional, closed form: when setting off along the edge *can* work (a door open as you get there).
  Bots only try departures it allows, so it must never say no to one that works; when in doubt, leave it out.
- Put wait spots where the blue (everything 0.35 m bigger, overshooting ~0.4 m as it stops) can stand untouched:
  Gate Crash's are 2 m before each door; Crown Peak's terrace has four corners clear of the sweeper. A spot
  inside a boulder lane can only be waited at between boulders; the planner copes (it keeps several arrivals a
  node), but give it steps aside (edges within a row) so it can dodge.
- Nodes riding a moving solid: `on: index` (positions as at its static pose).

### Trying your round

The scratch scripts in the session's `scratchpad/wobble/engine-tests/` take any code:

```
node blue.mjs b2 b1b2b3C2      # the blue bean: untouched?, its times per round, determinism, the fast bot
node plan-log.mjs b2           # the planner's log: every safe node it reaches and each way out
node trace.mjs b2 blue         # the first way that works from each node, and why the others failed
node seg.mjs b2 0:w0_1 0:e0_1  # one segment from a node at many departure times
node probe.mjs b2 x y z tx tz  # put the bean somewhere and steer it at a point
node physics.mjs               # the bean's numbers and every engine feature
node shell.mjs g2l2C2          # a shell-style run: countdown, ghost, cues, autopilot; then the phone check
```

`courseFromCode('b2', seed)` lays a round on its own (with Crown Peak after it); `labCourse({ letters: 'b' })`
lays it at all three tiers; a `RoundSpec` can carry a `def` to lay a round module before it's registered. All of
them lay the newest generation unless given `gen`.

To measure a round alone, `soloCourse(letter, tier, { seed, gen, def })` (lab.ts) lays the start pad and slide, the
round, a checkpoint pad and a plain finish (a finale gets a plain lead-in and its checkpoint pad first, so its slime
starts), nothing else that can touch a bean; the round under test is `course.rounds[soloIndex(course)]` and is laid
exactly as `courseFromCode(letter + tier, seed)` lays its first round. `roundTimer(course)` times any run through it
(`tick` it after each step: the bots' `onStep`):

```ts
const course = soloCourse('n', 3, { seed: 4, gen: 2 })
const tm = roundTimer(course)
runRoute(course, planRoute(course, BLUE_HANDS)!, BLUE_HANDS, { onStep: tm.tick })
console.log(tm.exit - tm.enter)                          // the blue's time in Gust Gaps T3, s
const tn = roundTimer(course)
const naive = naiveRun(course, { pauses: [1.2] }, 120, tn.tick)   // NAIVE held 1.2 s at the start
console.log(tn.exit - tn.enter, naive.counts.splats)     // its time in the round (∞ if it never got out), its falls
```

### How hard is it? (`scripts/wobblerun-difficulty.mjs`)

```
node scripts/wobblerun-difficulty.mjs [--round n] [--tier 3] [--gen 2] [--seeds 12] [--phases 6] [--json]
```

Every round and tier (gen 1, then gen 2 wherever a builder lays it differently) laid alone from 12 seeds: the
blue's time in it, FAST ÷ blue, a perfectly timed main-route run (MAIN), one phone run a seed (got through, knocks,
falls), and NAIVE from 6 start phases a seed: the share that fell, the share knocked, the time lost to FAST and to
MAIN, and **timing**: the share of NAIVE runs that fell or lost 2 s or more to MAIN. A round you can run straight
through scores near 0. Every row is set against Gust Gaps T3 at gen 1, the one round Ramsey found hard.

NAIVE (`bots.ts NAIVE_HANDS`, `naiveHands`, `naiveRun`) is a player who just runs: the main route at full stick (the
stick straight at each spot, allowing for no carry), never waiting, every window ignored, reacting only by the colour
code (JUMP 0.12 s before an orange thing would touch it and at a gap's edge, DIVE 0.15 s before a violet one), and
committed to every jump: in the air it keeps to the line it jumped along (easing off or pushing on to land on the
spot) and never steers across it. That last is what makes Gust Gaps hard for it, as for a person: with the bots'
perfect mid-air steering, a crosswind gap is no harder than a still one. It never dodges a red thing (that's not
timing, but it costs it time: rounds of red dodge-it hazards score high on "timing" though a person dodges them by
eye, so read their fall share too). After a splat it takes a drawn moment (up to 0.5 s) to get going again.

## The lab

The test lab (`?lab=1` on the play page, an admin's; in DEV any signed-in account) opens on a picker (TestCards.tsx
`LabStartCard`): what it lays is the shell's `LabPick` (runs.ts), remembered on the device
(`skermix-wobblerun-lab-pick`), and the game mounts afresh for each pick. Everything is laid by the newest generation.

- **One round** at T1, T2 or T3: `soloCourse(letter, tier)` (the start pad and slide, the round, a checkpoint pad, the
  star; a finale gets a lead-in), named as players know it ("Gust Gaps T3", on the start arch). The picker lists
  `labRounds()`: every built round, then the finales, by `name` and `hint`.
- **Test gauntlet**: `testGauntlet(n)`: day n's rounds picked as the plan picks a day's (`plan.ts pickRounds`, gen 2's
  heat, no history), laid as the plan's first try at day n would be, ups and downs and all; the shell draws a new n
  (1000–9999) each time. Nothing checks it: it's a look at what a gen-2 day comes to.
- **Every round**: `labCourse(options?)`: every built round (not stubs) at T1, T2, T3 in registry order, a checkpoint
  pad before each, then the first built finale at T2. `labCode()` is its code, `labRoundNames()` the names in it. Its
  splits can be more than the API's 12 and it can be longer than 900 m: the lab never saves or sends a ghost.

## For the plan script

`scripts/wobblerun-daily.mjs plan [days] | replan <n> [days] | repace | show <n> [gen]` writes dailyPlan.ts,
blueRoutes.ts, the API's wobblerunPace.ts (`API_DIR`) and its courseNames.ts; `trial <n> [days] [gen]` picks and
checks test gauntlets by another generation (the newest by default) and writes nothing. It runs on several cores
(`JOBS`); 180 days take about half an hour. Every day is picked (heat) and laid by its own generation (`genOfDay`).

- The heat by weekday is `HEAT` for gen-1 days and `HEAT2` for gen-2 days and trials (`heatOf(gen)`).

- `pickRounds(n, history, { roll?, slime?, avoid?, stubs? })` → the day's code. It weighs every order the slot rules
  allow as likely as drawing it slot by slot, drops the ones the variety rules rule out (yesterday's opener, two
  touch things side by side, a round a fifth time in 7 days, the rounds of a code in `avoid` at the same tiers in
  any order), and draws one of the rest,
  preferring an order not seen in 60 days, else the one seen longest ago. Roll On (`roll`) and Slime Climb
  (`slime`) are left out unless asked for.
- `validate(course)` → the checks, cheapest first: the blue runs untouched, raced `PACE_FROM`–`PACE_TO` (80–95 s);
  the fast hands finish in `FAST_LEAST`–`FAST_MOST` (0.48–0.6) of that (platinum stays reachable, the API's 0.40
  floor stays under 0.85 × the quickest run); 20 phone runs (`phoneCheck`) all finish within 1.6 × the blue, with
  at most 2 knocks or yeets and 1 splat at the median.
- `firstGoodCourse(n, k)` → the first of 40 tries that passes (`{ course, attempt, blue, pace, fast, phone }`), or
  `{ why, tried, unpaced }` (it gives up after 10 if none had the blue in a fair time); the script then gives the
  day other rounds (`avoid`), and an unpaced set of rounds to no later day either.
- `fastRun(course)` (gold lines, small margins) is the floor's and the medals' sanity; `phoneRuns(course, 20)` the
  fairness check (PHONE_HANDS: 0.55 s late, ±8° off, presses up to 0.08 s late).
- A day's checks take 3–10 s a try in Node; a replay ~20 ms.

## Where it differs from design-final

- Crown Peak's terrace is 12 m, not 8: with a 4.8 m sweeper an 8 m terrace has no spot a careful bean can wait
  clear of it. Boulders leave their chutes 1 m below each ramp's top and drop away 1.5 m before its foot, so the
  terrace corners are clear of them too. The summit pad's throw is aimed (at the summit for a perfect bounce, half
  way up the upper ramp for a plain one) rather than a fixed 9 m/s, which can't reach the summit from the terrace.
- The slide down after a high round runs straight onto the next pad: the spec's 0.4 m lip and 3 m gap would splat
  anyone running down it at less than full stick.
- Bounce-pad throws are carries and ballistic (no air control until landing), so a 20 m/s fling isn't bled away.
- Gate Crash's wait spots are 2.0 m in front of each door (the spec's 1.0 m is inside the blue's margin).
- The jump's apex is 1.925 m, not 1.97: it's the prototype's integrator (gravity, then move), kept.
- The blue is an earliest-arrival planner over the route graph with the spec's margins (0.35 m, a 0.35 s
  reaction after any wait, windows trimmed 0.3 s at the late end) and a 0.4 s look round at every safe spot. With
  the margins alone it ran a day in 50–65 s, and the fast bot 0.8–0.9× that, so silver was a near-perfect run.
  Racing it slower (`BLUE_PACE`) would put it out of step with the clock things it waited for; a slower stick or
  a longer reaction made it miss the green waves and moving pads the rounds are timed to. With the look, a day's
  blue is 80–95 s (median about 86) and the fast bot about 0.55× it, as §4.3 wants.
- The variety rules: a round at most 4 times in 7 days even with all ten rounds in (the spec's 3 can't be kept:
  every day takes two of the five timing-or-dodging rounds and two of the five footing-or-flying ones), and "no
  identical order within 60 days" is a preference (phase 1's slot rules allow only 72 orders).
- Engine fixes the round builders asked for (engine-requests): coyote time when the tile under the bean drops; a
  hazard's push never takes the bean through a wall (it can pin it on one); the hazard body that knocked a bean
  leaves it alone through the knock's cooldown (no more knocked all the way down a fruit or boulder lane); the
  bots' air steering caps the bean's own speed, not the wind-carried one, and lands by the wind's lift; a reaction
  shut out by a closing window starts again at the next one; a jump that lands by the crown without touching it is
  a miss; with nothing clean, the live hands go the way that ends nearest the crown. Rounds that worked round them
  (Hit Parade's 9 m Wrecking Row, Fruit Chute's yeeting fruit, Big Fans' late dive on the Tail Wind) can go back to
  the spec, then replan.
- Block Party: walls are born at the runway's end (centre L − 0.5, rising out of the floor over 0.8 m), so none ever
  reaches the pad after; P is spread over 0.8 s from max(3.6, 1.5·(7.2 + v)/v), so T1 runs 4.2–5.0 s; 6–8 layouts;
  doors on five lanes 1.45 m apart. The route is a lane grid (rows ~4.5 m apart) with closed-form windows, not
  nodes per meeting. Hurdles and slots are gold.
- Spin Club: the launch pad is laid only when a sweeper follows the turntable, and throws you over it onto the
  walkway after; T2's turntable is fenced all round, T3's only on the half turning against the way out. Bumpers sit
  at ρ 4.2–6.0, leaving an unswept ring round the hub where the blue waits. On a sweeper only the side the bars turn
  toward is laid. T3 is ~58 m (three stages and four walkways don't fit 48).
