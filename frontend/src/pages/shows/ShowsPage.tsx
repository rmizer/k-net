import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isDirectorLevel, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Show } from '../../types'
import { ShowFormDialog } from './ShowFormDialog'
import './shows.css'

/** Shows the production runs or is brainstorming. Directors and Site Managers
 *  create and edit them. */
export function ShowsPage() {
  const { user } = useAuth()
  const shows = useFetch<Show[]>('/shows/')
  const people = useFetch<User[]>('/users/')
  const [searchParams, setSearchParams] = useSearchParams()
  const canEdit = isDirectorLevel(user)
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
          <button type="button" className="button" onClick={() => setEditing(null)} disabled={!people.data}>
            + Create new show
          </button>
        )}
      </div>

      {shows.loading && !shows.data && <p className="loading">Loading shows…</p>}
      {shows.error && !shows.data && <p className="form__error">Couldn’t load the shows.</p>}
      {shows.data?.length === 0 && <p className="muted">No shows yet. Create one to start planning.</p>}

      <ul className="show-tiles">
        {shows.data?.map((show) => (
          <li key={show.id} className="tile show-tile">
            <div className="show-tile__head">
              <div>
                <h2>{show.name}</h2>
                {show.status_display && <span className="badge">{show.status_display}</span>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditing(show)}
                  disabled={!people.data}
                  aria-label={`Edit ${show.name}`}
                >
                  Edit
                </button>
              )}
            </div>
            <p className="show-tile__description">{show.description}</p>
            <dl className="show-tile__details">
              <div>
                <dt>Starts</dt>
                <dd>{show.start_date ? formatDay(show.start_date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{show.shooting_location || 'Not set'}</dd>
              </div>
              <div>
                <dt>Seasons</dt>
                <dd>
                  {show.seasons ?? '—'}
                  {show.weeks_per_season ? ` × ${show.weeks_per_season} weeks` : ''}
                </dd>
              </div>
              <div>
                <dt>Director</dt>
                <dd>{show.director_name ?? 'Not set'}</dd>
              </div>
              <div>
                <dt>Other directors</dt>
                <dd>{show.other_director_details.map((person) => person.name).join(', ') || 'None'}</dd>
              </div>
              <div>
                <dt>Department heads</dt>
                <dd>
                  {show.department_head_details
                    .map((person) => `${person.name} (${person.head_of_department_name ?? 'No department listed'})`)
                    .join(', ') || 'None'}
                </dd>
              </div>
              <div>
                <dt>Influencers</dt>
                <dd>
                  {show.influencer_count ? (
                    <Link to={`/influencers?show=${show.id}`}>{show.influencer_count} on the roster</Link>
                  ) : (
                    'None'
                  )}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {editing !== undefined && user && people.data && (
        <ShowFormDialog
          show={editing}
          people={people.data}
          viewer={user}
          onSaved={() => shows.reload()}
          onClose={close}
        />
      )}
    </section>
  )
}
