import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import type { Department } from '../../types'

interface NewDepartmentDialogProps {
  onCreated: (department: Department) => void
  onClose: () => void
}

/** Adds a department from the Director Dashboard; the Departments page does the rest. */
export function NewDepartmentDialog({ onCreated, onClose }: NewDepartmentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      onCreated(await api<Department>('/departments/', { method: 'POST', body: JSON.stringify({ name }) }))
    } catch (err) {
      setError(fieldErrors(err).name ?? (err instanceof ApiError ? err.message : 'Could not add the department.'))
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="new-department-title">
      <form className="form" onSubmit={submit}>
        <div className="dialog__header">
          <h2 id="new-department-title">New department</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <label className="form__field">
          <span>Department name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Camera, Wardrobe, Catering"
            maxLength={100}
            required
            autoFocus
          />
        </label>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add department'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
