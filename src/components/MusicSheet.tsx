import { useId, type CSSProperties } from 'react'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { pickSong, songFeel, songName, songsOn, STATION_LABELS } from '../lib/musicStations'
import { isMusicOn, setMusicOn, unlockSound } from '../lib/sound'
import { MusicToggle } from './MusicToggle'
import { Panel, PanelHead } from './Panel'
import { StationSelect } from './StationSelect'

export function EqIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="6" width="3" height="8" rx="1.5" fill="currentColor" />
      <rect x="6.5" y="2" width="3" height="12" rx="1.5" fill="currentColor" />
      <rect x="11.5" y="8" width="3" height="6" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor" />
    </svg>
  )
}

/**
 * The music for a game, opened from its card: the station for every game, the station's songs (a tap plays
 * one under this game from now on), and how loud. On a phone it rises from the bottom like every panel.
 */
export function MusicSheet({
  slug,
  game,
  style,
  onClose,
}: {
  slug: string
  game?: string
  style?: CSSProperties
  onClose: () => void
}) {
  const titleId = useId()
  const songsId = useId()
  const { on, station, song } = useNowPlaying(slug)
  const songs = songsOn(station)
  // A song from no list (Fireflies' quiet one) still shows, first, as the one playing.
  const list = song && !songs.includes(song) ? [song, ...songs] : songs

  return (
    <Panel labelledBy={titleId} onClose={onClose} style={style} className="music-sheet">
      <PanelHead titleId={titleId} title="Music" kicker={game} onClose={onClose} closeLabel="Close music" />
      <div className="panel__body panel__body--last music-sheet__body">
        <section className="music-sheet__part" aria-label="Station">
          <span className="music-sheet__cap" aria-hidden="true">
            Station
          </span>
          <StationSelect className="music-sheet__stations" />
          <p className="music-sheet__hint">Every game plays the station’s song that suits it. Skip on the game’s card for the next one.</p>
        </section>
        <section className="music-sheet__part" aria-labelledby={songsId}>
          <h3 id={songsId} className="music-sheet__cap">
            On {STATION_LABELS[station]}
          </h3>
          <ul className="music-sheet__songs">
            {list.map((id) => {
              const here = id === song
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="music-sheet__song"
                    aria-pressed={here}
                    onClick={() => {
                      unlockSound()
                      if (!isMusicOn()) setMusicOn(true)
                      pickSong(slug, id)
                    }}
                  >
                    <span className="music-sheet__dot">{here ? <EqIcon /> : <PlayIcon />}</span>
                    <span className="music-sheet__text">
                      <span className="music-sheet__name">{songName(id)}</span>
                      <span className="music-sheet__feel">{songFeel(id)}</span>
                    </span>
                    {here ? <span className="music-sheet__tag">{on ? 'Playing' : 'Picked'}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
        <MusicToggle variant="seg" className="music-sheet__volume" />
      </div>
    </Panel>
  )
}
