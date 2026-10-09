import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { addDays, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Department, EventType, ProductionLocation } from '../../types'

interface Person {
  id: number
  name: string
}

interface BlockScheduleDialogProps {
  /** Who's ticked to start with, e.g. the person whose schedule is open. */
  defaultAttendees?: number[]
  /** The first day of the first date range. */
  defaultDay: string
  people: Person[]
  departments: Department[]
  /** Times are entered in the production's time zone. */
  timeZone: string
  onSaved: (count: number) => void
  onClose: () => void
}

interface DateRange {
  start_date: string
  end_date: string
}

// Monday is 0, matching the server.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const PATTERNS: { value: string; label: string; days: number[] }[] = [
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)', days: [0, 1, 2, 3, 4] },
  { value: 'every', label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { value: 'weekends', label: 'Weekends (Sat–Sun)', days: [5, 6] },
]

const SHIFTS: { label: string; start: string; end: string }[] = [
  { label: '9 AM – 5 PM', start: '09:00', end: '17:00' },
  { label: '8 AM – 4 PM', start: '08:00', end: '16:00' },
  { label: '7 AM – 7 PM', start: '07:00', end: '19:00' },
  { label: '7 PM – 7 AM', start: '19:00', end: '07:00' },
]

const TYPES: { value: EventType; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'production', label: 'Production' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'other', label: 'Other' },
]

const weekdayOf = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

/** Every day in the ranges that falls on one of the weekdays, without repeats. */
function matchingDays(ranges: DateRange[], weekdays: number[]) {
  const days = new Set<string>()
  for (const { start_date, end_date } of ranges) {
    if (!start_date || !end_date || end_date < start_date) continue
    for (let day = start_date; day <= end_date && days.size <= 366; day = addDays(day, 1)) {
      if (weekdays.includes(weekdayOf(day))) days.add(day)
    }
  }
  return [...days].sort()
}

const hoursBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm)
  return (minutes <= 0 ? minutes + 24 * 60 : minutes) / 60
}

const shortDay = (day: string) => formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })

/** Schedule the same shift over one or more date ranges, on chosen days of the
 *  week, in one go (e.g. Oct 5–30, weekdays, 9 to 5). */
