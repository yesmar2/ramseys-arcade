import * as THREE from 'three'
import { isDarkTheme, THEME_EVENT } from '../../lib/theme'
import { cameraAt } from './engine/course.ts'
import { mulberry32, hashString } from './engine/rng.ts'
import { prone, slimeY } from './engine/sim.ts'
import type { CameraPreset, Course, Run, SimEvent } from './engine/types.ts'
import { BeanRig, beanLook, GhostBean, ghostGeometries, type BeanState, type GhostKind } from './scene/bean.ts'
import { CourseView } from './scene/course.ts'
import { Fx, Shadow } from './scene/fx.ts'
import {
  CODE,
  LOOKS,
  mix,
  paintBlur,
  paintCheck,
  paintDot,
  paintFloor,
  paintGoo,
  paintMatcap,
  paintPattern,
  paintRing,
  paintSlide,
  Painter,
  PATTERN_ROLES,
  signPaint,
  Tints,
  type PatternRole,
  type SkyLook,
} from './scene/look.ts'
import { centreAt, World } from './scene/world.ts'

/*
 * Wobble Run in 3D: a candy obstacle course floating over goo, drawn with three.js from the engine's course
 * (engine/README.md "For the scene") and the run the shell steps. A theme-following world: an afternoon in the
 * site's light theme, dusk with stars and glowing trims in dark (and Neon Night's night in either), the colour
 * code the same in every theme. No lamps and no shadow maps: the light is baked into vertex colours, the bean has
 * a matcap, and a soft blob (or, over nothing, a bright ring on the goo) shows where it'll land. The static course
 * is merged into a few meshes a chunk, repeats are instanced, and only what's near the camera is drawn.
 *
 * ---------------------------------------------------------------------------------------------- the API ---
 *
 *   const scene = new WobbleScene(canvas, course)   // throws when there's no WebGL: show the no-3D message
 *   scene.resize(w, h)                              // every frame, from the holder's box, CSS px (0×0 is ignored)
 *   // each fixed step:
 *   step(run, input)
 *   scene.events(run.ev, run)                       // squash, tumbles, splashes, confetti, pad squash, flashes
 *   // each frame:
 *   scene.frame({ mode, run, ghosts, doneFor, skin }, dt)   // dt 0 while paused: nothing moves but it draws
 *   scene.snap()                                    // a new run: the camera jumps behind the bean, puffs cleared
 *   scene.dispose()                                 // lets go of everything; ends in forceContextLoss()
 *
 * - `mode`: 'menu' is the start card (a slow flyover of the gauntlet, from the start; with no run the bean waits
 *   on the start pad), 'play' a run from the countdown to the crown, 'done' after the crown (the camera swings
 *   round to the bean's front with the crown on its head; `doneFor` is the seconds since the touch, for the
 *   swing; for the spec's slow motion, step the run at 0.3× for the first second: the scene just draws).
 * - `run`: the run on screen. The clock things are posed at `t` (default run.t; give `t` and `at`, the bean's
 *   place, to draw between steps). Touch things come from run.world; the slime from slimeY(run).
 * - `ghosts`: up to three, each { kind: 'blue' | 'rival' | 'mine', x, y, z, state, tag, skin? }: the blue bean
 *   (translucent blue), someone else's run (cyan), your best (amber); `tag` is the name over the one you're
 *   chasing ('' for none); a skin the scene knows draws the ghost in it, lighter (none exist yet, so always the
 *   kind's colour). They fade as they come alongside you, and a jump of over 3 m (a respawn) doesn't spin one.
 * - `skin`: the player's chosen skin (lib/skins.ts chosenSkin('wobblerun')); unknown ids are the pink bean.
 * - `calm`: reduced motion (default: the OS setting): no shake, no FOV kicks, no swing, fewer puffs.
 * - The scene watches the site theme itself (data-theme and THEME_EVENT); retheme() forces a re-read.
 * - `renderer` is public for the dev hook (__wobbleScene(): renderer.info.render.calls / triangles, and
 *   render-then-toDataURL stills in one task: there's no preserveDrawingBuffer).
 * - Context loss: three restores the context itself; while it's lost frame() draws nothing. The shell's
 *   per-frame try/catch and failure count cover a context that never comes back.
 */

