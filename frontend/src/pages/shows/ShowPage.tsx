import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isDirectorLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'
import type { InfluencerRow, Show } from '../../types'
import { ShowDetails } from './ShowDetails'
import { ShowEditor } from './ShowsPage'
import './shows.css'

/** One show: its details, people and the influencers on it. */
export function ShowPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canEdit = isDirectorLevel(user)
  const show = useFetch<Show>(`/shows/${id}/`)
  const roster = useFetch<InfluencerRow[]>('/influencers/')
  const [editing, setEditing] = useState(false)

  if (show.loading && !show.data) return <p className="loading">Loading show…</p>
  if (!show.data) {
    return (
      <section>
        <h1>Show not found</h1>
        <Link to="/staff-manager/shows">Back to Shows</Link>
      </section>
    )
  }

  const data = show.data
  const influencers = (roster.data ?? [])
    .filter((influencer) => influencer.show === data.id)
    .sort((a, b) => (b.week ?? 0) - (a.week ?? 0) || a.name.localeCompare(b.name))

  return (
    <section className="shows show-page">
      <p className="breadcrumb">
        <Link to="/staff-manager/shows">← Shows</Link>
      </p>
      <div className="page-header">
        <div>
          <h1>{data.name}</h1>
          {data.status_display && <span className="badge">{data.status_display}</span>}
        </div>
        {canEdit && (
          <button type="button" className="button" onClick={() => setEditing(true)}>
            Edit show
          </button>
        )}
      </div>

      <div className="tile show-tile">
        <p className="show-tile__description">{data.description}</p>
        <ShowDetails show={data} />
      </div>

      <div className="tile show-page__influencers">
        <h2>Influencers on this show</h2>
        {roster.loading && !roster.data && <p className="loading">Loading influencers…</p>}
        {roster.data && influencers.length === 0 && <p className="muted">No influencers are on this show yet.</p>}
        {influencers.length > 0 && (
          <table className="data-table fin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Season</th>
                <th scope="col">Week</th>
                <th scope="col">Platform</th>
              </tr>
            </thead>
            <tbody>
              {influencers.map((influencer) => (
                <tr key={influencer.id}>
                  <td data-label="Name">
                    <Link to={`/influencers/${influencer.id}`} className="fin-person-link">
                      {influencer.name}
                    </Link>
                  </td>
                  <td data-label="Season">{influencer.season ?? <span className="muted">—</span>}</td>
                  <td data-label="Week">{influencer.week ?? <span className="muted">—</span>}</td>
                  <td data-label="Platform">{influencer.platform_display || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canEdit && editing && user && (
        <ShowEditor
          show={data}
          viewer={user}
          onSaved={() => {
            show.reload()
            roster.reload()
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  )
}
