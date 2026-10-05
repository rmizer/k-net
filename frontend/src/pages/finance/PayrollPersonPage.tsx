import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import type { Paycheck, PaymentMethod, PayrollPersonDetail, PayUnit, ReceiptSummary } from '../../types'
import { ReceiptProgress } from '../documents/DocumentsPage'
import { formErrors, MethodSelect, money, PayDialog, shortDate, Stat, todayIso, useDialog } from './shared'
import { rateText } from './PayrollPage'
import './finance.css'

const UNIT_WORDS: Record<PayUnit, [string, string]> = {
  day: ['day', 'days'],
  hour: ['hour', 'hours'],
  week: ['week', 'weeks'],
}

const quantityText = (quantity: string, unit: PayUnit) =>
  `${Number(quantity)} ${UNIT_WORDS[unit][Number(quantity) === 1 ? 0 : 1]}`

export function PayrollPersonPage() {
  const { id } = useParams()
  const person = useFetch<PayrollPersonDetail>(`/finance/payroll/${id}/`)
  const methods = useFetch<PaymentMethod[]>('/finance/payment-methods/')
  const [editingRate, setEditingRate] = useState(false)
  const [paycheckDialog, setPaycheckDialog] = useState<Paycheck | null | undefined>(undefined)
  const [paying, setPaying] = useState<Paycheck | null>(null)
  const [error, setError] = useState('')

  if (person.loading && !person.data) return <p className="loading">Loading…</p>
  if (!person.data) {
    return (
      <section>
        <h1>Person not found</h1>
        <Link to="/finance/payroll">Back to Payroll</Link>
      </section>
    )
  }
  const data = person.data
  const unreimbursed = data.receipts.filter((r) => !r.paycheck)

  const removePaycheck = async (paycheck: Paycheck) => {
    const receiptsNote = paycheck.receipts.length ? ' Its receipts go back to In process.' : ''
    if (!window.confirm(`Delete the ${shortDate(paycheck.pay_date)} paycheck?${receiptsNote}`)) return
    setError('')
    try {
      await api(`/finance/paychecks/${paycheck.id}/`, { method: 'DELETE' })
      person.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that paycheck.')
    }
  }

  return (
    <section className="finance">
      <p className="breadcrumb no-print">
        <Link to="/finance/payroll">← Payroll</Link>
      </p>
      <div className="page-header">
        <div>
          <h1>{data.name}</h1>
          <p className="subtitle">
            {[data.role_display, data.department_name, data.is_active_crew ? 'Active crew' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="fin-header-buttons no-print">
          <button type="button" className="button button--secondary" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="button" onClick={() => setPaycheckDialog(null)}>
            + New paycheck
          </button>
        </div>
      </div>

      <dl className="fin-stats">
        <Stat
          label="Pay rate"
          value={rateText(data)}
          note={
            <button type="button" className="text-button no-print" onClick={() => setEditingRate(true)}>
              {data.pay_rate ? 'Change' : 'Set pay rate'}
            </button>
          }
          alert={!data.pay_rate}
        />
        <Stat
          label="Next paycheck"
          value={data.next_paycheck ? money(data.next_paycheck.total) : '—'}
          note={data.next_paycheck ? shortDate(data.next_paycheck.pay_date) : 'None scheduled'}
        />
        <Stat
          label="Receipts to add"
          value={money(data.unreimbursed.total)}
          note={`${data.unreimbursed.count} receipt${data.unreimbursed.count === 1 ? '' : 's'}`}
        />
        <Stat
          label="Paid to date"
          value={money(data.paid_to_date)}
          note={`Last paid ${shortDate(data.last_paid_on)}`}
        />
      </dl>
      {data.pay_rate?.notes && <p className="muted">{data.pay_rate.notes}</p>}

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <section className="fin-section" aria-labelledby="paychecks-heading">
        <h2 id="paychecks-heading">Paychecks</h2>
        <div className="tile">
          {data.paychecks.length === 0 ? (
            <p className="muted">No paychecks yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <th>Pay date</th>
                    <th>Period</th>
                    <th className="fin-num">Wages</th>
                    <th className="fin-num">Adjustment</th>
                    <th className="fin-num">Receipts</th>
                    <th className="fin-num">Total</th>
                    <th>Status</th>
                    <th className="no-print">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.paychecks.map((paycheck) => (
                    <tr key={paycheck.id}>
                      <td data-label="Pay date">{shortDate(paycheck.pay_date, true)}</td>
                      <td data-label="Period">
                        {shortDate(paycheck.period_start)} – {shortDate(paycheck.period_end)}
                        {paycheck.notes && <span className="fin-sub">{paycheck.notes}</span>}
                      </td>
                      <td data-label="Wages" className="fin-num">
                        {money(paycheck.wages)}
                        <span className="fin-sub">
                          {quantityText(paycheck.quantity, paycheck.unit)} × {money(paycheck.rate)}
                        </span>
                      </td>
                      <td data-label="Adjustment" className="fin-num">
                        {Number(paycheck.adjustment) ? money(paycheck.adjustment) : '—'}
                      </td>
                      <td data-label="Receipts" className="fin-num">
                        {paycheck.receipts.length ? (
                          <>
                            {money(paycheck.reimbursements)}
                            <span className="fin-sub">{paycheck.receipt_details.map((r) => r.title).join(', ')}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Total" className="fin-num">
                        <strong>{money(paycheck.total)}</strong>
                      </td>
                      <td data-label="Status">
                        <span className={`fin-badge fin-badge--${paycheck.status}`}>
                          {paycheck.status === 'paid' ? `Paid ${shortDate(paycheck.paid_on)}` : 'Scheduled'}
                        </span>
                      </td>
                      <td className="fin-actions no-print">
                        {paycheck.status === 'scheduled' && (
                          <span className="row-actions">
                            <button type="button" className="text-button" onClick={() => setPaying(paycheck)}>
                              Pay
                            </button>
                            <button type="button" className="text-button" onClick={() => setPaycheckDialog(paycheck)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removePaycheck(paycheck)}
                              aria-label={`Delete ${shortDate(paycheck.pay_date)} paycheck`}
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="fin-section" aria-labelledby="receipts-heading">
        <h2 id="receipts-heading">Receipts</h2>
        <div className="tile">
          {data.receipts.length === 0 ? (
            <p className="muted">{data.name} hasn’t submitted any receipts.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Purchased</th>
                    <th className="fin-num">Amount</th>
                    <th>Status</th>
                    <th>Reimbursed on</th>
                  </tr>
                </thead>
                <tbody>
                  {data.receipts.map((receipt) => {
                    const paycheck = data.paychecks.find((p) => p.id === receipt.paycheck)
                    return (
                      <tr key={receipt.id}>
                        <td data-label="Receipt">
                          <a href={`/api/documents/${receipt.id}/file/`} target="_blank" rel="noopener noreferrer">
                            {receipt.title}
                          </a>
                          {receipt.vendor && <span className="fin-sub">{receipt.vendor}</span>}
                        </td>
                        <td data-label="Purchased">{shortDate(receipt.purchase_date)}</td>
                        <td data-label="Amount" className="fin-num">
                          {money(receipt.amount)}
                        </td>
                        <td data-label="Status">
                          <ReceiptProgress status={receipt.status} />
                        </td>
                        <td data-label="Reimbursed on">
                          {paycheck ? (
                            `Paycheck of ${shortDate(paycheck.pay_date)}`
                          ) : (
                            <span className="muted">Not yet</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {editingRate && (
        <RateDialog
          personId={data.id}
          name={data.name}
          current={data.pay_rate}
          onClose={() => setEditingRate(false)}
          onSaved={() => {
            setEditingRate(false)
            person.reload()
          }}
        />
      )}
      {paycheckDialog !== undefined && (
        <PaycheckDialog
          person={data}
          paycheck={paycheckDialog}
          available={[
            ...unreimbursed,
            ...data.receipts.filter((r) => paycheckDialog && r.paycheck === paycheckDialog.id),
          ]}
          methods={methods.data ?? []}
          onClose={() => setPaycheckDialog(undefined)}
          onSaved={() => {
            setPaycheckDialog(undefined)
            person.reload()
          }}
        />
      )}
      {paying && (
        <PayDialog
          title="Pay paycheck"
          summary={`${money(paying.total)} to ${data.name} for ${shortDate(paying.period_start)} – ${shortDate(paying.period_end)}.`}
          path={`/finance/paychecks/${paying.id}/pay/`}
          methods={methods.data ?? []}
          defaultMethod={paying.payment_method}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            person.reload()
          }}
        />
      )}
    </section>
  )
}

interface RateDialogProps {
  personId: number
  name: string
  current: PayrollPersonDetail['pay_rate']
  onSaved: () => void
  onClose: () => void
}

function RateDialog({ personId, name, current, onSaved, onClose }: RateDialogProps) {
  const dialogRef = useDialog()
  const [form, setForm] = useState({
    unit: (current?.unit ?? 'day') as PayUnit,
    rate: current?.rate ?? '',
    notes: current?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(`/finance/payroll/${personId}/rate/`, { method: 'PUT', body: JSON.stringify(form) })
      onSaved()
    } catch (err) {
      setErrors(formErrors(err))
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog dialog--narrow" onClose={onClose} aria-labelledby="rate-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="rate-title">Pay rate for {name}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>Rate</span>
            <input
              inputMode="decimal"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/[^0-9.]/g, '') })}
              placeholder="0.00"
              required
            />
            {errors.rate && <small className="form__field-error">{errors.rate}</small>}
          </label>
          <label className="form__field">
            <span>Per</span>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as PayUnit })}>
              <option value="day">Day</option>
              <option value="hour">Hour</option>
              <option value="week">Week</option>
            </select>
          </label>
          <label className="form__field form__span">
            <span>Notes</span>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Direct deposit; kit fee included"
            />
          </label>
        </div>
        <p className="form__hint">Changing the rate doesn’t change paychecks already created.</p>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Save rate'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}

interface PaycheckDialogProps {
  person: PayrollPersonDetail
  paycheck: Paycheck | null
  /** Receipts that can go on this paycheck. */
  available: ReceiptSummary[]
  methods: PaymentMethod[]
  onSaved: () => void
  onClose: () => void
}

/** The week after the person's latest paycheck (or this week), paid the following Friday. */
function defaultPeriod(paychecks: Paycheck[]) {
  const day = (iso: string, offset = 0) =>
    new Date(new Date(`${iso}T00:00:00Z`).getTime() + offset * 86_400_000).toISOString().slice(0, 10)
  const latestEnd = paychecks.map((p) => p.period_end).sort().at(-1)
  const today = todayIso()
  const thisMonday = day(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const start = latestEnd ? day(latestEnd, 1) : thisMonday
  return { period_start: start, period_end: day(start, 6), pay_date: day(start, 11) }
}

function PaycheckDialog({ person, paycheck, available, methods, onSaved, onClose }: PaycheckDialogProps) {
  const dialogRef = useDialog()
  const rate = person.pay_rate
  const [form, setForm] = useState({
    ...(paycheck
      ? { period_start: paycheck.period_start, period_end: paycheck.period_end, pay_date: paycheck.pay_date }
      : defaultPeriod(person.paychecks)),
    unit: (paycheck?.unit ?? rate?.unit ?? 'day') as PayUnit,
    quantity: paycheck ? String(Number(paycheck.quantity)) : rate?.unit === 'week' ? '1' : '5',
    rate: paycheck?.rate ?? rate?.rate ?? '',
    adjustment: paycheck ? String(Number(paycheck.adjustment)) : '0',
    notes: paycheck?.notes ?? '',
  })
  const [receipts, setReceipts] = useState<number[]>(paycheck?.receipts ?? available.map((r) => r.id))
  const [method, setMethod] = useState<number | null>(paycheck?.payment_method ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })

  const wages = (Number(form.quantity) || 0) * (Number(form.rate) || 0)
  const reimbursed = available.filter((r) => receipts.includes(r.id)).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  const total = wages + (Number(form.adjustment) || 0) + reimbursed

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(paycheck ? `/finance/paychecks/${paycheck.id}/` : '/finance/paychecks/', {
        method: paycheck ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, person: person.id, receipts, payment_method: method }),
      })
      onSaved()
    } catch (err) {
      setErrors(formErrors(err))
      setSaving(false)
    }
  }

  const input = (name: keyof typeof form, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="form__field">
      <span>{label}</span>
      <input value={form[name]} onChange={(e) => set(name, e.target.value)} autoComplete="off" {...extra} />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="paycheck-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="paycheck-title">{paycheck ? 'Edit paycheck' : `New paycheck for ${person.name}`}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid form__grid--three">
          {input('period_start', 'Period start', { type: 'date' })}
          {input('period_end', 'Period end', { type: 'date' })}
          {input('pay_date', 'Pay date', { type: 'date' })}
          {input(
            'quantity',
            `${UNIT_WORDS[form.unit][1][0].toUpperCase()}${UNIT_WORDS[form.unit][1].slice(1)} worked`,
            {
              inputMode: 'decimal',
            },
          )}
          {input('rate', `Rate per ${UNIT_WORDS[form.unit][0]}`, { inputMode: 'decimal' })}
          {input('adjustment', 'Adjustment (+/−)', { inputMode: 'decimal' })}
        </div>

        <fieldset className="form__fieldset">
          <legend>Receipts to reimburse</legend>
          {available.length === 0 ? (
            <p className="muted">No receipts waiting.</p>
          ) : (
            available.map((receipt) => (
              <label key={receipt.id} className="form__check">
                <input
                  type="checkbox"
                  checked={receipts.includes(receipt.id)}
                  onChange={(e) =>
                    setReceipts(
                      e.target.checked ? [...receipts, receipt.id] : receipts.filter((id) => id !== receipt.id),
                    )
                  }
                />
                <span>
                  {receipt.title} · {money(receipt.amount)}
                  {receipt.vendor && <span className="muted"> · {receipt.vendor}</span>}
                </span>
              </label>
            ))
          )}
          {errors.receipts && <small className="form__field-error">{errors.receipts}</small>}
          <small className="form__hint">
            Receipts on a paycheck show as Processed to the person who submitted them.
          </small>
        </fieldset>

        <div className="form__grid">
          <MethodSelect
            methods={methods}
            value={method}
            onChange={setMethod}
            label="Pay from"
            kinds={['bank', 'digital']}
          />
          {input('notes', 'Notes')}
        </div>

        <dl className="fin-paycheck-total">
          <div>
            <dt>Wages</dt>
            <dd>{money(wages)}</dd>
          </div>
          <div>
            <dt>Adjustment</dt>
            <dd>{money(Number(form.adjustment) || 0)}</dd>
          </div>
          <div>
            <dt>Receipts</dt>
            <dd>{money(reimbursed)}</dd>
          </div>
          <div className="is-total">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : paycheck ? 'Save changes' : 'Create paycheck'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
