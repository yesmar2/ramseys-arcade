import { Suspense, useEffect, useState } from 'react'
import { DeviceUnavailable } from '../components/DeviceUnavailable'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { lazyPage, type LazyPage } from '../lib/lazyPage'
import { getGame, gamePlayableOn } from '../data/games'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import { isImpersonating } from '../lib/impersonate'
import { ApiError, normalizePlayerName, PLAYER_NAME_MAX, rememberPlayerName } from '../lib/leaderboard'
import {
  getTournament,
  getTournamentInvite,
  isPlayerInTournament,
  joinTournament,
  rememberTournamentInvite,
  syncJoinedTournamentRosters,
  type TournamentDetail,
} from '../lib/tournaments'
import { tournamentHref } from '../hooks/useHashRoute'
import { TournamentPlayProvider } from '../tournaments/TournamentPlayContext'

/*
 * Every game that can be played inside an event. Each of these reads the
 * tournament context and saves through the shared score card, so the only
 * thing that decides whether a slug plays here is whether it is in this map.
 * The old fixed list of eight left the weekly's newer games — Find the Bug,
 * Crumbtrail — reporting that they weren't part of an event they were in.
 *
 * Each game is the same chunk its own page loads. It is fetched as soon as
 * this page mounts, while the event detail is still on its way, so by the
 * time the gate opens the game is usually already here.
 */
const TOURNAMENT_GAMES: Record<string, LazyPage<object>> = {
  asteroids: lazyPage(() => import('../games/asteroids/AsteroidsGame').then((m) => m.AsteroidsGame)),
  barrage: lazyPage(() => import('../games/barrage/BarrageGame').then((m) => m.BarrageGame)),
  centroid: lazyPage(() => import('../games/dead-center/DeadCenterGame').then((m) => m.DeadCenterGame)),
  crosswalk: lazyPage(() => import('../games/crosswalk/CrosswalkGame').then((m) => m.CrosswalkGame)),
  crumbtrail: lazyPage(() => import('../games/crumbtrail/CrumbtrailGame').then((m) => m.CrumbtrailGame)),
  bop: lazyPage(() => import('../games/bop/BopGame').then((m) => m.BopGame)),
  putt: lazyPage(() => import('../games/putt/PuttGame').then((m) => m.PuttGame)),
  findbug: lazyPage(() => import('../games/findbug/FindBugGame').then((m) => m.FindBugGame)),
  fireflies: lazyPage(() => import('../games/fireflies/FirefliesGame').then((m) => m.FirefliesGame)),
  patriot: lazyPage(() => import('../games/patriot/PatriotGame').then((m) => m.PatriotGame)),
  pellets: lazyPage(() => import('../games/pellets/PelletsGame').then((m) => m.PelletsGame)),
  pop: lazyPage(() => import('../games/whack/WhackGame').then((m) => m.WhackGame)),
  // Retired for Fireflies, but an event that was already running with it plays out.
  simon: lazyPage(() => import('../games/simon/SimonGame').then((m) => m.SimonGame)),
  snake: lazyPage(() => import('../games/snake/SnakeGame').then((m) => m.SnakeGame)),
  stacker: lazyPage(() => import('../games/stacker/StackerGame').then((m) => m.StackerGame)),
}

