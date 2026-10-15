import { useEffect, useState } from 'react'
import { getStation, songFor, STATION_EVENT } from '../lib/musicStations'
import { isMusicOn, MUSIC_EVENT } from '../lib/sound'

/** A game's music as it stands: on or off, the station, and the song it plays there. */
export function useNowPlaying(slug: string) {
  const read = () => ({ on: isMusicOn(), station: getStation(), song: songFor(slug) })
  const [state, setState] = useState(read)
  useEffect(() => {
    const sync = () => setState({ on: isMusicOn(), station: getStation(), song: songFor(slug) })
    sync()
    window.addEventListener(MUSIC_EVENT, sync)
    window.addEventListener(STATION_EVENT, sync)
    return () => {
      window.removeEventListener(MUSIC_EVENT, sync)
      window.removeEventListener(STATION_EVENT, sync)
    }
  }, [slug])
  return state
}
