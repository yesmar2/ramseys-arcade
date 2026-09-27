import { useEffect, useRef, useState } from 'react'
import { aimSaver, saverAt, saverHeading, type SaverPlan } from '../lib/blipSaver'
import { reportEgg } from '../lib/eggs'
import { sfx } from '../lib/sound'
import { BrandMark } from './BrandMark'

/*
 * The screen saver, an easter egg (lib/eggs.ts): leave the site alone for a minute and the screen dims, and
 * the blip bounces round it like an old DVD player's logo, a new colour at every wall. Its path is aimed
 * (lib/blipSaver.ts) to land exactly in a corner half a minute or so in, and a corner finds the Perfect
 * Corner secret. Not on a game's screen, over an open dialog, while someone types, or for anyone who asks
 * their device for less motion. Anything touched brings the page back. ?saver=now starts it at once, and
 * ?saver=corner has its first corner come in seconds.
 */

/** A minute with nothing touched, and the saver comes on. */
const IDLE_MS = 60_000
/** Seconds to the first corner, and to each one after. */
const FIRST_CORNER: readonly [number, number] = [16, 36]
const NEXT_CORNER: readonly [number, number] = [40, 75]
/** Near enough to a corner, as it meets a wall, to be one. */
const CORNER_SLACK_PX = 3
/** A pointer that moves this far is someone back. */
const WAKE_MOVE_PX = 14
const COLOURS = ['#3ee0b0', '#ff6b9d', '#ffd166', '#7aa2ff', '#c792ea', '#ff9f43', '#5ce1e6']

const lessMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

function canStart(): boolean {
  if (document.hidden || lessMotion()) return false
  // A game's screen has no header.
  if (!document.querySelector('.site-bar__brand')) return false
  const el = document.activeElement as HTMLElement | null
  if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return false
  return !document.querySelector('[aria-modal="true"], dialog[open], [role="dialog"]')
}

const between = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo)
const either = (): 1 | -1 => (Math.random() < 0.5 ? 1 : -1)

/** To see it without the wait: ?saver=now starts it as soon as it can; ?saver=corner also brings the corner in seconds. */
function askedFor(): 'now' | 'corner' | null {
  const asked = new URLSearchParams(window.location.search).get('saver')
  return asked === 'now' || asked === 'corner' ? asked : null
}

const QUICK_CORNER: readonly [number, number] = [3, 4]

export function BlipSaver() {
  const [on, setOn] = useState<false | 'idle' | 'now' | 'corner'>(false)

  useEffect(() => {
    if (lessMotion()) return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => (canStart() ? setOn((was) => was || 'idle') : arm()), IDLE_MS)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    for (const name of events) window.addEventListener(name, arm, { capture: true, passive: true })
    arm()
    const asked = askedFor()
    let tries = 0
    let soon = 0
    const ask = () => {
      if (canStart()) setOn(asked ?? 'now')
      else if (++tries < 20) soon = window.setTimeout(ask, 1000)
    }
    if (asked) soon = window.setTimeout(ask, 600)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(soon)
      for (const name of events) window.removeEventListener(name, arm, { capture: true })
    }
  }, [])

  return on ? <SaverScreen quickCorner={on === 'corner'} onWake={() => setOn(false)} /> : null
}

type Burst = { x: number; y: number; key: number }

