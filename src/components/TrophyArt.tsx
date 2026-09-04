export type MetalTone = 'gold' | 'silver' | 'bronze'
export type RibbonTone = 'weekly' | 'monthly'
export type TrophyArtSize = 'sm' | 'md' | 'lg'

const ART_SIZE: Record<TrophyArtSize, { width: number; height: number }> = {
  sm: { width: 20, height: 22 },
  md: { width: 36, height: 40 },
  lg: { width: 64, height: 72 },
}

const COMPACT_MEDAL_SIZE: Record<'sm' | 'md', { width: number; height: number }> = {
  sm: { width: 20, height: 22 },
  md: { width: 34, height: 38 },
}

const RIBBON_SIZE: Record<TrophyArtSize, { width: number; height: number }> = {
  sm: { width: 14, height: 18 },
  md: { width: 28, height: 36 },
  lg: { width: 52, height: 66 },
}

/** Honor ribbon for global #4–10 — weekly blue, monthly violet. */
export function TopTenRibbon({
  tone = 'weekly',
  size = 'lg',
}: {
  tone?: RibbonTone
  size?: TrophyArtSize
}) {
  const dim = RIBBON_SIZE[size]
  return (
    <span
      className={`trophy-art trophy-art--${size} trophy-case__ribbon trophy-case__ribbon--${tone}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 36" width={dim.width} height={dim.height} focusable="false">
        <path
          className="trophy-case__ribbon-band"
          d="M5 2h18c1.1 0 2 .9 2 2v7.5H3V4c0-1.1.9-2 2-2Z"
        />
        <path
          className="trophy-case__ribbon-shine"
          d="M7 3.2h6.5c.4 0 .7.4.55.75L12.2 9.2H6.4c-.35 0-.55-.4-.35-.7L7 3.2Z"
        />
        <path
          className="trophy-case__ribbon-tail"
          d="M5.2 11.5 9.6 33.2 14 22.8l4.4 10.4 4.4-21.7Z"
        />
        <path
          className="trophy-case__ribbon-notch"
          d="M14 22.8 9.6 33.2l4.4-4.2 4.4 4.2Z"
        />
      </svg>
    </span>
  )
}

/** Monthly podium award — a cup. Shapes overlap so the silhouette reads as one piece. */
export function MonthlyTrophyCup({
  tone,
  size = 'lg',
}: {
  tone: MetalTone
  size?: TrophyArtSize
}) {
  const dim = ART_SIZE[size]
  return (
    <span
      className={`trophy-art trophy-art--${size} trophy-case__cup trophy-case__cup--${tone}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 72" width={dim.width} height={dim.height} focusable="false">
        <path
          className="trophy-case__cup-handle"
          d="M16.8 16.5c-9 0-11.8 4.6-10 9.2 1.4 3.6 5.4 5.6 10.2 5.8"
        />
        <path
          className="trophy-case__cup-handle"
          d="M47.2 16.5c9 0 11.8 4.6 10 9.2-1.4 3.6-5.4 5.6-10.2 5.8"
        />
        <path
          className="trophy-case__cup-bowl"
          d="M16.8 12h30.4v3.8c0 10.2-6.1 18.4-13.7 20.6V42h-3v-5.6C22.9 34.2 16.8 26 16.8 15.8V12Z"
        />
        <path
          className="trophy-case__cup-rim"
          d="M14.5 8h35a1.6 1.6 0 0 1 1.6 1.6v3.2H12.9V9.6A1.6 1.6 0 0 1 14.5 8Z"
        />
        <path
          className="trophy-case__cup-shine"
          d="M21.5 14.6h9c.5 0 .85.5.66.96L28 24.4h-8.1c-.5 0-.84-.5-.66-.96L21.5 14.6Z"
        />
        <path className="trophy-case__cup-stem" d="M28.6 40h6.8v8h-6.8z" />
        <path className="trophy-case__cup-knob" d="M25 46.4h14v3.6H25z" />
        <path className="trophy-case__cup-cone" d="M26 49.2h12l4.5 8.4h-21z" />
        <path className="trophy-case__cup-base" d="M20 56.4h24v4.4H20z" />
        <path
          className="trophy-case__cup-foot"
          d="M16.4 59.8h31.2a1.6 1.6 0 0 1 1.6 1.6v3.8H14.8v-3.8a1.6 1.6 0 0 1 1.6-1.6Z"
        />
      </svg>
    </span>
  )
}

/** Weekly podium award — full neck-ribbon medal (lg) or disk-first badge (sm/md). */
export function WeeklyMedal({
  rank,
  size = 'lg',
}: {
  rank: number
  size?: TrophyArtSize
}) {
  const tone: MetalTone =
    rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'gold'
  const compact = size === 'sm' || size === 'md'
  const dim = compact ? COMPACT_MEDAL_SIZE[size] : ART_SIZE[size]
  return (
    <span
      className={`trophy-art trophy-art--${size} trophy-case__medal trophy-case__medal--${tone}`}
      aria-hidden="true"
    >
      {compact ? (
        <svg viewBox="0 0 40 44" width={dim.width} height={dim.height} focusable="false">
          <path className="trophy-case__medal-strap" d="M12 2h7.5l-2 14H14Z" />
          <path
            className="trophy-case__medal-strap trophy-case__medal-strap--fold"
            d="M20.5 2H28l-2 14h-5.5Z"
          />
          <path
            className="trophy-case__medal-clasp"
            d="M11 1h18a1.6 1.6 0 0 1 1.6 1.6V5H9.4V2.6A1.6 1.6 0 0 1 11 1Z"
          />
          <circle className="trophy-case__medal-disk" cx="20" cy="28" r="13.2" />
          <circle className="trophy-case__medal-ring" cx="20" cy="28" r="9.8" />
          <text className="trophy-case__medal-num" x="20" y="33.2" textAnchor="middle">
            {rank}
          </text>
        </svg>
      ) : (
        <svg viewBox="0 0 64 72" width={dim.width} height={dim.height} focusable="false">
          <path className="trophy-case__medal-strap" d="M23.5 5h17l-3.5 32h-10z" />
          <path
            className="trophy-case__medal-strap trophy-case__medal-strap--fold"
            d="M32 5h8.5L37 37h-5z"
          />
          <path
            className="trophy-case__medal-clasp"
            d="M22 3h20a1.8 1.8 0 0 1 1.8 1.8v3.4H20.2V4.8A1.8 1.8 0 0 1 22 3Z"
          />
          <circle className="trophy-case__medal-disk" cx="32" cy="47.5" r="15.5" />
          <circle className="trophy-case__medal-ring" cx="32" cy="47.5" r="11.8" />
          <text className="trophy-case__medal-num" x="32" y="54.2" textAnchor="middle">
            {rank}
          </text>
        </svg>
      )}
    </span>
  )
}
