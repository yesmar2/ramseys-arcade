import { soundOut } from '../../lib/sound'

const LEVEL = 0.5

type Voice = { audio: AudioContext; level: GainNode; rumble: GainNode; lp: BiquadFilterNode; noise: AudioBufferSourceNode }

/**
 * The marble rolling: a rumble that rises and brightens with its speed, and goes quiet in the air. It plays
 * through the site's own mixer (lib/sound's soundOut), so the mute switch and the limiter hold for it as for
 * every other sound. It wakes on the press that starts a run, since a browser won't play before one.
 */
export class RollSound {
  private voice: Voice | null = null
  private failed = false

  wake() {
    if (this.voice || this.failed) return
    const out = soundOut()
    if (!out) return
    try {
      const { audio } = out
      const level = audio.createGain()
      level.gain.value = 0
      level.connect(out.out)
      // Brown-ish noise: white noise leaned toward the low end, looped.
      const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < data.length; i++) {
        last = last * 0.96 + (Math.random() * 2 - 1) * 0.04
        data[i] = last * 6
      }
      const noise = audio.createBufferSource()
      noise.buffer = buffer
      noise.loop = true
      const lp = audio.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 200
      const rumble = audio.createGain()
      rumble.gain.value = 0
      noise.connect(lp)
      lp.connect(rumble)
      rumble.connect(level)
      noise.start()
      level.gain.setTargetAtTime(LEVEL, audio.currentTime, 0.1)
      this.voice = { audio, level, rumble, lp, noise }
    } catch {
      this.failed = true
    }
  }

  /** This frame's roll: its speed in m/s, and whether it's on the track. Nothing plays unless `on`. */
  update(speed: number, rolling: boolean, on: boolean) {
    const voice = this.voice
    if (!voice) return
    const t = voice.audio.currentTime
    const loud = on && rolling ? Math.min(0.5, speed * 0.035) : 0
    voice.rumble.gain.setTargetAtTime(loud, t, 0.05)
    voice.lp.frequency.setTargetAtTime(160 + speed * 70, t, 0.05)
  }

  dispose() {
    const voice = this.voice
    this.voice = null
    if (!voice) return
    voice.level.gain.setTargetAtTime(0, voice.audio.currentTime, 0.03)
    // Let the fade finish before the voice stops, so leaving doesn't click.
    window.setTimeout(() => {
      try {
        voice.noise.stop()
      } catch {
        /* already stopped */
      }
      voice.level.disconnect()
    }, 200)
  }
}
