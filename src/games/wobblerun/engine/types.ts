/**
 * Wobble Run's engine shapes: what a course is made of, what a run is, what a step tells, and what the bots
 * walk. Types only, so the scene, the shell and the site can import them without pulling in the engine.
 *
 * Units are metres, seconds, m/s and radians. The axes are the prototype's: x across the track (screen right is
 * −x), y up, z down the course (the camera always looks +z). Every yaw is three.js's `rotation.y`: a yaw of θ
 * turns local +x to (cos θ, 0, −sin θ) and local +z to (sin θ, 0, cos θ), and the bean faces local +z.
 *
 * Read engine/README.md first: it says how the scene draws a course, how the shell drives a run, and how a
 * round is built.
 */

export type Vec3 = { x: number; y: number; z: number }
export type XZ = { x: number; z: number }

/** A round's tier: 1 gentle, 2 the usual, 3 spicy. */
export type Tier = 1 | 2 | 3

/** T time it · D dodge it · F keep your footing · A fly it, then the finales and the connectors. */
export type Family = 'T' | 'D' | 'F' | 'A' | 'finale' | 'connector'

/**
 * What a thing means, in the colour code every theme keeps (design-final §1.5): `jump` orange, `dive` violet,
 * `dodge` red, `bouncy` teal, `helps` green, `pushes` indigo, `warn` the about-to-go amber, `gold` the gold
 * line's edge. `floor` takes the day's pastel, `check` is a checkpoint's white, `jelly` a translucent crossing
 * wall, `deco` scenery with no meaning.
 */
export type Role = 'floor' | 'jump' | 'dive' | 'dodge' | 'bouncy' | 'helps' | 'pushes' | 'warn' | 'gold' | 'check' | 'jelly' | 'deco'

/**
 * How the scene draws a thing. The known looks are listed in engine/README.md (with the params each reads);
 * a look the scene doesn't know is drawn by its shape and role, so a round can add one before the scene does.
 */
export type KnownLook =
  // floors and pads
  | 'floor'
  | 'pad'
  | 'start-pad'
  | 'check-pad'
  | 'terrace'
  | 'island'
  | 'summit'
  | 'basement'
  | 'slide'
  | 'belt'
  | 'plank'
  | 'tile'
  | 'tile-star'
  | 'pad-lily'
  | 'pad-gold'
  | 'drum'
  | 'disc'
  | 'turntable'
  // walls and frames
  | 'rail'
  | 'fence'
  | 'divider'
  | 'cushion'
  | 'barrier'
  | 'frame'
  | 'header'
  | 'door'
  | 'wall-jelly'
  | 'tooth'
  | 'tooth-tall'
  // hazards
  | 'bar-low'
  | 'bar-high'
  | 'hub'
  | 'bumper'
  | 'pendulum'
  | 'glove'
  | 'glove-low'
  | 'glove-high'
  | 'fruit-melon'
  | 'fruit-orange'
  | 'banana'
  | 'boulder'
  | 'gumball'
  // pads that throw you
  | 'bounce'
  | 'launch-pad'
  // volumes
  | 'fan'
  | 'wind'
  | 'hoop'
  | 'crown'
  | 'slime'
  // dressing
  | 'flag'
  | 'gold-edge'
  | 'gold-flag'
  | 'lamp'
  | 'arch'
  | 'cannon'
  | 'chute'
  | 'gantry'
  | 'pillar'
  | 'pylon'
  | 'pedestal'
  | 'stripe'
  | 'arrow'
  | 'lip'
export type Look = KnownLook | (string & {})

/* ------------------------------------------------------------------ motion --- */

/**
 * What a closed-form motion writes, as an offset from the thing's static pose: where it has moved to, how far
 * it has turned (added to its yaw), whether it's there at all (`on`), and, when it isn't −1, a half-height in
 * place of its own (a Block Party wall sinking into the floor). The engine zeroes it before each call.
 */
export type Offset = { x: number; y: number; z: number; yaw: number; on: boolean; hy: number }

/** A clock thing's motion: a pure function of the run clock `t` (0 at GO), never of frame time or chance. */
export type MoveFn = (t: number, o: Offset) => void

/**
 * A telegraph's reading at clock time t: `state` is the phase (a door's lamp, a glove's wind-up, a fan's spin-up),
 * `u` how far through that phase it is, 0 to 1. Lamps, wind-up sounds and floor stripes are driven from it.
 */
