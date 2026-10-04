import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { fromLocalInput, toLocalInput } from '../../format'
import { TRAVEL_KINDS, type TravelArrangement, type TravelKind } from '../../types'

interface TravelFormDialogProps {
  influencerId: number
  /** The arrangement being edited, or null to add one. */
  travel: TravelArrangement | null
  onSaved: () => void
  onClose: () => void
}

export function TravelFormDialog({ influencerId, travel, onSaved, onClose }: TravelFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({
    kind: travel?.kind ?? ('flight' as TravelKind),
    provider: travel?.provider ?? '',
    reference: travel?.reference ?? '',
    confirmation: travel?.confirmation ?? '',
    depart_location: travel?.depart_location ?? '',
    arrive_location: travel?.arrive_location ?? '',
    starts_at: toLocalInput(travel?.starts_at ?? null),
    ends_at: toLocalInput(travel?.ends_at ?? null),
    notes: travel?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })
  const hotel = form.kind === 'hotel'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(travel ? `/influencer-travel/${travel.id}/` : '/influencer-travel/', {
        method: travel ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          influencer: influencerId,
          starts_at: fromLocalInput(form.starts_at),
          ends_at: fromLocalInput(form.ends_at),
        }),
      })
      onSaved()
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const input = (name: keyof typeof form, label: string, type = 'text') => (
    <label className="form__field">
      <span>{label}</span>
      <input type={type} value={form[name]} onChange={(e) => set(name, e.target.value)} autoComplete="off" />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="travel-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="travel-form-title">{travel ? 'Edit travel' : 'Add travel'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {TRAVEL_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {input('provider', hotel ? 'Hotel' : 'Airline / company')}
          {input('reference', hotel ? 'Room' : 'Flight / reference #')}
          {input('confirmation', 'Confirmation #')}
          {!hotel && input('depart_location', 'From')}
          {!hotel && input('arrive_location', 'To')}
          {input('starts_at', hotel ? 'Check-in' : 'Departs', 'datetime-local')}
          {input('ends_at', hotel ? 'Check-out' : 'Arrives', 'datetime-local')}
          <label className="form__field form__span">
            <span>Notes</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        <p className="form__hint form__hint--below">Times are in your own time zone.</p>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : travel ? 'Save changes' : 'Add travel'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
