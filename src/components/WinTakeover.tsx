import { useId, useRef } from 'react'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import type { WinPodium, WinTakeoverData } from '../lib/winTakeover'
import { CloseIcon, Panel } from './Panel'
import { PlayerAvatar } from './PlayerAvatar'
import { ReportConfetti } from './RunReport'

/*
 * The whole screen, once: an event won, or first in the standings. The prize
 * in gold beside a trophy and the podium, how it was won in a line, the games
 * that won it, and two ways on. Carry on (or Esc, or the close) goes back to
 * whatever it covered, the run report or the event's page.
 */

export type WinAction = { label: string; href?: string; onClick?: () => void }

function Trophy({ plate }: { plate: string | null }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="win__trophy" viewBox="0 0 230 250" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-cup`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe29a" />
          <stop offset="0.5" stopColor="#f5b942" />
          <stop offset="1" stopColor="#b87a12" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M58 22h114v58c0 38-26 66-57 66S58 118 58 80z" fill={`url(#${id}-cup)`} />
      <path
        d="M58 34H26v18c0 26 18 42 40 44M172 34h32v18c0 26-18 42-40 44"
        fill="none"
        stroke={`url(#${id}-cup)`}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="104" y="144" width="22" height="42" fill={`url(#${id}-cup)`} />
      <path d="M70 186h90l8 26H62z" fill={`url(#${id}-cup)`} />
      <rect x="52" y="212" width="126" height="26" rx="6" fill="#8a5a10" />
      <path d="M76 32c0 30 6 60 22 84" fill="none" stroke={`url(#${id}-shine)`} strokeWidth="9" strokeLinecap="round" />
      {plate ? (
        <text
          x="115"
          y="230"
          textAnchor="middle"
          fontFamily="ui-monospace, 'DM Mono', monospace"
          fontSize="11"
          fontWeight="600"
          fill="#ffe29a"
          letterSpacing="1.5"
        >
          {plate}
        </text>
      ) : null}
    </svg>
  )
}

const ORDINAL: Record<1 | 2 | 3, string> = { 1: '1st', 2: '2nd', 3: '3rd' }

/** Second, first, third: the podium's own order. */
function podiumOrder(podium: WinPodium[]): WinPodium[] {
  const at = (place: number) => podium.find((p) => p.place === place)
  return [at(2), at(1), at(3)].filter((p): p is WinPodium => Boolean(p))
}

export function WinTakeover({
  data,
  primary,
  onClose,
}: {
  data: WinTakeoverData
  primary?: WinAction | null
  onClose: () => void
}) {
  const titleId = useId()
  const primaryRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null)
  const carryRef = useRef<HTMLButtonElement>(null)
  // It opens as a run ends: the run's last presses don't reach its buttons (useDeliberatePress).
  const allow = useDeliberatePress()

  return (
    <Panel
      onClose={onClose}
      labelledBy={titleId}
      scrimCloses={false}
      className="win"
      layerClassName="win-layer"
      initialFocus={primary ? primaryRef : carryRef}
      backdrop={<ReportConfetti accent="#f5b942" />}
    >
      <button
        type="button"
        className="panel__close win__close"
        aria-label="Close"
        onClick={(e) => {
          if (allow(e)) onClose()
        }}
      >
        <CloseIcon />
      </button>
      <div className="win__stage">
        <div className="win__art">
          <Trophy plate={data.plate} />
          {data.podium.length ? (
            <ol className="win__podium" aria-label="Podium">
              {podiumOrder(data.podium).map((p) => (
                <li key={p.name} className={`win__step win__step--${p.place}${p.mine ? ' win__step--mine' : ''}`}>
                  <PlayerAvatar name={p.name} avatarId={p.avatarId} size="lg" />
                  <span className="win__step-name">{p.name}</span>
                  <span className="win__block">
                    <span className="win__block-place">{ORDINAL[p.place]}</span>
                    <span className="win__block-value">{p.value}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="win__text">
          <span className="win__kicker">{data.kicker}</span>
          <h2 id={titleId} className="win__title">
            {data.lead} <span className="win__prize">{data.prize}</span>
          </h2>
          <p className="win__lede">{data.lede}</p>
          {data.rows.length ? (
            <ul className="win__rows" aria-label="How it was won">
              {data.rows.map((row) => (
                <li key={row.key} className="win__row">
                  <span className="win__dot" style={{ background: row.color }} aria-hidden="true" />
                  <span className="win__row-name">{row.name}</span>
                  <span className={`win__row-place win__row-place--${row.placeTone}`}>{row.place}</span>
                  <span className="win__row-value">{row.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="win__actions">
            {primary?.href ? (
              <a
                ref={primaryRef}
                className="win__btn"
                href={primary.href}
                onClick={(e) => {
                  if (!allow(e)) e.preventDefault()
                }}
              >
                {primary.label}
              </a>
            ) : primary ? (
              <button
                ref={primaryRef}
                type="button"
                className="win__btn"
                onClick={(e) => {
                  if (allow(e)) primary.onClick?.()
                }}
              >
                {primary.label}
              </button>
            ) : null}
            <button
              ref={carryRef}
              type="button"
              className="win__btn win__btn--ghost"
              onClick={(e) => {
                if (allow(e)) onClose()
              }}
            >
              Carry on
            </button>
          </div>
          {data.note ? (
            <p className="win__note">
              {data.note.href ? <a href={data.note.href}>{data.note.text}</a> : data.note.text}
            </p>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
