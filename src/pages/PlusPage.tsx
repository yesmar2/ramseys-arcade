import { PageShell } from '../components/PageShell'
import { useAuth } from '../hooks/useAuth'
import { APP_NAME } from '../lib/brand'
import { tournamentsHref } from '../hooks/useHashRoute'

/**
 * What the two plans get you.
 *
 * Written from the free column outwards. Everything about playing is free and
 * stays free, so the page has to say that plainly before it asks for anything
 * — a pricing page that opens with the upsell reads as though the games are
 * the thing being sold, which they are not.
 */

type Row = {
  label: string
  free: string | boolean
  plus: string | boolean
  note?: string
}

const PLAY: Row[] = [
  { label: 'Every game', free: true, plus: true },
  { label: 'Daily, weekly, monthly and all-time boards', free: true, plus: true },
  { label: 'Record books', free: true, plus: true },
  { label: 'Global ranking and trophies', free: true, plus: true },
  { label: 'Friends', free: true, plus: true },
  { label: 'Match alerts', free: true, plus: true },
  {
    label: 'Joining events',
    free: 'Any size',
    plus: 'Any size',
    note: 'Joining is never paid, whoever is hosting.',
  },
]

const HOST: Row[] = [
  { label: 'Events running at once', free: '1', plus: '5' },
  { label: 'Players in an event', free: 'Up to 8', plus: 'Up to 64' },
  { label: 'Groups you run', free: '1', plus: '5' },
  { label: 'Players in a group', free: '20', plus: '100' },
  { label: 'Double elimination', free: false, plus: true },
  { label: 'A different game each round', free: false, plus: true },
]

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="plus-cell plus-cell--yes">
        <span aria-hidden="true">✓</span>
        <span className="visually-hidden">Included</span>
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="plus-cell plus-cell--no">
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">Not included</span>
      </span>
    )
  }
  return <span className="plus-cell">{value}</span>
}

function Table({ title, blurb, rows }: { title: string; blurb: string; rows: Row[] }) {
  return (
    <section className="plus-table" aria-labelledby={`plus-${title.toLowerCase()}`}>
      <div className="plus-table__head">
        <h2 className="plus-table__title" id={`plus-${title.toLowerCase()}`}>
          {title}
        </h2>
        <p className="plus-table__blurb">{blurb}</p>
      </div>
      <table className="plus-grid">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Feature</span>
            </th>
            <th scope="col">Free</th>
            <th scope="col" className="plus-grid__paid">
              Plus
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                {row.label}
                {row.note ? <span className="plus-grid__note">{row.note}</span> : null}
              </th>
              <td>
                <Cell value={row.free} />
              </td>
              <td className="plus-grid__paid">
                <Cell value={row.plus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function PlusPage() {
  const { isPlus, signedIn } = useAuth()

  return (
    <PageShell innerClassName="lb-page__inner">
      <header className="plus-hero">
        <p className="plus-hero__kicker">{APP_NAME} Plus</p>
        <h1 className="plus-hero__title">Playing is free. Always.</h1>
        <p className="plus-hero__lead">
          Every game, every leaderboard and every record board is free, and joining
          somebody&rsquo;s tournament is free however big it is. Plus is for the person
          running them — bigger draws, more events at once, and the formats that make a
          real competition.
        </p>
        <div className="plus-hero__cta">
          {isPlus ? (
            <span className="plus-hero__have">You&rsquo;re on Plus</span>
          ) : (
            <>
              <span className="plus-hero__price">
                <strong>$3</strong>
                <span>/month</span>
              </span>
              <button type="button" className="plus-hero__btn" disabled>
                Not on sale yet
              </button>
            </>
          )}
        </div>
        {isPlus ? null : (
          <p className="plus-hero__soon">
            Plus isn&rsquo;t purchasable yet — this page is here so you can see what it
            will cover before anything costs money.
          </p>
        )}
      </header>

      <Table
        title="Playing"
        blurb="Free for everyone, with or without an account."
        rows={PLAY}
      />
      <Table
        title="Hosting"
        blurb="Running events and groups for other people."
        rows={HOST}
      />

      <footer className="plus-foot">
        <p className="plus-foot__line">
          Nothing that is free today will move behind Plus later.
        </p>
        <a className="plus-foot__link" href={tournamentsHref()}>
          {signedIn ? 'Back to events' : 'See what is running'} →
        </a>
      </footer>
    </PageShell>
  )
}
