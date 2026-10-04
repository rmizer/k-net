import { useState, type ChangeEvent, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth/useAuth'
import type { User } from '../auth/roles'
import { initials } from '../format'

const EDITABLE_FIELDS = [
  { name: 'first_name', label: 'First name', type: 'text', autoComplete: 'given-name' },
  { name: 'last_name', label: 'Last name', type: 'text', autoComplete: 'family-name' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  { name: 'emergency_contact_name', label: 'Emergency contact name', type: 'text', autoComplete: 'off' },
  { name: 'emergency_contact_phone', label: 'Emergency contact phone', type: 'tel', autoComplete: 'off' },
] as const

type EditableField = (typeof EDITABLE_FIELDS)[number]['name']

export function AccountPage() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState<Record<EditableField, string>>(() =>
    Object.fromEntries(EDITABLE_FIELDS.map(({ name }) => [name, user?.[name] ?? ''])) as Record<
      EditableField,
      string
    >,
  )
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      setUser(await api<User>('/auth/me/', { method: 'PATCH', body: JSON.stringify(form) }))
      setStatus({ kind: 'success', message: 'Your account has been updated.' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not save changes.' })
    } finally {
      setSaving(false)
    }
  }

  const handlePicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const body = new FormData()
    body.append('profile_picture', file)
    setStatus(null)
    try {
      setUser(await api<User>('/auth/me/picture/', { method: 'POST', body }))
      setStatus({ kind: 'success', message: 'Profile picture updated.' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : 'Upload failed.' })
    }
    event.target.value = ''
  }


  return (
    <section>
      <h1>Account</h1>
      <p className="subtitle">
        {user.role_display}
        {user.department_name ? ` · ${user.department_name}` : ''}
      </p>

      {status && (
        <p className={`notice notice--${status.kind}`} role="status">
          {status.message}
        </p>
      )}

      <div className="account">
        <div className="tile account__picture">
          {user.profile_picture ? (
            <img src={user.profile_picture} alt="" className="avatar avatar--large" />
          ) : (
            <span className="avatar avatar--large avatar--initials" aria-hidden="true">
              {initials(user.first_name, user.last_name)}
            </span>
          )}
          <label className="button button--secondary">
            Upload picture
            <input type="file" accept="image/*" className="visually-hidden" onChange={handlePicture} />
          </label>
        </div>

        <form className="tile form account__details" onSubmit={handleSave}>
          <p className="form__static">
            <span>Email</span>
            {user.email}
          </p>
          {EDITABLE_FIELDS.map((field) => (
            <label key={field.name} className="form__field">
              <span>{field.label}</span>
              <input
                type={field.type}
                autoComplete={field.autoComplete}
                value={form[field.name]}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
              />
            </label>
          ))}
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </section>
  )
}
