import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { formatDay } from '../../format'
import type { Deposit, PaymentMethod, ProductionSettings, TimelineItem } from '../../types'
import { RevenueChart } from './RevenueChart'
import { formErrors, MethodSelect, money, shortDate, Stat, todayIso, useDialog } from './shared'
import './finance.css'

export function IncomingPage() {
  const deposits = useFetch<Deposit[]>('/finance/deposits/')
  const methods = useFetch<PaymentMethod[]>('/finance/payment-methods/')
  const production = useFetch<ProductionSettings>('/production/')
  // The production period starts with the first item on the Master Timeline.
  const timeline = useFetch<TimelineItem[]>('/timeline/')
  // ?add=1 (from the Finance overview) opens the form straight away.
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Deposit | null | undefined>(params.has('add') ? null : undefined)
  const [error, setError] = useState('')

  const remove = async (deposit: Deposit) => {
    if (!window.confirm(`Delete the ${money(deposit.amount)} deposit from ${deposit.source}?`)) return
    setError('')
    try {
      await api(`/finance/deposits/${deposit.id}/`, { method: 'DELETE' })
      deposits.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that deposit.')
    }
  }

  if (deposits.loading && !deposits.data) return <p className="loading">Loading incoming…</p>
  if (!deposits.data) return <p className="form__error">Couldn’t load incoming money.</p>

  // A running statement: balance accumulates oldest to newest, then shows newest first.
  const oldestFirst = [...deposits.data].sort((a, b) => a.received_on.localeCompare(b.received_on) || a.id - b.id)
  const running = oldestFirst.reduce<number[]>(
    (totals, deposit) => [...totals, (totals.at(-1) ?? 0) + Number(deposit.amount)],
    [],
  )
  const rows = oldestFirst.map((deposit, i) => ({ deposit, balance: running[i] })).reverse()
  const balance = running.at(-1) ?? 0
  const today = production.data?.today ?? todayIso()
  const thisMonth = today.slice(0, 7)
  const productionStart =
    timeline.data?.map((item) => item.start_date).sort()[0] ?? oldestFirst[0]?.received_on ?? today
  const monthTotal = deposits.data
    .filter((d) => d.received_on.startsWith(thisMonth))
    .reduce((sum, d) => sum + Number(d.amount), 0)

  return (
    <section className="finance">
      <div className="page-header">
        <div>
          <h1>Incoming</h1>
          <p className="subtitle">Running statement of money received</p>
        </div>
        <button type="button" className="button" onClick={() => setEditing(null)}>
          + Record deposit
        </button>
      </div>

      <dl className="fin-stats">
        <Stat label="Received to date" value={money(balance)} />
        <Stat label="This month" value={money(monthTotal)} />
        <Stat label="Deposits" value={deposits.data.length} />
      </dl>

      {oldestFirst.length > 0 && (
        <section className="tile" aria-labelledby="revenue-heading">
          <div className="fin-section__head">
            <h2 id="revenue-heading">Revenue to date</h2>
            <p className="muted revenue-chart__caption">
              Total received since the production began on{' '}
              {formatDay(productionStart, { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <RevenueChart deposits={deposits.data} start={productionStart} end={today} />
        </section>
      )}

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="tile">
        {rows.length === 0 ? (
          <p className="muted">No money recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Deposited into</th>
                  <th className="fin-num">Amount</th>
                  <th className="fin-num">Running total</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ deposit, balance: runningTotal }) => (
                  <tr key={deposit.id}>
                    <td data-label="Date">{shortDate(deposit.received_on, true)}</td>
                    <td data-label="Source">
                      <strong>{deposit.source}</strong>
                      {deposit.description && <span className="fin-sub">{deposit.description}</span>}
                    </td>
                    <td data-label="Into">{deposit.deposited_into_label ?? '—'}</td>
                    <td data-label="Amount" className="fin-num fin-in">
                      +{money(deposit.amount)}
                    </td>
                    <td data-label="Running total" className="fin-num">
                      {money(runningTotal)}
                    </td>
                    <td className="fin-actions">
                      <span className="row-actions">
                        {deposit.document_id && (
                          <a
                            href={`/api/documents/${deposit.document_id}/file/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-button"
                          >
                            Document
                          </a>
                        )}
                        <button type="button" className="text-button" onClick={() => setEditing(deposit)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => remove(deposit)}
                          aria-label={`Delete deposit from ${deposit.source}`}
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
      </div>

      {editing !== undefined && (
        <DepositDialog
          deposit={editing}
          methods={methods.data ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            deposits.reload()
          }}
        />
      )}
    </section>
  )
}

interface DepositDialogProps {
  deposit: Deposit | null
  methods: PaymentMethod[]
  onSaved: () => void
  onClose: () => void
}

function DepositDialog({ deposit, methods, onSaved, onClose }: DepositDialogProps) {
  const dialogRef = useDialog()
  const [form, setForm] = useState({
    received_on: deposit?.received_on ?? todayIso(),
    source: deposit?.source ?? '',
    amount: deposit?.amount ?? '',
    description: deposit?.description ?? '',
  })
  const [into, setInto] = useState<number | null>(deposit?.deposited_into ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const body = new FormData()
    for (const [key, value] of Object.entries(form)) body.append(key, value)
    body.append('deposited_into', into ? String(into) : '')
    if (file) body.append('file', file)
    try {
      await api(deposit ? `/finance/deposits/${deposit.id}/` : '/finance/deposits/', {
        method: deposit ? 'PATCH' : 'POST',
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
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="deposit-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="deposit-title">{deposit ? 'Edit deposit' : 'Record a deposit'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>
              Source<span aria-hidden="true"> *</span>
            </span>
            <input
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              placeholder="Who it came from"
              autoComplete="off"
              required
            />
            {error('source')}
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
            <span>Received on</span>
            <input type="date" value={form.received_on} onChange={(e) => set('received_on', e.target.value)} required />
            {error('received_on')}
          </label>
          <MethodSelect
            methods={methods}
            value={into}
            onChange={setInto}
            label="Deposited into"
            kinds={['bank', 'digital']}
          />
          <label className="form__field form__span">
            <span>Description</span>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} autoComplete="off" />
          </label>
          <label className="form__field form__span">
            <span>{deposit?.file_name ? 'Replace document' : 'Document'}</span>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {deposit?.file_name && !file && <small className="form__hint">Current: {deposit.file_name}</small>}
            {error('file')}
          </label>
        </div>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : deposit ? 'Save changes' : 'Record deposit'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
