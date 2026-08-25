/** Run-scoped record-book wins queued for the end-of-run celebration. */

export type RunAchievement = {
  /** Stable book key so beating the same record again replaces the prior award. */
  id?: string
  /** Record name shown on the celebration card (e.g. "Wave 3 clear"). */
  label: string
  /** Secondary stat on the card — time, combo size, or streak. */
  value?: string
  rank: number | null
}

let queue: RunAchievement[] = []
let settleTimer = 0
let settlePromise: Promise<void> | null = null
let settleResolve: (() => void) | null = null

function bumpSettle() {
  if (!settlePromise) {
    settlePromise = new Promise((resolve) => {
      settleResolve = resolve
    })
  }
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => {
    settleResolve?.()
    settleResolve = null
    settlePromise = null
  }, 120)
}

/** Wait for late async record-book posts (e.g. game-over combo) before celebrating. */
export async function whenRunAchievementsSettled(timeoutMs = 1500) {
  bumpSettle()
  if (!settlePromise) return
  await Promise.race([
    settlePromise,
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ])
}

function achievementKey(hit: Pick<RunAchievement, 'id' | 'label'>) {
  const id = hit.id?.trim()
  if (id) return id
  return hit.label.trim()
}

export function pushRunAchievement(hit: RunAchievement) {
  const label = hit.label.trim()
  if (!label) return
  const key = achievementKey(hit)
  if (!key) return
  const next: RunAchievement = {
    id: hit.id?.trim() || undefined,
    label,
    value: hit.value?.trim() || undefined,
    rank: hit.rank,
  }
  // Same book mid-run: keep only the latest award (e.g. streak 5 then 8).
  queue = [...queue.filter((row) => achievementKey(row) !== key), next]
  bumpSettle()
}

export function takeRunAchievements(): RunAchievement[] {
  const hits = queue
  queue = []
  return hits
}

export function clearRunAchievements() {
  queue = []
}

export function peekRunAchievements(): readonly RunAchievement[] {
  return queue
}
