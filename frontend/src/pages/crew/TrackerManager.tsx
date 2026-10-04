import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import type { User } from '../../auth/roles'
import { timeAgo } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Tracker, TrackerType } from '../../types'

const TRACKER_TYPES: { value: TrackerType; label: string }[] = [
  { value: 'airtag', label: 'Apple AirTag' },
  { value: 'tile', label: 'Tile' },
  { value: 'smarttag', label: 'Samsung SmartTag' },
  { value: 'gps', label: 'GPS tracker' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
]

/** Site Manager tools: add trackers, issue keys, set locations by hand. */
export function TrackerManager({ onChange }: { onChange: () => void }) {
  const trackers = useFetch<Tracker[]>('/trackers/')
  const [dialog, setDialog] = useState<{ kind: 'add' } | { kind: 'location'; tracker: Tracker } | null>(null)
  const [revealed, setRevealed] = useState<{ name: string; token: string } | null>(null)

  const changed = () => {
    trackers.reload()
    onChange()
  }

  const rotateKey = async (tracker: Tracker) => {
    if (!window.confirm(`Issue a new key for ${tracker.person_name}'s tracker? The current key stops working.`)) return
    const { token } = await api<{ token: string }>(`/trackers/${tracker.id}/rotate_key/`, { method: 'POST' })
    setRevealed({ name: tracker.person_name, token })
  }

  const toggleActive = async (tracker: Tracker) => {
    await api(`/trackers/${tracker.id}/`, { method: 'PATCH', body: JSON.stringify({ is_active: !tracker.is_active }) })
    changed()
  }

  const remove = async (tracker: Tracker) => {
    if (!window.confirm(`Remove ${tracker.person_name}'s tracker and its location history?`)) return
    await api(`/trackers/${tracker.id}/`, { method: 'DELETE' })
    changed()
  }

  return (
    <section className="tracker-manager" aria-labelledby="tracker-manager-title">
      <div className="page-header">
        <div>
          <h2 id="tracker-manager-title">Trackers</h2>
          <p className="muted">Only Site Managers see this section.</p>
        </div>
        <button type="button" className="button" onClick={() => setDialog({ kind: 'add' })}>
          + Add tracker
        </button>
      </div>

      {revealed && <KeyNotice {...revealed} onDismiss={() => setRevealed(null)} />}

      <div className="tile table-wrap">
        {trackers.data && trackers.data.length === 0 && <p className="muted">No trackers yet.</p>}
        {trackers.data && trackers.data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Tracker</th>
                <th scope="col">Device ID</th>
                <th scope="col">Last report</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {trackers.data.map((tracker) => (
                <tr key={tracker.id} className={tracker.is_active ? undefined : 'is-inactive'}>
                  <td>
                    <strong>{tracker.person_name}</strong>
                    {!tracker.is_active && <span className="badge badge--muted">Paused</span>}
                  </td>
                  <td>
                    {tracker.tracker_type_display}
                    {tracker.label && <span className="muted"> · {tracker.label}</span>}
                  </td>
                  <td>{tracker.identifier || <span className="muted">—</span>}</td>
                  <td>
                    {tracker.last_ping ? (
                      <>
                        {timeAgo(tracker.last_ping.recorded_at)}
                        {tracker.last_ping.source === 'manual' && <span className="muted"> (set by hand)</span>}
                      </>
                    ) : (
                      <span className="muted">Never</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="text-button" onClick={() => setDialog({ kind: 'location', tracker })}>
                        Set location
                      </button>
                      <button type="button" className="text-button" onClick={() => rotateKey(tracker)}>
                        New key
                      </button>
                      <button type="button" className="text-button" onClick={() => toggleActive(tracker)}>
                        {tracker.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => remove(tracker)}
                        aria-label={`Remove ${tracker.person_name}'s tracker`}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialog?.kind === 'add' && (
        <AddTrackerDialog
          onClose={() => setDialog(null)}
          onCreated={(tracker) => {
            setDialog(null)
            setRevealed({ name: tracker.person_name, token: tracker.token ?? '' })
            changed()
          }}
        />
      )}
      {dialog?.kind === 'location' && (
        <LocationDialog
          tracker={dialog.tracker}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            changed()
          }}
        />
      )}
    </section>
  )
}

function KeyNotice({ name, token, onDismiss }: { name: string; token: string; onDismiss: () => void }) {
  const endpoint = `${window.location.origin}/api/trackers/ping/`
  return (
    <div className="notice notice--success key-notice" role="status">
      <div className="key-notice__head">
        <p>
          <strong>Tracker key for {name}.</strong> Copy it now; it won’t be shown again.
        </p>
        <button type="button" className="icon-button" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
      <code className="key-notice__key">{token}</code>
      <details>
        <summary>How a device reports its location</summary>
        <p>
          The device, phone shortcut or bridge service sends a POST request to <code>{endpoint}</code> with this key:
        </p>
        <pre className="key-notice__code">{`Authorization: Bearer ${token}
Content-Type: application/json

{"latitude": 27.9506, "longitude": -82.4572, "accuracy_m": 15}`}</pre>
        <p className="muted">
          AirTags can’t send locations directly (Apple has no public API), so they need a bridge app or service that reads
          Find My and forwards locations here.
        </p>
      </details>
    </div>
  )
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const titleId = `dialog-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby={titleId}>
      <div className="dialog__header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}

function AddTrackerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (tracker: Tracker) => void }) {
  const people = useFetch<User[]>('/users/')
  const [form, setForm] = useState({ person: '', tracker_type: 'airtag' as TrackerType, label: '', identifier: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const tracker = await api<Tracker>('/trackers/', {
        method: 'POST',
        body: JSON.stringify({ ...form, person: form.person ? Number(form.person) : null }),
      })
      onCreated(tracker)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  return (
    <Dialog title="Add tracker" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>Person *</span>
            <select value={form.person} onChange={(event) => setForm({ ...form, person: event.target.value })} required>
              <option value="">Choose someone…</option>
              {(people.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                  {person.department_name ? ` (${person.department_name})` : ''}
                </option>
              ))}
            </select>
            {errors.person && <small className="form__field-error">{errors.person}</small>}
          </label>
          <label className="form__field">
            <span>Type</span>
            <select
              value={form.tracker_type}
              onChange={(event) => setForm({ ...form, tracker_type: event.target.value as TrackerType })}
            >
              {TRACKER_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            <span>Label</span>
            <input
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="e.g. Badge AirTag"
            />
          </label>
          <label className="form__field">
            <span>Device ID / serial</span>
            <input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
          </label>
        </div>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Adding…' : 'Add tracker'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function LocationDialog({ tracker, onClose, onSaved }: { tracker: Tracker; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    latitude: tracker.last_ping?.latitude ?? '',
    longitude: tracker.last_ping?.longitude ?? '',
    note: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const fillFromDevice = () => {
    if (!navigator.geolocation) {
      setErrors({ form: 'This browser can’t share its location.' })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm({
          ...form,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        })
        setLocating(false)
      },
      () => {
        setErrors({ form: 'Couldn’t get this device’s location. Check the browser’s location permission.' })
        setLocating(false)
      },
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(`/trackers/${tracker.id}/location/`, {
        method: 'POST',
        body: JSON.stringify({ latitude: Number(form.latitude), longitude: Number(form.longitude), note: form.note }),
      })
      onSaved()
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: 'Could not save the location.' })
      setSaving(false)
    }
  }

  return (
    <Dialog title={`Set location: ${tracker.person_name}`} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {errors.form && <p className="form__error">{errors.form}</p>}
        <div className="form__grid">
          <label className="form__field">
            <span>Latitude *</span>
            <input
              inputMode="decimal"
              value={form.latitude}
              onChange={(event) => setForm({ ...form, latitude: event.target.value })}
            />
            {errors.latitude && <small className="form__field-error">{errors.latitude}</small>}
          </label>
          <label className="form__field">
            <span>Longitude *</span>
            <input
              inputMode="decimal"
              value={form.longitude}
              onChange={(event) => setForm({ ...form, longitude: event.target.value })}
            />
            {errors.longitude && <small className="form__field-error">{errors.longitude}</small>}
          </label>
          <label className="form__field form__span">
            <span>Note</span>
            <input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="e.g. Stage B"
            />
          </label>
        </div>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Save location'}
          </button>
          <button type="button" className="button button--secondary" onClick={fillFromDevice} disabled={locating}>
            {locating ? 'Locating…' : 'Use this device’s location'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
