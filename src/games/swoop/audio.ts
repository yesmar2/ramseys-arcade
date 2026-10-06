import { soundOut } from '../../lib/sound'

const LEVEL = 0.55

type Voice = { audio: AudioContext; level: GainNode; rush: GainNode; band: BiquadFilterNode; noise: AudioBufferSourceNode }

/**
 * The wind past the bird: noise through a band of air that rises and grows louder the faster it goes, a
 * little louder still in flight. It plays through the site's own mixer (lib/sound's soundOut), so the mute
 * switch and the limiter hold for it as for every other sound. It wakes on the press that starts a run, since
 * a browser won't play before one.
 */
export class WindSound {
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
      const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = audio.createBufferSource()
      noise.buffer = buffer
      noise.loop = true
      const band = audio.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 500
      band.Q.value = 0.7
      const rush = audio.createGain()
      rush.gain.value = 0
      noise.connect(band)
      band.connect(rush)
      rush.connect(level)
      noise.start()
      level.gain.setTargetAtTime(LEVEL, audio.currentTime, 0.1)
      this.voice = { audio, level, rush, band, noise }
    } catch {
      this.failed = true
    }
  }

  /** This frame's wind: the bird's speed, m/s, and whether it's in the air. Nothing plays unless `on`. */
  update(speed: number, air: boolean, on: boolean) {
    const voice = this.voice
    if (!voice) return
    const t = voice.audio.currentTime
    const f = on ? Math.min(1.2, Math.max(0, speed / 60)) : 0
    voice.rush.gain.setTargetAtTime((air ? 0.4 : 0.22) * f * f, t, 0.08)
    voice.band.frequency.setTargetAtTime(300 + f * 900, t, 0.1)
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
