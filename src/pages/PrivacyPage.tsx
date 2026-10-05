import { APP_NAME, SITE_HOST } from '../lib/brand'
import { LegalContact, LegalDocument } from '../components/LegalDocument'
import { termsHref } from '../hooks/useHashRoute'

const UPDATED = 'October 5, 2026'

export function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy describes how {APP_NAME} (“we”, “us”) handles information when you
        use our browser arcade at {SITE_HOST} and related pages (the “Service”).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Gameplay data.</strong> Scores, player names (tags), leaderboard entries,
          tournament participation, and game progress may be stored on our servers when you
          submit a score or join an event.
        </li>
        <li>
          <strong>Local data.</strong> Your browser may store settings such as your chosen
          player name, sound preferences, theme, and personal bests using local storage on
          your device.
        </li>
        <li>
          <strong>Account information.</strong> If you sign in with Google or Discord, or with
          a code we email you, we receive the information needed to authenticate you (your
          email address, and an identifier from Google or Discord). We use this to link your
          account to your player name. The same email address, whichever way you sign in, is
          the same account.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting providers may log standard request
          information (IP address, browser type, timestamps) for security and reliability.
        </li>
        <li>
          <strong>Visit counts.</strong> We count page visits with Vercel Web Analytics, which
          uses no cookies and does not identify you. It sees the page’s address without anything
          after the “?”, your browser and device type, and your country.
        </li>
        <li>
          <strong>Error reports.</strong> When something on the site breaks, your browser tells our
          server what went wrong: the error, the page’s address without anything after the “?”,
          your browser type and the site’s version. It doesn’t include your name or account. We
          keep these for 30 days to fix problems.
        </li>
        <li>
          <strong>Feedback.</strong> If you send us an idea or tell us something broke, we keep what
          you wrote, the page you sent it from and your browser type, with your account and player
          name if you’re signed in.
        </li>
        <li>
          <strong>Tickets and prizes.</strong> With your account we keep the tickets your saved runs
          and other play have paid, what you’ve traded them for at the prize counter, and the prize
          you’re saving for.
        </li>
        <li>
          <strong>Purchases.</strong> If you buy Pass+ or join Plus, payment is handled by Stripe,
          which collects your card and billing details under its own privacy policy. We never see
          or store your full card number. We keep what you bought, Stripe’s identifiers for you
          and your membership, the membership’s status, and when it renews or ends.
        </li>
        <li>
          <strong>Alerts.</strong> If you turn on alerts, your browser gives us an address to send
          them to, through your browser maker’s push service. We keep it, and your alert settings,
          until you turn alerts off.
        </li>
      </ul>

      <h2>How we use information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>Run games, leaderboards, record books, and tournaments</li>
        <li>Display public rankings and player names you choose to submit</li>
        <li>Authenticate accounts and prevent abuse</li>
        <li>Take payments, and give you what you bought</li>
        <li>Send the alerts you turn on</li>
        <li>Improve stability and fix problems with the Service</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>What is public</h2>
      <p>
        Player names and scores you submit to leaderboards, record books, or tournaments may be
        visible to other visitors, along with your avatar, the looks you wear, and the season
        skin a run was played in. If you’re a Plus member, a small Plus mark shows beside your
        player name, and your player card says so. Choose a name you are comfortable displaying
        publicly.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        The Service uses browser local storage (and similar technologies) to remember your
        preferences and session. We do not use third-party advertising cookies. If you sign in
        with Google or Discord, that service’s own policies apply to its sign-in flow.
      </p>

      <h2>Third-party services</h2>
      <ul>
        <li>
          <strong>Google Sign-In</strong> — optional authentication; governed by Google’s
          privacy policy when you use it.
        </li>
        <li>
          <strong>Discord sign-in</strong> — optional authentication; governed by Discord’s
          privacy policy when you use it. We ask Discord only for your account’s identifier and
          email address.
        </li>
        <li>
          <strong>Email delivery</strong> — if you sign in with a code, it is sent through an
          email delivery service (Resend), which receives your email address to deliver it.
        </li>
        <li>
          <strong>Stripe</strong> — handles payments for Pass+ and Plus; governed by Stripe’s
          privacy policy. Stripe receives your payment details and email address directly.
        </li>
        <li>
          <strong>Push services</strong> — if you turn on alerts, they are delivered through your
          browser maker’s push service (for example Google, Apple or Mozilla).
        </li>
        <li>
          <strong>Hosting</strong> — the site and API are hosted on third-party infrastructure
          (for example Vercel and Render) that process traffic on our behalf.
        </li>
        <li>
          <strong>Vercel Web Analytics</strong> — counts page visits without cookies.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        The Service is a casual arcade intended for a general audience. Anyone can play without
        an account, but you must be 13 or older to sign in, and we do not knowingly collect
        personal information from children under 13. If you believe a child under 13 has signed
        in or given us personal information, contact us and we will delete it.
      </p>

      <h2>Retention</h2>
      <p>
        Leaderboard and account data may be retained while the Service operates. Records of
        purchases are kept as long as tax and accounting rules require, even if you ask us to
        remove your account. Local data on your device remains until you clear your browser
        storage. We may delete inactive or test data at any time, especially during early
        development.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Play without signing in; nothing goes on the boards until you do</li>
        <li>Clear site data in your browser to remove local preferences</li>
        <li>Choose a different public player name before submitting scores</li>
        <li>Turn alerts off, or choose which ones you get, in your notification settings</li>
        <li>Cancel Plus any time from the Plus page</li>
        <li>Request account or score removal by contacting us</li>
      </ul>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. The “Last updated” date at the top will
        change when we do. Continued use of the Service after changes means you accept the
        updated policy.
      </p>

      <h2>Contact</h2>
      <LegalContact />

      <p className="legal-prose__fine">
        See also our <a href={termsHref()}>Terms of Service</a>.
      </p>
    </LegalDocument>
  )
}
