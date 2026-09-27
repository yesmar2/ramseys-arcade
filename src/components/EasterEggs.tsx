import { useEffect, useRef, useState } from 'react'
import { rankHref } from '../hooks/useHashRoute'
import { applyEightBit, blipFound, EIGHT_BIT_EVENT, isEightBit, rememberBlip, reportEgg, setEightBit } from '../lib/eggs'
import { SECRET_EVENT, type SecretFound } from '../lib/secrets'
import { SecretArt } from './TrophyArt'
import '../styles/eggs.css'

/*
 * The site's easter eggs, on every page (lib/eggs.ts), and the pop-up that says a secret was found
 * (lib/secrets.ts), wherever it was found: a run, a bug, a day's hole or an egg.
 *
 * - The old cheat code, ↑↑↓↓←→←→ then B A on a keyboard, or the same swipes then two taps on a phone,
 *   turns the arcade 8-bit, and back. Its clue is scratched faintly into the footer.
 * - Seven quick taps on the logo make it blip. Its clue: till a device has done it, the logo's blip
 *   sends out two rings now and then, as if it wants a tap.
 */

type Token = 'up' | 'down' | 'left' | 'right' | 'b' | 'a' | 'tap'

const KEYS: readonly Token[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']
const SWIPES: readonly Token[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'tap', 'tap']

const KEY_TOKENS: Record<string, Token> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  b: 'b',
  B: 'b',
  a: 'a',
  A: 'a',
}

/** Taps on the logo, each within this of the one before, that count towards the blip. */
const TAP_GAP_MS = 1200
const TAPS_TO_BLIP = 7

/** The logo's first ping comes this long after the site opens, then one every so often. */
const PING_FIRST_MS = 6000
const PING_GAP_MS: readonly [number, number] = [25_000, 45_000]

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'))
}

const endsWith = (seen: readonly Token[], code: readonly Token[]) =>
  seen.length >= code.length && code.every((t, i) => seen[seen.length - code.length + i] === t)

export function EasterEggs() {
  const [eightBit, setOn] = useState(isEightBit)
  const [shown, setShown] = useState<SecretFound[]>([])

  // As this device last had it.
  useEffect(() => {
    applyEightBit()
    const sync = () => setOn(isEightBit())
    window.addEventListener(EIGHT_BIT_EVENT, sync)
    return () => window.removeEventListener(EIGHT_BIT_EVENT, sync)
  }, [])

  // The cheat code, by keys or by swipes.
  useEffect(() => {
    let seen: Token[] = []
    const push = (token: Token) => {
      seen = [...seen, token].slice(-KEYS.length)
      if (endsWith(seen, KEYS) || endsWith(seen, SWIPES)) {
        seen = []
        const on = !isEightBit()
        setEightBit(on)
        if (on) void reportEgg('konami')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      const token = KEY_TOKENS[e.key]
      if (token) push(token)
      else seen = []
    }
    let start: { x: number; y: number; at: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      start = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, at: e.timeStamp } : null
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!start || !t) return
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const ms = e.timeStamp - start.at
      start = null
      if (ms > 700) return
      const far = Math.max(Math.abs(dx), Math.abs(dy))
      if (far < 12 && ms < 350) push('tap')
      else if (far >= 40) push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Seven quick taps on the logo: it wobbles from the third, and blips on the seventh.
  useEffect(() => {
    let taps = 0
    let last = 0
    const onClick = (e: MouseEvent) => {
      const brand = (e.target as Element | null)?.closest?.('.site-bar__brand')
      if (!(brand instanceof HTMLElement)) return
      taps = e.timeStamp - last < TAP_GAP_MS ? taps + 1 : 1
      last = e.timeStamp
      const cue = taps >= TAPS_TO_BLIP ? 'egg-blip' : taps >= 3 ? 'egg-wobble' : null
      if (!cue) return
      brand.classList.remove('egg-wobble', 'egg-blip')
      // A fresh frame, so the same animation starts again.
      void brand.offsetWidth
      brand.classList.add(cue)
      if (cue === 'egg-blip') {
        taps = 0
        rememberBlip()
        void reportEgg('blip')
      }
    }
    const onEnd = (e: AnimationEvent) => {
      const target = e.target as Element | null
      if (e.animationName === 'egg-wobble' || e.animationName === 'egg-blip-ring') {
        target?.closest?.('.site-bar__brand')?.classList.remove('egg-wobble', 'egg-blip')
      } else if (e.animationName === 'brand-ping' && !target?.nextElementSibling) {
        // The second ring is the last to fade.
        target?.closest?.('.site-bar__brand')?.classList.remove('egg-ping')
      }
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('animationend', onEnd, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('animationend', onEnd, true)
    }
  }, [])

  // The blip's clue: now and then, till this device has made it blip, the logo sends out two rings.
  useEffect(() => {
    if (blipFound() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let id = 0
    const ping = () => {
      if (blipFound()) return
      const brand = document.querySelector<HTMLElement>('.site-bar__brand')
      // Not on a game's screen (it has no header), in a hidden tab, or while someone is tapping the logo.
      if (brand && !document.hidden && !brand.matches('.egg-wobble, .egg-blip')) {
        brand.classList.remove('egg-ping')
        void brand.offsetWidth
        brand.classList.add('egg-ping')
      }
      id = window.setTimeout(ping, PING_GAP_MS[0] + Math.random() * (PING_GAP_MS[1] - PING_GAP_MS[0]))
    }
    id = window.setTimeout(ping, PING_FIRST_MS)
    return () => window.clearTimeout(id)
  }, [])

  // Secrets found, one pop-up at a time.
  useEffect(() => {
    const onFound = (e: Event) => {
      const secret = (e as CustomEvent<SecretFound>).detail
      if (secret) setShown((list) => (list.some((s) => s.n === secret.n) ? list : [...list, secret]))
    }
    window.addEventListener(SECRET_EVENT, onFound)
    return () => window.removeEventListener(SECRET_EVENT, onFound)
  }, [])

  return (
    <>
      {eightBit ? (
        <button type="button" className="eightbit-off" onClick={() => setEightBit(false)}>
          8-bit mode <span aria-hidden="true">·</span> <b>Turn off</b>
        </button>
      ) : null}
      {shown[0] ? <SecretToast key={shown[0].n} secret={shown[0]} onDone={() => setShown((list) => list.slice(1))} /> : null}
    </>
  )
}

/** A secret found: its picture, its name and what it's for, for a few seconds. */
function SecretToast({ secret, onDone }: { secret: SecretFound; onDone: () => void }) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 7000)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="secret-toast" role="status">
      <span className="secret-toast__tile trophy-tone--secret">
        <SecretArt n={secret.n} size="md" />
      </span>
      <span className="secret-toast__words">
        <span className="secret-toast__kicker">{secret.signedOut ? 'You found a secret' : 'Secret found'}</span>
        <b className="secret-toast__name">{secret.name}</b>
        <span className="secret-toast__says">
          {secret.signedOut ? 'Sign in and find it again to keep it on your shelf.' : secret.says}
        </span>
        {secret.signedOut ? null : (
          <a className="secret-toast__link" href={rankHref(undefined, 'all', 'trophies')} onClick={onDone}>
            On your shelf ›
          </a>
        )}
      </span>
      <button type="button" className="secret-toast__close" aria-label="Close" onClick={onDone}>
        ×
      </button>
    </div>
  )
}
