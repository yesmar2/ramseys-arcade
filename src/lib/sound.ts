import {
  createSynth,
  DEFAULT_SOUND_PACK,
  isSoundPackId,
  PACK_TRIM,
  SOUND_PACK_IDS,
  SOUND_PACK_LABELS,
  SOUND_PACKS,
  type SoundName,
  type SoundPackId,
} from './soundPacks'
import { roomImpulse, type Fx } from './soundPacks/voices'
import { startTrack, type Playing } from './music'
import { trackForGame } from './musicTracks'
import { isQuiet } from './quiet'

export type { SoundName, SoundPackId }
export { SOUND_PACK_IDS, SOUND_PACK_LABELS }

const MUTE_KEY = 'skermix-mute'
const MUSIC_KEY = 'skermix-music-on'
/*
 * Not the old skermix-sfx-pack: the sets changed under it (Arcade and Soft
 * gave way to Neon and Toybox), so everyone starts on the new default rather
 * than on whatever they last cycled to.
 */
const PACK_KEY = 'skermix-sound-set'
export const SOUND_PACK_EVENT = 'arcade-sfx-pack'
export const MUSIC_EVENT = 'arcade-music'
const LEGACY_MUTE_KEYS = ['fordriva-mute', 'acralia-mute', 'archivade-mute'] as const

/** The whole mix, after the limiter. */
const LEVEL = 0.8
/**
 * Classic keeps the gain and the dulling filter it always had, then comes up
 * to where the other sets sit, so switching sets never means touching the volume.
 */
const CLASSIC_GAIN = 0.22
const CLASSIC_LIFT = 10.65

let ctx: AudioContext | null = null
/** Everything passes through here: 0 when muted. */
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let classicIn: GainNode | null = null
let musicBus: GainNode | null = null
let fx: Fx | null = null

let muted = readMuted()
let musicOn = readMusicOn()
let soundPack: SoundPackId = readSoundPack()
/** The game on screen, whose music should be playing. */
let musicSlug: string | null = null
let playing: Playing | null = null

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

function readMusicOn() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== '0'
  } catch {
    return true
  }
}

function readSoundPack(): SoundPackId {
  try {
    const raw = localStorage.getItem(PACK_KEY)
    if (raw && isSoundPackId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_SOUND_PACK
}

/**
 * The mixing desk, built on first use: sound effects, music, a shared room and
 * echo, all into one limiter so a pile of explosions can't clip.
 */
function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    const audio = new AC()

    const mute = audio.createGain()
    mute.gain.value = muted ? 0 : 1
    const limiter = audio.createDynamicsCompressor()
    limiter.threshold.value = -8
    limiter.knee.value = 4
    limiter.ratio.value = 12
    limiter.attack.value = 0.002
    limiter.release.value = 0.16
    const level = audio.createGain()
    level.gain.value = LEVEL
    mute.connect(limiter)
    limiter.connect(level)
    level.connect(audio.destination)

    const effects = audio.createGain()
    effects.connect(mute)

    const classic = audio.createGain()
    classic.gain.value = CLASSIC_GAIN
    const dull = audio.createBiquadFilter()
    dull.type = 'lowpass'
    dull.frequency.value = 1800
    dull.Q.value = 0.4
    const lift = audio.createGain()
    lift.gain.value = CLASSIC_LIFT
    classic.connect(dull)
    dull.connect(lift)
    lift.connect(effects)

    const verb = audio.createConvolver()
    verb.buffer = roomImpulse(audio)
    const verbOut = audio.createGain()
    verbOut.gain.value = 0.8
    verb.connect(verbOut)
    verbOut.connect(mute)

    const echo = audio.createGain()
    const delay = audio.createDelay(1)
    delay.delayTime.value = 0.27
    const damp = audio.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 2400
    const feedback = audio.createGain()
    feedback.gain.value = 0.34
    const echoOut = audio.createGain()
    echoOut.gain.value = 0.7
    echo.connect(delay)
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)
    damp.connect(echoOut)
    echoOut.connect(mute)

    const music = audio.createGain()
    music.gain.value = musicLevel()
    music.connect(mute)

    ctx = audio
    master = mute
    sfxBus = effects
    classicIn = classic
    musicBus = music
    fx = { verb, echo }
  }
  return ctx
}

function musicLevel() {
  if (!musicOn || (typeof document !== 'undefined' && document.hidden)) return 0
  return 1
}

function applyMusicGain() {
  if (!ctx || !musicBus) return
  musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.08)
}

/**
 * Start, change or stop the music to match the game on screen and the
 * settings. It waits for the page's first tap: a browser won't play before one.
 */
function syncMusic() {
  const track = musicSlug && musicOn && !muted ? trackForGame(musicSlug) : null
  if (!track) {
    playing?.stop()
    playing = null
    return
  }
  if (playing?.track === track) return
  if (!ctx || ctx.state !== 'running' || !musicBus || !fx) return
  playing?.stop()
  playing = startTrack(ctx, track, musicBus, fx)
}

export function unlockSound() {
  const audio = getCtx()
  if (!audio) return
  if (audio.state === 'suspended') void audio.resume().then(syncMusic)
  else syncMusic()
}

export function isMuted() {
  return muted
}

export function getSoundPack(): SoundPackId {
  return soundPack
}

export function setSoundPack(next: SoundPackId) {
  if (!isSoundPackId(next)) return
  soundPack = next
  try {
    localStorage.setItem(PACK_KEY, next)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SOUND_PACK_EVENT))
  unlockSound()
}

/** Step to the next set, in the order the pickers show them. Returns the new one. */
export function cycleSoundPack(): SoundPackId {
  const i = SOUND_PACK_IDS.indexOf(soundPack)
  const next = SOUND_PACK_IDS[(i + 1) % SOUND_PACK_IDS.length]!
  setSoundPack(next)
  return next
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
    master.gain.setTargetAtTime(next ? 0 : 1, audio.currentTime, 0.03)
  }
  if (next) syncMusic()
  else unlockSound()
}

export function isMusicOn() {
  return musicOn
}

/** Music on or off. Turning it on while everything is muted unmutes, or it would do nothing. */
export function setMusicOn(next: boolean) {
  musicOn = next
  try {
    localStorage.setItem(MUSIC_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(MUSIC_EVENT))
  applyMusicGain()
  if (next && muted) setMuted(false)
  else unlockSound()
}

/** A game is on screen: play its music, now or on the first tap. */
export function playMusicFor(slug: string) {
  musicSlug = slug
  syncMusic()
}

/** Off a game screen: the music fades out. */
export function silenceMusic() {
  musicSlug = null
  syncMusic()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', applyMusicGain)
}

export function sfx(name: SoundName, pitch = 0) {
  // A game playing itself in a preview makes no noise; see `quietly`.
  if (muted || isQuiet()) return
  const audio = getCtx()
  if (!audio || !sfxBus || !classicIn || !fx) return
  if (audio.state === 'suspended') void audio.resume()
  const play = SOUND_PACKS[soundPack] ?? SOUND_PACKS[DEFAULT_SOUND_PACK]
  // Classic plays through its old filter and knows nothing of the room or echo.
  if (soundPack === 'classic') play(createSynth(audio, classicIn), name, pitch)
  else play(createSynth(audio, sfxBus, fx, PACK_TRIM[soundPack]), name, pitch)
}
