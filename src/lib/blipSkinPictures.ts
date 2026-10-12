import frenzyBlip from '../assets/season/frenzy-blip.webp'
import marbleRunBlip from '../assets/season/marblerun-blip.webp'
import pelletsBlip from '../assets/season/pellets-blip.webp'
import swoopBlip from '../assets/season/swoop-blip.webp'

/**
 * Blip's set's pictures (lib/skins.ts BLIP_SKINS), each rendered from its game's own drawing as the pass's other
 * pictures are: for his question's card (components/BlipSet.tsx), which shows them without loading all the pass's
 * art, and for RewardArt.
 */
export const BLIP_SKIN_PICTURES: Readonly<Record<string, string>> = {
  'pellets-blip': pelletsBlip,
  'swoop-blip': swoopBlip,
  'frenzy-blip': frenzyBlip,
  'marblerun-blip': marbleRunBlip,
}
