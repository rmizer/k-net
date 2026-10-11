import { useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../api'
import type { User } from '../auth/roles'
import { useAuth } from '../auth/useAuth'

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

/** Your login email on the Account page, and changing it: a link goes to the new
 *  address and the change happens when it's clicked. Once every two weeks. */
export function EmailChange({ user }: { user: User }) {
  const { setUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      setUser(await api<User>('/auth/me/email/', { method: 'POST', body: JSON.stringify({ email, password }) }))
      setOpen(false)
      setEmail('')
      setPassword('')
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length
          ? fields
          : { form: err instanceof ApiError ? err.message : 'Couldn’t send the link. Please try again.' },
      )
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      setUser(await api<User>('/auth/me/email/', { method: 'DELETE' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tile email-change">
      <p className="form__static">
        <span>Email</span>
        {user.email}
      </p>
      <p className="form__hint">You log in with this email, and it’s how Slack finds you.</p>

      {user.pending_email ? (
        <div className="notice email-change__pending" role="status">
          <p>
            We sent a link to <strong>{user.pending_email}</strong>. Your email changes when you open it. Check your
            spam folder if it isn’t there in a few minutes.
          </p>
          <button type="button" className="text-button" onClick={cancel} disabled={busy}>
            Cancel the change
          </button>
        </div>
      ) : user.next_email_change ? (
        <p className="muted">
          You can change your email once every two weeks. You can change it again on{' '}
          {longDate(user.next_email_change)}.
        </p>
      ) : open ? (
        <form className="form email-change__form" onSubmit={submit} noValidate>
          {errors.form && (
            <p className="form__error" role="alert">
              {errors.form}
            </p>
          )}
          <label className="form__field">
            <span>New email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              required
            />
            {errors.email && <small className="form__error">{errors.email}</small>}
          </label>
          <label className="form__field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              required
            />
            {errors.password && <small className="form__error">{errors.password}</small>}
          </label>
          <p className="form__hint">
            We’ll send a link to the new address to make sure it’s right. You can change your email once every two
            weeks.
          </p>
          <div className="inline-form__actions">
            <button type="submit" className="button" disabled={busy || !email || !password}>
              {busy ? 'Sending…' : 'Send link'}
            </button>
            <button type="button" className="button button--secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button button--secondary" onClick={() => setOpen(true)}>
          Change email
        </button>
      )}
    </div>
  )
}
