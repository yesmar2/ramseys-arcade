import { CHIP_GAME_MUSIC, TRACKS, type TrackId } from './musicTracks'

/*
 * The song picker: music comes in stations, and a player picks one for every game at once. Each game plays
 * the station's song that suits it (a driving one under the races, a soft one under Find the Bug), Skip on
 * a game's card moves that game on to the station's next song, and the music sheet lets a player choose
 * any of the station's songs for it. Ramsey chose this, A on the "Song picker" canvas, on 2026-10-15
 * ("A works"), after saying "maybe we make a song picker for the users".
 *
 * The station is kept in skermix-music-station and each game's own picks, station by station, in
 * skermix-music-picks.
 */

export type StationId = 'arcade' | 'bit' | 'chill' | 'piano'

export const STATION_IDS: readonly StationId[] = ['arcade', 'bit', 'chill', 'piano']

export const STATION_LABELS: Record<StationId, string> = {
  arcade: 'Arcade',
  // Not "Game Boy": that's Nintendo's name.
  bit: '8-bit',
  chill: 'Chill',
  piano: 'Piano',
}

export const DEFAULT_STATION: StationId = 'arcade'

/** Fired on window when the station or a game's song changes. */
export const STATION_EVENT = 'arcade-station'

const STATION_KEY = 'skermix-music-station'
const PICKS_KEY = 'skermix-music-picks'

/** Each station's songs, in the order its list shows them and Skip goes through them. */
const STATION_SONGS: Record<StationId, readonly TrackId[]> = {
  arcade: ['groove', 'toypop', 'dash', 'neonmile', 'rush', 'glide'],
  bit: ['coinop', 'pocket', 'bonus', 'hyperspace', 'highscore', 'nightdrive', 'mountainking', 'dungeon', 'puzzle', 'paper', 'credits', 'nightpond', 'pond'],
  chill: ['bossa', 'lofi', 'still'],
  piano: ['mountain', 'elise', 'canon', 'prelude', 'gymno'],
}

/** What a song is like, under its name in the list. */
const SONG_FEEL: Record<TrackId, string> = {
  groove: 'Funky',
  toypop: 'Bouncy',
  dash: 'Fast electro',
  neonmile: 'Synthwave',
  rush: 'Fast and smooth',
  glide: 'Floaty',
  lofi: 'Laid back',
  bossa: 'Easy',
  still: 'Calm',
  stillair: 'Calm, no tune',
  mountain: 'Grieg · speeds up',
  elise: 'Beethoven',
  canon: 'Pachelbel',
  prelude: 'Bach',
  gymno: 'Satie',
  coinop: 'Upbeat',
  pocket: 'Bouncy',
  bonus: 'Quick',
  hyperspace: 'Driving',
  highscore: 'Driving',
  nightdrive: 'Steady',
  mountainking: 'Speeds up',
  dungeon: 'Sneaky',
  puzzle: 'Thinking',
  paper: 'Gentle',
  credits: 'Waltz',
  nightpond: 'Calm, no tune',
  pond: 'Calm, no tune',
}

type Kind = 'arcade' | 'race' | 'calm' | 'quiet'

/** The games with music, by what playing them is like. A game not here plays none. */
const GAME_KIND: Record<string, Kind> = {
  asteroids: 'arcade',
  barrage: 'arcade',
  patriot: 'arcade',
  pileup: 'arcade',
  snake: 'arcade',
  crosswalk: 'arcade',
  frenzy: 'arcade',
  bop: 'arcade',
  pellets: 'arcade',
  pop: 'arcade',
  crumbtrail: 'arcade',
  stacker: 'arcade',
  swoop: 'race',
  sling: 'race',
  lander: 'race',
  hotlap: 'race',
  marblerun: 'race',
  wobblerun: 'race',
  findbug: 'calm',
  spotter: 'calm',
  centroid: 'calm',
  halffull: 'calm',
  putt: 'calm',
  acechase: 'calm',
  // A tune to sing back wants no other melody over it.
  fireflies: 'quiet',
  simon: 'quiet',
}

/**
 * The Arcade station's song for each game: the funk and the bouncy one for most of the arcade, the electro
 * for the shooters and Pileup, and a different one for each of the day's five races, in their order.
 */
