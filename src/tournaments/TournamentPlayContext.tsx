import { createContext, useContext, type ReactNode } from 'react'

export type TournamentPlayInfo = {
  tournamentId: string
  title: string
  gameSlug: string
  status: 'upcoming' | 'active' | 'ended'
  format: string
  maxAttempts: number | null
  attemptsRemaining: number | null
  canPlay: boolean
  /** The event spends a try the moment its run starts. */
  triesAtStart: boolean
}

const TournamentPlayContext = createContext<TournamentPlayInfo | null>(null)

export function TournamentPlayProvider({
  value,
  children,
}: {
  value: TournamentPlayInfo
  children: ReactNode
}) {
  return (
    <TournamentPlayContext.Provider value={value}>
      {children}
    </TournamentPlayContext.Provider>
  )
}

export function useTournamentPlay() {
  return useContext(TournamentPlayContext)
}
