import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import type { Invoice, InvoiceStatus, PaymentMethod } from '../../types'
import { formErrors, MethodSelect, money, PayDialog, shortDate, useDialog } from './shared'
import { SortHeader, useSort } from '../../components/sorting'
import './finance.css'

type Show = 'open' | 'paid' | 'archived' | 'all'
type SortKey = 'due_on' | 'vendor' | 'amount' | 'issued_on' | 'status'

const SHOW: { value: Show; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

export function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.status === 'paid')
    return <span className="fin-badge fin-badge--paid">Paid {shortDate(invoice.paid_on)}</span>
  if (invoice.is_overdue) return <span className="fin-badge fin-badge--overdue">Overdue</span>
  return <span className={`fin-badge fin-badge--${invoice.status}`}>{invoice.status_display}</span>
}

export function InvoicesPage() {
  const invoices = useFetch<Invoice[]>('/finance/invoices/')
  const methods = useFetch<PaymentMethod[]>('/finance/payment-methods/')
  const [show, setShow] = useState<Show>('open')
  const [search, setSearch] = useState('')
  const sort = useSort<SortKey>('due_on')
  // ?add=1 (from the Finance overview) opens the form straight away.
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Invoice | null | undefined>(params.has('add') ? null : undefined)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [error, setError] = useState('')

  const all = useMemo(() => invoices.data ?? [], [invoices.data])
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter((invoice) => {
      const inView =
        show === 'all' ||
        (show === 'archived' && invoice.archived) ||
        (show === 'paid' && !invoice.archived && invoice.status === 'paid') ||
        (show === 'open' && !invoice.archived && invoice.status !== 'paid')
      const text = `${invoice.vendor} ${invoice.number} ${invoice.description}`.toLowerCase()
      return inView && (!query || text.includes(query))
    }),
    (invoice, key) => (key === 'amount' ? Number(invoice.amount) : invoice[key]),
  )
  const openTotal = all.filter((i) => !i.archived && i.status !== 'paid').reduce((sum, i) => sum + Number(i.amount), 0)

  const setArchived = async (invoice: Invoice, archived: boolean) => {
    setError('')
    try {
      await api(`/finance/invoices/${invoice.id}/`, { method: 'PATCH', body: JSON.stringify({ archived }) })
      invoices.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t update that invoice.')
    }
  }

  if (invoices.loading && !invoices.data) return <p className="loading">Loading invoices…</p>
  if (!invoices.data) return <p className="form__error">Couldn’t load invoices.</p>

  return (
    <section className="finance">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p className="subtitle">{money(openTotal)} open</p>
        </div>
        <button type="button" className="button" onClick={() => setEditing(null)}>
          + Submit invoice
        </button>
      </div>

      <div className="fin-toolbar">
        <div className="segmented" role="group" aria-label="Show">
          {SHOW.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={show === option.value}
              onClick={() => setShow(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="form__field fin-search">
          <span className="visually-hidden">Search invoices</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vendor, number, description…"
          />
        </label>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="tile">
        {visible.length === 0 ? (
          <p className="muted">{query ? 'Nothing matches that search.' : 'No invoices here.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table fin-table">
              <thead>
                <tr>
                  <SortHeader sort={sort} column="vendor">
                    Vendor
                  </SortHeader>
                  <SortHeader sort={sort} column="issued_on">
                    Issued
                  </SortHeader>
                  <SortHeader sort={sort} column="due_on">
                    Due
                  </SortHeader>
                  <SortHeader sort={sort} column="amount" className="fin-num">
                    Amount
                  </SortHeader>
                  <SortHeader sort={sort} column="status">
                    Status
                  </SortHeader>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((invoice) => (
                  <tr key={invoice.id} className={invoice.is_overdue ? 'is-overdue' : undefined}>
                    <td data-label="Vendor">
                      <strong>{invoice.vendor}</strong>
                      {invoice.number && <span className="fin-sub">#{invoice.number}</span>}
                      {invoice.description && <span className="fin-sub">{invoice.description}</span>}
                    </td>
                    <td data-label="Issued">{shortDate(invoice.issued_on)}</td>
                    <td data-label="Due" className={invoice.is_overdue ? 'fin-overdue' : undefined}>
                      {shortDate(invoice.due_on)}
                    </td>
                    <td data-label="Amount" className="fin-num">
                      {money(invoice.amount)}
                    </td>
                    <td data-label="Status">
                      <InvoiceStatusBadge invoice={invoice} />
                      {invoice.archived && <span className="badge badge--muted">Archived</span>}
                    </td>
                    <td className="fin-actions">
                      <span className="row-actions">
                        {invoice.document_id && (
                          <a
                            href={`/api/documents/${invoice.document_id}/file/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-button"
                          >
                            Open
                          </a>
                        )}
                        {invoice.status !== 'paid' && !invoice.archived && (
                          <button type="button" className="text-button" onClick={() => setPaying(invoice)}>
                            Pay
                          </button>
                        )}
                        <button type="button" className="text-button" onClick={() => setEditing(invoice)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setArchived(invoice, !invoice.archived)}
                        >
                          {invoice.archived ? 'Unarchive' : 'Archive'}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== undefined && (
        <InvoiceDialog
          invoice={editing}
          methods={methods.data ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            invoices.reload()
          }}
        />
      )}
      {paying && (
        <PayDialog
          title="Pay invoice"
          summary={`${money(paying.amount)} to ${paying.vendor}${paying.number ? ` (#${paying.number})` : ''}`}
          path={`/finance/invoices/${paying.id}/pay/`}
          methods={methods.data ?? []}
          defaultMethod={paying.payment_method}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            invoices.reload()
          }}
        />
      )}
    </section>
  )
}

interface InvoiceDialogProps {
  invoice: Invoice | null
  methods: PaymentMethod[]
  onSaved: () => void
  onClose: () => void
}

function InvoiceDialog({ invoice, methods, onSaved, onClose }: InvoiceDialogProps) {
  const dialogRef = useDialog()
  const [form, setForm] = useState({
    vendor: invoice?.vendor ?? '',
    number: invoice?.number ?? '',
    amount: invoice?.amount ?? '',
    issued_on: invoice?.issued_on ?? '',
    due_on: invoice?.due_on ?? '',
    description: invoice?.description ?? '',
    status: (invoice?.status ?? 'unpaid') as InvoiceStatus,
  })
  const [method, setMethod] = useState<number | null>(invoice?.payment_method ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })
  const paid = invoice?.status === 'paid'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const body = new FormData()
    for (const [key, value] of Object.entries(form)) {
      if (key === 'status' && paid) continue // Paid invoices are undone from Outgoing.
      body.append(key, value)
    }
    body.append('payment_method', method ? String(method) : '')
    if (file) body.append('file', file)
    try {
      await api(invoice ? `/finance/invoices/${invoice.id}/` : '/finance/invoices/', {
        method: invoice ? 'PATCH' : 'POST',
        body,
      })
      onSaved()
    } catch (err) {
      setErrors(formErrors(err))
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="invoice-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="invoice-title">{invoice ? `Edit invoice from ${invoice.vendor}` : 'Submit an invoice'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>
              Vendor<span aria-hidden="true"> *</span>
            </span>
            <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} autoComplete="off" required />
            {error('vendor')}
          </label>
          <label className="form__field">
            <span>Invoice number</span>
            <input value={form.number} onChange={(e) => set('number', e.target.value)} autoComplete="off" />
          </label>
          <label className="form__field">
            <span>
              Amount<span aria-hidden="true"> *</span>
            </span>
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              required
            />
            {error('amount')}
          </label>
          {!paid && (
            <label className="form__field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="unpaid">Unpaid</option>
                <option value="scheduled">Payment scheduled</option>
              </select>
            </label>
          )}
          <label className="form__field">
            <span>Invoice date</span>
            <input type="date" value={form.issued_on} onChange={(e) => set('issued_on', e.target.value)} />
          </label>
          <label className="form__field">
            <span>Due</span>
            <input type="date" value={form.due_on} onChange={(e) => set('due_on', e.target.value)} />
            {error('due_on')}
          </label>
          <MethodSelect methods={methods} value={method} onChange={setMethod} label="Pay with" />
          <label className="form__field">
            <span>{invoice?.file_name ? 'Replace file' : 'Invoice file'}</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {invoice?.file_name && !file && <small className="form__hint">Current: {invoice.file_name}</small>}
            {error('file')}
          </label>
        </div>
        <label className="form__field">
          <span>Description</span>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <p className="form__hint">The file is also filed under Documents → Invoices.</p>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : invoice ? 'Save changes' : 'Submit invoice'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