export type TeleState = 'rest' | 'warn' | 'act' | 'hold' | 'back'
export type Tele = { u: number; state: TeleState }
export type TeleFn = (t: number) => Tele

/** A thing's world pose at a moment, as the engine and the scene read it. */
export type Pose = {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  roll: number
  /** Whether it's there and solid (a dropped tile, a hidden tooth, a fruit that has gone are not). */
  on: boolean
  hy: number
  /** A crumbling tile's state, 0 untouched to 1 dropping; 0 for everything else. */
  crack: number
}

/* ------------------------------------------------------------------ solids --- */

/**
 * A pad that throws you (bounce pads, the launch pad, the summit pad). Landing or stepping on it sets `vy`, and
 * either `fwd` (a set horizontal velocity) or `aim` (whatever horizontal velocity lands you on that point), or
 * leaves your own. A JUMP pressed within 0.15 s before touching it or 0.10 s after makes it a perfect bounce:
 * `perfectVy`, with `perfectFwd` / `perfectAim` if given. While `lit` says no, it's plain floor.
 */
export type Bounce = {
  vy: number
  perfectVy?: number
  fwd?: XZ
  perfectFwd?: XZ
  aim?: Vec3
  perfectAim?: Vec3
  lit?: (t: number) => boolean
}

/**
 * A touch thing: it answers your bean only, steps in a fixed order, and resets when you respawn into its round
 * or an earlier one. A `tile` cracks when you touch it and drops `crumble` s later (a `star` tile never does); a
 * `plank` tips toward the side you stand on, `k` °/m past `dead` m off its pivot line, to at most `max` °,
 * moving `rate` °/s (35) and coming back level at `back` °/s (12).
 */
export type TouchSpec =
  | { kind: 'tile'; crumble: number; star?: boolean }
  | { kind: 'plank'; k: number; max: number; rate?: number; back?: number; dead?: number }

/**
 * Something you stand on or bump into. A `box` is hx × hz (half sizes, in its own frame, turned by `yaw`), a
 * `cyl` a disc of radius r (drawn with `sides` sides: 6 is a hex tile). Its top is at `y` at its centre and
 * slopes by `pitch` (rising toward its +z) and `roll` (rising toward its +x): the top at local (lx, lz) is
 * y + lz·tan(pitch) + lx·tan(roll). Its body runs 2·hy down from the top.
 */
export type Solid = {
  shape: 'box' | 'cyl'
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  roll: number
  hx: number
  hz: number
  r: number
  hy: number
  sides?: number
  look: Look
  role: Role
  /** Which of the theme's floor hues it takes (floors and pads); −1 leaves it to the look. */
  tint: number
  /** A gold line's piece: drawn with the gold edge. */
  gold?: boolean
  move?: MoveFn
  tele?: TeleFn
  /** You can catch its edge from a short jump (on for platforms; off for walls, doors and fast movers). */
  ledge: boolean
  /** Never stood on: walls, rails, frames, doors. You slide off the top. */
  noGround?: boolean
  /** A jelly door: the descending-door rule instead of a plain push (design-final M7). */
  door?: boolean
  /** A diving or sliding bean (0.84 m tall) fits under it. */
  duck?: boolean
  /** A belly slide doesn't run out on it, and gravity pulls you down it (slides). */
  slick?: boolean
  /** Tipped past 8° it slides you toward its low side (see-saw planks, drum facets). */
  slip?: boolean
  /** A carry along its surface, m/s, in its own frame (belts). */
  belt?: XZ
  bounce?: Bounce
  touch?: TouchSpec
  /** The course round it belongs to (−1 for pads and slides); set by the course. */
  round: number
  /** Its index among the course's tiles or planks, when it's one; set by the course. */
  ti: number
  pi: number
  /** The z it can reach at any time (with its motion), for the engine's broad phase; set by the course. */
  z0: number
  z1: number
}

/* ----------------------------------------------------------------- hazards --- */

/**
 * What a hazard does to you (design-final §1.2). A `bonk` pushes you `kn` m/s away with a pop of `pop` and no
 * stun; a `knock` adds `kv` × the hazard's own speed (capped at `vcap`) and stuns you 0.55 s; a `yeet` flings you
 * `fling` (+ `kv` × the hazard's speed) and stuns you until you land. A hazard moving toward you at under 1 m/s
 * only shoves, unless it's `always` (bumpers and hubs bonk whether they move or not).
 */
