import { APP_NAME } from '../lib/brand'
import { LegalContact, LegalDocument } from '../components/LegalDocument'

const UPDATED = 'September 4, 2026'

export function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (“Terms”) govern your use of {APP_NAME}, a free browser arcade
        with leaderboards and events (the “Service”). By using the Service, you agree to these
        Terms.
      </p>

      <h2>The Service</h2>
      <p>
        {APP_NAME} provides casual games you can play in a web browser, optionally save scores
        to public leaderboards, and join scheduled tournaments. The Service is provided for
        entertainment. We may add, change, or remove games and features at any time.
      </p>

      <h2>Accounts and player names</h2>
      <ul>
        <li>You may play as a guest with a player name stored on your device.</li>
        <li>
          Optional sign-in (Google or email link) links your player name to an account across
          devices.
        </li>
        <li>
          You are responsible for the player name you display. Do not impersonate others or
          use offensive, misleading, or illegal names.
        </li>
        <li>We may rename, reject, or remove names and scores that violate these Terms.</li>
      </ul>

      <h2>Leaderboards and fair play</h2>
      <ul>
        <li>Submit only scores you earned through normal play on the Service.</li>
        <li>
          Do not cheat, exploit bugs, automate play, tamper with requests, or interfere with
          other players.
        </li>
        <li>
          Tournament and leaderboard standings are for fun. We may adjust or remove entries we
          believe are invalid.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose</li>
        <li>Attempt to gain unauthorized access to our systems or other users’ accounts</li>
        <li>Overload, scrape, or reverse engineer the Service beyond personal enjoyment</li>
        <li>Harass others through public player names or any other means</li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        The Service, including its design, code, art, and branding, is owned by us or our
        licensors. You receive a limited, personal, non-commercial license to use the Service
        as intended. Game concepts may be inspired by classic arcade games; all implementations
        here are original to this project.
      </p>

      <h2>No gambling</h2>
      <p>
        The Service does not offer real-money wagering, prizes with cash value, or gambling.
        Scores and rankings have no monetary value.
      </p>

      <h2>Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND,
        WHETHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE UNINTERRUPTED ACCESS, ERROR-FREE
        PLAY, OR THAT SCORES AND DATA WILL BE PRESERVED PERMANENTLY—ESPECIALLY DURING BETA OR
        DEVELOPMENT PERIODS.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS,
        OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or stop providing the Service, or restrict access, at any time. You
        may stop using the Service at any time.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. The “Last updated” date will change when we do. Continued
        use after changes means you accept the revised Terms.
      </p>

      <h2>Contact</h2>
      <LegalContact />

      <p className="legal-prose__fine">
        See also our <a href="#/privacy">Privacy Policy</a>.
      </p>
    </LegalDocument>
  )
}
