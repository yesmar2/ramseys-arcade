import { soundOut } from '../../lib/sound'

const LEVEL = 0.55

type Voice = { audio: AudioContext; level: GainNode; roar: GainNode; band: BiquadFilterNode; noise: AudioBufferSourceNode }

/**
 * The engine: a roar of noise that rises and brightens with the throttle, and goes quiet with it off. It plays
 * through the site's own mixer (lib/sound's soundOut), so the mute switch and the limiter hold for it as for
 * every other sound. It wakes on the press that starts a run, since a browser won't play before one.
 */
export class EngineSound {
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
      // Noise leaned toward the low end, looped.
      const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < data.length; i++) {
        last = last * 0.86 + (Math.random() * 2 - 1) * 0.14
        data[i] = last * 3
      }
      const noise = audio.createBufferSource()
      noise.buffer = buffer
      noise.loop = true
      const band = audio.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 180
      band.Q.value = 0.8
      const roar = audio.createGain()
      roar.gain.value = 0
      noise.connect(band)
      band.connect(roar)
      roar.connect(level)
      noise.start()
      level.gain.setTargetAtTime(LEVEL, audio.currentTime, 0.1)
      this.voice = { audio, level, roar, band, noise }
    } catch {
      this.failed = true
    }
  }

  /** This frame's engine, 0 to 1. Nothing plays unless `on`. */
  update(throttle: number, on: boolean) {
    const voice = this.voice
    if (!voice) return
    const t = voice.audio.currentTime
    const level = on ? throttle : 0
    voice.roar.gain.setTargetAtTime(level * 0.55, t, 0.04)
    voice.band.frequency.setTargetAtTime(140 + level * 160, t, 0.06)
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
