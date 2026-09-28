import type { ReactNode } from 'react'
import { prizesHref } from '../hooks/useHashRoute'
import { AVATAR_GAME_PINS, AVATAR_PINS, AVATAR_RINGS, isGamePin, pinInfo, RING_INFO } from '../lib/avatars'
import { SECRETS, type SecretKey } from '../lib/secrets'
import { TODAY_MILESTONES } from '../lib/today'
import type { TrophyTone } from '../lib/trophies'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SecretArt, TopTenRibbon, WeeklyMedal } from './TrophyArt'

/*
 * The admin's Trophies tab: everything a player can win or find, and exactly what earns each. The
 * trophies; the secret ones, whose rules nothing else on the site says; the easter eggs; and the rings
 * and pins an avatar can wear.
 */

type Thing = { key: string; art: ReactNode; tone: TrophyTone; name: string; says?: string; how: string }

/** The trophies anyone can see how to win (the API's trophies.ts). */
const TROPHIES: Thing[] = [
  {
    key: 'event',
    art: <EventCup size="md" />,
    tone: 'gold',
    name: 'Event win',
    how: 'First place in any event: the official daily, weekly and One Shot events, and the ones players make for friends and groups.',
  },
  {
    key: 'month-podium',
    art: <MonthlyTrophyCup tone="gold" size="md" />,
    tone: 'gold',
    name: 'Month podium',
    how: '1st, 2nd or 3rd in the arcade’s standings for a calendar month, given when the month closes: a gold, silver or bronze cup.',
  },
  {
    key: 'week-podium',
    art: <WeeklyMedal rank={1} size="md" />,
    tone: 'gold',
    name: 'Week podium',
    how: '1st, 2nd or 3rd in the arcade’s standings for a week (Monday to Sunday, New York time), given when the week closes: a gold, silver or bronze medal.',
  },
  {
    key: 'month-top',
    art: <TopTenRibbon tone="monthly" rank={4} size="md" />,
    tone: 'month',
    name: 'Month top ten',
    how: '4th to 10th in a month’s standings: a violet rosette with the place on it.',
  },
  {
    key: 'week-top',
    art: <TopTenRibbon tone="weekly" rank={7} size="md" />,
    tone: 'week',
    name: 'Week top ten',
    how: '4th to 10th in a week’s standings: a teal rosette with the place on it.',
  },
  {
    key: 'hunt',
    art: <HuntSetJar size="md" />,
    tone: 'hunt',
    name: 'Bug hunt set',
    how: 'All twelve of a month’s daily bugs caught, each on its own day. The first set also unlocks the bug net pin.',
  },
]

/** What finds each secret, as the API checks it (its secrets.ts), in words. */
const SECRET_RULES: Record<SecretKey, string> = {
  nightowl:
    'A run saved between 3:00 and 3:59 in the morning on the player’s own clock. The site sends the player’s time zone with each score.',
  earlybird: 'The day’s bug caught before 8 in the morning on the player’s own clock.',
  grandtour:
    'A saved run on every one of the 18 games the site lists (all but Simon and Spotter) in one day on the boards’ clock, New York time. Ace Chase counts when the day’s hole is solved, and solving it can finish the tour.',
  palindrome:
    'A saved score of 1,001 or more that reads the same backwards, like 1,221 or 34,543. Games scored in points only: not Ace Chase, Spotter, Find the Bug, Hot Lap or Half Full.',
  sevens: 'A saved score made only of sevens: 777, 7,777, 77,777 and so on. Games scored in points only.',
  photofinish: 'A saved score that ties first place on that game’s board this week, where another player already has the same score.',
  soclose: 'A saved score exactly one point below the game’s all-time record as it stood before the run. Games scored in points only.',
  holeinone: 'Today’s Hole solved with a bullseye on the first try.',
  konami: 'Doing the cheat code (see Easter eggs).',
  blip: 'Doing the logo blip (see Easter eggs).',
  wish: 'A run saved at 11:11 on the player’s own clock, morning or night.',
  dejavu:
    'A saved score of 100 or more that’s the same as the player’s run just before it on the same game. Games scored in points only.',
  round: 'A saved score of exactly 1,000, 10,000 or 100,000. Games scored in points only.',
  marathon:
    'Fifty saved runs in one day on the boards’ clock, New York time, any games. A solved Today’s Hole counts as one. Saves are capped at 40 in ten minutes, so it takes at least a quarter of an hour.',
  barrelroll: 'Doing a barrel roll (see Easter eggs).',
  corner: 'Watching the screen saver hit a corner (see Easter eggs).',
  cheats: 'Trying an old game cheat (see Easter eggs).',
  continue: 'Putting a coin in at Game Over (see Easter eggs).',
}

