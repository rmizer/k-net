import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { LOCATION_KINDS, type LocationKind, type ProductionLocation } from '../../types'
import { LocationFormDialog } from './LocationFormDialog'
import { LocationIcon } from './LocationIcon'
import { directionsUrl, LocationsMap } from './LocationsMap'
import './locations.css'

type DialogState = { location: ProductionLocation | null; kind: LocationKind }

export function LocationsPage() {
  const { user } = useAuth()
  const manager = isManagerLevel(user)
  const locations = useFetch<ProductionLocation[]>('/locations/')
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [error, setError] = useState('')
  const mapRef = useRef<HTMLDivElement>(null)

  const kindParam = params.get('type')
  const filter = LOCATION_KINDS.some((k) => k.value === kindParam) ? (kindParam as LocationKind) : null

  const all = useMemo(() => locations.data ?? [], [locations.data])
  const visible = useMemo(() => all.filter((place) => !filter || place.kind === filter), [all, filter])
  const groups = LOCATION_KINDS.map((kind) => ({
    ...kind,
    places: visible.filter((place) => place.kind === kind.value).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.places.length > 0)

  const selectOnMap = useCallback((id: number) => setSelectedId(id), [])

  const showOnMap = (place: ProductionLocation) => {
    setSelectedId(place.id)
    const top = mapRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0) mapRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const remove = async (place: ProductionLocation) => {
    if (!window.confirm(`Remove ${place.name} from Locations?`)) return
    setError('')
    try {
      await api(`/locations/${place.id}/`, { method: 'DELETE' })
      locations.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t remove that location.')
    }
  }

  if (locations.loading && !locations.data) return <p className="loading">Loading locations…</p>
  if (!locations.data) return <p className="form__error">Couldn’t load locations.</p>

  return (
    <section className="locations">
      <div className="page-header">
        <div>
          <h1>Locations</h1>
          <p className="subtitle">Hotels, airports, sets and everywhere else the production goes</p>
        </div>
        {manager && (
          <button
            type="button"
            className="button"
            onClick={() => setDialog({ location: null, kind: filter ?? 'shooting' })}
          >
            + Add location
          </button>
        )}
      </div>

      <div className="location-filters" role="group" aria-label="Show">
        <button type="button" aria-pressed={!filter} onClick={() => setParams({})}>
          All <span className="location-filters__count">{all.length}</span>
        </button>
        {LOCATION_KINDS.map((kind) => {
          const count = all.filter((place) => place.kind === kind.value).length
          if (!count) return null
          return (
            <button
              key={kind.value}
              type="button"
              aria-pressed={filter === kind.value}
              onClick={() => setParams({ type: kind.value })}
            >
              <LocationIcon kind={kind.value} />
              {kind.plural} <span className="location-filters__count">{count}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {all.length === 0 ? (
        <div className="tile">
          <p className="muted">
            No locations yet.{manager ? ' Add the crew hotel, airports and shooting locations to get started.' : ''}
          </p>
        </div>
      ) : (
        <>
          <div ref={mapRef}>
            <LocationsMap locations={visible} selectedId={selectedId} onSelect={selectOnMap} />
          </div>

          {groups.map((group) => (
            <section key={group.value} className="location-group" aria-labelledby={`locations-${group.value}`}>
              <h2 id={`locations-${group.value}`}>
                <LocationIcon kind={group.value} />
                {group.plural}
              </h2>
              <ul className="location-cards">
                {group.places.map((place) => (
                  <li key={place.id} className={`tile location-card${place.id === selectedId ? ' is-selected' : ''}`}>
                    <div className="location-card__head">
                      <h3>{place.name}</h3>
                      {place.kind === 'other' && place.custom_type && (
                        <span className="badge badge--muted">{place.custom_type}</span>
                      )}
                      {manager && (
                        <span className="row-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setDialog({ location: place, kind: place.kind })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => remove(place)}
                            aria-label={`Remove ${place.name}`}
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                    {place.address && <p className="location-card__address">{place.address}</p>}
                    <dl className="location-card__details">
                      {place.phone && (
                        <div>
                          <dt>Phone</dt>
                          <dd>
                            <a className="contact-link" href={`tel:${place.phone}`}>
                              {place.phone}
                            </a>
                          </dd>
                        </div>
                      )}
                      {place.contact_name && (
                        <div>
                          <dt>Contact</dt>
                          <dd>{place.contact_name}</dd>
                        </div>
                      )}
                    </dl>
                    {place.notes && <p className="location-card__notes">{place.notes}</p>}
                    <div className="location-card__actions">
                      {place.latitude != null ? (
                        <button type="button" className="text-button" onClick={() => showOnMap(place)}>
                          Show on map
                        </button>
                      ) : (
                        <span className="muted location-card__unmapped">Not on the map</span>
                      )}
                      {(place.latitude != null || place.address) && (
                        <a
                          href={directionsUrl(place)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-button"
                        >
                          Directions ↗
                        </a>
                      )}
                      {place.website && (
                        <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-button">
                          Website ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {dialog && (
        <LocationFormDialog
          location={dialog.location}
          initialKind={dialog.kind}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setDialog(null)
            setSelectedId(saved.id)
            locations.reload()
          }}
        />
      )}
    </section>
  )
}
