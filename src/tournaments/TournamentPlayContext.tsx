import { createContext, useContext, type ReactNode } from 'react'

export type TournamentPlayInfo = {
  tournamentId: string
  title: string
  gameSlug: string
  status: 'upcoming' | 'active' | 'ended'
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