/** What each Today streak reward is, beyond the card's words. */
const TODAY_REWARD_NOTES: Record<number, string> = {
  3: '10 tickets.',
  7: 'The Today pin, a punched ticket on deep orange. The flame pin stays for playing any game seven days in a row.',
  14: '25 tickets.',
  30: 'The Gold badge finish. Never for sale: it isn’t on the counter, and the API refuses to trade for it.',
  100: 'The “Every Day” title, on a plate in lights. Never for sale.',
}

const EGGS: { key: string; name: string; how: string; does: string; clue: string; secret: string }[] = [
  {
    key: 'konami',
    name: 'The cheat code: 8-bit mode',
    how: 'On any page but a game’s screen, ↑ ↑ ↓ ↓ ← → ← → then B A on a keyboard; on a phone, just swipe up, up, down, down, left, right, left, right.',
    does: 'Turns the whole site 8-bit: a pixel font, square corners and faint scan lines, with a Turn off button in the corner. The device remembers it; the code again turns it off.',
    clue: 'The code is scratched, small and very faint, into the footer of every page, under “Original games that load fast…”, like a tip written on an arcade cabinet. Phones see it without the B A.',
    secret: 'Up Up Down Down',
  },
  {
    key: 'blip',
    name: 'The logo blip',
    how: 'Tap the Blipka logo at the top left seven times quickly, each within about a second of the last.',
    does: 'The logo wobbles from the third tap and blips on the seventh.',
    clue: 'The dot on the logo’s i sends out two little rings now and then (6 seconds in, then every 25 to 45), as if it wants a tap. It stops once that device has made it blip, and never plays for anyone who has asked their device for less motion.',
    secret: 'Blip Blip',
  },
  {
    key: 'barrelroll',
    name: 'The barrel roll',
    how: 'Search “do a barrel roll” (or just “barrel roll”). Typed anywhere on a keyboard without the spaces works too.',
    does: 'The whole screen does a barrel roll, header and all, with a whoosh, and the search says “Wheee!”.',
    clue: 'A search of three letters or more that finds nothing says “Try “do a barrel roll”.”, till that device has done it.',
    secret: 'Barrel Roll',
  },
  {
    key: 'corner',
    name: 'The screen saver',
    how: 'Leave any page with the site’s header alone for a minute: no taps, keys, scrolling or mouse. Not on a game’s screen, over an open dialog, while typing, or with less motion asked for. To see it now, add ?saver=now to any address, or ?saver=corner for a corner within seconds.',
    does: 'The screen dims and the blip bounces round it like an old DVD player’s logo, a new colour at every wall. Its path is aimed to land exactly in a corner 16 to 36 seconds in (then every 40 to 75): a burst, “Perfect corner!”, and a chime. Anything touched brings the page back.',
    clue: 'None needed: it shows itself to anyone who leaves the site open.',
    secret: 'Perfect Corner',
  },
  {
    key: 'cheats',
    name: 'Old game cheats',
    how: 'Search one, or type it anywhere on a keyboard: iddqd, idkfa, xyzzy, rosebud, motherlode, kaching, hesoyam, “show me the money” or “there is no cow level”.',
    does: 'The arcade answers back. iddqd gives ten seconds of gold “god mode” round the screen; xyzzy says “Nothing happens.”; the money ones say “Nice try. Tickets are earned here.” Nothing is ever given.',
    clue: 'The cheat code scratched into the footer says cheats are a thing here. Once the barrel roll is done, a search that finds nothing says “Cheats don’t work here. Mostly.”',
    secret: 'Nice Try',
  },
  {
    key: 'continue',
    name: 'Game Over',
    how: 'Go to any address the site has never had (a mistyped one, say), or /level/256. An address that starts with one of the site’s own sections (games, records, leaderboards and so on) still goes where it always did.',
    does: 'An arcade Game Over screen counts CONTINUE? down from 9. Insert coin before it runs out and it says CONTINUE! and goes back to the arcade. /level/256 is Pac-Man’s last level: the right half of the screen is garbage.',
    clue: 'A faint “Level 256” beside the © at the very bottom of every page.',
    secret: 'Continue?',
  },
]

function ThingRow({ thing }: { thing: Thing }) {
  return (
    <li className="adm-row adm-thing">
      <span className={`adm-thing__art trophy-tone--${thing.tone}`} aria-hidden="true">
        {thing.art}
      </span>
      <div className="adm-row__main">
        <b className="adm-row__title">{thing.name}</b>
        {thing.says ? <span className="adm-thing__says">“{thing.says}”</span> : null}
        <span className="adm-row__sub">{thing.how}</span>
      </div>
    </li>
  )
}

