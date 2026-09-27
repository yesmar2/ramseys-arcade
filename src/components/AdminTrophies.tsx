import type { ReactNode } from 'react'
import { prizesHref } from '../hooks/useHashRoute'
import { AVATAR_GAME_PINS, AVATAR_PINS, AVATAR_RINGS, isGamePin, pinInfo, RING_INFO } from '../lib/avatars'
import { SECRETS, type SecretKey } from '../lib/secrets'
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
    'A saved run on every one of the 17 games the site lists (all but Simon and Spotter) in one day on the boards’ clock, New York time. Ace Chase counts when the day’s hole is solved, and solving it can finish the tour.',
  palindrome:
    'A saved score of 1,001 or more that reads the same backwards, like 1,221 or 34,543. Games scored in points only: not Ace Chase, Spotter, Find the Bug or Hot Lap.',
  sevens: 'A saved score made only of sevens: 777, 7,777, 77,777 and so on. Games scored in points only.',
  photofinish: 'A saved score that ties first place on that game’s board this week, where another player already has the same score.',
  soclose: 'A saved score exactly one point below the game’s all-time record as it stood before the run. Games scored in points only.',
  holeinone: 'Today’s Hole solved with a bullseye on the first try.',
  konami: 'Doing the cheat code (see Easter eggs).',
  blip: 'Doing the logo blip (see Easter eggs).',
}

const EGGS: { key: string; name: string; how: string; does: string; secret: string }[] = [
  {
    key: 'konami',
    name: 'The cheat code: 8-bit mode',
    how: 'On any page, ↑ ↑ ↓ ↓ ← → ← → then B A on a keyboard; on a phone, swipe up, up, down, down, left, right, left, right, then tap twice.',
    does: 'Turns the whole site 8-bit: a pixel font, square corners and faint scan lines, with a Turn off button in the corner. The device remembers it; the code again turns it off.',
    secret: 'Up Up Down Down',
  },
  {
    key: 'blip',
    name: 'The logo blip',
    how: 'Tap the Blipka logo at the top left seven times quickly, each within about a second of the last.',
    does: 'The logo wobbles from the third tap and blips on the seventh.',
    secret: 'Blip Blip',
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

      <section className="adm-card" aria-labelledby="adm-secrets">
        <div className="adm-card__head">
          <h2 className="adm-card__title" id="adm-secrets">
            Secret trophies
            <span className="adm-card__count">{SECRETS.length}</span>
          </h2>
        </div>
        <p className="adm-card__sub">
          Nothing on the site says how to get these until someone has. Once a player finds one, their card and shelf
          show it with the line in quotes, and their own card shows a question mark for each one left. Eight are found
          by playing; the last two by the easter eggs. Each is found once an account.
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
          Hidden things to do on the site. Each also finds a secret trophy the first time, signed in; signed out, it
          still works, but nothing is kept.
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
                One for each game (not Ace Chase or Hot Lap yet): reach the all-time top ten on that game.
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