export function TournamentPlayPage({
  tournamentId,
  gameSlug,
  invite,
}: {
  tournamentId: string
  gameSlug: string
  invite?: string
}) {
  const playerName = usePlayerName()
  const device = useDeviceType()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [joining, setJoining] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const game = getGame(gameSlug)
  const Game = TOURNAMENT_GAMES[gameSlug]
  const accentStyle = gameAccentStyle(gameSlug)
  const backHref = tournamentHref(tournamentId, invite ?? getTournamentInvite(tournamentId) ?? undefined)

  useEffect(() => {
    void Game?.preload()
  }, [Game])

  useEffect(() => {
    if (invite) rememberTournamentInvite(tournamentId, invite)
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setReady(false)

    const boot = async () => {
      try {
        await syncJoinedTournamentRosters()
        let data = await getTournament(tournamentId, {
          playerName: playerName.trim().toUpperCase() || undefined,
          game: gameSlug,
          invite: invite ?? getTournamentInvite(tournamentId) ?? undefined,
        })
        if (cancelled) return
        setDetail(data)
        if (!data.games.includes(gameSlug) || !(gameSlug in TOURNAMENT_GAMES)) {
          setLoadError('That game isn’t part of this tournament.')
          return
        }
        if (data.status === 'ended') {
          setLoadError('This tournament has ended.')
          return
        }
        if (data.status === 'upcoming') {
          setLoadError('This tournament hasn’t started yet.')
          return
        }
        const playerStatus = data.playerStatus
        if (
          playerStatus &&
          !playerStatus.canPlay &&
          isPlayerInTournament(data, playerName.trim().toUpperCase(), tournamentId)
        ) {
          if (data.kind === 'bracket') {
            if (!data.bracket?.lockedAt) {
              setLoadError('The bracket draws when the roster fills.')
            } else if (
              playerStatus.maxAttempts != null &&
              playerStatus.attemptsRemaining === 0
            ) {
              setLoadError('No tries left in this match.')
            } else {
              setLoadError('It is not your match yet.')
            }
          } else if (playerStatus.maxAttempts != null) {
            setLoadError('You have no attempts remaining in this event.')
          } else {
            setLoadError('You cannot play this event right now.')
          }
          return
        }
        const name = playerName.trim().toUpperCase()
        const onRoster = Boolean(
          name && data.players.some((p) => normalizePlayerName(p.name) === name),
        )
        if (name && isPlayerInTournament(data, name, tournamentId)) {
          // Seat may still be under an old tag — rebind without a join gate.
          if (!onRoster && isImpersonating()) {
            // Stored seat belongs to the real tag; do not steal it.
          } else {
            if (!onRoster) {
              const result = await joinTournament(tournamentId, name)
              if (cancelled) return
              data = result.tournament
              setDetail(data)
            }
            setReady(true)
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [tournamentId, gameSlug, playerName, invite])

  const joinWithName = async (rawName: string) => {
    const name = normalizePlayerName(rawName)
    if (!name || joining) return
    setJoining(true)
    setJoinError(null)
    try {
      if (!isImpersonating()) {
        await rememberPlayerName(name)
      }
      const result = await joinTournament(tournamentId, name)
      setDetail(result.tournament)
      setReady(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setJoinError('That gamer tag is taken. Sign in or pick another.')
      } else {
        setJoinError(err instanceof Error ? err.message : 'Could not join')
      }
    } finally {
      setJoining(false)
    }
  }

  if (game && !gamePlayableOn(game, device)) {
    return <DeviceUnavailable game={game} />
  }

  if (loading) {
    return (
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← Event
        </a>
        <p className="tour-play__message">Loading event…</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← Event
        </a>
        <div className="tour-play__gate">
          <section className="panel" aria-labelledby="tour-gate-title" style={accentStyle}>
            <div className="panel__head">
              <div className="panel__heading">
                <span className="panel__kicker">{detail?.title ?? 'Event'}</span>
                <h1 id="tour-gate-title" className="panel__title">
                  {loadError}
                </h1>
              </div>
            </div>
            <div className="panel__actions">
              <a className="panel__btn" href={backHref}>
                Back to event
              </a>
            </div>
          </section>
        </div>
      </main>
    )
  }

  if (!ready || !detail) {
    return (
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← Event
        </a>
        <div className="tour-play__gate">
          <section className="panel" aria-labelledby="tour-gate-title" style={accentStyle}>
            <div className="panel__head">
              <div className="panel__heading">
                <span className="panel__kicker">{game?.name ?? gameSlug}</span>
                <h1 id="tour-gate-title" className="panel__title">
                  Join {detail?.title ?? 'the event'}
                </h1>
              </div>
            </div>
            <div className="panel__body">
              {detail?.blurb ? <p className="panel__text">{detail.blurb}</p> : null}
              {playerName ? (
                <div className="panel__row">
                  <span>Gamer tag</span>
                  <strong>{playerName}</strong>
                </div>
              ) : (
                <label className="panel__field">
                  <span className="panel__label">Gamer tag</span>
                  <input
                    className="panel__input"
                    value={nameDraft}
                    maxLength={PLAYER_NAME_MAX}
                    placeholder="YOU"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setNameDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void joinWithName(nameDraft)
                      }
                    }}
                  />
                </label>
              )}
              {joinError ? <p className="panel__error">{joinError}</p> : null}
            </div>
            <div className="panel__actions">
              <a className="panel__btn panel__btn--ghost" href={backHref}>
                Back
              </a>
              <button
                type="button"
                className="panel__btn"
                disabled={joining || (!playerName && !nameDraft.trim())}
                onClick={() => void joinWithName(playerName || nameDraft)}
              >
                {joining ? 'Joining…' : `Join and play ${game?.name ?? ''}`.trim()}
              </button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <TournamentPlayProvider
      value={{
        tournamentId,
        title: detail.title,
        gameSlug,
        status: detail.status,
        format: detail.formatLabel,
        maxAttempts: detail.playerStatus?.maxAttempts ?? null,
        attemptsRemaining: detail.playerStatus?.attemptsRemaining ?? null,
        canPlay: detail.playerStatus?.canPlay ?? detail.kind !== 'bracket',
      }}
    >
      <main className="game-page game-page--fullscreen tour-play">
        {Game ? (
          <Suspense fallback={<p className="tour-play__message">Loading {game?.name ?? gameSlug}…</p>}>
            <Game />
          </Suspense>
        ) : null}
      </main>
    </TournamentPlayProvider>
  )
}
