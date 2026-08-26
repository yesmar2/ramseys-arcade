const MUTE_KEY = 'fordriva-mute'
const MUSIC_KEY = 'fordriva-music'
const LEGACY_MUTE_KEYS = ['acralia-mute', 'archivade-mute'] as const
const LEGACY_MUSIC_KEYS = ['acralia-music', 'archivade-music'] as const
const MASTER_GAIN = 0.22
const MUSIC_GAIN = 0.07
const MUSIC_STEP = 1.28
const MUSIC_LOOP = [
  261.6, 0, 329.6, 0,
  392.0, 0, 329.6, 0,
  293.7, 0, 329.6, 0,
  261.6, 0, 196.0, 0,
]

export type SoundName =
  | 'place'
  | 'perfect'
  | 'chop'
  | 'eat'
  | 'fire'
  | 'hit'
  | 'boom'
  | 'hurt'
  | 'die'
  | 'wave'
  | 'tap'
  | 'pad'
  | 'good'
  | 'miss'

const PENT = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3]

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicGain: GainNode | null = null
let muted = readMuted()
let musicVol = readMusicVol()
let musicHolders = 0
let musicWanted = false
let musicTimer: number | null = null
let nextNoteTime = 0
let loopStep = 0
let padNodes: AudioNode[] = []

function readMuted() {
  try {
    let raw = localStorage.getItem(MUTE_KEY)
    if (raw == null) {
      for (const key of LEGACY_MUTE_KEYS) {
        raw = localStorage.getItem(key)
        if (raw != null) {
          localStorage.setItem(MUTE_KEY, raw)
          break
        }
      }
    }
    return raw === '1'
  } catch {
    return false
  }
}

function readMusicVol() {
  try {
    let raw = localStorage.getItem(MUSIC_KEY)
    if (raw == null) {
      for (const key of LEGACY_MUSIC_KEYS) {
        raw = localStorage.getItem(key)
        if (raw != null) {
          localStorage.setItem(MUSIC_KEY, raw)
          break
        }
      }
    }
    if (raw == null) return 0.55
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0.55
    return Math.min(1, Math.max(0, n))
  } catch {
    return 0.55
  }
}

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_GAIN
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.4
    musicGain = ctx.createGain()
    musicGain.gain.value = musicLevel()
    musicGain.connect(master)
    master.connect(filter)
    filter.connect(ctx.destination)
  }
  return ctx
}

function musicLevel() {
  if (muted || typeof document !== 'undefined' && document.hidden) return 0
  return MUSIC_GAIN * musicVol
}

function applyMusicGain() {
  if (!ctx || !musicGain) return
  musicGain.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.06)
}

export function unlockSound() {
  const audio = getCtx()
  if (!audio) return
  const go = () => {
    if (musicWanted && musicHolders > 0) runMusic()
  }
  if (audio.state === 'suspended') void audio.resume().then(go)
  else go()
}

export function isMuted() {
  return muted
}

export function getMusicVolume() {
  return musicVol
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  const audio = getCtx()
  if (audio && master) {
    master.gain.setTargetAtTime(next ? 0 : MASTER_GAIN, audio.currentTime, 0.03)
  }
  applyMusicGain()
  if (!next) unlockSound()
}

export function setMusicVolume(next: number) {
  musicVol = Math.min(1, Math.max(0, next))
  try {
    localStorage.setItem(MUSIC_KEY, String(musicVol))
  } catch {
    /* ignore */
  }
  applyMusicGain()
  if (musicVol > 0 && muted) setMuted(false)
  else unlockSound()
}

export function acquireMusic() {
  musicHolders += 1
  musicWanted = true
  unlockSound()
}

export function releaseMusic() {
  musicHolders = Math.max(0, musicHolders - 1)
  if (musicHolders > 0) return
  silenceMusic()
}

/** Stop background music immediately, even if a holder leaked. */
export function silenceMusic() {
  musicHolders = 0
  musicWanted = false
  if (musicTimer != null) {
    window.clearTimeout(musicTimer)
    musicTimer = null
  }
  stopPad()
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime)
    musicGain.gain.setValueAtTime(0, ctx.currentTime)
  }
}

