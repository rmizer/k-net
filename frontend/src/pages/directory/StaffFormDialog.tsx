import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { ROLE_LABELS, type Role, type User } from '../../auth/roles'
import type { Department } from '../../types'

const NEW_DEPARTMENT = 'new'

interface StaffFormDialogProps {
  /** The person being edited, or null to add someone new. */
  person: User | null
  departments: Department[]
  assignableRoles: Role[]
  onSaved: (saved: User) => void
  onClose: () => void
}

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  title: string
  role: Role
  department: string
  is_department_head: boolean
  head_of_department: string
  lodging: string
  room_number: string
  emergency_contact_name: string
  emergency_contact_phone: string
  allergies: string
  food_allergies: string
  is_active_crew: boolean
  password: string
}

function initialState(person: User | null, assignableRoles: Role[]): FormState {
  return {
    first_name: person?.first_name ?? '',
    last_name: person?.last_name ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    title: person?.title ?? '',
    role: person?.role ?? (assignableRoles.includes('staff') ? 'staff' : assignableRoles[0]),
    department: person?.department ? String(person.department) : '',
    is_department_head: person?.is_department_head ?? false,
    head_of_department: person?.head_of_department ? String(person.head_of_department) : '',
    lodging: person?.lodging ?? '',
    room_number: person?.room_number ?? '',
    emergency_contact_name: person?.emergency_contact_name ?? '',
    emergency_contact_phone: person?.emergency_contact_phone ?? '',
    allergies: person?.allergies ?? '',
    food_allergies: person?.food_allergies ?? '',
    is_active_crew: person?.is_active_crew ?? true,
    password: '',
  }
}

export function StaffFormDialog({ person, departments, assignableRoles, onSaved, onClose }: StaffFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState(() => initialState(person, assignableRoles))
  const [newDepartment, setNewDepartment] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm({ ...form, [field]: value })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      let department: number | null = form.department ? Number(form.department) : null
      if (form.department === NEW_DEPARTMENT) {
        try {
          const created = await api<Department>('/departments/', {
            method: 'POST',
            body: JSON.stringify({ name: newDepartment }),
          })
          department = created.id
        } catch (err) {
          setErrors({ department: fieldErrors(err).name ?? 'Could not create the department.' })
          setSaving(false)
          return
        }
      }

      const { password, ...fields } = form
      const head_of_department =
        form.is_department_head && form.head_of_department ? Number(form.head_of_department) : null
      const body = { ...fields, department, head_of_department, ...(password ? { password } : {}) }
      const saved = await api<User>(person ? `/users/${person.id}/` : '/users/', {
        method: person ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length
          ? fields
          : { form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' },
      )
      setSaving(false)
    }
  }

  // Keep the person's current role selectable even if it's one the viewer can't assign.
  const roleOptions = person && !assignableRoles.includes(person.role) ? [person.role, ...assignableRoles] : assignableRoles

  const field = (name: keyof FormState, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="form__field">
      <span>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        value={form[name] as string}
        onChange={(event) => set(name, event.target.value)}
        aria-invalid={!!errors[name]}
        {...props}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  const allergyField = (name: 'allergies' | 'food_allergies', label: string, placeholder: string) => (
    <label className="form__field">
      <span>{label}</span>
      <textarea
        rows={2}
        value={form[name]}
        onChange={(event) => set(name, event.target.value)}
        aria-invalid={!!errors[name]}
        placeholder={placeholder}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="staff-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="staff-form-title">{person ? `Edit ${person.first_name}` : 'Add staff member'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}
        {(errors.non_field_errors || errors.detail) && (
          <p className="form__error" role="alert">
            {errors.non_field_errors || errors.detail}
          </p>
        )}

        <div className="form__grid">
          {field('first_name', 'First name', { required: true, autoComplete: 'off' })}
          {field('last_name', 'Last name', { autoComplete: 'off' })}
          {field('email', 'Email', { type: 'email', required: true, autoComplete: 'off' })}
          {field('phone', 'Phone', { type: 'tel', autoComplete: 'off' })}
          <div className="form__span">
            {field('title', 'Title', { autoComplete: 'off', placeholder: 'e.g. Executive Producer', maxLength: 150 })}
            <p className="form__hint form__hint--below">
              Their job on the production. The role below decides which pages they can open.
            </p>
          </div>

          <label className="form__field">
            <span>Role</span>
            <select value={form.role} onChange={(event) => set('role', event.target.value as Role)}>
              {roleOptions.map((role) => (
                <option key={role} value={role} disabled={!assignableRoles.includes(role)}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {errors.role && <small className="form__field-error">{errors.role}</small>}
          </label>

          <label className="form__field">
            <span>Department</span>
            <select value={form.department} onChange={(event) => set('department', event.target.value)}>
              <option value="">No department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
              <option value={NEW_DEPARTMENT}>+ New department…</option>
            </select>
            {form.department === NEW_DEPARTMENT && (
              <input
                className="form__subinput"
                value={newDepartment}
                onChange={(event) => setNewDepartment(event.target.value)}
                placeholder="Department name"
                aria-label="New department name"
                required
              />
            )}
            {errors.department && <small className="form__field-error">{errors.department}</small>}
          </label>

          <div className="form__field form__field--checkbox">
            <label className="form__check">
              <input
                type="checkbox"
                checked={form.is_department_head}
                onChange={(event) => set('is_department_head', event.target.checked)}
              />
              Department head
            </label>
          </div>
          {form.is_department_head ? (
            <label className="form__field">
              <span>Head of</span>
              <select
                value={form.head_of_department}
                onChange={(event) => set('head_of_department', event.target.value)}
              >
                <option value="">No department listed</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {errors.head_of_department && (
                <small className="form__field-error">{errors.head_of_department}</small>
              )}
            </label>
          ) : (
            <div aria-hidden="true" />
          )}

          {field('lodging', 'Lodging', { autoComplete: 'off', placeholder: 'e.g. the crew hotel' })}
          {field('room_number', 'Room number (optional)', { autoComplete: 'off', maxLength: 20 })}
          <div className="form__field form__field--checkbox">
            <label className="form__check">
              <input
                type="checkbox"
                checked={form.is_active_crew}
                onChange={(event) => set('is_active_crew', event.target.checked)}
              />
              On the active crew
            </label>
          </div>

          {field('emergency_contact_name', 'Emergency contact name', { autoComplete: 'off' })}
          {field('emergency_contact_phone', 'Emergency contact phone', { type: 'tel', autoComplete: 'off' })}

          {allergyField('allergies', 'General allergies', 'Medications, insects, latex, pollen…')}
          {allergyField('food_allergies', 'Food allergies', 'Peanuts, shellfish, gluten… (shared with Culinary)')}

          {!person && (
            <div className="form__span">
              {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
              <p className="form__hint form__hint--below">
                Leave blank to generate a temporary password you can share with them.
              </p>
            </div>
          )}
        </div>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : person ? 'Save changes' : 'Add staff member'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
