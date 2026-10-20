import { useState } from 'react'
import type { StickerAlbum as Album } from '../lib/stickers'
import { StickerArt } from './StickerArt'

/*
 * The back of the player card: the sticker album, a page at a time. Twelve numbered slots; a sticker in each one
 * got, and in each gap the few words of what it takes. Tap a slot to read it whole along the foot. A season's
 * page opens first while it runs; the arrows turn to the others. Ramsey picked B3 of the "New prize kinds" canvas
 * (2026-10-20).
 */
export function StickerAlbum({ album, isSelf }: { album: Album | null; isSelf: boolean }) {
  const [at, setAt] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  if (!album) {
    return (
      <div className="album album--wait" aria-hidden="true">
        <span className="skel-line" style={{ width: '60%' }} />
      </div>
    )
  }
  const pages = album.pages
  const page = pages[Math.min(at, pages.length - 1)]!
  const count = page.stickers.filter((s) => page.got.has(s.id)).length
  const chosen = page.stickers.find((s) => s.id === picked) ?? null
  const turn = (by: number) => {
    setAt((i) => (i + by + pages.length) % pages.length)
    setPicked(null)
  }
  return (
    <div className="album">
      <div className="album__head">
        {pages.length > 1 ? (
          <button type="button" className="album__turn" onClick={() => turn(-1)} aria-label="The page before">
            ‹
          </button>
        ) : null}
        <span className="album__title">
          <b>{page.name}</b>
          <span>
            {count} of {page.stickers.length}
          </span>
        </span>
        {pages.length > 1 ? (
          <button type="button" className="album__turn" onClick={() => turn(1)} aria-label="The next page">
            ›
          </button>
        ) : null}
      </div>
      <span className="album__bar" aria-hidden="true">
        <i style={{ width: `${(100 * count) / page.stickers.length}%` }} />
      </span>
      <ul className="album__grid" aria-label={`${page.name} stickers`}>
        {page.stickers.map((s, i) => {
          const got = page.got.has(s.id)
          const label = got ? `${s.name}: ${s.how}` : `Sticker ${i + 1}, not yet: ${s.how}`
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`album__cell${got ? ' album__cell--got' : ''}`}
                aria-pressed={picked === s.id}
                aria-label={label}
                title={label}
                onClick={() => setPicked((p) => (p === s.id ? null : s.id))}
              >
                <span className="album__num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {got ? (
                  <StickerArt id={s.id} className="album__art" />
                ) : (
                  <>
                    <b aria-hidden="true">?</b>
                    <span className="album__short" aria-hidden="true">
                      {s.short}
                    </span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="album__foot" aria-live="polite">
        {chosen ? (
          <>
            <b>{chosen.name}</b> · {chosen.how}
          </>
        ) : page.full ? (
          isSelf ? (
            `A full page: ${album.pageTickets} tickets, paid.`
          ) : (
            'A full page.'
          )
        ) : (
          `Fill the page for ${album.pageTickets} tickets`
        )}
      </p>
    </div>
  )
}
