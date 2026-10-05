import { APP_NAME } from '../lib/brand'
import { LegalContact, LegalDocument } from '../components/LegalDocument'
import { plusHref, privacyHref } from '../hooks/useHashRoute'

const UPDATED = 'October 5, 2026'

export function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (“Terms”) govern your use of {APP_NAME}, a browser arcade with
        leaderboards and events that is free to play, with optional paid extras (the “Service”).
        By using the Service, you agree to these Terms.
      </p>

      <h2>The Service</h2>
      <p>
        {APP_NAME} provides casual games you can play in a web browser, optionally save scores
        to public leaderboards, and join scheduled tournaments. The Service is provided for
        entertainment. We may add, change, or remove games and features at any time.
      </p>

      <h2>Who can use it</h2>
      <ul>
        <li>Anyone may play without an account.</li>
        <li>You must be at least 13 years old to create an account or sign in.</li>
        <li>
          If you are under 18, you need a parent or guardian’s permission to buy anything, and
          they are responsible for the purchase.
        </li>
      </ul>

      <h2>Accounts and player names</h2>
      <ul>
        <li>
          Saving scores, picking a player name (gamer tag) and joining events need an account.
          You sign in with Google, Discord or a code sent to your email, whichever the sign-in
          screen offers.
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
        <li>
          Nothing you buy changes a score, a place or a rank. Paid extras are looks and access,
          never an advantage on a board.
        </li>
      </ul>

      <h2>Plus membership</h2>
      <ul>
        <li>
          <strong>What it is.</strong> Plus is an optional paid membership. What it includes is
          described on the <a href={plusHref()}>Plus page</a>, along with its current prices.
        </li>
        <li>
          <strong>Billing.</strong> Plus is billed monthly or yearly, as you choose when you join.
          It <strong>renews automatically</strong> at the end of each period, and your payment
          method is charged the price shown when you joined (plus any tax that applies) until
          you cancel.
        </li>
        <li>
          <strong>Free week.</strong> An account’s first membership may start with a free week.
          A payment method is needed to start it. If you don’t cancel before the free week ends,
          it becomes a paid membership and you are charged then. Each account gets one free week.
          Rewards that are yours to keep (the season’s Pass+ rewards and the month’s members’
          look) arrive with the first payment, not during the free week.
        </li>
        <li>
          <strong>Cancelling.</strong> You can cancel any time from the Plus page (“Manage or
          cancel”). Plus then lasts until the end of the period you’ve paid for and does not
          renew. Anything Plus gave you to keep stays yours after it ends.
        </li>
        <li>
          <strong>Price changes.</strong> If the price changes, we’ll tell members before the
          new price applies. It takes effect from your next renewal, and you can cancel before
          then.
        </li>
        <li>
          <strong>Changes to Plus.</strong> We may change what Plus includes. If we take
          something away, we’ll tell members first.
        </li>
      </ul>

      <h2>Pass+</h2>
      <p>
        Pass+ is a one-time payment for one season’s extra rewards. It does not renew. Its
        rewards are given level by level as you play that season (or up to your level at once
        when you buy it), and they stay yours after the season ends.
      </p>

      <h2>Payments and refunds</h2>
      <ul>
        <li>
          Payments are handled by Stripe. Prices are in US dollars, and tax may be added where
          it applies.
        </li>
        <li>
          Payments are not refunded for time or rewards already received, except where the law
          requires it.
        </li>
        <li>
          If you were charged by mistake (for example, a free week you meant to cancel), contact
          us within 14 days of the charge and we’ll make it right.
        </li>
      </ul>

      <h2>Tickets, prizes, skins and looks</h2>
      <p>
        Tickets, prizes, skins, titles and other looks you earn or receive in the Service have
        no cash value. They can’t be exchanged for money, sold, or transferred to another
        account, and they are for use in the Service only. We may change how they look or
        work, but we won’t take away ones you’ve earned or bought, except from an account
        suspended for breaking these Terms.
      </p>

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
        OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM
        IS LIMITED TO THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE IT.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or stop providing the Service, or restrict access, at any time. If we
        suspend an account for breaking these Terms, its membership ends and is not refunded.
        If we stop providing the Service, we’ll stop charging memberships and refund the unused
        part of any paid period. You may stop using the Service at any time.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. The “Last updated” date will change when we do. Continued
        use after changes means you accept the revised Terms.
      </p>

      <h2>Contact</h2>
      <LegalContact />

      <p className="legal-prose__fine">
        See also our <a href={privacyHref()}>Privacy Policy</a>.
      </p>
    </LegalDocument>
  )
}
