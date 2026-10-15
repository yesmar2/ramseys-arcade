import { useState, type CSSProperties } from 'react'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { nextSong, songName, STATION_LABELS } from '../lib/musicStations'
import { setMusicOn, unlockSound } from '../lib/sound'
import { EqIcon, MusicSheet } from './MusicSheet'
import { MusicToggle, NoteIcon } from './MusicToggle'
import '../styles/nowPlaying.css'

/**
 * The song under a game, on its start and pause cards: the note turns the music off and on, the song and
 * its station open the music sheet, and Skip moves this game on to the station's next song. The volume is
 * in the sheet. A game with no music keeps the plain note and slider.
 */
export function NowPlaying({ slug, game, style }: { slug: string; game?: string; style?: CSSProperties }) {
  const { on, station, song } = useNowPlaying(slug)
  const [open, setOpen] = useState(false)
  if (!song) return <MusicToggle className="game-sound--bare" />
  const name = songName(song)
  const stationName = STATION_LABELS[station]

  return (
    <div className={`now-playing${on ? '' : ' now-playing--off'}`} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="game-pause-btn now-playing__note"
        aria-label={on ? 'Turn the music off' : 'Turn the music on'}
        aria-pressed={on}
        title={on ? 'Music on' : 'Music off'}
        onClick={(e) => {
          e.stopPropagation()
          unlockSound()
          setMusicOn(!on)
        }}
      >
        <NoteIcon off={!on} />
      </button>
      <button
        type="button"
        className="now-playing__song"
        aria-label={`Music: ${name}, on ${stationName}. Change it`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          unlockSound()
          setOpen(true)
        }}
      >
        <EqIcon className="now-playing__eq" />
        <span className="now-playing__name">{name}</span>
        <span className="now-playing__station">{stationName}</span>
      </button>
      <button
        type="button"
        className="game-pause-btn now-playing__skip"
        aria-label="Next song"
        title="Next song"
        onClick={(e) => {
          e.stopPropagation()
          unlockSound()
          if (!on) setMusicOn(true)
          nextSong(slug)
        }}
      >
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 6.5l8.5 5.5-8.5 5.5z" fill="currentColor" />
          <path d="M18 6.5v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? <MusicSheet slug={slug} game={game} style={style} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}
