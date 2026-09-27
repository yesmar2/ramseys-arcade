import { useEffect, useRef, useState } from 'react'
import { rankHref } from '../hooks/useHashRoute'
import { applyEightBit, EIGHT_BIT_EVENT, eggDone, isEightBit, reportEgg, setEightBit } from '../lib/eggs'
import { EGG_LETTERS_KEPT, EGG_WORD_EVENT, eggWordTyped, playEggWord, type EggWordSaid } from '../lib/eggWords'
import { SECRET_EVENT, type SecretFound } from '../lib/secrets'
import { sfx } from '../lib/sound'
import { BlipSaver } from './BlipSaver'
import { SecretArt } from './TrophyArt'
import '../styles/eggs.css'

/*
 * The site's easter eggs, on every page (lib/eggs.ts), and the pop-up that says a secret was found
 * (lib/secrets.ts), wherever it was found: a run, a bug, a day's hole or an egg.
 *
 * - The old cheat code, ↑↑↓↓←→←→ then B A on a keyboard, or just the same swipes on a phone (it has no B
 *   or A to press), turns the arcade 8-bit, and back. Its clue is scratched very faintly into the footer,
 *   without the B A on a phone. A game's own arrows and swipes don't count.
 * - Seven quick taps on the logo make it blip. Its clue: till a device has done it, the logo's blip
 *   sends out two rings now and then, as if it wants a tap.
 * - Words (lib/eggWords.ts), searched or typed anywhere: a barrel roll spins the page, and old game cheats
 *   answer back, iddqd with ten seconds of gold.
 * - The screen saver, after a minute left alone (BlipSaver.tsx).
 */

/** The same word again this soon is a double press, not a second go. */
const WORD_AGAIN_MS = 2500
/** How long a cheat's answer stays up, and god mode lasts. */
const REPLY_MS = 3600
const GOD_MODE_MS = 10_000

type Token = 'up' | 'down' | 'left' | 'right' | 'b' | 'a'

/** The code on a keyboard, and on a phone: the same arrows as swipes, since a phone has no B or A. */
const KEYS: readonly Token[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']
const SWIPES: readonly Token[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right']

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

/** A game's screen (it has no header), where arrows, swipes and letters are the game's. */
const onGameScreen = () => !document.querySelector('.site-bar__brand')

const endsWith = (seen: readonly Token[], code: readonly Token[]) =>
  seen.length >= code.length && code.every((t, i) => seen[seen.length - code.length + i] === t)

type WithViewTransition = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } }

/**
 * The screen does a barrel roll: a picture of all of it turns once round (a view transition, styled in
 * eggs.css), header and tab bar too, and hands back to the page. Without view transitions, the page's
 * main part turns instead.
 */
function barrelRoll() {
  const root = document.documentElement
  if (root.classList.contains('egg-rolling')) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const doc = document as WithViewTransition
  if (doc.startViewTransition) {
    root.classList.add('egg-rolling')
    sfx('whoosh')
    void doc
      .startViewTransition(() => undefined)
      .finished.catch(() => undefined)
      .finally(() => root.classList.remove('egg-rolling'))
    return
  }
  const main = document.querySelector<HTMLElement>('main')
  if (!main) return
  const box = main.getBoundingClientRect()
  const middle = Math.min(Math.max(window.innerHeight / 2 - box.top, 0), box.height)
  main.style.transformOrigin = `50% ${middle}px`
  document.documentElement.classList.add('egg-rolling')
  main.classList.add('egg-roll')
  sfx('whoosh')
  main.addEventListener(
    'animationend',
    () => {
      main.classList.remove('egg-roll')
      main.style.transformOrigin = ''
      document.documentElement.classList.remove('egg-rolling')
    },
    { once: true },
  )
}

export function EasterEggs() {
  const [eightBit, setOn] = useState(isEightBit)
  const [shown, setShown] = useState<SecretFound[]>([])
  const [reply, setReply] = useState<{ text: string; key: number } | null>(null)
  const [godMode, setGodMode] = useState(false)

  // A word said: its effect, its answer, and its secret.
  useEffect(() => {
    let lastWord = ''
    let lastAt = 0
    let replyTimer = 0
    let godTimer = 0
    const onWord = (e: Event) => {
      const said = (e as CustomEvent<EggWordSaid>).detail
      if (!said) return
      const { word } = said
      const now = Date.now()
      if (word.words === lastWord && now - lastAt < WORD_AGAIN_MS) return
      lastWord = word.words
      lastAt = now
      if (word.effect === 'roll') barrelRoll()
      else if (said.in === 'keys') {
        setReply({ text: word.reply, key: now })
        window.clearTimeout(replyTimer)
        replyTimer = window.setTimeout(() => setReply(null), REPLY_MS)
      }
      if (word.effect === 'god') {
        setGodMode(true)
        sfx('perfect')
        window.clearTimeout(godTimer)
        godTimer = window.setTimeout(() => setGodMode(false), GOD_MODE_MS)
      }
      void reportEgg(word.egg)
    }
    window.addEventListener(EGG_WORD_EVENT, onWord)
    return () => {
      window.removeEventListener(EGG_WORD_EVENT, onWord)
      window.clearTimeout(replyTimer)
      window.clearTimeout(godTimer)
    }
  }, [])

  // Letters typed anywhere nothing else is taking them, for the words.
  useEffect(() => {
    let letters = ''
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || onGameScreen()) return
      if (!/^[a-z]$/i.test(e.key)) return
      letters = (letters + e.key.toLowerCase()).slice(-EGG_LETTERS_KEPT)
      const word = eggWordTyped(letters)
      if (word) {
        letters = ''
        playEggWord(word, 'keys')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // As this device last had it.
  useEffect(() => {
    applyEightBit()
    const sync = () => setOn(isEightBit())
    window.addEventListener(EIGHT_BIT_EVENT, sync)
    return () => window.removeEventListener(EIGHT_BIT_EVENT, sync)
  }, [])

  // The cheat code, by keys or by swipes, anywhere but a game's screen.
  useEffect(() => {
    let keys: Token[] = []
    let swipes: Token[] = []
    const found = () => {
      keys = []
      swipes = []
      const on = !isEightBit()
      setEightBit(on)
      if (on) void reportEgg('konami')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || onGameScreen()) return
      const token = KEY_TOKENS[e.key]
      if (!token) {
        keys = []
        return
      }
      keys = [...keys, token].slice(-KEYS.length)
      if (endsWith(keys, KEYS)) found()
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
      if (ms > 700 || Math.max(Math.abs(dx), Math.abs(dy)) < 40 || onGameScreen()) return
      const way: Token = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      swipes = [...swipes, way].slice(-SWIPES.length)
      if (endsWith(swipes, SWIPES)) found()
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
    if (eggDone('blip') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let id = 0
    const ping = () => {
      if (eggDone('blip')) return
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
      {reply ? (
        <p key={reply.key} className="cheat-reply" role="status">
          {reply.text}
        </p>
      ) : null}
      {godMode ? <div className="god-mode" aria-hidden="true" /> : null}
      <BlipSaver />
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
