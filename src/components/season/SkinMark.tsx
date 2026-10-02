import { skinById } from '../../lib/skins'
import { RewardArt } from './RewardArt'
import '../../styles/season.css'

/**
 * The skin a run was played in, small, beside the player's name on a game's board: so the boards show
 * skins off too. Nothing for a run in the usual look, or a skin this build doesn't know.
 */
export function SkinMark({ skin, size = 22 }: { skin: string | null | undefined; size?: number }) {
  const known = skinById(skin)
  if (!known) return null
  return (
    <span className="skin-mark" title={`Played in the ${known.name}`} aria-label={`in the ${known.name}`}>
      <RewardArt reward={{ kind: 'skin', id: known.id, name: known.name }} size={size} />
    </span>
  )
}
