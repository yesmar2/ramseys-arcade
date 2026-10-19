import { useMemo } from 'react'
import type { Tower } from './sim'
import { towerSvg } from './towerPicture'

/**
 * A day's tower as a postcard (towerPicture.ts): a stretch of its middle at dusk, Blip in the air between two
 * pegs and the blue blip on the one below. It's the picture on the home row, Today's Tower, the past towers'
 * cards and the tomorrow tease. `w` by `h` is its own shape; it covers any box it's put in.
 */
export function TowerPostcard({ tower, w = 480, h = 360, className }: { tower: Tower; w?: number; h?: number; className?: string }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(towerSvg(tower, w, h))}`, [tower, w, h])
  return <img className={className} src={src} width={w} height={h} alt={`${tower.name}, partway up`} style={{ objectFit: 'cover' }} />
}
