import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { addDays, dayKey, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import {
  DOCUMENT_CATEGORIES,
  RECEIPT_STATUSES,
  type DocumentCategory,
  type ProductionSettings,
  type ProjectDocument,
  type ReceiptStatus,
} from '../../types'
import { DocumentFormDialog } from './DocumentFormDialog'
import { NavIcon } from '../../components/NavIcon'
import './documents.css'

/** Documents expiring within this many days are flagged. */
const EXPIRY_WARNING_DAYS = 30

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const fileUrl = (doc: ProjectDocument, download = false) =>
  `/api/documents/${doc.id}/file/${download ? '?download=1' : ''}`

function fileSize(bytes: number | null) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const shortDate = (day: string) => formatDay(day, { month: 'short', day: 'numeric', year: 'numeric' })

function Expiry({ day, today }: { day: string | null; today: string }) {
  if (!day) return <span className="muted">—</span>
  const expired = day < today
  const soon = !expired && day <= addDays(today, EXPIRY_WARNING_DAYS)
  return (
    <span className={expired ? 'doc-expiry is-expired' : soon ? 'doc-expiry is-soon' : 'doc-expiry'}>
      {expired ? 'Expired ' : ''}
      {shortDate(day)}
    </span>
  )
}

/** Status as a label plus a four-step track, so it never relies on color alone. */
export function ReceiptProgress({ status }: { status: ReceiptStatus }) {
  const index = RECEIPT_STATUSES.findIndex((s) => s.value === status)
  return (
    <span className={`receipt-progress is-${status}`}>
      <span className="receipt-progress__label">{RECEIPT_STATUSES[index].label}</span>
      <span className="receipt-progress__steps" aria-hidden="true">
        {RECEIPT_STATUSES.map((step, i) => (
          <span key={step.value} className={i <= index ? 'is-reached' : undefined} />
        ))}
      </span>
    </span>
  )
}

type DialogState = { document: ProjectDocument | null; category: DocumentCategory }

export function DocumentsPage() {
  const { user } = useAuth()
  const manager = isManagerLevel(user)
  const production = useFetch<ProductionSettings>('/production/')
  const documents = useFetch<ProjectDocument[]>('/documents/')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [error, setError] = useState('')

  const remove = async (doc: ProjectDocument) => {
    const what = doc.category === 'receipt' && !manager ? 'Withdraw this receipt' : `Delete “${doc.title}”`
    if (!window.confirm(`${what}? The file will be deleted.`)) return
    setError('')
    try {
      await api(`/documents/${doc.id}/`, { method: 'DELETE' })
      documents.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that.')
    }
  }

  if ((documents.loading && !documents.data) || (production.loading && !production.data)) {
    return <p className="loading">Loading documents…</p>
  }
  if (!documents.data || !production.data) return <p className="form__error">Couldn’t load documents.</p>

  const today = production.data.today
  const actions = {
    onEdit: (doc: ProjectDocument) => setDialog({ document: doc, category: doc.category }),
    onDelete: remove,
    reload: documents.reload,
  }

  return (
    <section className="documents">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="document" />
            Documents
          </h1>
          <p className="subtitle">{manager ? 'Project paperwork and crew receipts' : 'Your receipts'}</p>
        </div>
        <div className="documents__buttons">
          <button
            type="button"
            className={manager ? 'button button--secondary' : 'button'}
            onClick={() => setDialog({ document: null, category: 'receipt' })}
          >
            + Submit receipt
          </button>
          {manager && (
            <button type="button" className="button" onClick={() => setDialog({ document: null, category: 'other' })}>
              + Upload document
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {manager ? (
        <ManagerDocuments documents={documents.data} today={today} timeZone={production.data.time_zone} {...actions} />
      ) : (
        <MyReceipts receipts={documents.data} {...actions} />
      )}

      {dialog && (
        <DocumentFormDialog
          document={dialog.document}
          initialCategory={dialog.category}
          canChooseCategory={manager}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            documents.reload()
          }}
        />
      )}
    </section>
  )
}

interface ListActions {
  onEdit: (doc: ProjectDocument) => void
  onDelete: (doc: ProjectDocument) => void
  reload: () => void
}

/** Staff: the receipts they've submitted and where each one is. */
function MyReceipts({ receipts, onEdit, onDelete }: { receipts: ProjectDocument[] } & ListActions) {
  const outstanding = receipts
    .filter((r) => r.status !== 'processed')
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0)

  return (
    <section className="tile" aria-labelledby="my-receipts-heading">
      <div className="documents__section-head">
        <h2 id="my-receipts-heading">My Receipts</h2>
        {receipts.length > 0 && (
          <p className="muted">{money.format(outstanding)} waiting to be reimbursed</p>
        )}
      </div>
      {receipts.length === 0 ? (
        <p className="muted">
          No receipts yet. Submit one with a photo or PDF and you can follow it here from Submitted to Processed.
        </p>
      ) : (
        <ReceiptTable receipts={receipts} showSubmitter={false} onEdit={onEdit} onDelete={onDelete} />
      )}
      <p className="form__hint documents__status-help">
        <strong>Submitted</strong> → <strong>Viewed</strong> (a Director or Assistant opened it) →{' '}
        <strong>In process</strong> → <strong>Processed</strong> (added to your pay). You can edit or withdraw a
        receipt until it’s been viewed.
      </p>
    </section>
  )
}

