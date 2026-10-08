import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { isSiteManager, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { AuthScreen } from './AuthScreen'
import './signup.css'

/** The page the link in the verification email opens. It verifies the email,
 *  signs the person in and sends them to their dashboard. */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  // Each link works once, so only send the request once.
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    api<User>('/auth/verify-email/', {
      method: 'POST',
      body: JSON.stringify({ uid: params.get('uid') ?? '', token: params.get('token') ?? '' }),
    })
      .then((user) => {
        setUser(user)
        navigate(isSiteManager(user) ? '/site-manager' : '/', { replace: true })
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'))
  }, [params, setUser, navigate])

  return (
    <AuthScreen title="Verify email">
      <div className="tile check-email">
        {error ? (
          <>
            <p className="form__error" role="alert">
              {error}
            </p>
            <p>
              <Link to="/login">Log in</Link> if you’ve already verified, or <Link to="/signup">sign up again</Link>{' '}
              to get a new link.
            </p>
          </>
        ) : (
          <p className="loading">Verifying your email…</p>
        )}
      </div>
    </AuthScreen>
  )
}
