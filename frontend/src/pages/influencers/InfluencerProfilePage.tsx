import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { formatDateTime, initials, profileUrl } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Influencer, InfluencerNote, TravelArrangement } from '../../types'
import { InfluencerFormDialog } from './InfluencerFormDialog'
import { TravelFormDialog } from './TravelFormDialog'
import { NavIcon } from '../../components/NavIcon'
import './influencers.css'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="profile-field">
      <dt>{label}</dt>
      <dd>{children || <span className="muted">—</span>}</dd>
    </div>
  )
}

const tel = (value: string) =>
  value ? (
    <a className="contact-link" href={`tel:${value}`}>
      {value}
    </a>
  ) : null
const mail = (value: string) =>
  value ? (
    <a className="contact-link" href={`mailto:${value}`}>
      {value}
    </a>
  ) : null

export function InfluencerProfilePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const profile = useFetch<Influencer>(`/influencers/${id}/`)
  const [editing, setEditing] = useState(false)
  const [travelDialog, setTravelDialog] = useState<TravelArrangement | null | undefined>(undefined)
  const [photoError, setPhotoError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const manager = isManagerLevel(user)

  if (profile.loading && !profile.data) return <p className="loading">Loading profile…</p>
  if (!profile.data) {
    return (
      <section>
        <h1>Influencer not found</h1>
        <Link to="/influencers">Back to the roster</Link>
      </section>
    )
  }

  const influencer = profile.data
  const link = profileUrl(influencer.platform, influencer.handle)

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const body = new FormData()
    body.append('photo', file)
    setPhotoError('')
    try {
      await api(`/influencers/${influencer.id}/photo/`, { method: 'POST', body })
      profile.reload()
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Upload failed.')
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove ${influencer.name} from the roster? Their notes and travel will be deleted too.`)) return
    await api(`/influencers/${influencer.id}/`, { method: 'DELETE' })
    navigate('/influencers')
  }

  const removeTravel = async (travel: TravelArrangement) => {
    if (!window.confirm('Remove this travel arrangement?')) return
    await api(`/influencer-travel/${travel.id}/`, { method: 'DELETE' })
    profile.reload()
  }

  return (
    <section className="influencer-profile">
      <p className="breadcrumb">
        <Link to="/influencers">← Influencer Roster</Link>
      </p>

      <header className="tile profile-header">
        <div className="profile-header__photo">
          {influencer.photo ? (
            <img src={influencer.photo} alt="" />
          ) : (
            <span className="influencer-card__initials" aria-hidden="true">
              {initials(influencer.name)}
            </span>
          )}
        </div>
        <div className="profile-header__text">
          <h1>
            <NavIcon name="star" />
            {influencer.name}
          </h1>
          <p className="profile-header__handle">
            {influencer.handle &&
              (link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="contact-link">
                  @{influencer.handle} ↗
                </a>
              ) : (
                <span>@{influencer.handle}</span>
              ))}
            {influencer.platform_display && <span className="muted"> · {influencer.platform_display}</span>}
          </p>
          {influencer.show_name && (
            <p className="profile-header__show">
              {influencer.show_name}
              {influencer.season != null && ` · Season ${influencer.season}`}
              {influencer.week != null && ` · Week ${influencer.week}`}
            </p>
          )}
          {photoError && <p className="form__error">{photoError}</p>}
        </div>
        {manager && (
          <div className="profile-header__actions">
            <button type="button" className="button" onClick={() => setEditing(true)}>
              Edit profile
            </button>
            <button type="button" className="button button--secondary" onClick={() => photoInput.current?.click()}>
              {influencer.photo ? 'Change photo' : 'Add photo'}
            </button>
            <input ref={photoInput} type="file" accept="image/*" className="visually-hidden" onChange={uploadPhoto} />
            <button type="button" className="text-button" onClick={remove}>
              Remove from roster
            </button>
          </div>
        )}
      </header>

      <div className="profile-grid">
        <section className="tile profile-section" aria-labelledby="contact-heading">
          <h2 id="contact-heading">Contact</h2>
          <dl>
            <Field label="Phone">{tel(influencer.phone)}</Field>
            <Field label="Email">{mail(influencer.email)}</Field>
            <Field label="Address">{influencer.address}</Field>
          </dl>
        </section>

        <section className="tile profile-section" aria-labelledby="agent-heading">
          <h2 id="agent-heading">Agent or contact</h2>
          <dl>
            <Field label="Name">{influencer.agent_name}</Field>
            <Field label="Phone">{tel(influencer.agent_phone)}</Field>
            <Field label="Email">{mail(influencer.agent_email)}</Field>
          </dl>
        </section>

        <NeedsSection id="travel-needs" title="Travel needs" text={influencer.travel_needs} />
        <NeedsSection id="lodging-needs" title="Lodging needs" text={influencer.lodging_needs} />

        <section className="tile profile-section" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading">Upcoming schedule</h2>
          {influencer.upcoming_events.length === 0 ? (
            <p className="muted">Nothing scheduled.</p>
          ) : (
            <ul className="profile-list">
              {influencer.upcoming_events.map((event) => (
                <li key={event.id}>
                  <Link to={`/schedule?event=${event.id}`}>{event.title}</Link>
                  <span className="muted">
                    {' '}
                    · {event.all_day ? 'All day' : formatDateTime(event.start)}
                    {event.location ? ` · ${event.location}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <NeedsSection id="other-needs" title="Other needs" text={influencer.needs} />
        <NeedsSection id="allergies" title="General allergies" text={influencer.allergies} />
        <NeedsSection id="food-allergies" title="Food allergies" text={influencer.food_allergies} />

        <section className="tile profile-section profile-section--wide" aria-labelledby="travel-heading">
          <div className="profile-section__header">
            <h2 id="travel-heading">Travel &amp; lodging bookings</h2>
            {manager && (
              <button type="button" className="text-button" onClick={() => setTravelDialog(null)}>
                + Add travel
              </button>
            )}
          </div>
          {influencer.travel.length === 0 ? (
            <p className="muted">Nothing booked yet.</p>
          ) : (
            <ul className="travel-list">
              {influencer.travel.map((travel) => (
                <li key={travel.id} className="travel-item">
                  <div className="travel-item__head">
                    <span className="badge badge--muted">{travel.kind_display}</span>
                    <strong>{[travel.provider, travel.reference].filter(Boolean).join(' ') || travel.kind_display}</strong>
                    {manager && (
                      <span className="row-actions">
                        <button type="button" className="text-button" onClick={() => setTravelDialog(travel)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => removeTravel(travel)}
                          aria-label="Remove travel arrangement"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                  {(travel.depart_location || travel.arrive_location) && (
                    <p>
                      {travel.depart_location || '?'} → {travel.arrive_location || '?'}
                    </p>
                  )}
                  <p className="muted">
                    {travel.starts_at && `${travel.kind === 'hotel' ? 'Check-in' : 'Departs'} ${formatDateTime(travel.starts_at)}`}
                    {travel.starts_at && travel.ends_at && ' · '}
                    {travel.ends_at && `${travel.kind === 'hotel' ? 'Check-out' : 'Arrives'} ${formatDateTime(travel.ends_at)}`}
                  </p>
                  {travel.confirmation && <p>Confirmation: {travel.confirmation}</p>}
                  {travel.notes && <p className="muted">{travel.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <NotesSection
          influencerId={influencer.id}
          notes={influencer.notes}
          canEdit={manager}
          onChange={profile.reload}
        />
      </div>

      {editing && (
        <InfluencerFormDialog
          influencer={influencer}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            profile.reload()
          }}
        />
      )}
      {travelDialog !== undefined && (
        <TravelFormDialog
          influencerId={influencer.id}
          travel={travelDialog}
          onClose={() => setTravelDialog(undefined)}
          onSaved={() => {
            setTravelDialog(undefined)
            profile.reload()
          }}
        />
      )}
    </section>
  )
}

function NeedsSection({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <section className="tile profile-section" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      {text ? <p className="profile-needs">{text}</p> : <p className="muted">None listed.</p>}
    </section>
  )
}

interface NotesSectionProps {
  influencerId: number
  notes: InfluencerNote[]
  canEdit: boolean
  onChange: () => void
}

/** Notes written by Directors and Assistants; everyone can read them. */
function NotesSection({ influencerId, notes, canEdit, onChange }: NotesSectionProps) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const addNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    setSaving(true)
    try {
      await api('/influencer-notes/', { method: 'POST', body: JSON.stringify({ influencer: influencerId, body: draft }) })
      setDraft('')
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (note: InfluencerNote) => {
    if (!editText.trim()) return
    await api(`/influencer-notes/${note.id}/`, { method: 'PATCH', body: JSON.stringify({ body: editText }) })
    setEditingId(null)
    onChange()
  }

  const removeNote = async (note: InfluencerNote) => {
    if (!window.confirm('Delete this note?')) return
    await api(`/influencer-notes/${note.id}/`, { method: 'DELETE' })
    onChange()
  }

  return (
    <section className="tile profile-section profile-section--wide" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes</h2>
      {canEdit && (
        <form className="note-form" onSubmit={addNote}>
          <label className="form__field">
            <span className="visually-hidden">New note</span>
            <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note…" />
          </label>
          <button type="submit" className="button" disabled={saving || !draft.trim()}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="notes-list">
          {notes.map((note) => (
            <li key={note.id} className="note">
              {editingId === note.id ? (
                <div className="note__edit">
                  <textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit note" />
                  <div className="inline-form__actions">
                    <button type="button" className="button" onClick={() => saveEdit(note)}>
                      Save
                    </button>
                    <button type="button" className="button button--secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="note__body">{note.body}</p>
                  <p className="note__meta">
                    {note.author_name ?? 'Unknown'} · {formatDateTime(note.created_at)}
                    {new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1000 && ' (edited)'}
                    {canEdit && (
                      <span className="row-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setEditingId(note.id)
                            setEditText(note.body)
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="icon-button" onClick={() => removeNote(note)} aria-label="Delete note">
                          ×
                        </button>
                      </span>
                    )}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
