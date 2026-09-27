import { SECRETS, type SecretKey } from '../lib/secrets'
import { SecretArt } from './TrophyArt'

/*
 * The secret trophies for the admin (lib/secrets.ts): what each says once a player has found it, and
 * exactly what finds it. Nothing else on the site says.
 */

/** What finds each secret, as the API checks it (its secrets.ts), in words. */
const RULES: Record<SecretKey, string> = {
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
  konami:
    'The cheat code, on any page: ↑ ↑ ↓ ↓ ← → ← → then B A on a keyboard, or those swipes and then two taps on a phone. It also turns 8-bit mode on and off.',
  blip: 'Seven quick taps on the Blipka logo at the top left, each within about a second of the last. The logo wobbles from the third tap and blips on the seventh.',
}

export function AdminSecrets() {
  return (
    <section className="adm-card" aria-labelledby="adm-secrets">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-secrets">
          Secret trophies
          <span className="adm-card__count">{SECRETS.length}</span>
        </h2>
      </div>
      <p className="adm-card__sub">
        Nothing on the site says how to get these until someone has. Once a player finds one, their card and shelf
        show it with the line in quotes. Here’s exactly what finds each.
      </p>
      <ul className="adm-list">
        {SECRETS.map((secret) => (
          <li key={secret.key} className="adm-row adm-secret">
            <span className="adm-secret__art trophy-tone--secret" aria-hidden="true">
              <SecretArt n={secret.n} size="md" />
            </span>
            <div className="adm-row__main">
              <b className="adm-row__title">
                {secret.name} <span className="adm-secret__n">#{secret.n}</span>
              </b>
              <span className="adm-secret__says">“{secret.says}”</span>
              <span className="adm-row__sub">{RULES[secret.key]}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="adm-note">
        Each is found once an account and goes on the shelf of the tag it plays as. Signed out, the eggs still work,
        but nothing is kept.
      </p>
    </section>
  )
}