interface ReceiptTableProps {
  receipts: ProjectDocument[]
  showSubmitter: boolean
  onEdit: (doc: ProjectDocument) => void
  onDelete: (doc: ProjectDocument) => void
  /** Managers move receipts along; omitted for everyone else. */
  onStatus?: (doc: ProjectDocument, status: ReceiptStatus) => void
  onOpen?: (doc: ProjectDocument) => void
}

function ReceiptTable({ receipts, showSubmitter, onEdit, onDelete, onStatus, onOpen }: ReceiptTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table doc-table">
        <thead>
          <tr>
            <th>Receipt</th>
            {showSubmitter && <th>Submitted by</th>}
            <th>Purchased</th>
            <th className="doc-table__amount">Amount</th>
            <th>Status</th>
            <th>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => {
            const editable = !!onStatus || receipt.status === 'submitted'
            return (
              <tr key={receipt.id} className={receipt.status === 'submitted' && onStatus ? 'is-new' : undefined}>
                <td data-label="Receipt">
                  <a
                    href={fileUrl(receipt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-link"
                    onClick={() => onOpen?.(receipt)}
                  >
                    {receipt.title}
                  </a>
                  {receipt.vendor && <span className="doc-sub">{receipt.vendor}</span>}
                  {receipt.notes && <span className="doc-sub">{receipt.notes}</span>}
                </td>
                {showSubmitter && <td data-label="Submitted by">{receipt.uploaded_by_name ?? '—'}</td>}
                <td data-label="Purchased">{receipt.purchase_date ? shortDate(receipt.purchase_date) : '—'}</td>
                <td data-label="Amount" className="doc-table__amount">
                  {receipt.amount != null ? money.format(Number(receipt.amount)) : '—'}
                </td>
                <td data-label="Status">
                  {onStatus ? (
                    <select
                      className="doc-status-select"
                      value={receipt.status}
                      onChange={(e) => onStatus(receipt, e.target.value as ReceiptStatus)}
                      aria-label={`Status of ${receipt.title}`}
                    >
                      {RECEIPT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <ReceiptProgress status={receipt.status} />
                  )}
                </td>
                <td className="doc-table__actions">
                  <span className="row-actions">
                    <a href={fileUrl(receipt, true)} className="text-button" onClick={() => onOpen?.(receipt)}>
                      Download
                    </a>
                    {editable && (
                      <>
                        <button type="button" className="text-button" onClick={() => onEdit(receipt)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onDelete(receipt)}
                          aria-label={`Delete ${receipt.title}`}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type Tab = DocumentCategory | 'all'

interface ManagerDocumentsProps extends ListActions {
  documents: ProjectDocument[]
  today: string
  timeZone: string
}

/** Directors, Assistants and Site Managers: everything, by type. */
function ManagerDocuments({ documents, today, timeZone, onEdit, onDelete, reload }: ManagerDocumentsProps) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusError, setStatusError] = useState('')
  const tabParam = params.get('type')
  const tab: Tab = DOCUMENT_CATEGORIES.some((c) => c.value === tabParam) ? (tabParam as DocumentCategory) : 'all'

  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const doc of documents) result.set(doc.category, (result.get(doc.category) ?? 0) + 1)
    return result
  }, [documents])
  const newReceipts = documents.filter((d) => d.category === 'receipt' && d.status === 'submitted').length

  const expiring = documents
    .filter((d) => d.expires_on && d.expires_on <= addDays(today, EXPIRY_WARNING_DAYS))
    .sort((a, b) => (a.expires_on ?? '').localeCompare(b.expires_on ?? ''))

  const query = search.trim().toLowerCase()
  const visible = documents.filter(
    (d) =>
      (tab === 'all' || d.category === tab) &&
      (!query ||
        [d.title, d.vendor, d.notes, d.file_name, d.uploaded_by_name ?? ''].join(' ').toLowerCase().includes(query)),
  )

  const setStatus = async (doc: ProjectDocument, status: ReceiptStatus) => {
    setStatusError('')
    try {
      await api(`/documents/${doc.id}/`, { method: 'PATCH', body: JSON.stringify({ status }) })
      reload()
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Couldn’t update the status.')
    }
  }
  // Opening someone's new receipt marks it Viewed on the server.
  const opened = (doc: ProjectDocument) => {
    if (doc.category === 'receipt' && doc.status === 'submitted' && !doc.is_mine) window.setTimeout(reload, 800)
  }

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: documents.length },
    ...DOCUMENT_CATEGORIES.map((c) => ({ value: c.value as Tab, label: c.label, count: counts.get(c.value) ?? 0 })),
  ]

  return (
    <>
      {expiring.length > 0 && (
        <section className="tile documents__expiring" aria-labelledby="expiring-heading">
          <h2 id="expiring-heading">Expiring soon</h2>
          <ul>
            {expiring.map((doc) => (
              <li key={doc.id}>
                <a href={fileUrl(doc)} target="_blank" rel="noopener noreferrer" className="doc-link">
                  {doc.title}
                </a>
                <span className="muted"> · {doc.category_display} · </span>
                <Expiry day={doc.expires_on} today={today} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="doc-tabs" role="tablist" aria-label="Document type">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className="doc-tab"
            onClick={() => setParams(t.value === 'all' ? {} : { type: t.value })}
          >
            {t.label}
            <span className="doc-tab__count">{t.count}</span>
            {t.value === 'receipt' && newReceipts > 0 && <span className="badge">{newReceipts} new</span>}
          </button>
        ))}
      </div>

      <label className="form__field documents__search">
        <span className="visually-hidden">Search documents</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search names, vendors, notes…"
        />
      </label>

      {statusError && (
        <p className="form__error" role="alert">
          {statusError}
        </p>
      )}

      <section className="tile" role="tabpanel">
        {visible.length === 0 ? (
          <p className="muted">{query ? 'Nothing matches that search.' : 'Nothing here yet.'}</p>
        ) : tab === 'receipt' ? (
          <ReceiptTable
            receipts={visible}
            showSubmitter
            onEdit={onEdit}
            onDelete={onDelete}
            onStatus={setStatus}
            onOpen={opened}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table doc-table">
              <thead>
                <tr>
                  <th>Document</th>
                  {tab === 'all' && <th>Type</th>}
                  <th>Added</th>
                  <th>Expires</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => (
                  <tr key={doc.id}>
                    <td data-label="Document">
                      <a
                        href={fileUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="doc-link"
                        onClick={() => opened(doc)}
                      >
                        {doc.title}
                      </a>
                      {doc.category === 'receipt' && <ReceiptProgress status={doc.status} />}
                      <span className="doc-sub">
                        {[doc.file_name, fileSize(doc.file_size)].filter(Boolean).join(' · ')}
                      </span>
                      {doc.notes && <span className="doc-sub">{doc.notes}</span>}
                    </td>
                    {tab === 'all' && <td data-label="Type">{doc.category_display}</td>}
                    <td data-label="Added">
                      {formatDay(dayKey(doc.created_at, timeZone), { month: 'short', day: 'numeric' })}
                      {doc.uploaded_by_name && <span className="doc-sub">{doc.uploaded_by_name}</span>}
                    </td>
                    <td data-label="Expires">
                      <Expiry day={doc.expires_on} today={today} />
                    </td>
                    <td className="doc-table__actions">
                      <span className="row-actions">
                        <a href={fileUrl(doc, true)} className="text-button" onClick={() => opened(doc)}>
                          Download
                        </a>
                        <button type="button" className="text-button" onClick={() => onEdit(doc)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onDelete(doc)}
                          aria-label={`Delete ${doc.title}`}
                        >
                          ×
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
