import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth/useAuth'
import { isSiteManager } from '../auth/roles'
import { PasswordToggle } from '../components/PasswordToggle'
import wordmark from '../assets/brand/knet-wordmark.png'
import './signup/signup.css'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from

  if (loading)
    return (
      <main className="login-screen">
        <p className="loading">Loading…</p>
      </main>
    )
  if (user) return <Navigate to={from ?? '/'} replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const signedIn = await login(email, password, remember)
      // Site Managers land on their own dashboard.
      navigate(from ?? (isSiteManager(signedIn) ? '/site-manager' : '/'), { replace: true })
    } catch (err) {
      if (err instanceof ApiError && (err.data as { code?: string } | null)?.code === 'email_unverified') {
        navigate(`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
        return
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login">
        <img src={wordmark} alt="K-Net: K Network Project Center" className="login__logo" width={900} height={286} />
        <h1>Log in</h1>
        <form className="tile form" onSubmit={handleSubmit} noValidate>
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <label className="form__field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="form__field">
            <span>Password</span>
            <span className="password-box">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            </span>
          </label>
          <label className="form__check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Keep me logged in on this device for 14 days
          </label>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="login__new">
          <p className="login__new-title">New to K-Net?</p>
          <p className="login__new-text">Sign up with your own email to join the trial.</p>
          <Link to="/signup" className="button login__new-button">
            Create an account
          </Link>
        </div>
        <p className="login__investors">
          Investor? <Link to="/for-investors">See the investor page and costs</Link>, no login needed.
        </p>
      </section>
    </main>
  )
}