export type HitClass = 'bonk' | 'knock' | 'yeet'
export type Hit = { cls: HitClass; kn: number; kv: number; pop: number; vcap: number; fling?: Vec3; always?: boolean }

/**
 * A hazard's scheduled bodies (fruit, boulders, gumballs, Block Party walls): release k is at ph + k·P, and a
 * body released τ seconds ago is where `at(τ, k, o)` puts it (an offset from the hazard's anchor), for `life`
 * seconds. Only live releases are worked out.
 */
export type PathSpec = { P: number; ph: number; life: number; at: (tau: number, k: number, o: Offset) => void }

/**
 * Something that hits you. A `sphere` (r) is centred on its body; a `post` (r) stands from its body's y up `h`;
 * a `box` (hx, hy, hz) is centred on its body and turned by its yaw; a `bar` is a capsule of radius r through
 * its body along its yaw's local x, `len` each way (sweeper bars, bananas). Its anchor is x, y, z; `move` or
 * `path` puts its body somewhere else, as an offset from the anchor.
 */
export type Hazard = {
  shape: 'sphere' | 'post' | 'box' | 'bar'
  x: number
  y: number
  z: number
  yaw: number
  r: number
  h: number
  hx: number
  hy: number
  hz: number
  len: number
  hit: Hit
  move?: MoveFn
  path?: PathSpec
  tele?: TeleFn
  look: Look
  role: Role
  tint: number
  round: number
  z0: number
  z1: number
}

/** A hazard's body at a moment: where it is (world), its yaw, whether it's there, and for a path which release. */
export type Body = { x: number; y: number; z: number; yaw: number; on: boolean; hy: number; k: number; tau: number }

/* ----------------------------------------------------------------- volumes --- */

/**
 * Places that do something while you're in them. `wind`: a box (half sizes) whose air carries you `carry` m/s and
 * lifts you `up` m/s² times `duty(t)` (0 to 1), on the ground and in the air. `hoop`: pass through within 0.6 m of
 * its centre, going `dir`, for `boost` m/s more along `dir` for `dur` s. `crown`: touching it finishes the run
 * (its centre bobs by `bob(t)`). `slime`: a rising floor in the finale, `depth` below the flag you set off from,
 * rising `rate` m/s once you've been going 3 s.
 */
export type Volume =
  | {
      kind: 'wind'
      x: number
      y: number
      z: number
      hx: number
      hy: number
      hz: number
      carry: XZ
      up: number
      duty: (t: number) => number
      tele?: TeleFn
      look: Look
      role: Role
      round: number
      z0: number
      z1: number
    }
  | {
      kind: 'hoop'
      x: number
      y: number
      z: number
      r: number
      dir: XZ
      boost: number
      dur: number
      look: Look
      role: Role
      round: number
      z0: number
      z1: number
    }
  | {
      kind: 'crown'
      x: number
      y: number
      z: number
      r: number
      bob: (t: number) => number
      look: Look
      role: Role
      round: number
      z0: number
      z1: number
    }
  | {
      kind: 'slime'
      x: number
      y: number
      z: number
      hx: number
      depth: number
      rate: number
      look: Look
      role: Role
      round: number
      z0: number
      z1: number
    }

/* ----------------------------------------------------------------- dressing --- */

/**
 * Scenery the course places (gantries, arches, cannons, lamps, flags, frames, painted arrows): no collision. Its
 * size is sx × sy × sz (whole sizes) and `params` says anything else the look needs. A `ref` ties it to the solid,
 * hazard or volume whose telegraph drives it (a door's lamp, a cannon's swell, a fan's blades).
 */
export type Deco = {
  look: Look
  x: number
  y: number
  z: number
  yaw: number
  sx: number
  sy: number
  sz: number
  role: Role
  tint: number
  ref?: { kind: 'solid' | 'hazard' | 'volume'; i: number }
  params?: Record<string, number | string | boolean>
  round: number
}

/* ------------------------------------------------------------------- route --- */

/**
 * A spot the bots steer for. When `on` is a solid's index, the spot rides that solid: x, y, z are where it is when
 * the solid is at its static pose, and it moves and turns with it.
 */
export type Point = { x: number; y: number; z: number; on?: number }

/** `safe`: a bot may stop and wait here (each wait is still simulated); `no`: it never stops here. */
export type NodeWait = 'safe' | 'no'

export type GraphNode = Point & {
  id: string
  wait: NodeWait
  /** How close counts as there, m (0.6 for safe spots, 1.0 for spots passed through, by default). */
  r?: number
}

