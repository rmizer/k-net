import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { formatDay } from '../../format'
import type { Weather } from '../../types'
import { DashboardSection } from './DashboardSection'
import { WeatherIcon } from './WeatherIcon'

interface WeatherSectionProps {
  canEdit: boolean
  /** Called after the location changes, since it also changes the time zone. */
  onLocationChange: () => void
}

export function WeatherSection({ canEdit, onLocationChange }: WeatherSectionProps) {
  const { data, error, loading, reload } = useFetch<Weather>('/weather/')
  const [editing, setEditing] = useState(false)

  const handleSaved = () => {
    setEditing(false)
    reload()
    onLocationChange()
  }

  const action =
    canEdit && !editing ? (
      <button type="button" className="text-button" onClick={() => setEditing(true)}>
        {data?.configured ? 'Change location' : 'Set location'}
      </button>
    ) : undefined

  return (
    <DashboardSection title="Weather" action={action}>
      <div className="tile weather">
        {editing && <LocationForm onSaved={handleSaved} onCancel={() => setEditing(false)} />}
        {!editing && loading && <p className="muted">Loading weather…</p>}
        {!editing && !loading && error && <p className="muted">Weather is unavailable right now.</p>}
        {!editing && data && !data.configured && (
          <p className="muted">
            No production location set yet.
            {canEdit ? ' Use “Set location” to add one.' : ' A Director or Assistant can add one.'}
          </p>
        )}
        {!editing && data?.configured && (
          <div className="weather__body">
            <div className="weather__now">
              <WeatherIcon code={data.current.code} size={56} />
              <div>
                <p className="weather__temp">
                  {data.current.temperature}
                  {data.temperature_unit}
                </p>
                <p className="weather__desc">{data.current.description}</p>
              </div>
              <dl className="weather__details">
                <div>
                  <dt>Feels like</dt>
                  <dd>
                    {data.current.feels_like}
                    {data.temperature_unit}
                  </dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>
                    {data.current.wind_speed} {data.wind_unit}
                  </dd>
                </div>
                <div>
                  <dt>Humidity</dt>
                  <dd>{data.current.humidity}%</dd>
                </div>
              </dl>
              <p className="weather__location">{data.location_name}</p>
            </div>
            <ol className="weather__forecast" aria-label="5-day forecast">
              {data.daily.map((day, index) => (
                <li key={day.date}>
                  <span className="weather__day">{index === 0 ? 'Today' : formatDay(day.date, { weekday: 'short' })}</span>
                  <WeatherIcon code={day.code} size={28} />
                  <span className="visually-hidden">{day.description}</span>
                  <span>
                    <strong>{day.high}°</strong> / {day.low}°
                  </span>
                  {day.precipitation_chance !== null && (
                    <span className="weather__rain">{day.precipitation_chance}% rain</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </DashboardSection>
  )
}

function LocationForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/production/location/', { method: 'POST', body: JSON.stringify({ query }) })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the location.')
      setSaving(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label className="form__field">
        <span>Production location (city)</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Atlanta" required />
      </label>
      <p className="form__hint">This also sets the production’s time zone for schedules and tasks.</p>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="inline-form__actions">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Save location'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