/** A ghost to draw this frame (see the API above). */
export type GhostShow = {
  kind: GhostKind
  x: number
  y: number
  z: number
  /** The ghost path's state: 0 grounded, 1 air or dive, 2 respawning, 3 stunned. */
  state: number
  /** The name over it, for the one you're chasing; '' for none. */
  tag: string
  /** The skin its run was played in: drawn in it, lighter, when the scene knows it; else the kind's colour. */
  skin?: string | null
}

/** What a frame shows. */
export type SceneFrame = {
  mode: 'menu' | 'play' | 'done'
  run: Run | null
  /** The clock the course is posed at (default run.t), and the bean's place (default run.bean), between steps. */
  t?: number
  at?: { x: number; y: number; z: number } | null
  doneFor?: number
  ghosts?: readonly GhostShow[]
  skin?: string | null
  calm?: boolean
}

/** A camera preset (design-final §6 #10), as a portrait phone has it: how far back and up, where it looks. */
type Cam = { back: number; up: number; ahead: number; lookY: number; fov: number }
const CAMS: Record<CameraPreset, Cam> = {
  default: { back: 10.5, up: 6.3, ahead: 6, lookY: 0.8, fov: 0 },
  wide: { back: 12, up: 7.5, ahead: 7, lookY: 0.6, fov: 0 },
  climb: { back: 10, up: 8, ahead: 9, lookY: 3.2, fov: 0 },
  slide: { back: 8, up: 4.5, ahead: 7, lookY: 0.2, fov: 6 },
}
/** A portrait phone sees about 8.2 m across at the bean (half the across view's angle, as a tangent). */
const TAN_HALF = Math.tan((18.6 * Math.PI) / 180)
/** On a portrait screen's start card, the flyover's horizon is kept this far down from the top (a sliver of sky). */
const MENU_SKY = 0.05
/** The party colours: confetti. */
const PARTY = ['#ff6f91', '#ffd23f', '#3ec8cf', '#9b7bff', '#3ecf8e', '#ffffff', '#f2813a']

const MAX_GHOSTS = 3

