import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import type { User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { AuthScreen } from './AuthScreen'
import './signup.css'

/** The page the link in the email-change email opens. It confirms the new
 *  address; it works on any device and doesn't sign anyone in. */
export function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const { user, setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  // Each link works once, so only send the request once.
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    api<{ email: string }>('/auth/confirm-email/', {
      method: 'POST',
      body: JSON.stringify({ uid: params.get('uid') ?? '', token: params.get('token') ?? '' }),
    })
      .then(async (result) => {
        setEmail(result.email)
        // Signed in on this device? Show the new address everywhere straight away.
        const me = await api<User | null>('/auth/me/').catch(() => null)
        if (me) setUser(me)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'))
  }, [params, setUser])

  const next = user ? (
    <Link to="/account" className="button">
      Back to your account
    </Link>
  ) : (
    <Link to="/login" className="button">
      Log in
    </Link>
  )

  return (
    <AuthScreen title="Confirm email">
      <div className="tile check-email">
        {error ? (
          <>
            <p className="form__error" role="alert">
              {error}
            </p>
            <p>{next}</p>
          </>
        ) : email ? (
          <>
            <p>
              Your K-Net email is now <strong>{email}</strong>. Use it to log in from now on.
            </p>
            <p>{next}</p>
          </>
        ) : (
          <p className="loading">Confirming your new email…</p>
        )}
      </div>
    </AuthScreen>
  )
}
