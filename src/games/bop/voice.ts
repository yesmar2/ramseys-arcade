import { soundOut } from '../../lib/sound'
import type { Control } from './game'
import bopUrl from './voice/bop.wav'
import flickUrl from './voice/flick.wav'
import pullUrl from './voice/pull.wav'
import spinUrl from './voice/spin.wav'
import twistUrl from './voice/twist.wav'

/*
 * The toy says each call out loud: "Bop it!", "Twist it!" and the rest, as the
 * real one does, so a call can be played by ear while the eyes are on the
 * controls. The calls were recorded once with Windows' Mark voice, quickened a
 * little and trimmed tight (0.27 to 0.37 s, about 50 KB for all five), and play
 * through the sound effects' bus, so the mute switch and limiter hold for them.
 */

const URLS: Record<Control, string> = {
  bop: bopUrl,
  twist: twistUrl,
  pull: pullUrl,
  flick: flickUrl,
  spin: spinUrl,
}

/**
 * The voice's level. Its clips peak at -1 dB; this puts it about -24 dB RMS,
 * a touch over the loudest of the controls' own sounds (-23 to -31 dB), so the
 * call is the clearest thing on the toy.
 */
const VOICE_GAIN = 0.35

const buffers: Partial<Record<Control, AudioBuffer>> = {}
let loading: Promise<void> | null = null
let speaking: AudioBufferSourceNode | null = null

/**
 * Fetch and decode the calls, once. They're decoded on a context of their own,
 * so the page's sound doesn't have to start before the player's first tap.
 */
export function loadVoice(): Promise<void> {
  if (loading) return loading
  if (typeof OfflineAudioContext === 'undefined') return (loading = Promise.resolve())
  const decoder = new OfflineAudioContext(1, 1, 44100)
  loading = Promise.all(
    (Object.keys(URLS) as Control[]).map(async (control) => {
      try {
        const data = await (await fetch(URLS[control])).arrayBuffer()
        buffers[control] = await decoder.decodeAudioData(data)
      } catch {
        // Without its clip a call falls back to the control's own sound.
      }
    }),
  ).then(() => undefined)
  return loading
}

/** Say a call. False when it can't be said, so the caller can sound it some other way. */
export function sayCall(control: Control): boolean {
  const buffer = buffers[control]
  const out = buffer ? soundOut() : null
  if (!buffer || !out) return false
  // A new call cuts off the last one rather than talking over it.
  try {
    speaking?.stop()
  } catch {
    /* already done */
  }
  const source = out.audio.createBufferSource()
  source.buffer = buffer
  const level = out.audio.createGain()
  level.gain.value = VOICE_GAIN
  source.connect(level)
  level.connect(out.out)
  source.start()
  speaking = source
  return true
}
