import { useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { useAuth } from '../../auth/useAuth'
import { NavIcon } from '../../components/NavIcon'
import './contact.css'

type Kind = 'bug' | 'feature' | 'question' | 'feedback'

const KINDS: { value: Kind; label: string; noun: string; hint: string; messageLabel: string; placeholder: string }[] = [
  {
    value: 'bug',
    label: 'Report a bug',
    noun: 'bug report',
    hint: 'Something is broken or not working right',
    messageLabel: 'What happened?',
    placeholder: 'What were you doing, and what went wrong? Steps to make it happen again help a lot.',
  },
  {
    value: 'feature',
    label: 'Request a feature',
    noun: 'feature request',
    hint: 'An idea for something K-Net should do',
    messageLabel: 'What would you like K-Net to do?',
    placeholder: 'Describe the feature and how it would help you or the crew.',
  },
  {
    value: 'question',
    label: 'Ask for help',
    noun: 'question',
    hint: 'A tech support question about using K-Net',
    messageLabel: 'Your question',
    placeholder: 'What are you trying to do?',
  },
  {
    value: 'feedback',
    label: 'Give feedback',
    noun: 'feedback',
    hint: 'What you like, what you don’t, anything else',
    messageLabel: 'Your feedback',
    placeholder: 'Tell us what you think.',
  },
]

const EMPTY = { subject: '', message: '', page: '', expected: '' }

export function ContactPage() {
  const { user } = useAuth()
  const [kind, setKind] = useState<Kind>('bug')
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ id: number; kind: Kind } | null>(null)
  const current = KINDS.find((k) => k.value === kind)!

  const set = (field: keyof typeof EMPTY, value: string) => {
    setForm({ ...form, [field]: value })
    if (errors[field]) setErrors({ ...errors, [field]: '' })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (!form.subject.trim()) found.subject = 'Add a short subject.'
    if (!form.message.trim()) found.message = 'Tell us a bit more.'
    setErrors(found)
    if (Object.keys(found).length) return
    setSending(true)
    try {
      const body = kind === 'bug' ? form : { subject: form.subject, message: form.message }
      const saved = await api<{ id: number }>('/support/', {
        method: 'POST',
        body: JSON.stringify({ kind, ...body }),
      })
      setSent({ id: saved.id, kind })
      setForm(EMPTY)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length
          ? fields
          : { form: err instanceof ApiError ? err.message : 'Could not send your message. Please try again.' },
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    const { noun } = KINDS.find((k) => k.value === sent.kind)!
    return (
      <section className="contact">
        <h1>
          <NavIcon name="mail" />
          Contact
        </h1>
        <div className="tile contact__sent" role="status">
          <p className="contact__sent-icon" aria-hidden="true">
            ✓
          </p>
          <h2>Thanks, we’ve got it</h2>
          <p>
            Your {noun} is #{sent.id}. We’ll reply to <strong>{user?.email}</strong> if we need more details or when
            there’s an answer.
          </p>
          <button type="button" className="button button--secondary" onClick={() => setSent(null)}>
            Send something else
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="contact">
      <h1>
        <NavIcon name="mail" />
        Contact
      </h1>
      <p className="subtitle">Report a bug, request a feature, ask for help or send feedback</p>

      <form className="tile form contact__form" onSubmit={handleSubmit} noValidate>
        <fieldset className="form__fieldset">
          <legend>What’s this about?</legend>
          <div className="contact__kinds">
            {KINDS.map((option) => (
              <label key={option.value} className={`contact__kind${kind === option.value ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="kind"
                  value={option.value}
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                />
                <span className="contact__kind-label">{option.label}</span>
                <span className="contact__kind-hint">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="form__field">
          <span>Subject</span>
          <input
            value={form.subject}
            onChange={(event) => set('subject', event.target.value)}
            maxLength={150}
            required
            aria-invalid={!!errors.subject}
          />
          {errors.subject && <small className="form__field-error">{errors.subject}</small>}
        </label>

        <label className="form__field">
          <span>{current.messageLabel}</span>
          <textarea
            value={form.message}
            onChange={(event) => set('message', event.target.value)}
            rows={6}
            placeholder={current.placeholder}
            required
            aria-invalid={!!errors.message}
          />
          {errors.message && <small className="form__field-error">{errors.message}</small>}
        </label>

        {kind === 'bug' && (
          <>
            <label className="form__field">
              <span>Where did it happen? (optional)</span>
              <input
                value={form.page}
                onChange={(event) => set('page', event.target.value)}
                maxLength={255}
                placeholder="e.g. Schedule, month view"
              />
            </label>
            <label className="form__field">
              <span>What did you expect to happen? (optional)</span>
              <textarea value={form.expected} onChange={(event) => set('expected', event.target.value)} rows={3} />
            </label>
          </>
        )}

        <p className="contact__note">
          Sent to K-Net support from {user?.email}, along with your name, role and browser type so we can follow up.
        </p>
        <button type="submit" className="button" disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  )
}
