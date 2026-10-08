import { skinById } from '../../lib/skins'
import { RewardArt } from './RewardArt'
import { SkinCardButton } from './SkinCard'
import '../../styles/season.css'

/**
 * The skin a run was played in, small, beside the player's name on a game's board: so the boards show
 * skins off too. Nothing for a run in the usual look, or a skin this build doesn't know. Its size is the
 * name's (season.css .skin-mark), about the Plus star's; `size` is only the drawing's own.
 *
 * Pressed (or pointed at), it opens the skin's card: what it is, where it comes from, and the way there
 * (SkinCard.tsx). So it's a button, and never sits inside a link: a row's link is its player's name, next to
 * it. `plain` is the picture alone, where a press means something else (a game's start card).
 */
export function SkinMark({ skin, size = 22, plain = false }: { skin: string | null | undefined; size?: number; plain?: boolean }) {
  const known = skinById(skin)
  if (!known) return null
  const art = <RewardArt reward={{ kind: 'skin', id: known.id, name: known.name }} size={size} />
  if (!plain) return <SkinCardButton skin={known}>{art}</SkinCardButton>
  return (
    <span className="skin-mark" title={`Played in the ${known.name}`} aria-label={`in the ${known.name}`}>
      {art}
    </span>
  )
}
