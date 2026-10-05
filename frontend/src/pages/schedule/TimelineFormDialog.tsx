import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import type { TimelineItem } from '../../types'

interface TimelineFormDialogProps {
  /** The item being edited, or null to add one. */
  item: TimelineItem | null
  /** Start date for a new item. */
  defaultDate: string
  onSaved: (saved: TimelineItem) => void
  onClose: () => void
}

export function TimelineFormDialog({ item, defaultDate, onSaved, onClose }: TimelineFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({
    name: item?.name ?? '',
    start_date: item?.start_date ?? defaultDate,
    end_date: item?.end_date ?? defaultDate,
    description: item?.description ?? '',
  })
  const [milestone, setMilestone] = useState(item ? item.start_date === item.end_date : false)
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
    try {
      const saved = await api<TimelineItem>(item ? `/timeline/${item.id}/` : '/timeline/', {
        method: item ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, end_date: milestone ? form.start_date : form.end_date }),
      })
      onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="timeline-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="timeline-form-title">{item ? `Edit ${item.name}` : 'Add to the timeline'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="form__field">
          <span>
            Name<span aria-hidden="true"> *</span>
          </span>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Principal photography"
            aria-invalid={!!errors.name}
            autoComplete="off"
            required
          />
          {error('name')}
        </label>

        <label className="form__check">
          <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} />
          <span>Milestone (a single day)</span>
        </label>

        <div className="form__grid">
          <label className="form__field">
            <span>{milestone ? 'Date' : 'Start'}</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              aria-invalid={!!errors.start_date}
              required
            />
            {error('start_date')}
          </label>
          {!milestone && (
            <label className="form__field">
              <span>End</span>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => set('end_date', e.target.value)}
                aria-invalid={!!errors.end_date}
                required
              />
              {error('end_date')}
            </label>
          )}
        </div>

        <label className="form__field">
          <span>Description</span>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add to timeline'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
