import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import type {
  AutoDraft,
  DraftFrequency,
  FinanceOverview,
  OutgoingKind,
  OutgoingPayment,
  PaymentMethod,
} from '../../types'
import { ReceiptProgress } from '../documents/DocumentsPage'
import { formErrors, MethodSelect, money, PayDialog, shortDate, Stat, todayIso, useDialog } from './shared'
import './finance.css'

const KIND_FILTERS: { value: OutgoingKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'draft', label: 'Auto drafts' },
  { value: 'other', label: 'Other' },
]

export function OutgoingPage() {
  const payments = useFetch<OutgoingPayment[]>('/finance/payments/')
  const drafts = useFetch<AutoDraft[]>('/finance/auto-drafts/')
  const methods = useFetch<PaymentMethod[]>('/finance/payment-methods/')
  // Receipts waiting to be reimbursed come with the overview.
  const overview = useFetch<FinanceOverview>('/finance/overview/')
  const [kind, setKind] = useState<OutgoingKind | 'all'>('all')
  // ?add=payment or ?add=draft (from the Finance overview) opens that form straight away.
  const [params] = useSearchParams()
  const [addingPayment, setAddingPayment] = useState(params.get('add') === 'payment')
  const [editingDraft, setEditingDraft] = useState<AutoDraft | null | undefined>(
    params.get('add') === 'draft' ? null : undefined,
  )
  const [recording, setRecording] = useState<AutoDraft | null>(null)
  const [error, setError] = useState('')

  const all = useMemo(() => payments.data ?? [], [payments.data])
  const visible = all.filter((p) => kind === 'all' || p.kind === kind)
  const thisMonth = todayIso().slice(0, 7)
  const monthTotal = all.filter((p) => p.paid_on.startsWith(thisMonth)).reduce((sum, p) => sum + Number(p.amount), 0)
  const receipts = overview.data?.receipts ?? []
  const receiptsTotal = receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)

  const undo = async (payment: OutgoingPayment) => {
    const what = payment.invoice
      ? ' The invoice goes back to unpaid.'
      : payment.paycheck
        ? ' The paycheck goes back to scheduled.'
        : ''
    if (!window.confirm(`Delete this ${money(payment.amount)} payment to ${payment.payee}?${what}`)) return
    setError('')
    try {
      await api(`/finance/payments/${payment.id}/`, { method: 'DELETE' })
      payments.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that payment.')
    }
  }

  if (payments.loading && !payments.data) return <p className="loading">Loading outgoing…</p>
  if (!payments.data) return <p className="form__error">Couldn’t load outgoing payments.</p>

  return (
    <section className="finance">
      <div className="page-header">
        <div>
          <h1>Outgoing</h1>
          <p className="subtitle">Payments made, scheduled auto drafts and receipts to reimburse</p>
        </div>
        <button type="button" className="button" onClick={() => setAddingPayment(true)}>
          + Record payment
        </button>
      </div>

      <dl className="fin-stats">
        <Stat label="Paid this month" value={money(monthTotal)} />
        <Stat label="Receipts to reimburse" value={money(receiptsTotal)} note={`${receipts.length} waiting`} />
        <Stat
          label="Next auto draft"
          value={drafts.data?.find((d) => d.is_active) ? shortDate(drafts.data.find((d) => d.is_active)!.next_on) : '—'}
          note={drafts.data?.find((d) => d.is_active)?.payee}
        />
      </dl>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <section className="fin-section" aria-labelledby="payments-heading">
        <div className="fin-section__head">
          <h2 id="payments-heading">Payments</h2>
          <div className="segmented segmented--small" role="group" aria-label="Show">
            {KIND_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={kind === option.value}
                onClick={() => setKind(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tile">
          {visible.length === 0 ? (
            <p className="muted">No payments here yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Paid to</th>
                    <th>Type</th>
                    <th>Paid with</th>
                    <th className="fin-num">Amount</th>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((payment) => (
                    <tr key={payment.id}>
                      <td data-label="Date">{shortDate(payment.paid_on, true)}</td>
                      <td data-label="Paid to">
                        {payment.paycheck_person ? (
                          <Link to={`/finance/payroll/${payment.paycheck_person}`}>{payment.payee}</Link>
                        ) : (
                          <strong>{payment.payee}</strong>
                        )}
                        {payment.description && <span className="fin-sub">{payment.description}</span>}
                        {payment.reference && <span className="fin-sub">Ref. {payment.reference}</span>}
                      </td>
                      <td data-label="Type">{payment.kind_display}</td>
                      <td data-label="Paid with">{payment.payment_method_label ?? '—'}</td>
                      <td data-label="Amount" className="fin-num fin-out">
                        −{money(payment.amount)}
                      </td>
                      <td className="fin-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => undo(payment)}
                          aria-label={`Delete payment to ${payment.payee}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="fin-section" aria-labelledby="drafts-heading">
        <div className="fin-section__head">
          <h2 id="drafts-heading">Scheduled auto drafts</h2>
          <button type="button" className="text-button" onClick={() => setEditingDraft(null)}>
            + Add auto draft
          </button>
        </div>
        <div className="tile">
          {!drafts.data?.length ? (
            <p className="muted">No auto drafts set up.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <th>Next draft</th>
                    <th>Payee</th>
                    <th>How often</th>
                    <th>From</th>
                    <th className="fin-num">Amount</th>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.data.map((draft) => (
                    <tr key={draft.id} className={draft.is_active ? undefined : 'is-inactive'}>
                      <td data-label="Next draft">{!draft.is_active ? (
                          'Paused'
                        ) : draft.next_on < todayIso() ? (
                          <span className="fin-overdue">
                            {shortDate(draft.next_on, true)}
                            <span className="fin-sub">Due — record it</span>
                          </span>
                        ) : (
                          shortDate(draft.next_on, true)
                        )}</td>
                      <td data-label="Payee">
                        <strong>{draft.payee}</strong>
                        {draft.description && <span className="fin-sub">{draft.description}</span>}
                      </td>
                      <td data-label="How often">{draft.frequency_display}</td>
                      <td data-label="From">{draft.payment_method_label ?? '—'}</td>
                      <td data-label="Amount" className="fin-num">
                        {money(draft.amount)}
                      </td>
                      <td className="fin-actions">
                        <span className="row-actions">
                          {draft.is_active && (
                            <button type="button" className="text-button" onClick={() => setRecording(draft)}>
                              Record
                            </button>
                          )}
                          <button type="button" className="text-button" onClick={() => setEditingDraft(draft)}>
                            Edit
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
      </section>

      <section className="fin-section" aria-labelledby="reimburse-heading">
        <div className="fin-section__head">
          <h2 id="reimburse-heading">Receipts submitted for reimbursement</h2>
          <Link to="/documents?type=receipt">All receipts</Link>
        </div>
        <div className="tile">
          {receipts.length === 0 ? (
            <p className="muted">Nothing waiting. Receipts added to a paycheck are reimbursed with it.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table fin-table">
                  <thead>
                    <tr>
                      <th>Submitted</th>
                      <th>Receipt</th>
                      <th>By</th>
                      <th className="fin-num">Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt) => (
                      <tr key={receipt.id}>
                        <td data-label="Submitted">{shortDate(receipt.submitted_on)}</td>
                        <td data-label="Receipt">
                          <a href={`/api/documents/${receipt.id}/file/`} target="_blank" rel="noopener noreferrer">
                            {receipt.title}
                          </a>
                        </td>
                        <td data-label="By">
                          {receipt.person_id ? (
                            <Link to={`/finance/payroll/${receipt.person_id}`}>{receipt.person}</Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td data-label="Amount" className="fin-num">
                          {money(receipt.amount)}
                        </td>
                        <td data-label="Status">
                          <ReceiptProgress status={receipt.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="form__hint">
                To reimburse a receipt, add it to the person’s next paycheck from their payroll page.
              </p>
            </>
          )}
        </div>
      </section>

      {addingPayment && (
        <PaymentDialog
          methods={methods.data ?? []}
          onClose={() => setAddingPayment(false)}
          onSaved={() => {
            setAddingPayment(false)
            payments.reload()
          }}
        />
      )}
      {editingDraft !== undefined && (
        <DraftDialog
          draft={editingDraft}
          methods={methods.data ?? []}
          onClose={() => setEditingDraft(undefined)}
          onSaved={() => {
            setEditingDraft(undefined)
            drafts.reload()
          }}
        />
      )}
      {recording && (
        <PayDialog
          title="Record auto draft"
          summary={`${money(recording.amount)} to ${recording.payee}, due ${shortDate(recording.next_on)}. The next draft moves to the following date.`}
          path={`/finance/auto-drafts/${recording.id}/record/`}
          methods={methods.data ?? []}
          defaultMethod={recording.payment_method}
          dateLabel="Drafted on"
          submitLabel="Record draft"
          onClose={() => setRecording(null)}
          onDone={() => {
            setRecording(null)
            drafts.reload()
            payments.reload()
          }}
        />
      )}
    </section>
  )
}

interface PaymentDialogProps {
  methods: PaymentMethod[]
  onSaved: () => void
  onClose: () => void
}

/** A one-off payment that isn't an invoice, paycheck or auto draft. */
function PaymentDialog({ methods, onSaved, onClose }: PaymentDialogProps) {
  const dialogRef = useDialog()
  const [form, setForm] = useState({
    paid_on: todayIso(),
    payee: '',
    amount: '',
    kind: 'other' as OutgoingKind,
    description: '',
    reference: '',
  })
  const [method, setMethod] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api('/finance/payments/', { method: 'POST', body: JSON.stringify({ ...form, payment_method: method }) })
      onSaved()
    } catch (err) {
      setErrors(formErrors(err))
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="payment-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="payment-title">Record a payment</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="form__hint">
          For invoices, paychecks and auto drafts, use their own Pay or Record buttons instead.
        </p>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>
              Paid to<span aria-hidden="true"> *</span>
            </span>
            <input value={form.payee} onChange={(e) => set('payee', e.target.value)} autoComplete="off" required />
            {error('payee')}
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
          <label className="form__field">
            <span>Paid on</span>
            <input type="date" value={form.paid_on} onChange={(e) => set('paid_on', e.target.value)} />
            {error('paid_on')}
          </label>
          <label className="form__field">
            <span>Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="vendor">Vendor</option>
              <option value="other">Other</option>
            </select>
          </label>
          <MethodSelect methods={methods} value={method} onChange={setMethod} />
          <label className="form__field">
            <span>Reference</span>
            <input value={form.reference} onChange={(e) => set('reference', e.target.value)} autoComplete="off" />
          </label>
          <label className="form__field form__span">
            <span>What for</span>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} autoComplete="off" />
          </label>
        </div>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}

interface DraftDialogProps {
  draft: AutoDraft | null
  methods: PaymentMethod[]
  onSaved: () => void
  onClose: () => void
}

function DraftDialog({ draft, methods, onSaved, onClose }: DraftDialogProps) {
  const dialogRef = useDialog()
  const [form, setForm] = useState({
    payee: draft?.payee ?? '',
    description: draft?.description ?? '',
    amount: draft?.amount ?? '',
    frequency: (draft?.frequency ?? 'monthly') as DraftFrequency,
    next_on: draft?.next_on ?? todayIso(),
  })
  const [active, setActive] = useState(draft?.is_active ?? true)
  const [method, setMethod] = useState<number | null>(draft?.payment_method ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(draft ? `/finance/auto-drafts/${draft.id}/` : '/finance/auto-drafts/', {
        method: draft ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, payment_method: method, is_active: active }),
      })
      onSaved()
    } catch (err) {
      setErrors(formErrors(err))
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft || !window.confirm(`Delete the ${draft.payee} auto draft? Past payments stay under Outgoing.`)) return
    await api(`/finance/auto-drafts/${draft.id}/`, { method: 'DELETE' })
    onSaved()
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="draft-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="draft-title">{draft ? `Edit ${draft.payee} draft` : 'Add an auto draft'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>
              Payee<span aria-hidden="true"> *</span>
            </span>
            <input value={form.payee} onChange={(e) => set('payee', e.target.value)} autoComplete="off" required />
            {error('payee')}
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
          <label className="form__field">
            <span>How often</span>
            <select value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every two weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="form__field">
            <span>Next draft</span>
            <input type="date" value={form.next_on} onChange={(e) => set('next_on', e.target.value)} />
            {error('next_on')}
          </label>
          <MethodSelect methods={methods} value={method} onChange={setMethod} label="Drafted from" />
          <label className="form__field">
            <span>What for</span>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} autoComplete="off" />
          </label>
        </div>
        <label className="form__check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active (uncheck to pause)</span>
        </label>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : draft ? 'Save changes' : 'Add auto draft'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          {draft && (
            <button type="button" className="text-button text-button--danger" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
