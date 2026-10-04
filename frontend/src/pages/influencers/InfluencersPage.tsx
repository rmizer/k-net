import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { initials } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Influencer, InfluencerSummary } from '../../types'
import { InfluencerFormDialog } from './InfluencerFormDialog'
import './influencers.css'

export function InfluencersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const roster = useFetch<InfluencerSummary[]>('/influencers/')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const manager = isManagerLevel(user)

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    // The API already orders by name.
    return (roster.data ?? []).filter(
      (influencer) => !query || `${influencer.name} ${influencer.handle}`.toLowerCase().includes(query),
    )
  }, [roster.data, search])

  return (
    <section className="influencers">
      <div className="page-header">
        <div>
          <h1>Influencer Roster</h1>
          <p className="subtitle">
            Creators on the project{roster.data ? ` · ${roster.data.length}` : ''}
          </p>
        </div>
        {manager && (
          <button type="button" className="button" onClick={() => setAdding(true)}>
            + Add influencer
          </button>
        )}
      </div>

      <div className="filters" role="search">
        <label className="form__field filters__search">
          <span>Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or handle" />
        </label>
      </div>

      {roster.loading && !roster.data && <p className="loading">Loading roster…</p>}
      {roster.error && !roster.data && <p className="form__error">Couldn’t load the roster.</p>}
      {roster.data && visible.length === 0 && (
        <div className="tile influencers__empty">
          <p className="muted">{roster.data.length ? 'No one matches that search.' : 'No influencers yet.'}</p>
        </div>
      )}

      <ul className="influencer-grid">
        {visible.map((influencer) => (
          <li key={influencer.id}>
            <Link to={`/influencers/${influencer.id}`} className="influencer-card">
              <span className="influencer-card__image">
                {influencer.photo ? (
                  <img src={influencer.photo} alt="" />
                ) : (
                  <span className="influencer-card__initials" aria-hidden="true">
                    {initials(influencer.name)}
                  </span>
                )}
              </span>
              <span className="influencer-card__body">
                <span className="influencer-card__name">{influencer.name}</span>
                <span className="influencer-card__meta">
                  {[influencer.handle && `@${influencer.handle}`, influencer.platform_display].filter(Boolean).join(' · ') || ' '}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {adding && (
        <InfluencerFormDialog
          influencer={null}
          onClose={() => setAdding(false)}
          onSaved={(saved: Influencer) => navigate(`/influencers/${saved.id}`)}
        />
      )}
    </section>
  )
}
