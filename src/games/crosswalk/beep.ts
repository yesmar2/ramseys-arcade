import { soundOut } from '../../lib/sound'

/*
 * The crossing button's beep, for Crosswalk's easter egg: the knock of the
 * button going in, then one short square beep, rounded off, the way a
 * push-button at a real crossing answers. Played through the sound effects'
 * bus (soundOut), so the mute switch and the limiter hold, and a preview
 * playing itself makes none of it.
 */

/** About as loud as a hop: it's a small thing. */
const LEVEL = 0.5

export function pressBeep() {
  const out = soundOut()
  if (out) playBeep(out.audio, out.out, out.audio.currentTime)
}

/** The press, into `out` from time `t0`: split out so it can be rendered offline to measure. */
export function playBeep(audio: BaseAudioContext, out: AudioNode, t0: number) {
  const bus = audio.createGain()
  bus.gain.value = LEVEL
  bus.connect(out)

  // The button going in: a dull knock.
  const knock = audio.createOscillator()
  knock.type = 'triangle'
  knock.frequency.setValueAtTime(420, t0)
  knock.frequency.exponentialRampToValueAtTime(160, t0 + 0.03)
  const knockGain = audio.createGain()
  knockGain.gain.setValueAtTime(0.0001, t0)
  knockGain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.002)
  knockGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04)
  knock.connect(knockGain)
  knockGain.connect(bus)
  knock.start(t0)
  knock.stop(t0 + 0.05)

  // The beep, a beat after it: square, with its edges taken off.
  const at = t0 + 0.035
  const beep = audio.createOscillator()
  beep.type = 'square'
  beep.frequency.value = 1046.5
  const soft = audio.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 2600
  const beepGain = audio.createGain()
  beepGain.gain.setValueAtTime(0.0001, at)
  beepGain.gain.exponentialRampToValueAtTime(0.12, at + 0.004)
  beepGain.gain.setValueAtTime(0.12, at + 0.11)
  beepGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15)
  beep.connect(soft)
  soft.connect(beepGain)
  beepGain.connect(bus)
  beep.start(at)
  beep.stop(at + 0.16)
}
