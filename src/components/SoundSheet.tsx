import { useId, useState, type CSSProperties } from 'react'
import { hapticsOff, hapticsSupported, setHapticsOff } from '../lib/haptics'
import { isMuted, setMuted, unlockSound } from '../lib/sound'
import { NowPlaying } from './NowPlaying'
import { Panel, PanelHead } from './Panel'
import { SoundPackSelect } from './SoundPackSelect'

/**
 * A game's sound in one panel, opened from its start and pause cards' Sound button (A of the "Launch UX picks"
 * canvas's start card, Ramsey's pick on 2026-10-20): all of it on or off, the music and its song, the sound pack
 * by name, and the buzz where a phone has one. Each part named, as the menu's Settings name theirs, where the
 * card had a row of round icons and NEON. It wears the music sheet's parts (nowPlaying.css), whose song opens
 * from here too.
 */
export function SoundSheet({ slug, game, style, onClose }: { slug: string; game?: string; style?: CSSProperties; onClose: () => void }) {
  const titleId = useId()
  const [muted, setMute] = useState(isMuted)
  const [buzzSupported] = useState(hapticsSupported)
  const [buzzOff, setBuzzOff] = useState(hapticsOff)
  const mute = (next: boolean) => {
    unlockSound()
    setMuted(next)
    setMute(next)
  }
  const buzz = (off: boolean) => {
    setHapticsOff(off)
    setBuzzOff(off)
  }

  return (
    <Panel labelledBy={titleId} onClose={onClose} style={style} className="sound-sheet">
      <PanelHead titleId={titleId} title="Sound" kicker={game} onClose={onClose} closeLabel="Close sound" />
      <div className="panel__body panel__body--last music-sheet__body">
        <section className="music-sheet__part">
          <span className="music-sheet__cap" aria-hidden="true">
            All sound
          </span>
          <div className="site-seg sound-sheet__seg" role="group" aria-label="All sound">
            <button type="button" aria-pressed={!muted} onClick={() => mute(false)}>
              On
            </button>
            <button type="button" aria-pressed={muted} onClick={() => mute(true)}>
              Off
            </button>
          </div>
        </section>
        <section className="music-sheet__part" aria-label="Music">
          <span className="music-sheet__cap" aria-hidden="true">
            Music
          </span>
          <NowPlaying slug={slug} game={game} style={style} />
        </section>
        <section className="music-sheet__part">
          <span className="music-sheet__cap" aria-hidden="true">
            Sounds
          </span>
          <SoundPackSelect variant="chips" className="site-seg sound-sheet__seg" />
        </section>
        {/* A phone with no motor to buzz (every iPhone) never sees a switch that does nothing. */}
        {buzzSupported ? (
          <section className="music-sheet__part">
            <span className="music-sheet__cap" aria-hidden="true">
              Buzz
            </span>
            <div className="site-seg sound-sheet__seg" role="group" aria-label="Buzz">
              <button type="button" aria-pressed={!buzzOff} onClick={() => buzz(false)}>
                On
              </button>
              <button type="button" aria-pressed={buzzOff} onClick={() => buzz(true)}>
                Off
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </Panel>
  )
}