export class WobbleScene {
  readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200)
  private readonly course: Course
  private readonly painter: Painter
  private readonly tints = new Tints()
  private readonly world: World
  private readonly view: CourseView
  private readonly bean: BeanRig
  private readonly fx: Fx
  private readonly shadow: Shadow
  private readonly ghosts: { bean: GhostBean; tag: THREE.Sprite; tex: THREE.CanvasTexture; text: string; colour: string }[] = []
  private readonly themeWatch: MutationObserver | null = null
  private readonly calm: boolean
  private readonly rnd: () => number
  private look: SkyLook = LOOKS.dusk
  private width = 0
  private height = 0
  private disposed = false
  private lost = false

  // The camera.
  private snapNext = true
  private readonly cam: Cam = { ...CAMS.slide }
  private readonly focus = new THREE.Vector3()
  private groundY = 0
  private menuZ = -6
  private idle = 0
  private kick = 0
  private shake = 0
  private held = false
  private wasDead = false
  private swing = 0
  // Moments.
  private crowned = false
  private glintIn = 0.5
  private crownSparkIn = 0.2
  private partyIn = 0
  private slowFrames = 0
  private pixelRatio: number
  private lowered = false
  private readonly preview: boolean
  // Scratch.
  private readonly va = new THREE.Vector3()
  private readonly vb = new THREE.Vector3()
  private readonly eye = new THREE.Vector3()
  private readonly target = new THREE.Vector3()
  private readonly beanState: BeanState = { x: 0, y: 0, z: 0, yaw: 0, vy: 0, grounded: true, prone: false, stunned: false, dead: false, ledge: false }

  constructor(canvas: HTMLCanvasElement, course: Course, opts: { pixelRatio?: number; preview?: boolean } = {}) {
    this.course = course
    this.preview = !!opts.preview
    this.calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    this.rnd = mulberry32(hashString(`scene:${course.key}:${course.n}`))
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.pixelRatio ?? 1.75)
    renderer.setPixelRatio(this.pixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer = renderer
    this.scene.fog = new THREE.Fog('#3b2a5e', 45, 135)
    const painter = (this.painter = new Painter(Math.min(4, renderer.capabilities.getMaxAnisotropy())))

    const patterns = {} as Record<PatternRole, THREE.Texture>
    for (const role of PATTERN_ROLES) patterns[role] = paintPattern(painter, role)
    const dot = paintDot(painter)
    const matcap = paintMatcap(painter, { base: '#f1edf3', light: '#ffffff', dark: '#b1a2b6', spec: 0.8 })
    const gold = paintMatcap(painter, { base: '#e2bc52', light: '#fff6c8', dark: '#8a6416' })
    const ghostMatcap = paintMatcap(painter, { base: '#f0f0f0', light: '#ffffff', dark: '#c4c4cc', spec: 0.6 })

    this.world = new World(course, painter, this.tints, dot, paintGoo(painter), this.rnd)
    this.scene.add(this.world.group)
    this.view = new CourseView(course, painter, this.tints, { floor: paintFloor(painter), check: paintCheck(painter), slide: paintSlide(painter), dot, blur: paintBlur(painter), gold, patterns }, this.rnd)
    this.scene.add(this.view.group)
    this.bean = new BeanRig(matcap, gold, this.rnd)
    this.scene.add(this.bean.root)
    this.shadow = new Shadow(dot, paintRing(painter))
    this.scene.add(this.shadow.blob, this.shadow.ring)
    this.fx = new Fx(dot, this.rnd)
    this.fx.setCalm(this.calm)
    this.scene.add(this.fx.group)

    // The ghosts, each with a tag over it (the same size near or far).
    const geo = ghostGeometries()
    for (let k = 0; k < MAX_GHOSTS; k++) {
      const bean = new GhostBean(ghostMatcap, geo.body, geo.visor)
      const slot = { bean, tag: null as unknown as THREE.Sprite, tex: null as unknown as THREE.CanvasTexture, text: '', colour: '#46e4ff' }
      // The tag's colours are the ghost's, read when it's painted (paintTag).
      slot.tex = painter.paint(256, 64, (g, w, h) => signPaint(() => slot.text, { fill: this.look.tagFill, ink: slot.colour, edge: slot.colour }, 700)(g, w, h), { text: true })
      slot.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: slot.tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false }))
      slot.tag.position.y = 2.25
      slot.tag.renderOrder = 10
      bean.root.add(slot.tag)
      this.scene.add(bean.root)
      this.ghosts.push(slot)
    }

    // The site's theme: dark by default, light by choice; Neon Night is night either way.
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      this.themeWatch = new MutationObserver(() => this.retheme())
      this.themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    }
    window.addEventListener(THEME_EVENT, this.onTheme)
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    this.retheme()

    // Signs and tags are painted before Outfit has come; paint them again once it has.
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([document.fonts.load('800 60px "Outfit"'), document.fonts.load('700 30px "Outfit"')])
        .then(() => {
          if (this.disposed) return
          for (const [tex] of this.painter.lettered) this.painter.repaint(tex)
        })
        .catch(() => {})
    }
  }

  private readonly onTheme = () => this.retheme()
  private readonly onLost = () => {
    this.lost = true
  }
  private readonly onRestored = () => {
    this.lost = false
  }

  /** Read the site's theme again: the sky, the fog, the materials' dimming, the trims, the goo, the ghosts' colours. */
  retheme() {
    if (this.disposed) return
    const night = !!this.course.theme.night
    const look = (this.look = night || isDarkTheme() ? LOOKS.dusk : LOOKS.day)
    const fog = this.scene.fog as THREE.Fog
    fog.color.set(look.fog)
    fog.near = look.fogNear
    fog.far = look.fogFar
    this.renderer.setClearColor(look.fog)
    this.tints.apply(look, night)
    this.world.applyLook(look, night)
    this.view.setFlagColours(look.flag, look.passed)
    this.shadow.setStrength(look.shadow)
    // The tags are painted again in the new look's colours next frame.
    for (const g of this.ghosts) g.colour = ''
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    // A tall screen's tags a little smaller.
    const k = this.camera.aspect < 1 ? 0.78 : 1
    for (const g of this.ghosts) g.tag.scale.set(0.2 * k, 0.05 * k, 1)
  }

  /** The next frame puts the camera straight behind the bean, and clears the puffs: a new run. */
  snap() {
    this.snapNext = true
    this.fx.clear()
    this.bean.reset()
    this.crowned = false
    this.view.takeCrown(false)
    this.held = false
    this.swing = 0
    this.kick = this.shake = 0
    for (const g of this.ghosts) g.bean.hide()
  }

  /** How the screen's drawing is going: calls and triangles at the last frame. */
  info() {
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }
  }

  /**
   * One step's events (run.ev, after step()): the juice. Call it every step, so nothing between frames is missed.
   */
  events(ev: readonly SimEvent[], run: Run) {
    if (this.disposed) return
    const b = run.bean
    const dust = this.course.theme.floors[0] ?? '#ffffff'
    for (const e of ev) {
      switch (e.k) {
        case 'jump':
        case 'bellyHop':
          this.bean.jumped()
          this.fx.dust(e.x, e.y, e.z, 5, dust, 1.2)
          break
        case 'land':
          this.bean.landed(e.v)
          if (e.v > 6) this.fx.dust(e.x, e.y, e.z, Math.min(14, Math.round(e.v)), dust, 1 + e.v * 0.12)
          break
        case 'dive':
          this.fx.dust(e.x, e.y, e.z, 4, '#ffffff', 1)
          break
        case 'slide':
          this.fx.dust(e.x, e.y, e.z, 8, dust, 2.2)
          break
        case 'bonk': {
          this.bean.bonked()
          const h = this.course.hazards[e.i]
          if (h && Math.hypot(h.x - e.x, h.z - e.z) < 4) this.view.pulseHazard(e.i)
          else this.view.pulseSolid(e.i)
          this.fx.sparkle(e.x, e.y + 1, e.z, '#ffffff', 6, 1.6)
          break
        }
        case 'knock':
          this.bean.knocked(b.vx, b.vz, 1.5)
          this.fx.sparkle(e.x, e.y + 1.1, e.z, CODE.gold, 10, 2.4)
          if (!this.calm) this.shake = 0.32
          break
        case 'yeet':
          this.bean.knocked(b.vx, b.vz, 2.5)
          this.fx.sparkle(e.x, e.y + 1.1, e.z, CODE.gold, 12, 3)
          if (!this.calm) {
            this.kick = 1
            this.shake = 0.25
          }
          break
        case 'closeCall':
          this.fx.sparkle(e.x, e.y + 0.9, e.z, '#ffffff', 12, 2.2)
          break
        case 'ledge':
          this.fx.dust(e.x, e.y, e.z, 5, dust, 1)
          break
        case 'bounce':
        case 'perfectBounce':
          this.view.pulseSolid(e.i)
          this.bean.jumped()
          if (!this.calm) this.kick = e.k === 'perfectBounce' ? 1 : 0.6
          this.fx.sparkle(e.x, e.y + 0.3, e.z, e.k === 'perfectBounce' ? CODE.gold : CODE.bouncy, e.k === 'perfectBounce' ? 18 : 8, 2.6)
          break
        case 'hoop':
          this.view.pulseHoop(e.i)
          if (!this.calm) this.kick = 1
          this.fx.sparkle(e.x, e.y + 0.8, e.z, CODE.helps, 16, 3)
          break
        case 'tileCrack':
          this.fx.dust(e.x, e.y, e.z, 3, '#ffffff', 0.8)
          break
        case 'tileDrop':
          this.fx.dust(e.x, e.y - 0.3, e.z, 6, '#d9c9ff', 1.4)
          break
        case 'fall':
          this.held = true
          break
        case 'splat':
          this.fx.splash(e.x, this.course.gooY + 0.1, e.z, mix(this.world.goo(), '#ffffff', 0.35))
          break
        case 'respawn':
          this.bean.respawned()
          this.held = false
          this.fx.sparkle(e.x, e.y + 0.8, e.z, '#ffffff', 10, 1.8)
          break
        case 'checkpoint': {
          const k = run.splits.length
          const flags = this.view.flagsOf(k)
          for (const f of flags) this.fx.confettiAt(f.x, f.y, f.z, 22, PARTY, f.x > e.x ? -0.4 : 0.4)
          if (!flags.length) this.fx.confettiAt(e.x, e.y + 1.5, e.z, 30, PARTY)
          this.fx.sparkle(e.x, e.y + 1, e.z, CODE.gold, 12, 2.4)
          break
        }
        case 'flag':
          this.fx.sparkle(e.x, e.y + 1, e.z, '#ffffff', 10, 2)
          break
        case 'crown':
          this.bean.crowned()
          this.crowned = true
          this.view.takeCrown(true)
          this.fx.confettiAt(e.x, e.y + 1.8, e.z, 60, PARTY)
          this.fx.sparkle(e.x, e.y + 1.6, e.z, CODE.gold, 30, 4)
          this.partyIn = 0.7
          break
        case 'go':
          this.fx.sparkle(e.x, e.y + 1, e.z + 6, '#ffffff', 16, 3)
          break
        default:
          break
      }
    }
  }

  frame(f: SceneFrame, dt: number) {
    if (this.disposed) return
    const course = this.course
    const run = f.run
    const calm = f.calm ?? this.calm
    this.fx.setCalm(calm)
    const live = f.mode !== 'menu' && run
    if (!live) this.idle += dt
    // On a start card the course runs on a clock of its own, from long before GO: everything that moves is
    // moving, and the start barrier is still up in front of the bean.
    const t = live ? (f.t ?? run.t) : this.idle - 600
    this.adapt(dt)

    // The bean: the run's, or waiting on the start pad on a start card with no run.
    const s = this.beanState
    if (run) {
      const b = run.bean
      const at = f.at ?? b
      s.x = at.x
      s.y = at.y
      s.z = at.z
      s.yaw = b.yaw
      s.vy = b.vy
      s.grounded = b.ground >= 0
      s.prone = prone(b)
      s.stunned = b.stun > 0 || b.yeet
      s.dead = b.dead > 0
      s.ledge = b.ledge > 0
      if (run.done && !this.crowned) {
        this.crowned = true
        this.bean.crowned()
        this.view.takeCrown(true)
      }
    } else {
      const sp = course.spawns[0]!
      s.x = sp.x
      s.y = sp.y
      s.z = sp.z
      s.yaw = 0
      s.vy = 0
      s.grounded = true
      s.prone = s.stunned = s.dead = s.ledge = false
    }
    this.bean.wear(f.skin ?? null)

    // The camera first: what's drawn is what's near it.
    this.placeCamera(f, s, dt, calm)
    this.view.update({
      t,
      world: run && live ? run.world : null,
      splits: run && live ? run.splits.length : 0,
      started: !!(run && live && run.t >= 0),
      slime: run && live ? slimeY(run) : NaN,
      cam: this.camera.position,
      bean: this.va.set(s.x, s.y, s.z),
      dt,
      calm,
    })

    // The bean, its eyes on the nearest hazard; sunk out of sight once it's in the goo.
    const look = this.view.nearestHazard(s.x, s.y + 1.1, s.z, t, 4, this.vb) ? this.vb : null
    this.bean.update(s, look, dt, calm)
    if (s.dead && s.y <= course.gooY + 0.3) this.bean.root.visible = false

    // The landing aid under it.
    if (s.dead) this.shadow.hide()
    else {
      const under = this.view.surfaceBelow(s.x, s.z, s.y + 0.05, t, run && live ? run.world : null)
      if (under) this.shadow.onSurface(s.x, under.y, s.z, under.gx, under.gz, s.y - under.y)
      else this.shadow.overGoo(s.x, course.gooY, s.z, s.y - course.gooY, mix(this.world.goo(), '#ffffff', 0.55), this.idle + t)
    }

    // Ghosts, in their colours, fading as they come alongside; the chased one's name over it.
    const ghosts = f.mode === 'menu' ? [] : (f.ghosts ?? [])
    for (let k = 0; k < this.ghosts.length; k++) {
      const slot = this.ghosts[k]!
      const g = ghosts[k]
      if (!g) {
        slot.bean.hide()
        continue
      }
      slot.bean.place(g.x, g.y, g.z, g.state, dt)
      const known = g.kind !== 'blue' && g.skin != null && beanLook(g.skin) !== beanLook(null) ? beanLook(g.skin) : null
      const colour = known ? mix(known.body, '#ffffff', 0.35) : g.kind === 'blue' ? this.look.blue : g.kind === 'mine' ? this.look.mine : this.look.ghost
      slot.bean.body.color.set(colour)
      slot.bean.visor.color.set(known ? mix(known.visor, '#ffffff', 0.3) : mix(colour, '#ffffff', 0.55))
      const d = Math.hypot(g.x - s.x, g.y - s.y, g.z - s.z)
      const base = g.kind === 'blue' ? 0.52 : 0.44
      const near = Math.max(0.42, Math.min(1, (d - 0.4) / 2.6))
      const fade = g.state === 2 ? 0.35 : 1
      slot.bean.body.opacity = base * near * fade
      slot.bean.visor.opacity = base * near * fade
      const tag = g.tag ?? ''
      if (tag !== slot.text || colour !== slot.colour) {
        slot.text = tag
        slot.colour = colour
        this.paintTag(slot)
      }
      slot.tag.visible = !!tag
      // Faded in with distance, and out once the ghost is behind the bean: the tag would sit over the bean's own body.
      const behind = Math.max(0, Math.min(1, (g.z - s.z + 2) / 2))
      ;(slot.tag.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(1, (d - 3) / 4)) * behind
    }

    // Moments: glints off gold pieces, sparkles round the crown, confetti after the finish.
    if (dt > 0 && !calm) {
      this.glintIn -= dt
      if (this.glintIn <= 0) {
        this.glintIn = 0.3 + this.rnd() * 0.3
        if (this.view.goldGlint(this.camera.position.z, this.va)) this.fx.sparkle(this.va.x, this.va.y, this.va.z, CODE.gold, 3, 0.8)
      }
      this.crownSparkIn -= dt
      if (this.crownSparkIn <= 0) {
        this.crownSparkIn = 0.18
        if (this.view.crownAt(t, this.va) && Math.abs(this.va.z - s.z) < 45) this.fx.sparkle(this.va.x + (this.rnd() - 0.5), this.va.y + (this.rnd() - 0.3), this.va.z + (this.rnd() - 0.5), CODE.gold, 2, 0.7)
      }
      if (f.mode === 'done' && (f.doneFor ?? 0) < 4) {
        this.partyIn -= dt
        if (this.partyIn <= 0) {
          this.partyIn = 0.8
          this.bean.head(this.va)
          this.fx.confettiAt(this.va.x + (this.rnd() - 0.5) * 3, this.va.y + 1, this.va.z + 1, 18, PARTY)
        }
      }
    }

    this.world.update(this.idle + Math.max(0, t), this.camera.position, dt, this.fx, calm)
    this.fx.update(dt)
    if (!this.lost) this.renderer.render(this.scene, this.camera)
  }

  private paintTag(slot: { tex: THREE.CanvasTexture }) {
    this.painter.repaint(slot.tex)
  }

  /**
   * The camera (design-final §6 #10): behind the bean, looking down the course, never turning; the round's preset
   * (default, wide, climb, slide) blended over 0.8 s; wider on a tall screen and nearer on a wide one. Its height
   * follows the ground the bean last stood on, so hops don't shake it, rising with big flights and holding still
   * while the bean falls. A splat holds it a moment; a respawn far away jumps it there.
   */
  private placeCamera(f: SceneFrame, s: BeanState, dt: number, calm: boolean) {
    const course = this.course
    const cam = this.camera
    const aspect = cam.aspect || 1
    // Portrait: a set view across (8.2 m at the bean); landscape: a set 50° up and down, from a little nearer.
    const across = aspect < 1 ? (2 * Math.atan(TAN_HALF / aspect) * 180) / Math.PI : 50
    const baseFov = Math.max(50, Math.min(76, across))
    const near = aspect <= 0.75 ? 1 : aspect >= 1.3 ? 0.82 : 1 - ((aspect - 0.75) / 0.55) * 0.18

    if (f.mode === 'menu') {
      // The start card: a slow flyover of the gauntlet from the start (held at the start with reduced motion).
      this.menuZ = calm ? 2 : this.menuZ + dt * 7
      if (this.menuZ > course.length + 8) this.menuZ = -6
      const z = this.menuZ
      const x = centreAt(course, z + 10)
      const y = Math.max(0, this.baseAt(z + 10))
      cam.position.set(x, y + 11 * near + 3, z - 13 * near)
      cam.fov = baseFov
      // On a portrait screen the card covers all but the top quarter or so (wobblerun.css): the view slides up (an
      // offset, not a turn) till the horizon is just under the top, so the gauntlet fills the clear band above the
      // card rather than the sky. The horizon sits up from the middle by the look's drop over its reach.
      const sky = 0.5 - (0.5 * ((11 * near + 2.5) / (13 * near + 14))) / Math.tan((baseFov * Math.PI) / 360)
      const lift = aspect < 1 ? Math.max(0, sky - MENU_SKY) : 0
      if (lift > 0) cam.setViewOffset(aspect, 1, 0, lift, aspect, 1)
      else if (cam.view?.enabled) cam.clearViewOffset()
      cam.updateProjectionMatrix()
      cam.lookAt(x, y + 0.5, z + 14)
      this.snapNext = true
      return
    }
    // Off the start card, the view is centred again.
    if (cam.view?.enabled) cam.clearViewOffset()

    const preset = CAMS[cameraAt(course, s.z)]
    const k = this.snapNext ? 1 : 1 - Math.exp(-dt * 4.5)
    this.cam.back += (preset.back - this.cam.back) * k
    this.cam.up += (preset.up - this.cam.up) * k
    this.cam.ahead += (preset.ahead - this.cam.ahead) * k
    this.cam.lookY += (preset.lookY - this.cam.lookY) * k
    this.cam.fov += (preset.fov - this.cam.fov) * k

    // Where it follows: across, mostly the bean, partly the track's middle; along, the bean; up, the ground.
    const mid = centreAt(course, s.z)
    const wantX = mid + (s.x - mid) * 0.72
    if (s.grounded && !s.dead) this.groundY = s.y
    let wantY = this.groundY
    if (!s.grounded && s.y > this.groundY + 2.2) wantY = s.y - 2.2
    // Back in from a splat: jump there if it's far, ease if it's near.
    if (this.wasDead && !s.dead && Math.hypot(s.z - this.focus.z, s.y - this.focus.y) > 12) this.snapNext = true
    this.wasDead = s.dead
    if (this.snapNext) {
      this.focus.set(wantX, s.dead ? this.groundY : s.y, s.z)
      this.groundY = this.focus.y
      this.snapNext = false
    } else if (!(this.held && s.dead)) {
      this.focus.x += (wantX - this.focus.x) * (1 - Math.exp(-dt * 5))
      this.focus.y += (wantY - this.focus.y) * (1 - Math.exp(-dt * (wantY > this.focus.y ? 6 : 4)))
      this.focus.z += (s.z - this.focus.z) * (1 - Math.exp(-dt * 14))
    }
    const fx = this.focus.x
    const fy = this.focus.y
    const fz = this.focus.z
    const back = this.cam.back * near
    const up = this.cam.up * near
    this.eye.set(fx, fy + up, fz - back)
    this.target.set(fx, fy + this.cam.lookY, fz + this.cam.ahead)

    // Falling: the camera stays where it was and looks down after the bean, to see the splash.
    if (s.dead || (this.held && s.y < this.groundY - 1)) {
      this.vb.set(s.x, Math.max(s.y, course.gooY), s.z)
      this.target.lerp(this.vb, 0.55)
    }

    // After the crown: round to the bean's front, looking at it with the crown on its head.
    if (f.mode === 'done') {
      const want = calm ? 0 : Math.min(1, (f.doneFor ?? 0) / 1.3)
      this.swing += (want - this.swing) * (1 - Math.exp(-dt * 6))
      const e = this.swing * this.swing * (3 - 2 * this.swing)
      if (e > 0.001) {
        const a = e * Math.PI * 0.82
        const r = 6.2
        this.va.set(s.x + Math.sin(a) * r * 0.55, s.y + 2.6 - e * 0.6, s.z - Math.cos(a) * r)
        this.eye.lerp(this.va, e)
        this.vb.set(s.x, s.y + 1.2, s.z)
        this.target.lerp(this.vb, e)
      }
    }

    // Kicks and shakes: a wider view for a moment on boosts and yeets, a shake on knocks.
    this.kick = Math.max(0, this.kick - dt / 0.3)
    this.shake = Math.max(0, this.shake - dt * 1.1)
    if (!calm && this.shake > 0) {
      const a = this.shake * this.shake
      this.eye.x += Math.sin(this.idle * 61) * a
      this.eye.y += Math.sin(this.idle * 47 + 1) * a * 0.7
    }
    cam.position.copy(this.eye)
    cam.fov = baseFov + this.cam.fov + (calm ? 0 : 4 * this.kick)
    cam.updateProjectionMatrix()
    cam.lookAt(this.target)
  }

  private baseAt(z: number): number {
    for (const r of this.course.rounds) if (z >= r.z0 && z < r.z1) return r.y
    for (const p of this.course.pieces) if (z >= p.z0 && z < p.z1) return p.y
    return 0
  }

  /** A phone that can't keep up: draw at a lower density (the spec's 1.25 once frames run over 20 ms for 2 s). */
  private adapt(dt: number) {
    if (this.lowered || this.preview || dt <= 0) return
    this.slowFrames = dt > 0.02 ? this.slowFrames + dt : Math.max(0, this.slowFrames - dt * 0.5)
    if (this.slowFrames > 2 && this.pixelRatio > 1.25) {
      this.lowered = true
      this.pixelRatio = 1.25
      this.renderer.setPixelRatio(1.25)
      if (this.width > 0) this.renderer.setSize(this.width, this.height, false)
    }
  }

  dispose() {
    this.disposed = true
    this.themeWatch?.disconnect()
    window.removeEventListener(THEME_EVENT, this.onTheme)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('webglcontextlost', this.onLost)
    canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = mesh.material
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) m.dispose()
    })
    this.painter.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
