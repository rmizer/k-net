import { useState } from 'react'
import { api, ApiError } from '../../api'
import { NavIcon } from '../../components/NavIcon'
import { dayKey, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { DocumentCategory, ProductionSettings, ProjectDocument } from '../../types'
import { DocumentFormDialog } from './DocumentFormDialog'
import { fileUrl, money, ReceiptProgress, shortDate } from './DocumentsPage'
import './documents.css'

type DialogState = { document: ProjectDocument | null; category: DocumentCategory }

/** Everyone: send receipts and paperwork to the office, then follow what you've sent. */
export function PaperworkPage() {
  const production = useFetch<ProductionSettings>('/production/')
  const documents = useFetch<ProjectDocument[]>('/documents/?mine=1')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  // The submission just sent (or changed), for the confirmation and to highlight its row.
  const [sent, setSent] = useState<{ document: ProjectDocument; edited: boolean } | null>(null)
  const [error, setError] = useState('')

  const withdraw = async (doc: ProjectDocument) => {
    if (!window.confirm(`Withdraw “${doc.title}”? The file will be deleted.`)) return
    setError('')
    setSent(null)
    try {
      await api(`/documents/${doc.id}/`, { method: 'DELETE' })
      documents.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t withdraw that.')
    }
  }

  if ((documents.loading && !documents.data) || (production.loading && !production.data)) {
    return <p className="loading">Loading your paperwork…</p>
  }
  if (!documents.data || !production.data) return <p className="form__error">Couldn’t load your paperwork.</p>

  const timeZone = production.data.time_zone
  const mine = documents.data
  const outstanding = mine
    .filter((d) => d.category === 'receipt' && d.status !== 'processed')
    .reduce((sum, d) => sum + Number(d.amount ?? 0), 0)
  const open = (category: DocumentCategory) => {
    setSent(null)
    setDialog({ document: null, category })
  }

  return (
    <section className="documents">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="document" />
            Paperwork
          </h1>
          <p className="subtitle">Send receipts and documents to the office, and follow what you’ve sent</p>
        </div>
        <div className="documents__buttons">
          <button type="button" className="button" onClick={() => open('receipt')}>
            + Submit receipt
          </button>
          <button type="button" className="button button--secondary" onClick={() => open('other')}>
            + Upload document
          </button>
        </div>
      </div>

      {sent && <Confirmation document={sent.document} edited={sent.edited} timeZone={timeZone} />}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <section className="tile" aria-labelledby="my-submissions-heading">
        <div className="documents__section-head">
          <h2 id="my-submissions-heading">My Submissions</h2>
          {outstanding > 0 && <p className="muted">{money.format(outstanding)} waiting to be reimbursed</p>}
        </div>
        {mine.length === 0 ? (
          <p className="muted">
            Nothing sent yet. Submit a receipt to be paid back, or upload a document the office needs, and it’s listed
            here.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table doc-table">
              <thead>
                <tr>
                  <th>Submission</th>
                  <th>Type</th>
                  <th>Sent</th>
                  <th className="doc-table__amount">Amount</th>
                  <th>Status</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mine.map((doc) => (
                  <tr key={doc.id} className={doc.id === sent?.document.id ? 'is-new' : undefined}>
                    <td data-label="Submission">
                      <a href={fileUrl(doc)} target="_blank" rel="noopener noreferrer" className="doc-link">
                        {doc.title}
                      </a>
                      {doc.vendor && <span className="doc-sub">{doc.vendor}</span>}
                      {doc.notes && <span className="doc-sub">{doc.notes}</span>}
                    </td>
                    <td data-label="Type">{doc.category_display}</td>
                    <td data-label="Sent">{formatDay(dayKey(doc.created_at, timeZone), { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td data-label="Amount" className="doc-table__amount">
                      {doc.amount != null ? money.format(Number(doc.amount)) : '—'}
                    </td>
                    <td data-label="Status">
                      {doc.category === 'receipt' ? (
                        <ReceiptProgress status={doc.status} />
                      ) : doc.status === 'submitted' ? (
                        'Sent'
                      ) : (
                        'Seen by the office'
                      )}
                    </td>
                    <td className="doc-table__actions">
                      <span className="row-actions">
                        <a href={fileUrl(doc, true)} className="text-button">
                          Download
                        </a>
                        {doc.status === 'submitted' && (
                          <>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => {
                                setSent(null)
                                setDialog({ document: doc, category: doc.category })
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => withdraw(doc)}
                              aria-label={`Withdraw ${doc.title}`}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form__hint documents__status-help">
          Receipts go <strong>Submitted</strong> → <strong>Viewed</strong> → <strong>In process</strong> →{' '}
          <strong>Processed</strong> (added to your pay). You can edit or withdraw anything you’ve sent until the office
          has opened it.
        </p>
      </section>

      {dialog && (
        <DocumentFormDialog
          document={dialog.document}
          initialCategory={dialog.category}
          canChooseCategory
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setSent({ document: saved, edited: !!dialog.document })
            setDialog(null)
            documents.reload()
          }}
        />
      )}
    </section>
  )
}

/** Says the upload went through, and what happens next. */
function Confirmation({ document, edited, timeZone }: { document: ProjectDocument; edited: boolean; timeZone: string }) {
  const receipt = document.category === 'receipt'
  const when = `${shortDate(dayKey(document.updated_at, timeZone))} at ${new Date(document.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })}`
  return (
    <p className="notice notice--success" role="status">
      <strong>
        {edited ? 'Saved' : 'Submitted'}: “{document.title}”
        {receipt && document.amount != null ? ` for ${money.format(Number(document.amount))}` : ''}
      </strong>{' '}
      on {when}.{' '}
      {receipt
        ? 'It’s in My Submissions below, where you can follow it until it’s added to your pay.'
        : 'The office has it now, and it’s listed in My Submissions below.'}
    </p>
  )
}