function SaverScreen({ quickCorner, onWake }: { quickCorner: boolean; onWake: () => void }) {
  const logoRef = useRef<HTMLDivElement>(null)
  const [burst, setBurst] = useState<Burst | null>(null)
  const wake = useRef(onWake)
  useEffect(() => {
    wake.current = onWake
  })

  // Anything but a tap on the screen itself (which is its own click) brings the page back.
  useEffect(() => {
    let from: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (!from) from = { x: e.clientX, y: e.clientY }
      else if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > WAKE_MOVE_PX) wake.current()
    }
    const onKey = () => wake.current()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onKey, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onKey)
    }
  }, [])

  useEffect(() => {
    const logo = logoRef.current
    if (!logo) return
    let t = 0
    let walls = { x: 0, y: 0 }
    let colour = Math.floor(Math.random() * COLOURS.length)
    const paint = () => {
      logo.style.color = COLOURS[colour]!
    }
    const room = () => {
      const box = logo.getBoundingClientRect()
      return { w: Math.max(0, window.innerWidth - box.width), h: Math.max(0, window.innerHeight - box.height) }
    }
    /** A fresh path from here, its clock back at nought. */
    const aim = (x: number, y: number, dirX: 1 | -1, dirY: 1 | -1, corner: readonly [number, number]): SaverPlan => {
      const { w, h } = room()
      const next = aimSaver({
        w,
        h,
        x,
        y,
        dirX,
        dirY,
        speed: Math.min(Math.max(Math.min(w, h) * 0.25, 55), 140),
        angle: ((30 + Math.random() * 30) * Math.PI) / 180,
        cornerIn: between(corner),
      })
      t = 0
      const at = saverAt(next, 0)
      walls = { x: at.wallsX, y: at.wallsY }
      return next
    }
    const place = (x: number, y: number) => {
      logo.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
    const start = room()
    let plan = aim(Math.random() * start.w, Math.random() * start.h, either(), either(), quickCorner ? QUICK_CORNER : FIRST_CORNER)
    paint()
    place(saverAt(plan, 0).x, saverAt(plan, 0).y)

    /** At the wall just met on one line, how far the other line was from a wall of its own. */
    const cornerGap = (line: 'x' | 'y', wall: number) => {
      const when = line === 'x' ? (wall * plan.w - plan.x0) / plan.vx : (wall * plan.h - plan.y0) / plan.vy
      const at = saverAt(plan, when)
      return line === 'x' ? Math.min(at.y, plan.h - at.y) : Math.min(at.x, plan.w - at.x)
    }

    let raf = 0
    let last = 0
    const frame = (now: number) => {
      // A hidden tab stops the clock rather than letting it run on unseen.
      t += last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      const at = saverAt(plan, t)
      let corner = false
      if (at.wallsX !== walls.x || at.wallsY !== walls.y) {
        colour = (colour + 1) % COLOURS.length
        paint()
        if (at.wallsX !== walls.x && cornerGap('x', Math.max(at.wallsX, walls.x)) <= CORNER_SLACK_PX) corner = true
        if (at.wallsY !== walls.y && cornerGap('y', Math.max(at.wallsY, walls.y)) <= CORNER_SLACK_PX) corner = true
        walls = { x: at.wallsX, y: at.wallsY }
      }
      if (corner) {
        const cx = at.x < plan.w / 2 ? 0 : plan.w
        const cy = at.y < plan.h / 2 ? 0 : plan.h
        place(cx, cy)
        setBurst({ x: cx === 0 ? 0 : window.innerWidth, y: cy === 0 ? 0 : window.innerHeight, key: now })
        sfx('perfect')
        void reportEgg('corner')
        plan = aim(cx, cy, cx === 0 ? 1 : -1, cy === 0 ? 1 : -1, NEXT_CORNER)
      } else {
        place(at.x, at.y)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // A new size of screen: the same place and heading, aimed afresh.
    const onResize = () => {
      const at = saverAt(plan, t)
      const heading = saverHeading(plan, t)
      plan = aim(at.x, at.y, heading.dirX, heading.dirY, FIRST_CORNER)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [quickCorner])

  return (
    <div className="blip-saver" role="presentation" onClick={() => wake.current()}>
      <div ref={logoRef} className="blip-saver__logo" aria-hidden="true">
        <BrandMark />
      </div>
      {burst ? (
        <div key={burst.key} className="blip-saver__burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true" />
      ) : null}
      {burst ? (
        <p key={`${burst.key}-says`} className="blip-saver__cheer" aria-live="polite">
          Perfect corner!
        </p>
      ) : null}
      <p className="blip-saver__hint">Tap anywhere to come back</p>
    </div>
  )
}
