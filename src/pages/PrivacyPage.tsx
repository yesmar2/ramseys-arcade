import { APP_NAME } from '../lib/brand'
import { LegalContact, LegalDocument } from '../components/LegalDocument'

const UPDATED = 'August 31, 2026'

export function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy describes how {APP_NAME} (“we”, “us”) handles information when you
        use our free browser arcade at fordriva.com and related pages (the “Service”).
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
          <strong>Account information.</strong> If you sign in with Google or request an
          email link, we receive the information needed to authenticate you (such as your
          email address and a provider identifier). We use this to link your account to your
          player name.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting providers may log standard request
          information (IP address, browser type, timestamps) for security and reliability.
        </li>
      </ul>

      <h2>How we use information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>Run games, leaderboards, record books, and tournaments</li>
        <li>Display public rankings and player names you choose to submit</li>
        <li>Authenticate accounts and prevent abuse</li>
        <li>Improve stability and fix problems with the Service</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>What is public</h2>
      <p>
        Player names and scores you submit to leaderboards, record books, or tournaments may be
        visible to other visitors. Choose a name you are comfortable displaying publicly.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        The Service uses browser local storage (and similar technologies) to remember your
        preferences and session. We do not use third-party advertising cookies. If you sign in
        with Google, Google’s own policies apply to that sign-in flow.
      </p>

      <h2>Third-party services</h2>
      <ul>
        <li>
          <strong>Google Sign-In</strong> — optional authentication; governed by Google’s
          privacy policy when you use it.
        </li>
        <li>
          <strong>Hosting</strong> — the site and API are hosted on third-party infrastructure
          (for example Vercel and Render) that process traffic on our behalf.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        The Service is a casual arcade intended for a general audience. We do not knowingly
        collect personal information from children under 13. If you believe a child has
        provided personal information, contact us and we will take reasonable steps to delete
        it.
      </p>

      <h2>Retention</h2>
      <p>
        Leaderboard and account data may be retained while the Service operates. Local data on
        your device remains until you clear your browser storage. We may delete inactive or
        test data at any time, especially during early development.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Play as a guest without signing in</li>
        <li>Clear site data in your browser to remove local preferences</li>
        <li>Choose a different public player name before submitting scores</li>
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
        See also our <a href="#/terms">Terms of Service</a>.
      </p>
    </LegalDocument>
  )
}
