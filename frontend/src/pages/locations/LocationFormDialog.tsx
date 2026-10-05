import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { LOCATION_KINDS, type LocationKind, type ProductionLocation } from '../../types'

interface LocationFormDialogProps {
  /** The location being edited, or null to add one. */
  location: ProductionLocation | null
  initialKind: LocationKind
  onSaved: (saved: ProductionLocation) => void
  onClose: () => void
}

export function LocationFormDialog({ location, initialKind, onSaved, onClose }: LocationFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({
    name: location?.name ?? '',
    kind: location?.kind ?? initialKind,
    custom_type: location?.custom_type ?? '',
    address: location?.address ?? '',
    phone: location?.phone ?? '',
    website: location?.website ?? '',
    contact_name: location?.contact_name ?? '',
    notes: location?.notes ?? '',
    latitude: location?.latitude ?? '',
    longitude: location?.longitude ?? '',
  })
  // Pins come from the address unless someone places one by hand.
  const [manualPin, setManualPin] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const { latitude, longitude, ...fields } = form
    const body = manualPin
      ? { ...fields, latitude: latitude || null, longitude: longitude || null }
      : fields
    try {
      const saved = await api<ProductionLocation>(location ? `/locations/${location.id}/` : '/locations/', {
        method: location ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const input = (name: keyof typeof form, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="form__field">
      <span>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={!!errors[name]}
        autoComplete="off"
        {...props}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="location-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="location-form-title">{location ? `Edit ${location.name}` : 'Add a location'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <div className="form__grid">
          {input('name', 'Name', { required: true, placeholder: 'e.g. Armature Works' })}
          <label className="form__field">
            <span>Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {LOCATION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {form.kind === 'other' &&
            input('custom_type', 'What kind of place?', { placeholder: 'e.g. Hospital, Restaurant, Gym' })}
          <div className="form__span">
            {input('address', 'Address', { placeholder: 'Street, city, state' })}
            {!manualPin && (
              <small className="form__hint">
                The pin is placed from the address.{' '}
                <button type="button" className="text-button" onClick={() => setManualPin(true)}>
                  Place it by hand
                </button>
              </small>
            )}
          </div>
          {manualPin && (
            <>
              {input('latitude', 'Latitude', { inputMode: 'decimal', placeholder: '27.9506' })}
              {input('longitude', 'Longitude', { inputMode: 'decimal', placeholder: '-82.4572' })}
              <small className="form__hint form__span">
                Tip: in Google Maps, right-click the spot and click the numbers to copy them.
              </small>
            </>
          )}
          {input('phone', 'Phone', { type: 'tel' })}
          {input('website', 'Website', { type: 'url', placeholder: 'https://' })}
          {input('contact_name', 'On-site contact')}
        </div>

        <label className="form__field">
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Parking, access, load-in, Wi-Fi…"
          />
        </label>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : location ? 'Save changes' : 'Add location'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
