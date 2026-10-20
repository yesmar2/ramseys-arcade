/*
 * The sticker album on the back of the player card (Ramsey picked B3 of the "New prize kinds" canvas,
 * 2026-10-20). A page of twelve numbered stickers for each season, which fills only while the season runs, and one
 * for the arcade, open for good. Each sticker is for doing something, and an empty slot says what. The API decides
 * who has which (its stickers.ts, kept in step with the ids here); the pictures are components/StickerArt.tsx.
 */

export type StickerDef = {
  id: string
  name: string
  /** The few words an empty slot shows. */
  short: string
  /** How to get it, in a line. */
  how: string
}

export type StickerPageDef = {
  id: string
  name: string
  /** A season's page fills only during that season. */
  season?: number
  stickers: readonly StickerDef[]
}

const s = (id: string, name: string, short: string, how: string): StickerDef => ({ id, name, short, how })

export const STICKER_PAGES: readonly StickerPageDef[] = [
  {
    id: 's1',
    name: 'Space Race',
    season: 1,
    stickers: [
      s('s1-liftoff', 'Liftoff', 'Level 1', 'Reach level 1 of the Space Race pass.'),
      s('s1-moon', 'Moon', 'Level 5', 'Reach level 5 of the Space Race pass.'),
      s('s1-ringed', 'Ringed planet', 'Level 10', 'Reach level 10 of the Space Race pass.'),
      s('s1-comet', 'Comet', 'Level 15', 'Reach level 15 of the Space Race pass.'),
      s('s1-satellite', 'Satellite', 'Level 20', 'Reach level 20 of the Space Race pass.'),
      s('s1-astronaut', 'Astronaut', 'Level 25', 'Reach level 25 of the Space Race pass.'),
      s('s1-supernova', 'Supernova', 'Level 30', 'Reach the top of the Space Race pass, level 30.'),
      s('s1-medals', 'Medal haul', '5 medals', 'Win 5 race medals during Space Race.'),
      s('s1-gold', 'Golden orbit', '5 golds', 'Gold or better on 5 courses during Space Race.'),
      s('s1-dailies', 'Mission log', '21 Dailies', 'Keep the Dailies on 21 days of Space Race.'),
      s('s1-topten', 'Star week', 'Top-ten week', 'Finish a week in the arcade’s top ten during Space Race.'),
      s('s1-legend', 'Space legend', 'Season top 10', 'Finish Space Race in the arcade’s top ten.'),
    ],
  },
  {
    id: 'arcade',
    name: 'The arcade',
    stickers: [
      s('a-first', 'Press start', 'Play a game', 'Play any ranked game.'),
      s('a-explorer', 'Explorer', '10 games', 'Play 10 different games.'),
      s('a-week', 'Week streak', '7-day streak', 'Keep the Dailies 7 days in a row.'),
      s('a-fire', 'On fire', '30-day streak', 'Keep the Dailies 30 days in a row.'),
      s('a-medal', 'First medal', 'A medal', 'Win a medal in any race.'),
      s('a-goldrush', 'Gold rush', '10 golds', 'Gold or better on 10 courses.'),
      s('a-platinum', 'Platinum', 'A platinum', 'A platinum medal on any course.'),
      s('a-topten', 'Top ten', 'Top-ten week', 'Finish a week in the arcade’s top ten.'),
      s('a-podium', 'Podium', 'Top three', 'Finish a week or a month in the arcade’s top three.'),
      s('a-champ', 'Champion', '1st of a month', 'Finish a month 1st in the arcade.'),
      s('a-bug', 'Bug catcher', 'Bug hunt month', 'Catch every bug of a month in the bug hunt.'),
      s('a-secret', 'Secret keeper', 'A secret', 'Find a secret trophy.'),
    ],
  },
]
