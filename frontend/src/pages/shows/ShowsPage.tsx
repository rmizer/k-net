import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isDirectorLevel, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'
import type { Show } from '../../types'
import { ShowDetails } from './ShowDetails'
import { ShowFormDialog } from './ShowFormDialog'
import './shows.css'

/** Shows the production runs or is brainstorming. Directors, Assistants and
 *  Site Managers see them; only Directors and Site Managers create and edit. */
export function ShowsPage() {
  const { user } = useAuth()
  const canEdit = isDirectorLevel(user)
  const shows = useFetch<Show[]>('/shows/')
  const [searchParams, setSearchParams] = useSearchParams()
  // undefined = closed, null = creating, Show = editing. The Director's Dashboard
  // links here with ?new=1 to open the create form.
  const [editing, setEditing] = useState<Show | null | undefined>(() =>
    canEdit && searchParams.get('new') ? null : undefined,
  )
  const close = () => {
    setEditing(undefined)
    if (searchParams.get('new')) setSearchParams({}, { replace: true })
  }

  return (
    <section className="shows">
      <div className="page-header">
        <div>
          <h1>Shows</h1>
          <p className="subtitle">Current shows and new ideas</p>
        </div>
        {canEdit && (
          <button type="button" className="button" onClick={() => setEditing(null)}>
            + Create new show
          </button>
        )}
      </div>

      {shows.loading && !shows.data && <p className="loading">Loading shows…</p>}
      {shows.error && !shows.data && <p className="form__error">Couldn’t load the shows.</p>}
      {shows.data?.length === 0 && (
        <p className="muted">{canEdit ? 'No shows yet. Create one to start planning.' : 'No shows yet.'}</p>
      )}

      <ul className="show-tiles">
        {shows.data?.map((show) => (
          <li key={show.id} className="tile show-tile">
            <div className="show-tile__head">
              <div>
                <h2>
                  <Link to={`/staff-manager/shows/${show.id}`} className="show-tile__link">
                    {show.name}
                  </Link>
                </h2>
                {show.status_display && <span className="badge">{show.status_display}</span>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditing(show)}
                  aria-label={`Edit ${show.name}`}
                >
                  Edit
                </button>
              )}
            </div>
            <p className="show-tile__description">{show.description}</p>
            <ShowDetails show={show} />
          </li>
        ))}
      </ul>

      {canEdit && editing !== undefined && user && (
        <ShowEditor show={editing} viewer={user} onSaved={() => shows.reload()} onClose={close} />
      )}
    </section>
  )
}

/** The create / edit form, once the people to pick from have loaded. */
export function ShowEditor({
  show,
  viewer,
  onSaved,
  onClose,
}: {
  show: Show | null
  viewer: User
  onSaved: (saved: Show) => void
  onClose: () => void
}) {
  const people = useFetch<User[]>('/users/')
  if (!people.data) return people.error ? <p className="form__error">Couldn’t load the staff list.</p> : null
  return <ShowFormDialog show={show} people={people.data} viewer={viewer} onSaved={onSaved} onClose={onClose} />
}
