import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../api'
import type { User } from '../../auth/roles'
import { DualListBox } from '../../components/DualListBox'
import { fromLocalInput, toLocalInput } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { MeetingNote } from '../../types'
import { downloadMeetingPdf } from './meetingPdf'
import { NavIcon } from '../../components/NavIcon'
import '../shows/shows.css'
import './meetings.css'

const AUTOSAVE_MS = 30_000

/** New notes (/meeting-notes/new) or editing them (/meeting-notes/:id/edit). */
export function MeetingNoteFormPage() {
  const { id } = useParams()
  const location = useLocation()
  // Right after the first save, new notes move to their edit address carrying
  // what was saved, so the same form carries on without reloading.
  const handedOver = (location.state as { note?: MeetingNote } | null)?.note
  if (!id || handedOver) return <MeetingForm initial={handedOver ?? null} />
  return <EditMeetingNote id={id} />
}

function EditMeetingNote({ id }: { id: string }) {
  const note = useFetch<MeetingNote>(`/meeting-notes/${id}/`)
  if (note.data) return <MeetingForm initial={note.data} />
  if (note.loading) return <p className="loading">Loading meeting notes…</p>
  return (
    <section>
      <h1>Meeting notes not found</h1>
      <Link to="/meeting-notes">Back to Meeting Notes</Link>
    </section>
  )
}

interface FormState {
  title: string
  meeting_at: string
  attendees: number[]
  notes: string
}

const snapshot = (form: FormState) => JSON.stringify({ ...form, attendees: [...form.attendees].sort((a, b) => a - b) })

function MeetingForm({ initial }: { initial: MeetingNote | null }) {
  const navigate = useNavigate()
  const people = useFetch<User[]>('/users/')
  const [form, setForm] = useState<FormState>(() => ({
    title: initial?.title ?? '',
    meeting_at: initial ? toLocalInput(initial.meeting_at) : toLocalInput(new Date().toISOString()),
    attendees: initial?.attendees ?? [],
    notes: initial?.notes ?? '',
  }))
  const [savedId, setSavedId] = useState(initial?.id ?? null)
  // What was last saved (for new notes, the blank form, so it isn't autosaved empty).
  const [savedAs, setSavedAs] = useState(() => snapshot(form))
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = snapshot(form) !== savedAs

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }))

  /** Saves the form as it is now; returns the saved notes, or null if it couldn't. */
  const save = useCallback(async (): Promise<MeetingNote | null> => {
    const meetingAt = fromLocalInput(form.meeting_at)
    if (!meetingAt) {
      setErrors({ meeting_at: 'Pick the meeting date and time.' })
      return null
    }
    setSaving(true)
    setErrors({})
    const sent = snapshot(form)
    try {
      const saved = await api<MeetingNote>(savedId ? `/meeting-notes/${savedId}/` : '/meeting-notes/', {
        method: savedId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, meeting_at: meetingAt }),
      })
      setSavedAs(sent)
      setSavedAt(new Date())
      if (!savedId) {
        setSavedId(saved.id)
        navigate(`/meeting-notes/${saved.id}/edit`, { replace: true, state: { note: saved } })
      }
      return saved
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Couldn’t save. Check your connection.' },
      )
      return null
    } finally {
      setSaving(false)
    }
  }, [form, savedId, navigate])

  // Autosave every 30 seconds while there are changes.
  const autosave = useRef<() => void>(() => {})
  useEffect(() => {
    autosave.current = () => {
      if (dirty && !saving) void save()
    }
  }, [dirty, saving, save])
  useEffect(() => {
    const timer = window.setInterval(() => autosave.current(), AUTOSAVE_MS)
    return () => window.clearInterval(timer)
  }, [])

  // Warn before leaving the page with changes that haven't been saved yet.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveAndDownload = async () => {
    const saved = await save()
    if (saved) await downloadMeetingPdf(saved)
  }

  const saveAndClose = async () => {
    if (await save()) navigate('/meeting-notes')
  }

  const options = (people.data ?? [])
    .map((person) => ({
      id: person.id,
      label: `${person.first_name} ${person.last_name}`.trim() + (person.title ? ` (${person.title})` : ''),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const status = saving
    ? 'Saving…'
    : dirty
      ? 'Unsaved changes'
      : savedAt
        ? `Saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : savedId
          ? 'All changes saved'
          : ''

  return (
    <section className="meetings">
      <p className="meetings__breadcrumb">
        <Link to={savedId ? `/meeting-notes/${savedId}` : '/meeting-notes'}>
          ← {savedId ? 'Back to these notes' : 'Meeting Notes'}
        </Link>
      </p>
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="notes" />
            {initial ? 'Edit meeting notes' : 'New meeting notes'}
          </h1>
          <p className="subtitle">Saves automatically every 30 seconds while you type.</p>
        </div>
      </div>

      <form className="form tile meeting-form" onSubmit={(event) => event.preventDefault()} noValidate>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <div className="form__grid">
          <label className="form__field">
            <span>Meeting</span>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Production meeting (optional)"
              maxLength={200}
              autoComplete="off"
            />
            {errors.title && <small className="form__field-error">{errors.title}</small>}
          </label>
          <label className="form__field">
            <span>
              Meeting date / time<span aria-hidden="true"> *</span>
            </span>
            <input
              type="datetime-local"
              value={form.meeting_at}
              onChange={(e) => set('meeting_at', e.target.value)}
              aria-invalid={!!errors.meeting_at}
              required
            />
            {errors.meeting_at && <small className="form__field-error">{errors.meeting_at}</small>}
          </label>
        </div>

        {people.loading && !people.data ? (
          <p className="loading">Loading people…</p>
        ) : (
          <DualListBox
            label="Attendants"
            availableLabel="Staff and crew"
            chosenLabel="At the meeting"
            options={options}
            value={initial?.attendees ?? []}
            onChange={(ids) => set('attendees', ids)}
            error={errors.attendees}
          />
        )}

        <label className="form__field">
          <span>Notes</span>
          <textarea
            className="meeting-form__notes"
            rows={18}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="What was discussed, decisions, action items…"
          />
          {errors.notes && <small className="form__field-error">{errors.notes}</small>}
        </label>

        <div className="meeting-form__footer">
          <div className="inline-form__actions">
            <button type="button" className="button" onClick={() => void save()} disabled={saving}>
              Save
            </button>
            <button type="button" className="button button--secondary" onClick={saveAndDownload} disabled={saving}>
              Download PDF
            </button>
            <button type="button" className="button button--secondary" onClick={saveAndClose} disabled={saving}>
              Save and close
            </button>
          </div>
          <span className="meeting-form__status" role="status">
            {status}
          </span>
        </div>
      </form>
    </section>
  )
}
