import { soundOut } from '../../lib/sound'

/*
 * A plate of glass breaking, for Centroid's easter egg: a sharp crack, a dull
 * knock where it was struck, and a scatter of high tinkles as the pieces go.
 * Made fresh each time, so no two breaks sound alike, and played through the
 * sound effects' bus (soundOut), so the mute switch and the limiter hold, and
 * a preview playing itself makes none of it.
 */

/** The whole break's level, set so the crack sits a little over the game's loudest sounds. */
const LEVEL = 0.55

export function breakGlass() {
  const out = soundOut()
  if (out) playGlass(out.audio, out.out, out.audio.currentTime)
}

/** The break, into `out` from time `t0`: split out so it can be rendered offline to measure. */
export function playGlass(audio: BaseAudioContext, out: AudioNode, t0: number) {
  const bus = audio.createGain()
  bus.gain.value = LEVEL
  bus.connect(out)

  // The crack: a burst of bright noise that dies in under half a second.
  const len = Math.floor(audio.sampleRate * 0.5)
  const buf = audio.createBuffer(1, len, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bright = audio.createBiquadFilter()
  bright.type = 'highpass'
  bright.frequency.value = 2200
  const crack = audio.createGain()
  crack.gain.setValueAtTime(0.0001, t0)
  crack.gain.exponentialRampToValueAtTime(0.5, t0 + 0.003)
  crack.gain.exponentialRampToValueAtTime(0.06, t0 + 0.09)
  crack.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
  noise.connect(bright)
  bright.connect(crack)
  crack.connect(bus)
  noise.start(t0)
  noise.stop(t0 + 0.5)

  // The knock of the blow.
  const knock = audio.createOscillator()
  knock.frequency.setValueAtTime(190, t0)
  knock.frequency.exponentialRampToValueAtTime(70, t0 + 0.09)
  const knockGain = audio.createGain()
  knockGain.gain.setValueAtTime(0.0001, t0)
  knockGain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.004)
  knockGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
  knock.connect(knockGain)
  knockGain.connect(bus)
  knock.start(t0)
  knock.stop(t0 + 0.13)

  // The pieces: bright pings, most of them early, each with a clinking overtone.
  for (let i = 0; i < 16; i++) {
    const at = t0 + 0.01 + Math.random() ** 1.6 * 0.6
    const f = 2600 + Math.random() * 5200
    const peak = (0.05 + Math.random() * 0.07) * (1 - ((at - t0) / 0.7) * 0.5)
    const decay = 0.06 + Math.random() * 0.16
    for (const [mult, share] of [
      [1, 1],
      [2.71, 0.45],
    ] as const) {
      const ping = audio.createOscillator()
      ping.frequency.value = f * mult
      const g = audio.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak * share, at + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
      ping.connect(g)
      g.connect(bus)
      ping.start(at)
      ping.stop(at + decay + 0.02)
    }
  }
}
