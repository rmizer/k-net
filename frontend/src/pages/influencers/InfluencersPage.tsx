import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { SortHeader, useSort } from '../../components/sorting'
import { formatDateTime, initials, profileUrl } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import { INFLUENCER_PLATFORMS, type Influencer, type InfluencerRow } from '../../types'
import { InfluencerFormDialog } from './InfluencerFormDialog'
import '../finance/finance.css'
import './influencers.css'

type SortKey = 'name' | 'show' | 'season' | 'week' | 'platform' | 'status' | 'agent' | 'travel' | 'next'

export function InfluencersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const roster = useFetch<InfluencerRow[]>('/influencers/')
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  // The Shows page links here with ?show=<id>.
  const [show, setShow] = useState(() => searchParams.get('show') ?? '')
  const [week, setWeek] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('active')
  const [travelOnly, setTravelOnly] = useState(false)
  const [adding, setAdding] = useState(false)
  const sort = useSort<SortKey>('name')
  const manager = isManagerLevel(user)

  const all = useMemo(() => roster.data ?? [], [roster.data])
  const shows = useMemo(() => {
    const byId = new Map<number, string>()
    for (const i of all) if (i.show != null && i.show_name) byId.set(i.show, i.show_name)
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]))
  }, [all])
  const weeks = useMemo(
    () => [...new Set(all.map((i) => i.week).filter((w): w is number => w != null))].sort((a, b) => a - b),
    [all],
  )
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (i) =>
        (!query || `${i.name} ${i.handle} ${i.email} ${i.phone} ${i.agent_name}`.toLowerCase().includes(query)) &&
        (!show || (show === 'none' ? i.show == null : String(i.show) === show)) &&
        (!week || String(i.week) === week) &&
        (!platform || (platform === 'none' ? !i.platform : i.platform === platform)) &&
        (status === 'all' || i.is_active === (status === 'active')) &&
        (!travelOnly || !!i.next_travel_at),
    ),
    (i, key) =>
      ({
        name: i.name.toLowerCase(),
        show: i.show_name?.toLowerCase() ?? null,
        season: i.season,
        week: i.week,
        platform: i.platform_display,
        status: i.is_active ? 'Active' : 'Inactive',
        agent: i.agent_name.toLowerCase(),
        travel: i.next_travel_at,
        next: i.next_event_at,
      })[key],
  )
  const filtered = !!(query || show || week || platform || status !== 'all' || travelOnly)
  const clear = () => {
    setSearch('')
    setShow('')
    setWeek('')
    setPlatform('')
    setStatus('all')
    setTravelOnly(false)
  }

  return (
    <section className="influencers finance">
      <div className="page-header">
        <div>
          <h1>Influencer Roster</h1>
          <p className="subtitle">
            Creators on the project
            {roster.data ? ` · ${all.filter((i) => i.is_active).length} active of ${all.length}` : ''}
          </p>
        </div>
        {manager && (
          <button type="button" className="button" onClick={() => setAdding(true)}>
            + Add influencer
          </button>
        )}
      </div>

      <div className="fin-filters influencer-filters" role="search">
        <label className="form__field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, handle, email, phone, agent"
          />
        </label>
        <label className="form__field">
          <span>Show</span>
          <select value={show} onChange={(e) => setShow(e.target.value)}>
            <option value="">All</option>
            {shows.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value="none">No show</option>
          </select>
        </label>
        <label className="form__field">
          <span>Week</span>
          <select value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value="">All</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>Platform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">All</option>
            {INFLUENCER_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="none">Not set</option>
          </select>
        </label>
        <label className="form__field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="form__check fin-filters__check">
          <input type="checkbox" checked={travelOnly} onChange={(e) => setTravelOnly(e.target.checked)} />
          <span>Upcoming travel</span>
        </label>
      </div>

      {roster.loading && !roster.data && <p className="loading">Loading roster…</p>}
      {roster.error && !roster.data && <p className="form__error">Couldn’t load the roster.</p>}

      {roster.data && (
        <div className="tile influencer-table">
          {visible.length === 0 ? (
            <p className="muted">
              {all.length ? 'No one matches those filters.' : 'No influencers yet.'}
              {all.length > 0 && filtered && (
                <>
                  {' '}
                  <button type="button" className="text-button" onClick={clear}>
                    Show everyone
                  </button>
                </>
              )}
            </p>
          ) : (
            <>
              <p className="muted influencer-table__count">
                Showing {visible.length} of {all.length}
              </p>
              <div className="table-wrap">
                <table className="data-table fin-table">
                  <thead>
                    <tr>
                      <SortHeader sort={sort} column="name">
                        Name
                      </SortHeader>
                      <SortHeader sort={sort} column="show">
                        Show
                      </SortHeader>
                      <SortHeader sort={sort} column="season">
                        Season
                      </SortHeader>
                      <SortHeader sort={sort} column="week">
                        Week
                      </SortHeader>
                      <SortHeader sort={sort} column="platform">
                        Platform
                      </SortHeader>
                      <SortHeader sort={sort} column="status">
                        Status
                      </SortHeader>
                      <th>Contact</th>
                      <SortHeader sort={sort} column="agent">
                        Agent / contact
                      </SortHeader>
                      <SortHeader sort={sort} column="travel">
                        Travel
                      </SortHeader>
                      <SortHeader sort={sort} column="next">
                        Next on schedule
                      </SortHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((influencer) => {
                      const social = profileUrl(influencer.platform, influencer.handle)
                      return (
                        <tr key={influencer.id} className={influencer.is_active ? undefined : 'is-inactive'}>
                          <td data-label="Name">
                            <span className="influencer-row">
                              <span className="influencer-row__photo" aria-hidden="true">
                                {influencer.photo ? <img src={influencer.photo} alt="" /> : initials(influencer.name)}
                              </span>
                              <span>
                                <Link to={`/influencers/${influencer.id}`} className="fin-person-link">
                                  {influencer.name}
                                </Link>
                                {influencer.handle &&
                                  (social ? (
                                    <a className="fin-sub" href={social} target="_blank" rel="noreferrer">
                                      @{influencer.handle}
                                    </a>
                                  ) : (
                                    <span className="fin-sub">@{influencer.handle}</span>
                                  ))}
                              </span>
                            </span>
                          </td>
                          <td data-label="Show">{influencer.show_name ?? <span className="muted">—</span>}</td>
                          <td data-label="Season">{influencer.season ?? <span className="muted">—</span>}</td>
                          <td data-label="Week">{influencer.week ?? <span className="muted">—</span>}</td>
                          <td data-label="Platform">
                            {influencer.platform_display || <span className="muted">—</span>}
                          </td>
                          <td data-label="Status">
                            {influencer.is_active ? (
                              'Active'
                            ) : (
                              <span className="badge badge--muted">Inactive</span>
                            )}
                          </td>
                          <td data-label="Contact">
                            {influencer.phone && (
                              <a className="contact-link" href={`tel:${influencer.phone}`}>
                                {influencer.phone}
                              </a>
                            )}
                            {influencer.email && (
                              <a className="fin-sub" href={`mailto:${influencer.email}`}>
                                {influencer.email}
                              </a>
                            )}
                            {!influencer.phone && !influencer.email && <span className="muted">—</span>}
                          </td>
                          <td data-label="Agent / contact">
                            {influencer.agent_name || <span className="muted">—</span>}
                          </td>
                          <td data-label="Travel">
                            {influencer.next_travel_at ? (
                              <>
                                Next: {formatDateTime(influencer.next_travel_at)}
                                <span className="fin-sub">{influencer.travel_count} booked</span>
                              </>
                            ) : influencer.travel_count ? (
                              <span className="muted">{influencer.travel_count} past</span>
                            ) : (
                              <span className="muted">None</span>
                            )}
                          </td>
                          <td data-label="Next on schedule">
                            {influencer.next_event_at ? (
                              formatDateTime(influencer.next_event_at)
                            ) : (
                              <span className="muted">Nothing scheduled</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

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