/**
 * How an edge is taken. `run`: steer there. `jump`: run to the take-off, jump, steer the flight onto the spot.
 * `dive`: a ground dive at the take-off (under a bar). `lateDive`: jump, then dive late in the jump to reach far.
 * `bounce` / `perfectBounce`: onto the pad on the way (`via`), jumping on the touch for a perfect one. `slide`:
 * dive onto a slick slope and belly slide. `ride`: stay put on the platform for `dur` s.
 */
export type EdgeMove = 'run' | 'jump' | 'dive' | 'lateDive' | 'bounce' | 'perfectBounce' | 'slide' | 'ride'

export type GraphEdge = {
  from: string
  to: string
  move: EdgeMove
  /** `main` is the blue bean's way; `gold` is a gold line or an expert's move the blue never takes. */
  tier: 'main' | 'gold'
  /**
   * When setting off along it can work, if the round can say so in closed form (a door open long enough). A bot
   * only tries departures it allows, so it must never say no to one that works.
   */
  window?: (t: number) => boolean
  /**
   * Where to jump (or dive) from: a spot, or `'edge'` for wherever the bean is `inset` m from the edge of what it
   * stands on, heading for the spot (moving pads). Left out, it jumps as it sets off.
   */
  takeoff?: Point | 'edge'
  inset?: number
  /** Spots to pass on the way, in order (the bounce pad, for a bounce). */
  via?: Point[]
  /** Seconds into the jump to dive, for a lateDive; left out, it dives when the dive would land it just short of the spot. */
  diveAt?: number
  /** Overrides the hands' stick (0.75 on see-saws for the blue). */
  stick?: number
  /** Gives up after this long, s (2.5 + 0.4 s a metre by default). */
  maxT?: number
  /** A ride's length, s. */
  dur?: number
}

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

/* ------------------------------------------------------------------ rounds --- */

/** A gold line, as the start card and the run report name it: where it is along the round, and where across. */
export type GoldLine = { name: string; z0: number; z1: number; x: number }

/** A respawn point inside a round (Lily Leapers' hub, Crown Peak's terrace): not a split. */
export type MidFlag = { x: number; y: number; z: number; node: string }

/** How the camera sits over a round (design-final §6 #10): blended over 0.8 s at round boundaries. */
export type CameraPreset = 'default' | 'wide' | 'climb' | 'slide'

/**
 * What a round's builder makes (design-final M17), in the round's own frame: z from its start edge (the pad
 * before it ends at z 0), x from its centreline, y from its base (the pad before it is at y 0). Solids are
 * referred to by their index in `solids` (nodes' and points' `on`, decos' refs); the course moves them all.
 * Touch things are solids with a `touch`.
 */
export type RoundOut = {
  solids: Solid[]
  hazards: Hazard[]
  volumes: Volume[]
  decos: Deco[]
  flags: MidFlag[]
  /** Must have a node `in` (on the pad before, safe) and `out` (on the pad after, safe); a finale has `crown`. */
  graph: Graph
  gold: GoldLine[]
  camera: CameraPreset
  /** Where the pad after it starts: its near edge's centre. A finale's is where its last floor ends. */
  exit: Vec3
  /** Heights you splat below, by stretch (default: 6 m below the round's base all along). */
  deaths: { z0: number; z1: number; y: number }[]
}

/** Where a round sits in its course, for its builder. */
export type RoundSlot = {
  /** Its place in the course: 0 the opener, `count − 1` the finale. */
  i: number
  count: number
  letter: string
  tier: Tier
  /** Its base period, s: one of 2.9, 3.2, 3.4, 3.7, 4.1, 4.4, and no other round of the course has it. */
  period: number
  finale: boolean
  /** The seed its rng was made from. */
  seed: string
}

export type Rng = {
  (): number
  /** A number in [a, b). */
  between(a: number, b: number): number
  /** A whole number from a to b, both included. */
  int(a: number, b: number): number
  pick<T>(list: readonly T[]): T
  chance(p: number): boolean
  sign(): 1 | -1
  shuffle<T>(list: T[]): T[]
}

/**
 * A round's module (engine/rounds/*.ts exports one as ROUND). `hint` is the start card's few words ("hop the
 * pads"); a `stub` is a stand-in until the round is built, a flat safe stretch with the round's name.
 */
