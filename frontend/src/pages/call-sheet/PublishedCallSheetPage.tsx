import { Link, useParams } from 'react-router-dom'
import { useFetch } from '../../hooks/useFetch'
import type { PublishedCallSheet } from '../../types'
import { NavIcon } from '../../components/NavIcon'
import './call-sheet.css'

/** A call sheet as it was published to the Staff Hub, edits and all. Read-only:
 *  the server keeps only the sheet's own markup. */
export function PublishedCallSheetPage() {
  const { id = '' } = useParams()
  const sheet = useFetch<PublishedCallSheet>(`/call-sheets/${id}/`)

  if (sheet.loading && !sheet.data) return <p className="loading">Loading the call sheet…</p>
  if (!sheet.data) {
    return (
      <section>
        <h1>Call sheet not found</h1>
        <p>
          It may have been removed. <Link to="/">Back to the Staff Hub</Link>
        </p>
      </section>
    )
  }

  const published = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(sheet.data.published_at),
  )

  return (
    <section className="call-sheet-page cs-published">
      <div className="page-header no-print">
        <div>
          <h1>
            <NavIcon name="sheet" />
            {sheet.data.title}
          </h1>
          <p className="subtitle">
            Published {published}
            {sheet.data.published_by_name ? ` by ${sheet.data.published_by_name}` : ''}
          </p>
        </div>
        <button type="button" className="button" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>
      {/* Cleaned on the server (announcements/sanitize.py) before it's stored. */}
      <div dangerouslySetInnerHTML={{ __html: sheet.data.html }} />
    </section>
  )
}
