import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'

interface RequestRemovalDialogProps {
  person: { id: number; name: string }
  onSent: (message: string) => void
  onClose: () => void
}

/** Directors and Assistants ask the Site Managers to remove someone; only Site
 *  Managers can delete accounts. */
export function RequestRemovalDialog({ person, onSent, onClose }: RequestRemovalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const { name } = person

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await api(`/users/${person.id}/request-removal/`, { method: 'POST', body: JSON.stringify({ reason }) })
      onSent(`Removal requested for ${name}. A Site Manager will review it.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t send the request.')
      setSending(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="removal-title">
      <form className="form" onSubmit={submit}>
        <div className="dialog__header">
          <h2 id="removal-title">Request removal</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p>
          Only Site Managers can delete accounts. This asks them to remove <strong>{name}</strong> from K-Net; they’ll
          get an email and see it on their dashboard.
        </p>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <label className="form__field">
          <span>Reason (optional)</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            placeholder="e.g. Left the production on Oct 12"
          />
        </label>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={sending}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
