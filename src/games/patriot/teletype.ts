import { soundOut } from '../../lib/sound'

/*
 * The computer typing its line, for Patriot's easter egg: a key's dry clack
 * for each letter, each a little different from the last. Played through the
 * sound effects' bus (soundOut), so the mute switch and the limiter hold, and
 * a preview playing itself makes none of it.
 */

/** Soft: a terminal in the next room, under the game's own sounds. */
const LEVEL = 0.3

/** A burst of noise every clack is cut from, made once. Hashed rather than random, so it is the same burst every time. */
let burst: AudioBuffer | null = null

function noiseFor(audio: BaseAudioContext) {
  if (burst && burst.sampleRate === audio.sampleRate) return burst
  const len = Math.floor(audio.sampleRate * 0.04)
  burst = audio.createBuffer(1, len, audio.sampleRate)
  const data = burst.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453
    data[i] = (v - Math.floor(v)) * 2 - 1
  }
  return burst
}

/** The `n`th letter's clack. */
export function clack(n: number) {
  const out = soundOut()
  if (out) playClack(out.audio, out.out, out.audio.currentTime, n)
}

/** One clack, into `out` from time `t0`: split out so it can be rendered offline to measure. */
export function playClack(audio: BaseAudioContext, out: AudioNode, t0: number, n: number) {
  // The key's tick: a snap of noise through a band that shifts from letter to letter.
  const noise = audio.createBufferSource()
  noise.buffer = noiseFor(audio)
  const band = audio.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2300 + ((n * 7) % 5) * 260
  band.Q.value = 1.4
  const tick = audio.createGain()
  tick.gain.setValueAtTime(0.0001, t0)
  tick.gain.exponentialRampToValueAtTime(LEVEL, t0 + 0.002)
  tick.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03)
  noise.connect(band)
  band.connect(tick)
  tick.connect(out)
  noise.start(t0)
  noise.stop(t0 + 0.04)

  // The knock of it bottoming out.
  const knock = audio.createOscillator()
  knock.frequency.setValueAtTime(240, t0)
  knock.frequency.exponentialRampToValueAtTime(120, t0 + 0.025)
  const thud = audio.createGain()
  thud.gain.setValueAtTime(0.0001, t0)
  thud.gain.exponentialRampToValueAtTime(LEVEL * 0.5, t0 + 0.003)
  thud.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035)
  knock.connect(thud)
  thud.connect(out)
  knock.start(t0)
  knock.stop(t0 + 0.04)
}