export type RoundDef = {
  letter: string
  name: string
  hint: string
  family: Family
  phase: 1 | 2
  stub?: boolean
  build(slot: RoundSlot, rng: Rng, tier: Tier, base: Vec3): RoundOut
}

/* ------------------------------------------------------------------ course --- */

/** The day's look: set dressing only, never physics (design-final §4.5). Colours are '#rrggbb'. */
export type Theme = {
  id: string
  name: string
  /** Pastel tops and their mid-tone bodies, taken in turn by `tint`. */
  floors: readonly string[]
  bodies: readonly string[]
  goo: string
  /** Neon Night: night in either site theme, with glowing edges. */
  night?: boolean
  /** Big Show: a different hue per round. */
  perRound?: boolean
  scenery: readonly string[]
}

/** A round as laid in the course. */
export type CourseRound = {
  i: number
  letter: string
  tier: Tier
  name: string
  hint: string
  family: Family
  stub: boolean
  period: number
  /** Where it starts and ends along the course, its centreline's x, and its base height. */
  z0: number
  z1: number
  x: number
  y: number
  camera: CameraPreset
  gold: GoldLine[]
}

/** A stretch of course that isn't a round (the start, a checkpoint pad, a slide), for the camera and the map. */
export type CoursePiece = { kind: 'start' | 'slide' | 'check' | 'bounce-up'; z0: number; z1: number; x: number; y: number; camera: CameraPreset }

/**
 * Where a bean comes back after a splat. The start, each checkpoint pad (`split`: crossing its `line` is a split)
 * and each mid flag (reached by standing on solid ground past its line). `round`: respawning here resets the touch
 * things of this round and every later one. `node` is the route node the bots carry on from.
 */
export type Spawn = {
  kind: 'start' | 'check' | 'flag'
  x: number
  y: number
  z: number
  line: number
  split: boolean
  round: number
  node: string
  /** A finale's flag: the slime starts again under it. */
  finale: boolean
}

export type Course = {
  /** The round code (`g1l2h2s3C2`), the name, and the day and try it was laid for (0 when it's a test course). */
  key: string
  name: string
  n: number
  attempt: number
  theme: Theme
  solids: Solid[]
  hazards: Hazard[]
  volumes: Volume[]
  decos: Deco[]
  rounds: CourseRound[]
  pieces: CoursePiece[]
  spawns: Spawn[]
  /** Splat heights by stretch of z, in order. */
  deaths: { z0: number; z1: number; y: number }[]
  graph: Graph & { start: string; goal: string }
  /** The crown's volume index. */
  crown: number
  /** The solids that are tiles and planks, by their `ti` / `pi`. */
  tiles: number[]
  planks: number[]
  /** How many splits a finished run has: one a checkpoint, then the crown. */
  splitCount: number
  length: number
  minY: number
  maxY: number
  /** Where the goo is drawn: 9 m below the lowest floor. */
  gooY: number
  /** The engine's broad phase (sim.ts): what's near each 2 m of z. */
  grid: Grid
}

export type Grid = { z0: number; cell: number; solids: Int32Array[]; hazards: Int32Array[]; volumes: Int32Array[] }

/* --------------------------------------------------------------------- run --- */

/** What the player's hands say this step: the stick (x right, y forward, each −1 to 1) and the buttons pressed now. */
export type Input = { x: number; y: number; jump: boolean; dive: boolean }

/** The ghost path's state for a sample (the contract's ghost format). */
export type GhostState = 0 | 1 | 2 | 3

