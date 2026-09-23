import type { CSSProperties } from 'react'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { ProfileViews } from '../components/ProfileViews'
import { openSiteMenu } from '../components/siteNav'
import { StatsCalendar, StatsGames, StatsHero, StatsRecords } from '../components/StatsView'
import { useAuth } from '../hooks/useAuth'
import { useMyStats } from '../hooks/useMyStats'
import { usePlayerName } from '../hooks/usePlayerName'
import { AVATARS_ENABLED, avatarWashColor, getLocalAvatarId, resolveAvatar } from '../lib/avatars'
import { inkOn } from '../lib/color'
import { setDefaultPeriod, useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName, PERIOD_LABELS, VISIBLE_LEADERBOARD_PERIODS } from '../lib/leaderboard'
import { boardDayKey } from '../lib/statsView'

/**
 * Your stats: the private side of your profile, beside the player card. The
 * card says where you stand; this says how you got there. The period in
 * numbers and your streak, every day you played, the records within reach,
 * and each game with your place, your best and the day you set it, a bar for
 * every day you played it, your average and your runs. Only you can see it,
 * and all of it is free.
 */
export function StatsPage() {
  const { signedIn, loading: authLoading } = useAuth()
  const period = useDefaultPeriod()
  const name = normalizePlayerName(usePlayerName())
  const { avatarId: rankAvatarId } = useGlobalRank()
  const mine = useMyStats(period, signedIn)
  const today = boardDayKey(Date.now())
  const avatar = AVATARS_ENABLED && name ? resolveAvatar(getLocalAvatarId(name) ?? rankAvatarId, name) : null
  const accent = avatar ? avatarWashColor(avatar) : undefined
  const stats = mine.data?.stats ?? null
  const busy = authLoading || (signedIn && mine.loading && !stats)

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="sv" style={accent ? ({ '--you': accent, '--you-on': inkOn(accent) } as CSSProperties) : undefined}>
        <div className="sv-top">
          <ProfileViews on="stats" />
          {stats ? (
            <div className="sv-seg" role="group" aria-label="Period">
              {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
                <button key={p} type="button" aria-pressed={p === period} onClick={() => setDefaultPeriod(p)}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {busy ? (
          <div className="sv-loading" aria-hidden="true">
            <span className="sv-loading__hero" />
            <span className="sv-loading__card" />
            <span className="sv-loading__card" />
          </div>
        ) : !signedIn ? (
          <Invite
            title="Your stats live here"
            copy="Sign in and this is where you’ll find every day you played, your streaks, the records within reach and how each game is going. Only you can see it."
            action="Sign in"
          />
        ) : !stats ? (
          mine.error ? (
            <Invite title="Your stats didn’t load" copy="Check your connection and try again in a moment." />
          ) : (
            <Invite
              title="Pick a gamer tag first"
              copy="Your stats follow your gamer tag. Pick one, play a game, and they start here."
              action="Pick a tag"
            />
          )
        ) : (
          <>
            <StatsHero
              art={avatar ? <PlayerAvatar avatar={avatar} name={name} size="lg" /> : null}
              period={period}
              headline={stats.headline}
              streak={stats.streak}
              today={today}
            />
            <div className="sv-pair">
              <StatsCalendar streak={stats.streak} today={today} />
              <StatsRecords records={stats.nearRecords} />
            </div>
            <StatsGames games={stats.games} period={period} runs={stats.headline.runs} today={today} />
          </>
        )}
      </div>
    </PageShell>
  )
}

function Invite({ title, copy, action }: { title: string; copy: string; action?: string }) {
  return (
    <section className="sv-card sv-invite">
      <h1 className="sv-invite__title">{title}</h1>
      <p className="sv-invite__copy">{copy}</p>
      {action ? (
        <button type="button" className="sv-invite__go" onClick={openSiteMenu}>
          {action}
        </button>
      ) : null}
    </section>
  )
}
