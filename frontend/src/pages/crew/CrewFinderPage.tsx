import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { isSiteManager } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { timeAgo } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CrewFinderEntry } from '../../types'
import { CrewMap, type MapPoint } from './CrewMap'
import { TrackerManager } from './TrackerManager'
import './crew.css'

const REFRESH_MS = 60_000
/** Locations older than this are shown greyed out. */
const STALE_MINUTES = 30

export function CrewFinderPage() {
  const { user } = useAuth()
  const finder = useFetch<CrewFinderEntry[]>('/crewfinder/')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { reload } = finder

  // Refresh locations every minute.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
      reload()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  const points: MapPoint[] = useMemo(
    () =>
      (finder.data ?? [])
        .map((entry) => {
          const seenAt = entry.location ? new Date(entry.location.recorded_at).getTime() : null
          return {
            entry,
            stale: seenAt === null || now - seenAt > STALE_MINUTES * 60_000,
            lastSeen: entry.location ? timeAgo(entry.location.recorded_at, now) : 'never',
            seenAt,
          }
        })
        // Most recently seen first; people with no location yet at the end.
        .sort((a, b) => (b.seenAt ?? -Infinity) - (a.seenAt ?? -Infinity)),
    [finder.data, now],
  )

  const select = useCallback((trackerId: number) => setSelectedId(trackerId), [])

  const refreshNow = () => {
    setNow(Date.now())
    reload()
  }

  return (
    <section className="crewfinder">
      <div className="page-header">
        <div>
          <h1>CrewFinder</h1>
          <p className="subtitle">Where the crew is right now</p>
        </div>
        <button type="button" className="button button--secondary" onClick={refreshNow}>
          Refresh
        </button>
      </div>

      {finder.error && !finder.data && <p className="form__error">Couldn’t load crew locations.</p>}

      <div className="crewfinder__layout">
        <CrewMap points={points} selectedId={selectedId} onSelect={select} />

        <div className="crewfinder__list tile">
          <h2 className="crewfinder__list-title">Tracked crew ({points.length})</h2>
          {finder.loading && !finder.data && <p className="loading">Loading…</p>}
          {finder.data && points.length === 0 && (
            <p className="muted">
              No one is being tracked yet.
              {isSiteManager(user) ? ' Add a tracker below.' : ' A Site Manager can add trackers.'}
            </p>
          )}
          <ul>
            {points.map(({ entry, stale, lastSeen }) => (
              <li
                key={entry.tracker_id}
                className={`finder-row${stale ? ' is-stale' : ''}${selectedId === entry.tracker_id ? ' is-selected' : ''}`}
              >
                <Avatar person={entry.person} size={36} />
                <div className="finder-row__text">
                  <p className="finder-row__name">
                    {entry.person.first_name} {entry.person.last_name}
                  </p>
                  <p className="finder-row__meta">
                    {[entry.person.department_name, entry.location?.note].filter(Boolean).join(' · ') ||
                      entry.person.role_display}
                  </p>
                  <p className="finder-row__seen">
                    <span className="finder-row__dot" aria-hidden="true" />
                    {entry.location ? `Seen ${lastSeen}` : 'No location yet'}
                    {stale && entry.location && <span className="visually-hidden"> (may be out of date)</span>}
                  </p>
                </div>
                {entry.location && (
                  <button type="button" className="text-button finder-row__show" onClick={() => select(entry.tracker_id)}>
                    Show
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="finder-legend muted">
            Greyed out: last seen more than {STALE_MINUTES} minutes ago. Updates every minute.
          </p>
        </div>
      </div>

      {isSiteManager(user) && <TrackerManager onChange={reload} />}
    </section>
  )
}