const ARCADE_FOR: Record<string, TrackId> = {
  asteroids: 'dash',
  barrage: 'dash',
  patriot: 'dash',
  pileup: 'dash',
  snake: 'groove',
  crosswalk: 'groove',
  frenzy: 'groove',
  bop: 'groove',
  pellets: 'toypop',
  pop: 'toypop',
  crumbtrail: 'toypop',
  stacker: 'toypop',
  putt: 'toypop',
  acechase: 'toypop',
  swoop: 'rush',
  sling: 'rush',
  lander: 'glide',
  hotlap: 'neonmile',
  marblerun: 'dash',
  wobblerun: 'toypop',
  findbug: 'glide',
  spotter: 'glide',
  centroid: 'glide',
  halffull: 'glide',
}

/** A station's song for a game nobody has picked one for. */
function defaultSong(station: StationId, slug: string, kind: Kind): TrackId {
  if (kind === 'quiet') return station === 'bit' ? (CHIP_GAME_MUSIC[slug] ?? 'nightpond') : 'stillair'
  switch (station) {
    case 'bit':
      return CHIP_GAME_MUSIC[slug] ?? 'coinop'
    case 'arcade':
      return ARCADE_FOR[slug] ?? (kind === 'race' ? 'neonmile' : kind === 'calm' ? 'glide' : 'groove')
    case 'chill':
      return kind === 'arcade' ? 'bossa' : kind === 'race' ? 'lofi' : 'still'
    case 'piano':
      if (kind === 'race') return 'canon'
      if (kind === 'calm') return slug === 'findbug' || slug === 'spotter' ? 'prelude' : 'gymno'
      return ['asteroids', 'barrage', 'patriot', 'pileup'].includes(slug) ? 'mountain' : 'elise'
  }
}

function isStation(v: unknown): v is StationId {
  return typeof v === 'string' && (STATION_IDS as readonly string[]).includes(v)
}

function isSong(v: unknown): v is TrackId {
  return typeof v === 'string' && v in TRACKS
}

function readStation(): StationId {
  try {
    const raw = localStorage.getItem(STATION_KEY)
    if (isStation(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_STATION
}

type Picks = Partial<Record<StationId, Record<string, TrackId>>>

function readPicks(): Picks {
  try {
    const raw = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '{}') as unknown
    if (raw && typeof raw === 'object') return raw as Picks
  } catch {
    /* ignore */
  }
  return {}
}

let station = readStation()
let picks = readPicks()

function changed() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STATION_EVENT))
}

export function getStation(): StationId {
  return station
}

export function setStation(next: StationId) {
  if (!isStation(next) || next === station) return
  station = next
  try {
    localStorage.setItem(STATION_KEY, next)
  } catch {
    /* ignore */
  }
  changed()
}

/** Step to the next station, in the order the pickers show them. Returns the new one. */
export function cycleStation(): StationId {
  const next = STATION_IDS[(STATION_IDS.indexOf(station) + 1) % STATION_IDS.length]!
  setStation(next)
  return next
}

export function songsOn(id: StationId): readonly TrackId[] {
  return STATION_SONGS[id]
}

/** The song a game plays on a station: the player's pick for it there, or the station's own. */
export function songFor(slug: string, on: StationId = station): TrackId | null {
  const kind = GAME_KIND[slug]
  if (!kind) return null
  const picked = picks[on]?.[slug]
  return isSong(picked) ? picked : defaultSong(on, slug, kind)
}

/** Play this song under this game, on the current station, from now on. */
export function pickSong(slug: string, id: TrackId) {
  if (!GAME_KIND[slug] || !isSong(id)) return
  picks = { ...picks, [station]: { ...picks[station], [slug]: id } }
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks))
  } catch {
    /* ignore */
  }
  changed()
}

/** Skip: the station's next song for this game. */
export function nextSong(slug: string) {
  const list = STATION_SONGS[station]
  const now = songFor(slug)
  const at = now ? list.indexOf(now) : -1
  pickSong(slug, list[(at + 1) % list.length]!)
}

export function songName(id: TrackId): string {
  return TRACKS[id].name
}

export function songFeel(id: TrackId): string {
  return SONG_FEEL[id]
}
