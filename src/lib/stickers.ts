import { useEffect, useState } from 'react'
import { STICKER_PAGES, type StickerPageDef } from '../data/stickers'
import { api } from './leaderboard'
import { refreshTickets } from './tickets'

/*
 * A player's sticker album, for the back of their card (data/stickers.ts; the API's stickers.ts says who has
 * which). Asked for as the card opens. On your own card, a page you've just filled pays its tickets as it's asked
 * for, so the counter's figure is asked again after.
 */

export type StickerPage = StickerPageDef & { got: ReadonlySet<string>; full: boolean }

export type StickerAlbum = { pages: StickerPage[]; pageTickets: number }

type Answer = { pages: { id: string; got: string[]; full: boolean }[]; pageTickets?: number }

export function useStickers(name: string, isSelf: boolean): StickerAlbum | null {
  const [got, setGot] = useState<{ name: string; album: StickerAlbum } | null>(null)
  useEffect(() => {
    if (!name) return
    let live = true
    api<Answer>(`/stickers?name=${encodeURIComponent(name)}`)
      .then((r) => {
        if (!live) return
        const pages = STICKER_PAGES.map((def) => {
          const page = r.pages.find((p) => p.id === def.id)
          return { ...def, got: new Set(page?.got ?? []), full: page?.full ?? false }
        })
        setGot({ name, album: { pages, pageTickets: r.pageTickets ?? 250 } })
        // A full page of your own may just have paid.
        if (isSelf && pages.some((p) => p.full)) void refreshTickets(true)
      })
      .catch(() => {
        if (live) setGot({ name, album: { pages: STICKER_PAGES.map((def) => ({ ...def, got: new Set(), full: false })), pageTickets: 250 } })
      })
    return () => {
      live = false
    }
  }, [name, isSelf])
  return got?.name === name ? got.album : null
}
