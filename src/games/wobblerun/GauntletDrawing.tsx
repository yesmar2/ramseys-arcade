import { createElement, useId, useMemo, type ReactNode } from 'react'
import { gauntletMarks, roundMarks, roundsWords, type GauntletLike, type Mark, type RoundLetter } from './gauntletPicture'

/** SVG's attribute names as React spells them: stroke-width → strokeWidth. */
const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

function draw(m: Mark, key: number): ReactNode {
  const props: Record<string, string | number> = { key }
  for (const [k, v] of Object.entries(m.a)) props[camel(k)] = v
  return createElement(m.t, props, m.c?.map(draw))
}

/**
 * A day's gauntlet as a picture: its rounds as a trail of badges at dusk, each with its drawing in the colour
 * code and its tier as pips, ending in the crown, your bean at the start (gauntletPicture.ts). It's every
 * gauntlet picture on the site: the home row's, Today's Gauntlet's, the past gauntlets', the tomorrow tease's
 * and the Gauntlet Book's. `w` by `h` is its own shape; it covers any box it's put in.
 */
export function GauntletDrawing({ gauntlet, name, w = 480, h = 360, className }: { gauntlet: GauntletLike; name: string; w?: number; h?: number; className?: string }) {
  const uid = `wr${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { n, k } = gauntlet
  const { defs, marks } = useMemo(() => gauntletMarks({ n, k }, w, h, uid), [n, k, w, h, uid])
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${name}: ${roundsWords(gauntlet.k)}`}>
      <defs>{defs.map(draw)}</defs>
      {marks.map(draw)}
    </svg>
  )
}

/** One round's drawing on its own, for a chip: `size` across. */
export function RoundIcon({ letter, size = 20, className }: { letter: RoundLetter | 'crown'; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true" focusable="false">
      {roundMarks(letter).map(draw)}
    </svg>
  )
}