export function BlockScheduleDialog(props: BlockScheduleDialogProps) {
  const { defaultAttendees = [], defaultDay, people, departments, timeZone } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const locations = useFetch<ProductionLocation[]>('/locations/')
  const [form, setForm] = useState({
    title: '',
    event_type: 'staff' as EventType,
    start_time: '09:00',
    end_time: '17:00',
    location: '',
    department: '',
    description: '',
  })
  const [ranges, setRanges] = useState<DateRange[]>([{ start_date: defaultDay, end_date: addDays(defaultDay, 4) }])
  const [weekdays, setWeekdays] = useState<number[]>(PATTERNS[0].days)
  const [allDay, setAllDay] = useState(false)
  const [attendees, setAttendees] = useState<number[]>(defaultAttendees)
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })
  const setRange = (index: number, changes: Partial<DateRange>) =>
    setRanges(ranges.map((range, i) => (i === index ? { ...range, ...changes } : range)))
  const addRange = () => {
    // The next range starts the Monday after the last one ends, a week long.
    const last = ranges[ranges.length - 1]?.end_date || defaultDay
    const start = addDays(last, 7 - weekdayOf(last))
    setRanges([...ranges, { start_date: start, end_date: addDays(start, 4) }])
  }

  const pattern = PATTERNS.find((p) => p.days.length === weekdays.length && p.days.every((d) => weekdays.includes(d)))
  const toggleDay = (day: number) =>
    setWeekdays(weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day].sort())
  const shift = SHIFTS.find((s) => s.start === form.start_time && s.end === form.end_time)
  const overnight = !allDay && form.end_time <= form.start_time

  const days = matchingDays(ranges, weekdays)
  const hoursEach = allDay ? 0 : hoursBetween(form.start_time, form.end_time) * days.length
  const departmentName = departments.find((d) => String(d.id) === form.department)?.name

  const query = search.trim().toLowerCase()
  const listed = people.filter((p) => !query || p.name.toLowerCase().includes(query) || attendees.includes(p.id))
  const toggle = (id: number, on: boolean) => setAttendees(on ? [...attendees, id] : attendees.filter((a) => a !== id))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const result = await api<{ count: number }>('/events/block/', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          event_type: form.event_type,
          location: form.location,
          department: form.department ? Number(form.department) : null,
          description: form.description,
          attendees,
          ranges,
          weekdays,
          all_day: allDay,
          start_time: allDay ? null : form.start_time,
          end_time: allDay ? null : form.end_time,
        }),
      })
      props.onSaved(result.count)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' },
      )
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={props.onClose} aria-labelledby="block-form-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="block-form-title">Schedule a block</h2>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="form__hint">
          The same hours over a stretch of days, e.g. Oct 5–30, weekdays, 9 to 5. Each day is added to the schedule
          on its own, so single days can still be edited later.
        </p>
        {(errors.form || errors.non_field_errors) && (
          <p className="form__error" role="alert">
            {errors.form || errors.non_field_errors}
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
              placeholder="e.g. Office hours, Set build"
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

        <fieldset className="form__fieldset">
          <legend>Dates</legend>
          <ul className="block-ranges">
            {ranges.map((range, index) => (
              <li key={index} className="block-ranges__row">
                <label className="form__field">
                  <span>From</span>
                  <input
                    type="date"
                    value={range.start_date}
                    onChange={(e) => {
                      const start = e.target.value
                      setRange(index, {
                        start_date: start,
                        end_date: range.end_date && range.end_date >= start ? range.end_date : start,
                      })
                    }}
                    required
                  />
                </label>
                <label className="form__field">
                  <span>To</span>
                  <input
                    type="date"
                    value={range.end_date}
                    min={range.start_date}
                    onChange={(e) => setRange(index, { end_date: e.target.value })}
                    required
                  />
                </label>
                {ranges.length > 1 && (
                  <button
                    type="button"
                    className="icon-button block-ranges__remove"
                    onClick={() => setRanges(ranges.filter((_, i) => i !== index))}
                    aria-label={`Remove dates ${index + 1}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="text-button" onClick={addRange}>
            + Add another date range
          </button>
          {error('ranges')}
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Days</legend>
          <div className="block-days">
            <label className="form__field">
              <span className="visually-hidden">Repeat on</span>
              <select
                value={pattern?.value ?? 'custom'}
                onChange={(e) => {
                  const chosen = PATTERNS.find((p) => p.value === e.target.value)
                  if (chosen) setWeekdays(chosen.days)
                }}
              >
                {PATTERNS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="custom" disabled={!!pattern}>
                  Custom days
                </option>
              </select>
            </label>
            <div className="block-days__toggles" role="group" aria-label="Days of the week">
              {WEEKDAYS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={`block-day${weekdays.includes(day) ? ' is-on' : ''}`}
                  aria-pressed={weekdays.includes(day)}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error('weekdays')}
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Hours</legend>
          <div className="form__grid form__grid--three">
            <label className="form__field">
              <span>Shift</span>
              <select
                value={allDay ? 'all-day' : (shift?.label ?? 'custom')}
                onChange={(e) => {
                  if (e.target.value === 'all-day') return setAllDay(true)
                  setAllDay(false)
                  const chosen = SHIFTS.find((s) => s.label === e.target.value)
                  if (chosen) setForm({ ...form, start_time: chosen.start, end_time: chosen.end })
                }}
              >
                {SHIFTS.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
                <option value="all-day">All day</option>
                <option value="custom" disabled={!!shift || allDay}>
                  Custom hours
                </option>
              </select>
            </label>
            {!allDay && (
              <>
                <label className="form__field">
                  <span>Starts</span>
                  <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
                  {error('start_time')}
                </label>
                <label className="form__field">
                  <span>Ends{overnight ? ' (next day)' : ''}</span>
                  <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
                  {error('end_time')}
                </label>
              </>
            )}
          </div>
          <p className="form__hint block-hint">Times are production time ({timeZone.replace(/_/g, ' ')}).</p>
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>Who</legend>
          <div className="form__grid">
            <label className="form__field">
              <span>Find people</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" />
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
          <div className="event-people block-people">
            {listed.map((person) => (
              <label key={person.id} className="form__check">
                <input
                  type="checkbox"
                  checked={attendees.includes(person.id)}
                  onChange={(e) => toggle(person.id, e.target.checked)}
                />
                <span>{person.name}</span>
              </label>
            ))}
            {listed.length === 0 && <span className="muted">No one matches.</span>}
          </div>
          {error('attendees')}
        </fieldset>

        <div className="form__grid">
          <label className="form__field">
            <span>Where</span>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              list="block-locations"
              placeholder="Stage A, a set, an address…"
              autoComplete="off"
            />
            <datalist id="block-locations">
              {(locations.data ?? []).map((place) => (
                <option key={place.id} value={place.name} />
              ))}
            </datalist>
          </label>
          <label className="form__field">
            <span>Notes</span>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>
        </div>

        <div className="block-summary" aria-live="polite">
          {days.length === 0 ? (
            <span>No days match those dates and days of the week yet.</span>
          ) : (
            <>
              <strong>
                {days.length} {days.length === 1 ? 'day' : 'days'}
              </strong>
              {days.length > 1 ? `: ${shortDay(days[0])} – ${shortDay(days[days.length - 1])}` : `: ${shortDay(days[0])}`}
              {allDay ? ', all day' : `, ${Math.round(hoursEach * 10) / 10} hours per person`}
              {' · '}
              {[
                attendees.length && `${attendees.length} ${attendees.length === 1 ? 'person' : 'people'}`,
                departmentName && `the ${departmentName} department`,
              ]
                .filter(Boolean)
                .join(' and ') || 'no one chosen yet'}
            </>
          )}
        </div>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving || days.length === 0}>
            {saving ? 'Scheduling…' : `Add ${days.length || ''} ${days.length === 1 ? 'day' : 'days'} to the schedule`}
          </button>
          <button type="button" className="button button--secondary" onClick={props.onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
