import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { addDays, dayKey, timeInZone, zonedIso } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CalendarEvent, Department, EventType, ProductionLocation } from '../../types'

interface Person {
  id: number
  name: string
}

interface EventFormDialogProps {
  /** The event being edited, or null to add one. */
  event: CalendarEvent | null
  /** For a new event: the day, and who's attending. */
  defaultDay: string
  defaultAttendees?: number[]
  people: Person[]
  departments: Department[]
  /** Times are entered in the production's time zone. */
  timeZone: string
  onSaved: (saved: CalendarEvent) => void
  onDeleted: () => void
  onClose: () => void
}

const TYPES: { value: EventType; label: string }[] = [
  { value: 'production', label: 'Production' },
  { value: 'staff', label: 'Staff' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'support', label: 'Support' },
  { value: 'other', label: 'Other' },
]

export function EventFormDialog(props: EventFormDialogProps) {
  const { event, defaultDay, defaultAttendees = [], people, departments, timeZone } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const locations = useFetch<ProductionLocation[]>('/locations/')
  const [form, setForm] = useState({
    title: event?.title ?? '',
    event_type: (event?.event_type ?? 'production') as EventType,
    day: event ? dayKey(event.start, timeZone) : defaultDay,
    start: event && !event.all_day ? timeInZone(event.start, timeZone) : '09:00',
    end: event && !event.all_day ? timeInZone(event.end, timeZone) : '17:00',
    location: event?.location ?? '',
    department: event?.department?.toString() ?? '',
    description: event?.description ?? '',
  })
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [attendees, setAttendees] = useState<number[]>(event?.attendees ?? defaultAttendees)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })
  // An end time at or before the start means the event runs past midnight.
  const overnight = !allDay && form.end <= form.start

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (!form.day) {
      setErrors({ day: 'Pick a date.' })
      return
    }
    setSaving(true)
    setErrors({})
    const start = allDay ? zonedIso(form.day, '00:00', timeZone) : zonedIso(form.day, form.start, timeZone)
    const end = allDay
      ? zonedIso(addDays(form.day, 1), '00:00', timeZone)
      : zonedIso(overnight ? addDays(form.day, 1) : form.day, form.end, timeZone)
    try {
      const saved = await api<CalendarEvent>(event ? `/events/${event.id}/` : '/events/', {
        method: event ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title: form.title,
          event_type: form.event_type,
          start,
          end,
          all_day: allDay,
          location: form.location,
          department: form.department ? Number(form.department) : null,
          description: form.description,
          attendees,
        }),
      })
      props.onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' },
      )
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!event || !window.confirm(`Delete “${event.title}” from the schedule? It’s removed for everyone.`)) return
    await api(`/events/${event.id}/`, { method: 'DELETE' })
    props.onDeleted()
  }

  const removeBlock = async () => {
    if (
      !event?.block ||
      !window.confirm(`Delete every day of the “${event.title}” block from the schedule? It’s removed for everyone.`)
    ) {
      return
    }
    await api(`/events/block/${event.block}/`, { method: 'DELETE' })
    props.onDeleted()
  }

  const toggle = (id: number, on: boolean) => setAttendees(on ? [...attendees, id] : attendees.filter((a) => a !== id))
  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={props.onClose} aria-labelledby="event-form-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="event-form-title">{event ? 'Edit schedule item' : 'Add to the schedule'}</h2>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <div className="form__grid">
          <label className="form__field">
            <span>
              What<span aria-hidden="true"> *</span>
            </span>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Crew call"
              aria-invalid={!!errors.title}
              autoComplete="off"
              required
            />
            {error('title')}
          </label>
          <label className="form__field">
            <span>Type</span>
            <select value={form.event_type} onChange={(e) => set('event_type', e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form__grid form__grid--three">
          <label className="form__field">
            <span>Date</span>
            <input type="date" value={form.day} onChange={(e) => set('day', e.target.value)} required />
            {error('day')}
          </label>
          {!allDay && (
            <>
              <label className="form__field">
                <span>Starts</span>
                <input type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
                {error('start')}
              </label>
              <label className="form__field">
                <span>Ends{overnight ? ' (next day)' : ''}</span>
                <input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} />
                {error('end')}
              </label>
            </>
          )}
        </div>
        <label className="form__check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day</span>
        </label>
        <p className="form__hint">
          Times are production time ({timeZone.replace(/_/g, ' ')}).
          {event?.block && ' This day is part of a block; changes here apply to this day only.'}
        </p>

        <div className="form__grid">
          <label className="form__field">
            <span>Where</span>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              list="event-locations"
              placeholder="Stage A, a set, an address…"
              autoComplete="off"
            />
            <datalist id="event-locations">
              {(locations.data ?? []).map((place) => (
                <option key={place.id} value={place.name} />
              ))}
            </datalist>
          </label>
          <label className="form__field">
            <span>Whole department</span>
            <select value={form.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">None</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="form__fieldset">
          <legend>People</legend>
          <div className="event-people">
            {people.map((person) => (
              <label key={person.id} className="form__check">
                <input
                  type="checkbox"
                  checked={attendees.includes(person.id)}
                  onChange={(e) => toggle(person.id, e.target.checked)}
                />
                <span>{person.name}</span>
              </label>
            ))}
          </div>
          <small className="form__hint">Choosing a department puts this on everyone in it, too.</small>
        </fieldset>

        <label className="form__field">
          <span>Notes</span>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : event ? 'Save changes' : 'Add to schedule'}
          </button>
          <button type="button" className="button button--secondary" onClick={props.onClose}>
            Cancel
          </button>
          {event && (
            <button type="button" className="text-button text-button--danger" onClick={remove}>
              {event.block ? 'Delete this day' : 'Delete for everyone'}
            </button>
          )}
          {event?.block && (
            <button type="button" className="text-button text-button--danger" onClick={removeBlock}>
              Delete the whole block
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
