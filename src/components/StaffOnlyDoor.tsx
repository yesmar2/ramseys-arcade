import { useEffect } from 'react'
import '../styles/staffOnly.css'
import { homeHref, todayHref } from '../hooks/useHashRoute'
import { loadPixelFont, reportEgg } from '../lib/eggs'

/*
 * What /admin is to anyone who isn't an admin: the arcade's back-room door, under a flickering STAFF ONLY
 * sign, its keypad blinking red. Ramsey picked it (2026-10-05, "A" of three on the Restricted page canvas)
 * over a page that only said it was restricted. Finding it is a secret, Staff Only (lib/secrets.ts), and its
 * clue is in robots.txt (scripts/prerender.mjs), under the Disallow for /admin.
 */
export function StaffOnlyDoor() {
  useEffect(() => {
    loadPixelFont()
    void reportEgg('staffonly')
  }, [])

  return (
    <section className="staff-only" aria-labelledby="staff-only-title">
      <figure className="staff-only__art">
        <svg viewBox="0 0 440 600" role="img" aria-label="A back-room door marked Staff Only, its keypad glowing red">
          <rect width="440" height="600" rx="28" className="staff-only__wall" />
          <g className="staff-only__bricks">
            {[60, 120, 180, 240, 300, 360, 420, 480, 540].map((y) => (
              <line key={y} x1="0" y1={y} x2="440" y2={y} />
            ))}
          </g>
          <g className="staff-only__sign">
            <rect x="104" y="28" width="232" height="74" rx="18" className="staff-only__glow" />
            <rect x="110" y="34" width="220" height="62" rx="14" className="staff-only__tube" />
            <text x="220" y="76" textAnchor="middle" className="staff-only__sign-text">
              STAFF ONLY
            </text>
          </g>
          <rect x="98" y="132" width="244" height="440" rx="6" className="staff-only__door" />
          <rect x="124" y="160" width="192" height="150" rx="4" className="staff-only__panel" />
          <rect x="124" y="330" width="192" height="210" rx="4" className="staff-only__panel" />
          <rect x="150" y="196" width="140" height="70" rx="6" fill="#f5b942" />
          <text x="220" y="226" textAnchor="middle" className="staff-only__plate">
            NO TOKENS
          </text>
          <text x="220" y="250" textAnchor="middle" className="staff-only__plate">
            PAST HERE
          </text>
          <circle cx="306" cy="372" r="11" fill="#8aa0ae" />
          <rect x="284" y="368" width="34" height="8" rx="4" fill="#b8c7d1" />
          <rect x="358" y="300" width="52" height="82" rx="8" className="staff-only__door" />
          <circle cx="384" cy="314" r="5" className="staff-only__led" />
          <g fill="#33495a">
            {[0, 1, 2].flatMap((row) =>
              [0, 1, 2].map((col) => <rect key={`${row}-${col}`} x={366 + col * 13} y={326 + row * 13} width="10" height="9" rx="2" />),
            )}
            <rect x="379" y="365" width="10" height="9" rx="2" />
          </g>
          <rect x="104" y="566" width="232" height="8" fill="#f5b942" opacity=".55" />
          <rect x="80" y="574" width="280" height="26" fill="#f5b942" opacity=".08" />
          <g transform="translate(30 500)">
            <path d="M0 26 L10 80 L52 80 L62 26 Z" fill="#2eb8a0" opacity=".85" />
            <rect x="-4" y="18" width="70" height="10" rx="5" fill="#239683" />
            <line x1="40" y1="20" x2="74" y2="-150" stroke="#8a6a3c" strokeWidth="6" strokeLinecap="round" />
          </g>
        </svg>
      </figure>
      <div className="staff-only__words">
        <p className="staff-only__kicker">ACCESS DENIED</p>
        <h1 className="staff-only__title" id="staff-only-title">
          Staff only.
        </h1>
        <p className="staff-only__text">
          This door is for the people who keep the lights on. Every game is out front, and none of them are back here.
        </p>
        <div className="staff-only__acts">
          <a className="staff-only__cta" href={homeHref()}>
            Back to the games
          </a>
          <a className="staff-only__ghost" href={todayHref()}>
            Today’s dailies
          </a>
        </div>
      </div>
    </section>
  )
}
