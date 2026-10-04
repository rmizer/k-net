import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { RESOURCE_CATEGORIES, type Resource, type ResourceCategory } from '../../types'

interface ResourceFormDialogProps {
  /** The listing being edited, or null to add a new one. */
  resource: Resource | null
  onSaved: () => void
  onClose: () => void
}

const TEXT_FIELDS = ['company_name', 'contact_name', 'phone', 'email', 'website', 'address', 'notes'] as const
type TextField = (typeof TEXT_FIELDS)[number]

export function ResourceFormDialog({ resource, onSaved, onClose }: ResourceFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState(() => ({
    ...(Object.fromEntries(TEXT_FIELDS.map((name) => [name, resource?.[name] ?? ''])) as Record<TextField, string>),
    category: resource?.category ?? ('other' as ResourceCategory),
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(resource ? `/resources/${resource.id}/` : '/resources/', {
        method: resource ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      })
      onSaved()
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const field = (name: TextField, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <label className={`form__field${wide ? ' form__span' : ''}`}>
      <span>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        aria-invalid={!!errors[name]}
        {...props}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="resource-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="resource-form-title">{resource ? `Edit ${resource.company_name}` : 'Add resource'}</h2>
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
          {field('company_name', 'Company name', { required: true, autoComplete: 'off' })}
          <label className="form__field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as ResourceCategory })}
            >
              {RESOURCE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          {field('contact_name', 'Contact name', { autoComplete: 'off' })}
          {field('phone', 'Phone', { type: 'tel', required: true, autoComplete: 'off' })}
          {field('email', 'Email', { type: 'email', autoComplete: 'off' })}
          {field('website', 'Website', { type: 'url', placeholder: 'https://', autoComplete: 'off' })}
          {field('address', 'Address', { autoComplete: 'off' }, true)}
          <label className="form__field form__span">
            <span>Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Services offered, hours, account numbers…"
            />
          </label>
        </div>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : resource ? 'Save changes' : 'Add resource'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
