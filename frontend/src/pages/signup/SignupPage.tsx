import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../api'
import { useAuth } from '../../auth/useAuth'
import { AuthScreen } from './AuthScreen'
import { PASSWORD_RULES } from './passwordRules'
import './signup.css'

type Field = 'first_name' | 'last_name' | 'email' | 'phone' | 'password'

const EMPTY: Record<Field, string> = { first_name: '', last_name: '', email: '', phone: '', password: '' }

export function SignupPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  // Hidden from people; the server ignores sign-ups that fill it in (bots).
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (loading)
    return (
      <main className="login-screen">
        <p className="loading">Loading…</p>
      </main>
    )
  if (user) return <Navigate to="/" replace />

  const validate = () => {
    const found: Record<string, string> = {}
    if (!form.first_name.trim()) found.first_name = 'Enter your first name.'
    if (!form.last_name.trim()) found.last_name = 'Enter your last name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Enter a valid email address.'
    if (!form.phone.trim()) found.phone = 'Enter your phone number.'
    if (!PASSWORD_RULES.every((rule) => rule.test(form.password)))
      found.password = 'Your password doesn’t meet all of the rules below.'
    if (!acceptPrivacy) found.accept_privacy = 'Please check this box to continue.'
    return found
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      const { email } = await api<{ email: string }>('/auth/signup/', {
        method: 'POST',
        body: JSON.stringify({ ...form, accept_privacy: acceptPrivacy, website }),
      })
      navigate(`/check-email?email=${encodeURIComponent(email)}`)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length
          ? fields
          : { form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' },
      )
      setSubmitting(false)
    }
  }

  const field = (name: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>) => (
    <label className="form__field">
      <span>{label}</span>
      <input
        value={form[name]}
        onChange={(event) => {
          setForm({ ...form, [name]: event.target.value })
          if (errors[name]) setErrors({ ...errors, [name]: '' })
        }}
        required
        aria-invalid={!!errors[name]}
        {...props}
      />
      {errors[name] && <small className="form__field-error">{errors[name]}</small>}
    </label>
  )

  return (
    <AuthScreen title="Sign up" wide>
      <form className="tile form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="signup__row">
          {field('first_name', 'First name', { autoComplete: 'given-name', maxLength: 150 })}
          {field('last_name', 'Last name', { autoComplete: 'family-name', maxLength: 150 })}
        </div>
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('phone', 'Phone number', { type: 'tel', autoComplete: 'tel', maxLength: 30 })}
        {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
        <ul className="signup__rules" aria-label="Password rules">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(form.password)
            return (
              <li key={rule.label} className={met ? 'is-met' : undefined}>
                <span aria-hidden="true">{met ? '✓' : '•'}</span> {rule.label}
                <span className="visually-hidden">{met ? ' (done)' : ' (not yet)'}</span>
              </li>
            )
          })}
        </ul>

        <label className="signup__honeypot" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>

        <div>
          <label className="form__check signup__privacy">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(event) => {
                setAcceptPrivacy(event.target.checked)
                if (errors.accept_privacy) setErrors({ ...errors, accept_privacy: '' })
              }}
              aria-invalid={!!errors.accept_privacy}
            />
            I understand that my information in K-Net is kept private and won’t be shared with or sold to any third
            parties.
          </label>
          {errors.accept_privacy && <small className="form__field-error">{errors.accept_privacy}</small>}
        </div>

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Signing up…' : 'Sign up'}
        </button>
      </form>
      <p className="login__alt">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthScreen>
  )
}
