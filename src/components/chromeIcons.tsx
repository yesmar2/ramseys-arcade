import type { ReactNode } from 'react'

/*
 * The header's, the menu's and the tab bar's icons: plain strokes in the
 * text colour, drawn on a 24 grid like the rest of the site's.
 */

function Stroke({ children, width = 2 }: { children: ReactNode; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function GamesIcon() {
  return (
    <Stroke>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <circle cx="17.25" cy="17.25" r="3.75" />
    </Stroke>
  )
}

export function BoardsIcon() {
  return (
    <Stroke>
      <path d="M4 20v-9" />
      <path d="M10 20V5" />
      <path d="M16 20v-6" />
      <path d="M22 20H2" />
    </Stroke>
  )
}

export function EventsIcon() {
  return (
    <Stroke>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
    </Stroke>
  )
}

export function RecordsIcon() {
  return (
    <Stroke>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
      <path d="M9 7h6" />
    </Stroke>
  )
}

export function GroupsIcon() {
  return (
    <Stroke>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 4.8a3.2 3.2 0 0 1 0 6.4" />
      <path d="M18 14.7c1.9.7 3 2.5 3 5.3" />
    </Stroke>
  )
}

export function UserIcon() {
  return (
    <Stroke>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.6 3.4-5.4 7-5.4s6.2 1.8 7 5.4" />
    </Stroke>
  )
}

export function BellIcon() {
  return (
    <Stroke>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Stroke>
  )
}

export function StatsIcon() {
  return (
    <Stroke>
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M15 8h5v5" />
    </Stroke>
  )
}

export function FriendIcon() {
  return (
    <Stroke>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20c.7-3.4 3.1-5.2 6.5-5.2s5.8 1.8 6.5 5.2" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </Stroke>
  )
}

export function InviteIcon() {
  return (
    <Stroke>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </Stroke>
  )
}

export function SunIcon() {
  return (
    <Stroke>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Stroke>
  )
}

export function MoonIcon() {
  return (
    <Stroke>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </Stroke>
  )
}

export function SignOutIcon() {
  return (
    <Stroke>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </Stroke>
  )
}

export function PencilIcon() {
  return (
    <Stroke width={2.2}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Stroke>
  )
}

export function CloseIcon() {
  return (
    <Stroke width={2.2}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </Stroke>
  )
}

export function ChevronRightIcon() {
  return (
    <Stroke>
      <path d="M9 6l6 6-6 6" />
    </Stroke>
  )
}

/** A medal on its ribbon: a place on the boards, where the events icon is the trophy. */
export function MedalIcon() {
  return (
    <Stroke>
      <path d="M8 3l4 6.2L16 3" />
      <circle cx="12" cy="15" r="5.6" />
      <path d="M10.9 13.6l1.3-1v5" />
    </Stroke>
  )
}

/* ---------- a game's page ---------- */

/** Play: a solid triangle, the one filled icon, so it reads as the button it sits in. */
export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  )
}

/** A streak: days or runs in a row. */
export function FlameIcon() {
  return (
    <Stroke>
      <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.3-5.6 3.9-7.7.5 1.9 1.6 3 2.8 3.4-.3-2.7.8-5.5 3.1-7.5.4 3.4 4.2 5.6 4.2 11.6 0 3.8-3.2 6.4-7.5 6.4Z" />
    </Stroke>
  )
}

/** Against the clock. */
export function TimerIcon() {
  return (
    <Stroke>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 1.5" />
      <path d="M9.5 2.5h5" />
    </Stroke>
  )
}

/** Something open: a board nobody is on yet, a record nobody holds. */
export function SparkleIcon() {
  return (
    <Stroke>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
    </Stroke>
  )
}

/** A place still to fill. */
export function PlusIcon() {
  return (
    <Stroke>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Stroke>
  )
}

/** A phone beside a desk: where a game plays. */
export function DevicesIcon() {
  return (
    <Stroke>
      <rect x="2.5" y="4" width="13" height="10" rx="1.6" />
      <path d="M6 17.5h6" />
      <rect x="17" y="9" width="4.5" height="11" rx="1.2" />
    </Stroke>
  )
}
