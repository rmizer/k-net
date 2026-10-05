import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { formatDay } from '../../format'
import type { PaymentMethod } from '../../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** "$1,250.00" from the API's decimal strings (or numbers). */
export const money = (value: string | number | null | undefined) =>
  value == null || value === '' ? '—' : currency.format(Number(value))

export const shortDate = (day: string | null | undefined, withYear = false) =>
  day
    ? formatDay(
        day,
        withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' },
      )
    : '—'

export function todayIso() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** A stat tile: label over a big number. */
export function Stat({
  label,
  value,
  note,
  alert,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  alert?: boolean
}) {
  return (
    <div className={`fin-stat${alert ? ' fin-stat--alert' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <dd className="fin-stat__note">{note}</dd>}
    </div>
  )
}

interface MethodSelectProps {
  methods: PaymentMethod[]
  value: number | null
  onChange: (id: number | null) => void
  label?: string
  /** Limit to some kinds, e.g. bank accounts for deposits. */
  kinds?: PaymentMethod['kind'][]
}

export function MethodSelect({ methods, value, onChange, label = 'Paid with', kinds }: MethodSelectProps) {
  const options = methods.filter((m) => (m.is_active || m.id === value) && (!kinds || kinds.includes(m.kind)))
  return (
    <label className="form__field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Not set</option>
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface PayDialogProps {
  title: string
  /** What's being paid, e.g. "$1,180.00 to Sunbelt Rentals". */
  summary: string
  /** POST target, e.g. /finance/invoices/3/pay/ */
  path: string
  methods: PaymentMethod[]
  defaultMethod: number | null
  dateLabel?: string
  submitLabel?: string
  onDone: () => void
  onClose: () => void
}

/** Records a payment (invoice, paycheck or auto draft); it then shows under Outgoing. */
export function PayDialog(props: PayDialogProps) {
  const { title, summary, path, methods, defaultMethod, dateLabel = 'Paid on', submitLabel = 'Mark paid' } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [paidOn, setPaidOn] = useState(todayIso())
  const [method, setMethod] = useState<number | null>(defaultMethod)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api(path, {
        method: 'POST',
        body: JSON.stringify({ paid_on: paidOn, payment_method: method, reference }),
      })
      props.onDone()
    } catch (err) {
      const fields = fieldErrors(err)
      setError(Object.values(fields)[0] ?? (err instanceof ApiError ? err.message : 'Could not record the payment.'))
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog dialog--narrow" onClose={props.onClose} aria-labelledby="pay-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="pay-title">{title}</h2>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="fin-pay-summary">{summary}</p>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="form__grid">
          <label className="form__field">
            <span>{dateLabel}</span>
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
          </label>
          <MethodSelect methods={methods} value={method} onChange={setMethod} />
          <label className="form__field form__span">
            <span>Reference</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Check number, confirmation…"
              autoComplete="off"
            />
          </label>
        </div>
        <p className="form__hint">This is recorded under Outgoing.</p>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
          <button type="button" className="button button--secondary" onClick={props.onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}

/** Shared open/close plumbing for the finance edit dialogs. */
export function useDialog() {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return ref
}

/** Turns an API error into per-field messages (or one for the whole form). */
export function formErrors(err: unknown, fallback = 'Could not save.') {
  const fields = fieldErrors(err)
  return Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : fallback }
}
