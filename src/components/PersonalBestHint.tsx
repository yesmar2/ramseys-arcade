import { menuBestLine } from '../lib/personalBest'
import { usePersonalBest } from '../hooks/usePersonalBest'

export function PersonalBestHint({ slug }: { slug: string }) {
  const best = usePersonalBest(slug)
  return <span className="pb-hint">{menuBestLine(best)}</span>
}
