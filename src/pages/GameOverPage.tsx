import { useEffect, useMemo, useRef, useState } from 'react'
import { PageShell } from '../components/PageShell'
import { homeHref, navigate } from '../hooks/useHashRoute'
import { loadPixelFont, reportEgg } from '../lib/eggs'
import { sfx } from '../lib/sound'
import '../styles/gameOver.css'

/*
 * A place the site has never had, an easter egg (lib/eggs.ts): an arcade's Game Over screen, counting
 * down to nothing, with a coin slot. A coin in before nought finds the Continue? secret and goes back
 * to the arcade. /level/256, the footer's faint door here, is Pac-Man's last level: the right half of the
 * screen comes out as garbage.
 */

/** CONTINUE? counts down from this, a second a number, like the machines did. */
const COUNT_FROM = 9
/** Long enough to read CONTINUE! before the arcade comes back. */
const BACK_AFTER_MS = 1700

/** The kill screen's garbage: rows of mismatched tiles, the same for the whole visit. */
const GARBAGE_ROWS = 16
const GARBAGE_COLS = 11
const GARBAGE_TILES = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789!?#$%&*=+<>/▚▞▙▟▛▜'
const GARBAGE_COLOURS = ['#ff5a5f', '#ffd166', '#5ce1e6', '#ff9f43', '#c792ea', '#3ee0b0', '#f6f6f6', '#7aa2ff']

function Garbage() {
  const rows = useMemo(
    () =>
      Array.from({ length: GARBAGE_ROWS }, () =>
        Array.from({ length: GARBAGE_COLS }, () => ({
          tile: GARBAGE_TILES[Math.floor(Math.random() * GARBAGE_TILES.length)]!,
          colour: GARBAGE_COLOURS[Math.floor(Math.random() * GARBAGE_COLOURS.length)]!,
          flip: Math.random() < 0.3,
        })),
      ),
    [],
  )
  return (
    <div className="game-over__garbage" aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className="game-over__garbage-row">
          {row.map((cell, c) => (
            <span key={c} style={{ color: cell.colour, transform: cell.flip ? 'scaleX(-1)' : undefined }}>
              {cell.tile}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** The address that isn't a page, shortened for saying. */
function missingPath(): string {
  let path = window.location.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    /* keep it as it came */
  }
  return path.length > 40 ? `${path.slice(0, 39)}…` : path
}

export function GameOverPage({ killScreen = false }: { killScreen?: boolean }) {
  const [left, setLeft] = useState(COUNT_FROM)
  const [coin, setCoin] = useState(false)
  const path = useMemo(missingPath, [])
  const coinRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    loadPixelFont()
    coinRef.current?.focus({ preventScroll: true })
  }, [])

  // CONTINUE? 9… 8… till a coin goes in, or it runs out.
  useEffect(() => {
    if (coin || left <= 0) return
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left, coin])

  // A coin in: back to the arcade.
  useEffect(() => {
    if (!coin) return
    const id = window.setTimeout(() => navigate(homeHref()), BACK_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [coin])

  const insertCoin = () => {
    if (coin || left <= 0) return
    setCoin(true)
    sfx('good')
    void reportEgg('continue')
  }

  const over = left <= 0 && !coin

  return (
    <PageShell>
      <section className="game-over" aria-labelledby="game-over-title">
        <div className={`game-over__screen${killScreen ? ' game-over__screen--kill' : ''}`}>
          {killScreen ? <Garbage /> : null}
          <div className="game-over__play">
            <p className="game-over__level">{killScreen ? 'LEVEL 256' : 'PLAYER 1'}</p>
            <h1 id="game-over-title" className={`game-over__title${coin ? ' game-over__title--go' : ''}`}>
              {coin ? 'CONTINUE!' : 'GAME OVER'}
            </h1>
            {coin ? (
              <p className="game-over__ready">GET READY</p>
            ) : over ? (
              <>
                <p className="game-over__ready">THANKS FOR PLAYING</p>
                <a className="game-over__home" href={homeHref()}>
                  Back to the arcade
                </a>
              </>
            ) : (
              <>
                <p className="game-over__continue">CONTINUE?</p>
                <p className="game-over__count" key={left}>
                  {left}
                </p>
                <button ref={coinRef} type="button" className="game-over__coin" onClick={insertCoin}>
                  <span className="game-over__slot" aria-hidden="true" />
                  Insert coin
                </button>
              </>
            )}
          </div>
        </div>
        <p className="game-over__note">
          {killScreen ? 'Level 256 is as far as anyone ever got. ' : `There’s no page at ${path}. `}
          <a href={homeHref()}>Back to the arcade</a>
        </p>
      </section>
    </PageShell>
  )
}
