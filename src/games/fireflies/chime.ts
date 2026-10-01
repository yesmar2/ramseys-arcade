import { soundOut } from '../../lib/sound'
import { PENT } from '../../lib/soundPacks/types'

/*
 * A shooting star caught, for Fireflies' easter egg: a soft run of little
 * bells down the fireflies' own scale, two octaves over their notes, as if the
 * star were falling. Made here rather than as a sound pack's effect so it's
 * the same gentle thing in every pack, and played through the sound effects'
 * bus (soundOut), so the mute switch and the limiter hold, and a preview
 * playing itself makes none of it.
 */

/** The whole run's level, set so it sits a few dB under a firefly's own note: bells this high carry. */
const LEVEL = 0.4

/** From the top of the scale down, two octaves up. */
const NOTES = [5, 4, 3, 2, 1].map((i) => PENT[i]! * 4)

export function starChime() {
  const out = soundOut()
  if (out) playStarChime(out.audio, out.out, out.audio.currentTime)
}

/** The run, into `out` from time `t0`: split out so it can be rendered offline to measure. */
export function playStarChime(audio: BaseAudioContext, out: AudioNode, t0: number) {
  const bus = audio.createGain()
  bus.gain.value = LEVEL
  bus.connect(out)
  NOTES.forEach((f, i) => {
    const at = t0 + i * 0.065
    const peak = 0.16 * (1 - i * 0.12)
    const ring = 0.45 + i * 0.12
    // Each a bell: the note, and its clink of an overtone, quieter and quicker.
    for (const [mult, share, length] of [
      [1, 1, 1],
      [2.76, 0.2, 0.45],
    ] as const) {
      const bell = audio.createOscillator()
      bell.frequency.value = f * mult
      const g = audio.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak * share, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring * length)
      bell.connect(g)
      g.connect(bus)
      bell.start(at)
      bell.stop(at + ring * length + 0.02)
    }
  })
}
