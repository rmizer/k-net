import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { DOCUMENT_CATEGORIES, type DocumentCategory, type ProjectDocument } from '../../types'

/** Categories that usually carry an expiration date. */
export const EXPIRING_CATEGORIES: DocumentCategory[] = ['insurance', 'permit', 'contract', 'vehicle']

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt'

interface DocumentFormDialogProps {
  /** The document being edited, or null to upload a new one. */
  document: ProjectDocument | null
  /** Category for a new upload. */
  initialCategory: DocumentCategory
  /** Managers can file any category; everyone else files receipts. */
  canChooseCategory: boolean
  onSaved: (saved: ProjectDocument) => void
  onClose: () => void
}

export function DocumentFormDialog(props: DocumentFormDialogProps) {
  const { document, initialCategory, canChooseCategory, onSaved, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: document?.title ?? '',
    category: document?.category ?? initialCategory,
    vendor: document?.vendor ?? '',
    amount: document?.amount ?? '',
    purchase_date: document?.purchase_date ?? '',
    expires_on: document?.expires_on ?? '',
    notes: document?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })
  const receipt = form.category === 'receipt'
  const expiring = EXPIRING_CATEGORIES.includes(form.category)

  const chooseFile = (chosen: File | null) => {
    setFile(chosen)
    // Name the document after the file unless a name was already typed.
    if (chosen && !form.title) set('title', chosen.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!document && !file) {
      setErrors({ file: 'Choose a file to upload.' })
      return
    }
    setSaving(true)
    setErrors({})
    const body = new FormData()
    body.append('title', form.title)
    body.append('category', form.category)
    body.append('notes', form.notes)
    body.append('expires_on', expiring ? form.expires_on : '')
    body.append('vendor', receipt ? form.vendor : '')
    body.append('amount', receipt ? form.amount : '')
    body.append('purchase_date', receipt ? form.purchase_date : '')
    if (file) body.append('file', file)
    try {
      const saved = await api<ProjectDocument>(document ? `/documents/${document.id}/` : '/documents/', {
        method: document ? 'PATCH' : 'POST',
        body,
      })
      onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>
  const heading = document ? `Edit ${document.title}` : receipt ? 'Submit a receipt' : 'Upload a document'

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="document-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="document-form-title">{heading}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="form__field">
          <span>
            {document ? 'Replace file' : 'File'}
            {!document && <span aria-hidden="true"> *</span>}
          </span>
          <input
            type="file"
            accept={ACCEPT}
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            aria-invalid={!!errors.file}
            required={!document}
          />
          {document && !file && <small className="form__hint">Current file: {document.file_name}</small>}
          {receipt && !document && <small className="form__hint">A photo of the receipt is fine.</small>}
          {error('file')}
        </label>

        <div className="form__grid">
          <label className={`form__field${canChooseCategory ? '' : ' form__span'}`}>
            <span>
              Name<span aria-hidden="true"> *</span>
            </span>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={receipt ? 'e.g. Gaff tape for Stage B' : 'e.g. Film Tampa Bay permit'}
              aria-invalid={!!errors.title}
              autoComplete="off"
              required
            />
            {error('title')}
          </label>
          {canChooseCategory && (
            <label className="form__field">
              <span>Type</span>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {receipt && (
            <>
              <label className="form__field">
                <span>
                  Amount<span aria-hidden="true"> *</span>
                </span>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  aria-invalid={!!errors.amount}
                  required
                />
                {error('amount')}
              </label>
              <label className="form__field">
                <span>Date of purchase</span>
                <input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
                {error('purchase_date')}
              </label>
              <label className="form__field form__span">
                <span>Store or vendor</span>
                <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} autoComplete="off" />
              </label>
            </>
          )}

          {expiring && (
            <label className="form__field">
              <span>Expires</span>
              <input type="date" value={form.expires_on} onChange={(e) => set('expires_on', e.target.value)} />
              {error('expires_on')}
            </label>
          )}
        </div>

        <label className="form__field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={receipt ? 'What it was for' : ''}
          />
        </label>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : document ? 'Save changes' : receipt ? 'Submit receipt' : 'Upload'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
