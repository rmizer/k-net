import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import type { PaymentMethod, PaymentMethodKind } from '../../types'
import { formErrors, useDialog } from './shared'
import { NavIcon } from '../../components/NavIcon'
import './finance.css'

const KINDS: { value: PaymentMethodKind; label: string; plural: string }[] = [
  { value: 'card', label: 'Company card', plural: 'Company cards' },
  { value: 'bank', label: 'Bank account', plural: 'Bank accounts' },
  { value: 'digital', label: 'Digital account', plural: 'Digital accounts' },
]

const AMEX = /\bamex\b|american express/i

export function PaymentOptionsPage() {
  const methods = useFetch<PaymentMethod[]>('/finance/payment-methods/')
  // ?add=1 (from the Finance overview) opens the form straight away.
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<{ method: PaymentMethod | null; kind: PaymentMethodKind } | null>(
    params.has('add') ? { method: null, kind: 'card' } : null,
  )
  const [error, setError] = useState('')

  const remove = async (method: PaymentMethod) => {
    const usage = method.uses
      ? `\n\nIt’s on ${method.uses} payment${method.uses === 1 ? '' : 's'} or record${method.uses === 1 ? '' : 's'}; ` +
        'those will keep their amounts but show no payment method.'
      : ''
    if (
      !window.confirm(`Delete ${method.label}?${usage}\n\nIf it’s just no longer in use, Deactivate keeps the history.`)
    ) {
      return
    }
    setError('')
    try {
      await api(`/finance/payment-methods/${method.id}/`, { method: 'DELETE' })
      methods.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that.')
    }
  }

  const toggleActive = async (method: PaymentMethod) => {
    await api(`/finance/payment-methods/${method.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !method.is_active }),
    })
    methods.reload()
  }

  if (methods.loading && !methods.data) return <p className="loading">Loading payment options…</p>
  if (!methods.data) return <p className="form__error">Couldn’t load payment options.</p>

  return (
    <section className="finance">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="card" />
            Payment Options
          </h1>
          <p className="subtitle">Company cards, bank accounts and digital accounts</p>
        </div>
        <button type="button" className="button" onClick={() => setEditing({ method: null, kind: 'card' })}>
          + Add payment option
        </button>
      </div>
      <p className="notice">
        Only the last four digits are stored here. Keep full card and account numbers with the bank.
      </p>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {KINDS.map((kind) => {
        const group = methods.data!.filter((m) => m.kind === kind.value)
        return (
          <section key={kind.value} className="fin-section" aria-labelledby={`methods-${kind.value}`}>
            <div className="fin-section__head">
              <h2 id={`methods-${kind.value}`}>{kind.plural}</h2>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditing({ method: null, kind: kind.value })}
              >
                + Add
              </button>
            </div>
            {group.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <ul className="fin-methods">
                {group.map((method) => (
                  <li
                    key={method.id}
                    className={`tile fin-method fin-method--${method.kind}${method.is_active ? '' : ' is-inactive'}`}
                  >
                    <div className="fin-method__head">
                      <h3>{method.name}</h3>
                      {!method.is_active && <span className="badge badge--muted">Inactive</span>}
                    </div>
                    <p className="fin-method__number">
                      {method.institution}
                      {method.last_digits && <span> •••• {method.last_digits}</span>}
                    </p>
                    {method.holder && <p className="muted">Held by {method.holder}</p>}
                    {method.notes && <p className="fin-method__notes">{method.notes}</p>}
                    <p className="muted fin-method__uses">
                      Used on {method.uses} record{method.uses === 1 ? '' : 's'}
                    </p>
                    <div className="row-actions fin-method__actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setEditing({ method, kind: method.kind })}
                      >
                        Edit
                      </button>
                      <button type="button" className="text-button" onClick={() => toggleActive(method)}>
                        {method.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button type="button" className="text-button text-button--danger" onClick={() => remove(method)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      {editing && (
        <MethodDialog
          method={editing.method}
          kind={editing.kind}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            methods.reload()
          }}
        />
      )}
    </section>
  )
}

interface MethodDialogProps {
  method: PaymentMethod | null
  kind: PaymentMethodKind
  onSaved: () => void
  onClose: () => void
}

function MethodDialog({ method, kind, onSaved, onClose }: MethodDialogProps) {
  const dialogRef = useDialog()
  const [form, setForm] = useState({
    name: method?.name ?? '',
    kind: method?.kind ?? kind,
    institution: method?.institution ?? '',
    last_digits: method?.last_digits ?? '',
    holder: method?.holder ?? '',
    notes: method?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })
  // American Express cards have 15 digits and go by their last five. (Mirrors the server.)
  const amex = form.kind === 'card' && [form.institution, form.name].some((text) => AMEX.test(text))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(method ? `/finance/payment-methods/${method.id}/` : '/finance/payment-methods/', {
        method: method ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      })
      onSaved()
    } catch (err) {
      setErrors(formErrors(err))
      setSaving(false)
    }
  }

  const field = (name: keyof typeof form, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="form__field">
      <span>{label}</span>
      <input value={form[name]} onChange={(e) => set(name, e.target.value)} autoComplete="off" {...extra} />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="method-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="method-title">{method ? `Edit ${method.name}` : 'Add a payment option'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          {field('name', 'Name', { placeholder: 'e.g. Production Amex', required: true })}
          <label className="form__field">
            <span>Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {field('institution', form.kind === 'digital' ? 'Service' : 'Bank or card issuer', {
            placeholder: form.kind === 'digital' ? 'PayPal, Venmo, Zelle…' : 'Chase, American Express…',
          })}
          {field('last_digits', amex ? 'Last five digits' : 'Last four digits', {
            inputMode: 'numeric',
            maxLength: amex ? 5 : 4,
            placeholder: amex ? '10005' : '1234',
          })}
          {field('holder', form.kind === 'card' ? 'Cardholder' : 'Managed by')}
        </div>
        <label className="form__field">
          <span>Notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : method ? 'Save changes' : 'Add'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
