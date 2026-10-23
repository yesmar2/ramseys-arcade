import { games, isListedGame, isRankedGame } from '../data/games'
import { APP_NAME } from './brand'
import { numberWord } from './numberWord'

/*
 * The About page's questions, in the words people ask a search engine or an AI tool about the site ("is Blipka
 * free?", "does it have ads?"). One list for the page (AboutPage), the copy the build writes for readers that run
 * no scripts, and its FAQPage structured data (lib/pageMeta.ts), so the three never disagree. Ramsey asked for a
 * fuller About page with no name on it (2026-10-23): "made by one person in New York".
 */

export type AboutQuestion = { q: string; a: string }

export function aboutQuestions(): AboutQuestion[] {
  // The games the site lists, as the home page counts them (lib/pageMeta.ts arcadeLine).
  const listed = games.filter((game) => isListedGame(game) && game.playable)
  const races = numberWord(listed.filter((game) => game.daily && isRankedGame(game.slug)).length)
  const puzzles = numberWord(listed.filter((game) => game.daily && !isRankedGame(game.slug)).length)
  return [
    {
      q: `Is ${APP_NAME} free?`,
      a: `Yes. Every game is free to play in your browser, with nothing to install. Plus, an optional membership at $2.99 a month or $24.99 a year, adds extras: every season’s Gold Pass, every past daily, anyone’s ghost to race, a new look each month and new games a week early.`,
    },
    {
      q: `Does ${APP_NAME} have ads?`,
      a: `No. No banners, no video breaks and no pop-ups between rounds. The site is paid for by the players who choose Plus, not by ads.`,
    },
    {
      q: 'Can you pay for a better score?',
      a: `No. Plus buys looks and extras, never a score or a place on a board. Everyone plays the same games with the same rules.`,
    },
    {
      q: 'What are the dailies?',
      a: `Every day there are ${races} races and ${puzzles} puzzles, new at midnight New York time and the same for everyone. Play any two races to keep your streak going, and share how you did without giving the day away.`,
    },
    {
      q: 'Do I need an account?',
      a: `Not to play: tap a game and you’re in. Sign in to put your scores on the leaderboards, keep a streak, and join groups and events with friends.`,
    },
    {
      q: 'Does it work on a phone?',
      a: `Yes. It runs in the browser on a phone, a tablet or a computer, and you can add it to your home screen like an app.`,
    },
    {
      q: `Who makes ${APP_NAME}?`,
      a: `One person in New York. ${APP_NAME} opened on October 31, 2026.`,
    },
  ]
}
