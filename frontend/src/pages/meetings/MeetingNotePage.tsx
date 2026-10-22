import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { formatDateTime } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { MeetingNote } from '../../types'
import { downloadMeetingPdf, meetingTitle, meetingWhen } from './meetingPdf'
import { NavIcon } from '../../components/NavIcon'
import './meetings.css'

/** One meeting's notes, read-only, with Edit and Download PDF. */
export function MeetingNotePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const note = useFetch<MeetingNote>(`/meeting-notes/${id}/`)

  if (note.loading && !note.data) return <p className="loading">Loading meeting notes…</p>
  if (!note.data) {
    return (
      <section>
        <h1>Meeting notes not found</h1>
        <Link to="/meeting-notes">Back to Meeting Notes</Link>
      </section>
    )
  }
  const data = note.data

  const remove = async () => {
    if (!window.confirm(`Delete the notes from “${meetingTitle(data)}”? This can’t be undone.`)) return
    await api(`/meeting-notes/${data.id}/`, { method: 'DELETE' })
    navigate('/meeting-notes')
  }

  return (
    <section className="meetings">
      <p className="meetings__breadcrumb">
        <Link to="/meeting-notes">← Meeting Notes</Link>
      </p>
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="notes" />
            {meetingTitle(data)}
          </h1>
          <p className="subtitle">{meetingWhen(data.meeting_at)}</p>
        </div>
        <div className="meetings__actions">
          <button type="button" className="button button--secondary" onClick={() => void downloadMeetingPdf(data)}>
            Download PDF
          </button>
          <Link to={`/meeting-notes/${data.id}/edit`} className="button">
            Edit
          </Link>
        </div>
      </div>

      <article className="tile meeting-note">
        <dl className="meeting-note__details">
          <div>
            <dt>Attendees ({data.attendee_names.length})</dt>
            <dd>
              {data.attendee_names.length ? data.attendee_names.join(', ') : <span className="muted">None listed</span>}
            </dd>
          </div>
          <div>
            <dt>Taken by</dt>
            <dd>{data.created_by_name ?? <span className="muted">—</span>}</dd>
          </div>
          <div>
            <dt>Last saved</dt>
            <dd>
              {formatDateTime(data.updated_at)}
              {data.updated_by_name && ` by ${data.updated_by_name}`}
            </dd>
          </div>
        </dl>
        <h2 className="meeting-note__heading">Notes</h2>
        {data.notes.trim() ? (
          <p className="meeting-note__notes">{data.notes}</p>
        ) : (
          <p className="muted">No notes yet.</p>
        )}
      </article>

      <p className="meetings__delete">
        <button type="button" className="text-button" onClick={remove}>
          Delete these notes
        </button>
      </p>
    </section>
  )
}
