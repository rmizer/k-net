import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { INFLUENCER_PLATFORMS, type Influencer, type InfluencerPlatform, type Show } from '../../types'

interface InfluencerFormDialogProps {
  /** The influencer being edited, or null to add someone new. */
  influencer: Influencer | null
  onSaved: (saved: Influencer) => void
  onClose: () => void
}

const TEXT_FIELDS = [
  'name',
  'handle',
  'phone',
  'email',
  'address',
  'agent_name',
  'agent_phone',
  'agent_email',
  'travel_needs',
  'lodging_needs',
  'needs',
  'allergies',
  'food_allergies',
] as const
type TextField = (typeof TEXT_FIELDS)[number]
type NeedsField = 'travel_needs' | 'lodging_needs' | 'needs' | 'allergies' | 'food_allergies'
type FormState = Record<TextField, string> & { platform: InfluencerPlatform; show: string; season: string; week: string }

export function InfluencerFormDialog({ influencer, onSaved, onClose }: InfluencerFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<FormState>(() => ({
    ...(Object.fromEntries(TEXT_FIELDS.map((f) => [f, influencer?.[f] ?? ''])) as Record<TextField, string>),
    platform: influencer?.platform ?? '',
    show: influencer?.show != null ? String(influencer.show) : '',
    season: influencer?.season != null ? String(influencer.season) : '',
    week: influencer?.week != null ? String(influencer.week) : '',
  }))
  const shows = useFetch<Show[]>('/shows/')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const numberErrors: Record<string, string> = {}
    for (const name of ['season', 'week'] as const) {
      if (form[name] && !/^\d+$/.test(form[name])) numberErrors[name] = 'Enter a whole number.'
    }
    if (Object.keys(numberErrors).length) {
      setErrors(numberErrors)
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const body = {
        ...form,
        show: form.show ? Number(form.show) : null,
        season: form.season ? Number(form.season) : null,
        week: form.week ? Number(form.week) : null,
      }
      const saved = await api<Influencer>(influencer ? `/influencers/${influencer.id}/` : '/influencers/', {
        method: influencer ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const field = (name: TextField, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="form__field">
      <span>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        aria-invalid={!!errors[name]}
        autoComplete="off"
        {...props}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  const needsField = (name: NeedsField, label: string, placeholder: string) => (
    <label className="form__field">
      <span>{label}</span>
      <textarea
        rows={3}
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        aria-invalid={!!errors[name]}
        placeholder={placeholder}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="influencer-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="influencer-form-title">{influencer ? `Edit ${influencer.name}` : 'Add influencer'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <fieldset className="form__fieldset">
          <legend>Profile</legend>
          <div className="form__grid">
            {field('name', 'Name', { required: true })}
            <label className="form__field">
              <span>Platform</span>
              <select
                value={form.platform}
                onChange={(event) => setForm({ ...form, platform: event.target.value as InfluencerPlatform })}
              >
                <option value="">Not set</option>
                {INFLUENCER_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {field('handle', 'Handle', { placeholder: '@handle' })}
          </div>
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Show</legend>
          <div className="form__grid">
            <label className="form__field">
              <span>Show</span>
              <select value={form.show} onChange={(event) => setForm({ ...form, show: event.target.value })}>
                <option value="">No show</option>
                {shows.data?.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.name}
                  </option>
                ))}
              </select>
              {errors.show && <small className="form__field-error">{errors.show}</small>}
            </label>
            <div className="influencer-form__numbers">
              {(['season', 'week'] as const).map((name) => (
                <label key={name} className="form__field">
                  <span>{name === 'season' ? 'Season' : 'Week'}</span>
                  <input
                    className="influencer-form__number"
                    inputMode="numeric"
                    value={form[name]}
                    onChange={(event) => setForm({ ...form, [name]: event.target.value.trim() })}
                    aria-invalid={!!errors[name]}
                    maxLength={3}
                  />
                  {errors[name] && <small className="form__field-error">{errors[name]}</small>}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Contact</legend>
          <div className="form__grid">
            {field('phone', 'Phone', { type: 'tel' })}
            {field('email', 'Email', { type: 'email' })}
            <div className="form__span">{field('address', 'Address')}</div>
          </div>
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Agent or contact</legend>
          <div className="form__grid">
            {field('agent_name', 'Name')}
            {field('agent_phone', 'Phone', { type: 'tel' })}
            {field('agent_email', 'Email', { type: 'email' })}
          </div>
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Needs</legend>
          {needsField('travel_needs', 'Travel', 'Home airport, seat preference, ground transport, travel companions…')}
          {needsField('lodging_needs', 'Lodging', 'Room type, nights, accessibility, roommates…')}
          {needsField('needs', 'Other', 'Dietary, equipment, wardrobe…')}
          {needsField('allergies', 'General allergies', 'Medications, insects, latex, pollen…')}
          {needsField('food_allergies', 'Food allergies', 'Peanuts, shellfish, gluten… (shared with Culinary)')}
        </fieldset>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : influencer ? 'Save changes' : 'Add influencer'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