export function AdminTrophies() {
  const secrets: Thing[] = SECRETS.map((s) => ({
    key: s.key,
    art: <SecretArt n={s.n} size="md" />,
    tone: 'secret',
    name: `${s.name} · #${s.n}`,
    says: s.says,
    how: SECRET_RULES[s.key],
  }))
  const pins = AVATAR_PINS.filter((p) => !isGamePin(p))
  return (
    <>
      <section className="adm-card" aria-labelledby="adm-trophies">
        <div className="adm-card__head">
          <h2 className="adm-card__title" id="adm-trophies">
            Trophies
            <span className="adm-card__count">{TROPHIES.length}</span>
          </h2>
        </div>
        <p className="adm-card__sub">
          The trophies anyone can see how to win. They go on the player’s shelf and in the trophy case on their card,
          and the inbox says when one comes.
        </p>
        <ul className="adm-list">
          {TROPHIES.map((t) => (
            <ThingRow key={t.key} thing={t} />
          ))}
        </ul>
      </section>

      <section className="adm-card" aria-labelledby="adm-today">
        <div className="adm-card__head">
          <h2 className="adm-card__title" id="adm-today">
            Today streak
            <span className="adm-card__count">{TODAY_MILESTONES.length}</span>
          </h2>
        </div>
        <p className="adm-card__sub">
          Today’s ticket, on the home page: a streak day is one with any three of the day’s live dailies done (Today’s
          Hole solved, a lap on Today’s Track saved, Today’s Wanted’s first run saved, Today’s Pour’s first pour
          saved), on the boards’ New York day. Before Today’s Pour joined, on 28 September 2026, that was all three.
          Doing all four is a Full ticket: a gold mark in the week and “Full” on the header chip, with no reward of
          its own. The Daily, the One Shot and the bug hunt are bonus
          punches and don’t count. Signed-in players with a tag see the streak in the header too. Each reward comes
          once an account, however often a streak breaks, with a note in the inbox.
        </p>
        <ul className="adm-list">
          {TODAY_MILESTONES.map((m) => (
            <li key={m.day} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">Day {m.day}</b>
                <span className="adm-row__sub">{TODAY_REWARD_NOTES[m.day] ?? m.prize}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-card" aria-labelledby="adm-secrets">
        <div className="adm-card__head">
          <h2 className="adm-card__title" id="adm-secrets">
            Secret trophies
            <span className="adm-card__count">{SECRETS.length}</span>
          </h2>
        </div>
        <p className="adm-card__sub">
          Nothing on the site says how to get these until someone has. Once a player finds one, their card and shelf
          show it with the line in quotes, and their own card shows a question mark for each one left. Twelve are
          found by playing (1–8 and 11–14) and six by the easter eggs (9, 10 and 15–18). Each is found once an
          account.
        </p>
        <ul className="adm-list">
          {secrets.map((t) => (
            <ThingRow key={t.key} thing={t} />
          ))}
        </ul>
      </section>

      <section className="adm-card" aria-labelledby="adm-eggs">
        <div className="adm-card__head">
          <h2 className="adm-card__title" id="adm-eggs">
            Easter eggs
            <span className="adm-card__count">{EGGS.length}</span>
          </h2>
        </div>
        <p className="adm-card__sub">
          Hidden things to do on the site, each with a quiet clue. Each also finds a secret trophy the first time,
          signed in; signed out, it still works, but nothing is kept.
        </p>
        <ul className="adm-list">
          {EGGS.map((egg) => (
            <li key={egg.key} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{egg.name}</b>
                <span className="adm-row__sub">
                  <b>How:</b> {egg.how}
                </span>
                <span className="adm-row__sub">
                  <b>What it does:</b> {egg.does}
                </span>
                <span className="adm-row__sub">
                  <b>Clue:</b> {egg.clue}
                </span>
                <span className="adm-row__sub">
                  <b>Secret trophy:</b> {egg.secret}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-card" aria-labelledby="adm-flair">
        <div className="adm-card__head">
          <h2 className="adm-card__title" id="adm-flair">
            Avatar rings and pins
          </h2>
        </div>
        <p className="adm-card__sub">
          What a player can wear on their avatar, earned on the boards and never bought. A ring or pin already worn stays
          on even if the place that earned it slips.
        </p>
        <ul className="adm-list">
          {AVATAR_RINGS.map((ring) => (
            <li key={ring} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{RING_INFO[ring].label} ring</b>
                <span className="adm-row__sub">{RING_INFO[ring].rule}.</span>
              </div>
            </li>
          ))}
          {pins.map((pin) => (
            <li key={pin} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{pinInfo(pin).label} pin</b>
                <span className="adm-row__sub">{pinInfo(pin).rule}.</span>
              </div>
            </li>
          ))}
          <li className="adm-row">
            <div className="adm-row__main">
              <b className="adm-row__title">Game pins ({AVATAR_GAME_PINS.length})</b>
              <span className="adm-row__sub">
                One for each game (not Ace Chase, Hot Lap or Half Full yet): reach the all-time top ten on that game.
              </span>
            </div>
          </li>
        </ul>
        <p className="adm-note">
          The looks bought with tickets (card themes, titles, name styles and more) are all at the{' '}
          <a href={prizesHref()}>prize counter</a>.
        </p>
      </section>
    </>
  )
}
