import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { EventFormDialog } from '../../components/schedule/EventFormDialog'
import { addDays, eventDays, formatDay, formatTimeRange } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CalendarEvent, Department, ProductionSettings, StaffOverviewRow } from '../../types'
import '../finance/finance.css'
import './staff-manager.css'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))

/** Events in the list that overlap another timed event in the list. */
function overlaps(events: CalendarEvent[]) {
  const clashes = new Map<number, string[]>()
  const timed = events.filter((e) => !e.all_day)
  for (const a of timed) {
    for (const b of timed) {
      if (a.id !== b.id && a.start < b.end && b.start < a.end)
        clashes.set(a.id, [...(clashes.get(a.id) ?? []), b.title])
    }
  }
  return clashes
}

export function SchedulingPage() {
  const production = useFetch<ProductionSettings>('/production/')
  if (!production.data) {
    return production.loading ? <p className="loading">Loading…</p> : <p className="form__error">Couldn’t load.</p>
  }
  return <Scheduling today={production.data.today} timeZone={production.data.time_zone} />
}

function Scheduling({ today, timeZone }: { today: string; timeZone: string }) {
  const [params, setParams] = useSearchParams()
  const people = useFetch<StaffOverviewRow[]>('/staff-manager/staff/')
  const departments = useFetch<Department[]>('/departments/')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ event: CalendarEvent | null; day: string } | null>(null)
  const [error, setError] = useState('')

  const weekParam = params.get('week') ?? ''
  const weekStart = mondayOf(DAY_PATTERN.test(weekParam) ? weekParam : today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = days[6]
  const personId = Number(params.get('person')) || null
  const person = people.data?.find((p) => p.id === personId) ?? null

  // The window is padded a day each side (days are in production time); filtered below.
  const events = useFetch<CalendarEvent[]>(
    personId
      ? `/events/?person=${personId}&start=${addDays(weekStart, -1)}T00:00:00Z&end=${addDays(weekStart, 8)}T00:00:00Z`
      : '/events/?start=1970-01-01T00:00:00Z&end=1970-01-01T00:00:01Z', // Nobody picked yet: an empty window.
  )

  const weekEvents = (personId ? (events.data ?? []) : [])
    .filter((e) => eventDays(e.start, e.end, timeZone).some((d) => d >= weekStart && d <= weekEnd))
    .sort((a, b) => a.start.localeCompare(b.start))
  const clashes = overlaps(weekEvents)
  const hours = weekEvents
    .filter((e) => !e.all_day)
    .reduce((sum, e) => sum + (Date.parse(e.end) - Date.parse(e.start)) / 3_600_000, 0)

  const query = search.trim().toLowerCase()
  const list = (people.data ?? []).filter(
    (p) => !query || `${p.name} ${p.department_name ?? ''} ${p.role_display}`.toLowerCase().includes(query),
  )

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next)
  }

  const refresh = () => {
    events.reload()
    people.reload()
  }

  // Taking someone off an event leaves it on everyone else's schedule.
  const takeOff = async (event: CalendarEvent) => {
    if (
      !person ||
      !window.confirm(`Take ${person.first_name} off “${event.title}”? It stays on everyone else’s schedule.`)
    ) {
      return
    }
    setError('')
    try {
      await api(`/events/${event.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ attendees: event.attendees.filter((id) => id !== person.id) }),
      })
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t update the schedule.')
    }
  }

  return (
    <section className="finance staff-manager">
      <div className="page-header">
        <div>
          <h1>Scheduling</h1>
          <p className="subtitle">Edit individual staff schedules · production time ({timeZone.replace(/_/g, ' ')})</p>
        </div>
      </div>

      <div className="sm-scheduling">
        <aside className="tile sm-people" aria-label="Staff">
          <label className="form__field">
            <span className="visually-hidden">Find someone</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find someone…"
            />
          </label>
          <ul>
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={p.id === personId ? 'is-selected' : undefined}
                  aria-pressed={p.id === personId}
                  onClick={() => go({ person: String(p.id) })}
                >
                  <span className="sm-people__name">{p.name}</span>
                  <span className="sm-people__meta">
                    {p.department_name ?? p.role_display} · {p.hours_this_week} h this week
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="sm-week">
          {!person ? (
            <div className="tile">
              <p className="muted">Pick someone to see and edit their schedule.</p>
            </div>
          ) : (
            <>
              <div className="sm-week__head">
                <div>
                  <h2>{person.name}</h2>
                  <p className="muted">
                    {[person.role_display, person.department_name, person.lodging].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  className="button"
                  onClick={() => setDialog({ event: null, day: days.includes(today) ? today : weekStart })}
                >
                  + Add to {person.first_name}’s schedule
                </button>
              </div>

              <div className="sm-week__nav">
                <button
                  type="button"
                  className="icon-button sm-arrow"
                  onClick={() => go({ week: addDays(weekStart, -7) })}
                  aria-label="Previous week"
                >
                  ‹
                </button>
                <h3>
                  {formatDay(weekStart, { month: 'short', day: 'numeric' })} –{' '}
                  {formatDay(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <button
                  type="button"
                  className="icon-button sm-arrow"
                  onClick={() => go({ week: addDays(weekStart, 7) })}
                  aria-label="Next week"
                >
                  ›
                </button>
                {!days.includes(today) && (
                  <button type="button" className="text-button" onClick={() => go({ week: null })}>
                    This week
                  </button>
                )}
                <span className="sm-week__hours">
                  {Math.round(hours * 10) / 10} scheduled hours
                  {clashes.size > 0 && <strong className="fin-overdue"> · {clashes.size} overlapping</strong>}
                </span>
              </div>

              {error && (
                <p className="form__error" role="alert">
                  {error}
                </p>
              )}

              <ol className={`sm-days${events.loading && events.data ? ' is-loading' : ''}`}>
                {days.map((day) => {
                  const dayEvents = weekEvents.filter((e) => eventDays(e.start, e.end, timeZone).includes(day))
                  return (
                    <li key={day} className={`tile sm-day${day === today ? ' is-today' : ''}`}>
                      <div className="sm-day__head">
                        <h4>
                          {formatDay(day, { weekday: 'long' })}
                          <span>{formatDay(day, { month: 'short', day: 'numeric' })}</span>
                        </h4>
                        <button type="button" className="text-button" onClick={() => setDialog({ event: null, day })}>
                          + Add
                        </button>
                      </div>
                      {dayEvents.length === 0 ? (
                        <p className="muted sm-day__empty">Nothing scheduled.</p>
                      ) : (
                        <ul className="sm-events">
                          {dayEvents.map((event) => {
                            const direct = event.attendees.includes(person.id)
                            const clash = clashes.get(event.id)
                            return (
                              <li
                                key={event.id}
                                className={`sm-event sm-event--${event.event_type}${clash ? ' is-clash' : ''}`}
                              >
                                <span className="sm-event__time">
                                  {event.all_day ? 'All day' : formatTimeRange(event.start, event.end, timeZone)}
                                </span>
                                <span className="sm-event__body">
                                  <strong>{event.title}</strong>
                                  {event.location && <span className="fin-sub">{event.location}</span>}
                                  {!direct && event.department_name && (
                                    <span className="fin-sub">Through the {event.department_name} department</span>
                                  )}
                                  {clash && <span className="fin-sub fin-overdue">Overlaps {clash.join(', ')}</span>}
                                </span>
                                <span className="row-actions">
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => setDialog({ event, day })}
                                  >
                                    Edit
                                  </button>
                                  {direct && (
                                    <button type="button" className="text-button" onClick={() => takeOff(event)}>
                                      Take off
                                    </button>
                                  )}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ol>
              <p className="form__hint">
                Changes show on the <Link to={`/schedule?date=${weekStart}`}>Schedule</Link> and on {person.first_name}
                ’s dashboard.
              </p>
            </>
          )}
        </div>
      </div>

      {dialog && person && (
        <EventFormDialog
          event={dialog.event}
          defaultDay={dialog.day}
          defaultAttendees={[person.id]}
          people={(people.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
          departments={departments.data ?? []}
          timeZone={timeZone}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            refresh()
          }}
          onDeleted={() => {
            setDialog(null)
            refresh()
          }}
        />
      )}
    </section>
  )
}
