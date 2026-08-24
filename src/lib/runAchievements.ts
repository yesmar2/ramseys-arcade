/** Run-scoped record-book wins queued for the end-of-run celebration. */

export type RunAchievement = {
  label: string
  rank: number | null
}

let queue: RunAchievement[] = []

export function pushRunAchievement(hit: RunAchievement) {
  const label = hit.label.trim()
  if (!label) return
  const exists = queue.some(
    (row) => row.label === label && row.rank === hit.rank,
  )
  if (exists) return
  queue = [...queue, { label, rank: hit.rank }]
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
