import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SortHeader, useSort } from '../../components/sorting'
import { formatDateTime, toLocalInput } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { MeetingNote } from '../../types'
import { meetingTitle } from './meetingPdf'
import { NavIcon } from '../../components/NavIcon'
import '../finance/finance.css'
import './meetings.css'

type SortKey = 'when' | 'title' | 'attendees' | 'taken_by' | 'updated'

/** Every meeting's notes, newest first: Site Managers, Directors and Assistants. */
export function MeetingNotesPage() {
  const navigate = useNavigate()
  const notes = useFetch<MeetingNote[]>('/meeting-notes/')
  const [search, setSearch] = useState('')
  const [attendee, setAttendee] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const sort = useSort<SortKey>('when', true)

  const all = useMemo(() => notes.data ?? [], [notes.data])
  const people = useMemo(() => [...new Set(all.flatMap((note) => note.attendee_names))].sort(), [all])
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter((note) => {
      const day = toLocalInput(note.meeting_at).slice(0, 10)
      return (
        (!query ||
          [note.title, note.notes, note.created_by_name ?? '', ...note.attendee_names]
            .join(' ')
            .toLowerCase()
            .includes(query)) &&
        (!attendee || note.attendee_names.includes(attendee)) &&
        (!from || day >= from) &&
        (!to || day <= to)
      )
    }),
    (note, key) =>
      ({
        when: note.meeting_at,
        title: meetingTitle(note).toLowerCase(),
        attendees: note.attendees.length,
        taken_by: note.created_by_name?.toLowerCase(),
        updated: note.updated_at,
      })[key],
  )
  const filtered = !!(query || attendee || from || to)
  const clear = () => {
    setSearch('')
    setAttendee('')
    setFrom('')
    setTo('')
  }

  return (
    <section className="meetings finance">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="notes" />
            Meeting Notes
          </h1>
          <p className="subtitle">Minutes from production meetings{notes.data ? ` · ${all.length} meeting${all.length === 1 ? '' : 's'}` : ''}</p>
        </div>
        <Link to="/meeting-notes/new" className="button">
          + New notes
        </Link>
      </div>

      <div className="fin-filters meeting-filters" role="search">
        <label className="form__field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Meeting, notes or people"
          />
        </label>
        <label className="form__field">
          <span>Attendee</span>
          <select value={attendee} onChange={(e) => setAttendee(e.target.value)}>
            <option value="">Anyone</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="form__field">
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {notes.loading && !notes.data && <p className="loading">Loading meeting notes…</p>}
      {notes.error && !notes.data && <p className="form__error">Couldn’t load the meeting notes.</p>}

      {notes.data && (
        <div className="tile meetings__table">
          {visible.length === 0 ? (
            <p className="muted">
              {all.length ? 'No meetings match those filters.' : 'No meeting notes yet. Start with + New notes.'}
              {all.length > 0 && filtered && (
                <>
                  {' '}
                  <button type="button" className="text-button" onClick={clear}>
                    Show all
                  </button>
                </>
              )}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <SortHeader sort={sort} column="when">
                      Date / time
                    </SortHeader>
                    <SortHeader sort={sort} column="title">
                      Meeting
                    </SortHeader>
                    <SortHeader sort={sort} column="attendees">
                      Attendees
                    </SortHeader>
                    <SortHeader sort={sort} column="taken_by">
                      Taken by
                    </SortHeader>
                    <SortHeader sort={sort} column="updated">
                      Last saved
                    </SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((note) => (
                    <tr key={note.id} className="meetings__row" onClick={() => navigate(`/meeting-notes/${note.id}`)}>
                      <td data-label="Date / time">{formatDateTime(note.meeting_at)}</td>
                      <td data-label="Meeting">
                        <Link
                          to={`/meeting-notes/${note.id}`}
                          className="fin-person-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {meetingTitle(note)}
                        </Link>
                        {note.notes && <span className="fin-sub meetings__preview">{note.notes}</span>}
                      </td>
                      <td data-label="Attendees" title={note.attendee_names.join(', ')}>
                        {note.attendees.length || <span className="muted">—</span>}
                      </td>
                      <td data-label="Taken by">{note.created_by_name ?? <span className="muted">—</span>}</td>
                      <td data-label="Last saved">
                        {formatDateTime(note.updated_at)}
                        {note.updated_by_name && <span className="fin-sub">{note.updated_by_name}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