export type Bean = {
  x: number
  y: number
  z: number
  /** Its own velocity; what the floor and the air add (carries) is apart from it. */
  vx: number
  vy: number
  vz: number
  yaw: number
  /** The solid it stands on, or −1. */
  ground: number
  /** The carry from what it stands on (platform, belt, see-saw slide), m/s: it becomes velocity as it leaves. */
  gcx: number
  gcz: number
  /** The air's carry this step (wind, a hoop's boost). */
  acx: number
  acz: number
  /** The see-saw slide carry. */
  slipX: number
  slipZ: number
  /** How fast what it stands on rises, m/s (a jump off a rising pad goes higher). */
  gvy: number
  coyote: number
  jumpBuf: number
  diveBuf: number
  diving: boolean
  /** One air dive a jump. */
  airDived: boolean
  /** Belly slide time left, s, and how much it has been held under something overhead. */
  slide: number
  slideHeld: number
  stun: number
  /** Stunned by a yeet: until it lands, then 0.25 s. */
  yeet: boolean
  hitCd: number
  /**
   * The hazard body that last knocked it (hazard index, path release k; −1 for none): through the knock's cooldown
   * that body neither pushes nor hits it again, so a fruit or boulder rolling on after it never knocks it all the
   * way down its lane.
   */
  knockH: number
  knockK: number
  /** Splatted: seconds until it drops in again (it keeps falling, visibly, meanwhile). */
  dead: number
  splatted: boolean
  /** A ledge catch: seconds of the pop-up left, from where to where, onto which solid. */
  ledge: number
  ledgeFrom: Vec3
  ledgeTo: Vec3
  ledgeOn: number
  ledgeKeep: XZ
  /** A hoop's boost: seconds left, and the boost (m/s along the hoop). */
  hoopT: number
  hoopX: number
  hoopZ: number
  /** A bounce pad just touched, and how long ago (for a late perfect bounce). */
  bounceOn: number
  bounceAge: number
  /**
   * A bounce pad's throw across (m/s), carried until it lands rather than given as its own speed, so air control
   * (which pulls toward 7.2 m/s) doesn't bleed a 20 m/s fling away (design-final §3.0). It becomes its own speed as
   * it lands.
   */
  flingX: number
  flingZ: number
  /** Seconds since it left the ground; how fast it came down when it last landed. */
  air: number
  landV: number
  /** The spawn it comes back at. */
  spawn: number
  closeCd: number
}

export type Counts = { splats: number; knocks: number; bonks: number; yeets: number; close: number; ledges: number; bounces: number; perfects: number; hoops: number }

export type SimEventKind =
  | 'go'
  | 'jump'
  | 'land'
  | 'dive'
  | 'slide'
  | 'bellyHop'
  | 'bonk'
  | 'knock'
  | 'yeet'
  | 'fall'
  | 'splat'
  | 'respawn'
  | 'checkpoint'
  | 'flag'
  | 'closeCall'
  | 'ledge'
  | 'bounce'
  | 'perfectBounce'
  | 'hoop'
  | 'tileCrack'
  | 'tileDrop'
  | 'crown'
  | 'cue'

/**
 * Something a step did worth a sound or a puff (run.ev, emptied at the start of each step). x, y, z is the bean's
 * place (a cue's is its thing's); `i` is the thing it's about (hazard for hits and close calls, solid for tiles and
 * bounces, spawn for checkpoints and flags, the split's number for a checkpoint in `v`'s company); `v` a size (a
 * landing's speed, a checkpoint's split time). A `cue` is a telegraph changing phase (`state`), from thing `what`.
 */
export type SimEvent = {
  k: SimEventKind
  x: number
  y: number
  z: number
  i: number
  v: number
  what?: 'solid' | 'hazard' | 'volume'
  look?: Look
  state?: TeleState
}

/** The touch things' state: what a respawn resets. */
export type World = {
  /** When each tile was touched (NaN: not yet). */
  tileT: Float64Array
  /** Each plank's tip, radians (+ is its +x side down), and whether the bean stood on it last step. */
  plank: Float64Array
  plankOn: Uint8Array
  /** The slime's clock started at this time, under this height (NaN: not started). */
  slimeT0: number
  slimeY0: number
}

export type Run = {
  course: Course
  /** The run clock: 0 at GO, negative in the countdown. Always (steps − go) × STEP, so it's exactly 0 at GO. */
  t: number
  steps: number
  /** The step GO comes at (the countdown's length in steps). */
  go: number
  bean: Bean
  world: World
  /** The splits so far (a checkpoint's line crossing, then the crown), and the finish. */
  splits: number[]
  done: boolean
  time: number
  counts: Counts
  /** Hit by anything (or splatted) since this was last cleared: the blue must finish untouched. */
  touched: boolean
  /** The bots' margin: anything within `inflate` m of touching sets `near` (it changes nothing else). */
  inflate: number
  near: boolean
  /** This step's events (left empty when `quiet`). */
  ev: SimEvent[]
  quiet: boolean
  /** Emit `cue` events as telegraphs change phase near the bean (the shell's run turns this on). */
  cues: boolean
  /** When an array, the step records the ghost path into it: x, y, z, state, 20 a second from GO, the finish last. */
  ghost: number[] | null
  /** Internals: the pose cache's frame and the cue states. */
  frame: number
  cache: RunCache
}

export type RunCache = { stamp: Int32Array; pose: Float64Array; cue: Int8Array }
