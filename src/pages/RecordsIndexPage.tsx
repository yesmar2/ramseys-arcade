import { PageShell } from '../components/PageShell'
import { RecordBooksIndex } from '../components/RecordBooksIndex'

/** The record books: who holds the most, what's yours, every book, and what was set lately. */
export function RecordsIndexPage() {
  return (
    <PageShell innerClassName="lb-page__inner">
      <RecordBooksIndex />
    </PageShell>
  )
}
