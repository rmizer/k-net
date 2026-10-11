import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { AuthScreen } from './AuthScreen'
import './signup.css'

/** Shown after signing up, and to anyone who tries to log in before verifying. */
export function CheckEmailPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [sending, setSending] = useState(false)

  const resend = async () => {
    setSending(true)
    setStatus(null)
    try {
      await api('/auth/resend-verification/', { method: 'POST', body: JSON.stringify({ email }) })
      setStatus({ kind: 'success', message: 'We sent a new link. It can take a minute or two to arrive, so check your spam folder too.' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not send the email.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthScreen title="Check your email">
      <div className="tile check-email">
        <p className="check-email__icon" aria-hidden="true">
          ✉
        </p>
        <p>
          We sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}. Open it to verify
          your email and finish setting up your account.
        </p>
        <div className="check-email__spam">
          <p>
            <strong>Not in your inbox? Check your spam or junk folder.</strong>
          </p>
          <p>
            K-Net emails sometimes end up there. If you find it, mark it as “Not spam” so future K-Net emails reach your
            inbox.
          </p>
        </div>
        <p className="check-email__hint">The link works for 3 days.</p>
        {status && (
          <p className={`notice notice--${status.kind}`} role="status">
            {status.message}
          </p>
        )}
        {email && (
          <button type="button" className="button button--secondary" onClick={resend} disabled={sending}>
            {sending ? 'Sending…' : 'Resend email'}
          </button>
        )}
      </div>
      <p className="login__alt">
        Wrong address? <Link to="/signup">Sign up again</Link> · <Link to="/login">Log in</Link>
      </p>
    </AuthScreen>
  )
}