function runMusic() {
  const audio = getCtx()
  if (!audio || !musicWanted || audio.state === 'suspended') return
  if (musicTimer == null) {
    nextNoteTime = audio.currentTime + 0.08
    loopStep = 0
    startPad(audio)
    scheduleMusic()
  }
  applyMusicGain()
}

function scheduleMusic() {
  const audio = ctx
  if (!audio || !musicWanted) return
  while (nextNoteTime < audio.currentTime + 0.24) {
    const freq = MUSIC_LOOP[loopStep % MUSIC_LOOP.length]
    if (freq) musicNote(audio, freq, nextNoteTime)
    nextNoteTime += MUSIC_STEP
    loopStep += 1
  }
  musicTimer = window.setTimeout(scheduleMusic, 100)
}

function musicNote(audio: AudioContext, freq: number, when: number) {
  if (!musicGain) return
  const dur = 1.7
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.22, when + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g)
  g.connect(musicGain)
  osc.start(when)
  osc.stop(when + dur + 0.05)
}

function startPad(audio: AudioContext) {
  if (!musicGain || padNodes.length) return
  const make = (freq: number, gain: number) => {
    const osc = audio.createOscillator()
    const g = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.value = gain
    osc.connect(g)
    g.connect(musicGain as GainNode)
    osc.start()
    padNodes.push(osc, g)
  }
  make(130.8, 0.16)
  make(196.0, 0.09)
}

function stopPad() {
  for (const node of padNodes) {
    try {
      if (node instanceof OscillatorNode) node.stop()
      node.disconnect()
    } catch {
      /* already stopped */
    }
  }
  padNodes = []
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', applyMusicGain)
}

function tone(
  audio: AudioContext,
  freq: number,
  dur: number,
  gain = 0.14,
  slide = 0,
  delay = 0,
) {
  if (!master) return
  const t = audio.currentTime + delay
  const attack = Math.min(0.04, dur * 0.22)
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur)
  }
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.04)
}

function chime(audio: AudioContext, freq: number, dur: number, gain = 0.12, delay = 0) {
  tone(audio, freq, dur, gain, 0, delay)
  tone(audio, freq * 2, dur * 0.85, gain * 0.18, 0, delay)
}

export function sfx(name: SoundName, pitch = 0) {
  if (muted) return
  const audio = getCtx()
  if (!audio) return
  if (audio.state === 'suspended') void audio.resume()
  const note = PENT[Math.max(0, Math.min(PENT.length - 1, Math.round(pitch)))]

  switch (name) {
    case 'place':
      chime(audio, 329.6, 0.28, 0.11)
      break
    case 'perfect':
      chime(audio, 392.0, 0.32, 0.11)
      chime(audio, 523.3, 0.42, 0.1, 0.09)
      break
    case 'chop':
      tone(audio, 246.9, 0.42, 0.1, -70)
      break
    case 'eat':
      chime(audio, 329.6, 0.22, 0.1)
      chime(audio, 392.0, 0.3, 0.08, 0.05)
      break
    case 'fire':
      tone(audio, 523.3, 0.16, 0.06, -80)
      break
    case 'hit':
      chime(audio, note, 0.24, 0.09)
      break
    case 'boom':
      tone(audio, 130.8, 0.55, 0.12, -30)
      tone(audio, 196.0, 0.4, 0.06)
      break
    case 'hurt':
      tone(audio, 220.0, 0.4, 0.09, -50)
      break
    case 'die':
      tone(audio, 246.9, 0.35, 0.09)
      tone(audio, 196.0, 0.5, 0.08, 0, 0.12)
      tone(audio, 146.8, 0.7, 0.07, 0, 0.28)
      break
    case 'wave':
      chime(audio, 261.6, 0.28, 0.08)
      chime(audio, 329.6, 0.32, 0.09, 0.12)
      chime(audio, 392.0, 0.45, 0.1, 0.24)
      break
    case 'tap':
      tone(audio, 440.0, 0.18, 0.07)
      break
    case 'pad':
      chime(audio, PENT[Math.max(0, Math.min(PENT.length - 1, Math.round(pitch)))], 0.36, 0.12)
      break
    case 'good':
      chime(audio, 329.6, 0.28, 0.1)
      chime(audio, 493.9, 0.4, 0.09, 0.08)
      break
    case 'miss':
      tone(audio, 196.0, 0.38, 0.08, -28)
      break
  }
}
