import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AgendaList } from '../../components/schedule/AgendaList'
import { eventWhen, GanttChart } from '../../components/schedule/GanttChart'
import { ScheduleLegend } from '../../components/schedule/ScheduleLegend'
import { addDays, dayKey, eventDays, formatDay, formatTime } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CalendarEvent, ProductionSettings } from '../../types'
import { MonthCalendar, monthGrid } from './MonthCalendar'
import './schedule.css'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Events API path for whole days. The window is padded a day each side because
 * days are in the production's time zone; callers filter to the exact days. */
function eventsPath(first: string, last: string) {
  return `/events/?start=${addDays(first, -1)}T00:00:00Z&end=${addDays(last, 2)}T00:00:00Z`
}

function byStart(a: CalendarEvent, b: CalendarEvent) {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1
  return a.start.localeCompare(b.start) || a.title.localeCompare(b.title)
}

export function SchedulePage() {
  const production = useFetch<ProductionSettings>('/production/')

  if (!production.data) {
    if (production.loading) return <p className="loading">Loading schedule…</p>
    return <p className="form__error">Couldn’t load the schedule.</p>
  }
  return <Schedule today={production.data.today} timeZone={production.data.time_zone} />
}

function Schedule({ today, timeZone }: { today: string; timeZone: string }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const dayRef = useRef<HTMLElement>(null)
  const monthRef = useRef<HTMLElement>(null)

  const dateParam = params.get('date') ?? ''
  const day = DAY_PATTERN.test(dateParam) ? dateParam : today
  const view = params.get('view') === 'agenda' ? 'agenda' : 'gantt'
  const selectedId = Number(params.get('event')) || null

  const [month, setMonth] = useState(day.slice(0, 7))
  // Moving the daily view to another month brings the calendar along.
  useEffect(() => setMonth(day.slice(0, 7)), [day])

  useEffect(() => {
    if (location.hash === '#month') monthRef.current?.scrollIntoView()
  }, [location.hash])

  const dayFetch = useFetch<CalendarEvent[]>(eventsPath(day, day))
  const grid = monthGrid(month)
  const monthFetch = useFetch<CalendarEvent[]>(eventsPath(grid[0], grid[grid.length - 1]))

  const dayEvents = useMemo(
    () => (dayFetch.data ?? []).filter((e) => eventDays(e.start, e.end, timeZone).includes(day)).sort(byStart),
    [dayFetch.data, day, timeZone],
  )
  const selected = dayEvents.find((event) => event.id === selectedId)

  /** A link to this page with some search params changed. */
  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    const query = next.toString()
    return query ? `?${query}` : '?'
  }
  const dayHref = (target: string) => hrefWith({ date: target === today ? null : target, event: null })
  const eventHref = (event: CalendarEvent) => hrefWith({ date: day === today ? null : day, event: String(event.id) })

  const selectDay = (target: string) => {
    setParams(new URLSearchParams(dayHref(target).slice(1)))
    // On small screens the daily view is above the calendar, out of sight.
    const top = dayRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0) dayRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const dayLoading = dayFetch.loading || dayFetch.data === undefined

  return (
    <section className="schedule">
      <div className="page-header">
        <div>
          <h1>Schedule</h1>
          <p className="subtitle">Production time · {timeZone.replace(/_/g, ' ')}</p>
        </div>
      </div>

      <section ref={dayRef} className="schedule-day" aria-labelledby="schedule-day-heading">
        <div className="schedule-day__toolbar">
          <div className="schedule-day__nav">
            <Link to={dayHref(addDays(day, -1))} className="icon-button" aria-label="Previous day">
              ‹
            </Link>
            <h2 id="schedule-day-heading">
              {formatDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <Link to={dayHref(addDays(day, 1))} className="icon-button" aria-label="Next day">
              ›
            </Link>
            {day !== today && (
              <Link to={dayHref(today)} className="text-button">
                Today
              </Link>
            )}
          </div>
          {view === 'gantt' ? (
            <Link to={hrefWith({ view: 'agenda' })} className="schedule-day__view-link">
              Agenda View
            </Link>
          ) : (
            <Link to={hrefWith({ view: null })} className="schedule-day__view-link">
              Gantt View
            </Link>
          )}
        </div>

        <div className={`tile${dayFetch.loading && dayFetch.data ? ' is-loading' : ''}`}>
          {dayFetch.error && !dayFetch.data ? (
            <p className="form__error">Couldn’t load this day’s schedule.</p>
          ) : dayLoading && !dayFetch.data ? (
            <p className="loading">Loading…</p>
          ) : dayEvents.length === 0 ? (
            <p className="muted">Nothing on the schedule {day === today ? 'today' : 'this day'}.</p>
          ) : (
            <>
              {view === 'gantt' ? (
                <GanttChart
                  events={dayEvents}
                  day={day}
                  timeZone={timeZone}
                  eventHref={eventHref}
                  selectedId={selectedId}
                />
              ) : (
                <AgendaList events={dayEvents} timeZone={timeZone} eventHref={eventHref} selectedId={selectedId} />
              )}
              <ScheduleLegend />
            </>
          )}
        </div>

        {selected && (
          <EventDetails event={selected} timeZone={timeZone} closeHref={hrefWith({ event: null })} />
        )}
      </section>

      <section ref={monthRef} id="month" className="schedule-month" aria-labelledby="schedule-month-heading">
        <h2 id="schedule-month-heading">Monthly Schedule</h2>
        <MonthCalendar
          month={month}
          events={monthFetch.data ?? []}
          today={today}
          selectedDay={day}
          timeZone={timeZone}
          loading={monthFetch.loading}
          onSelectDay={selectDay}
          onMonthChange={setMonth}
        />
        {monthFetch.error && !monthFetch.data && <p className="form__error">Couldn’t load the month.</p>}
      </section>
    </section>
  )
}

function EventDetails({ event, timeZone, closeHref }: { event: CalendarEvent; timeZone: string; closeHref: string }) {
  const at = (iso: string) =>
    `${formatDay(dayKey(iso, timeZone), { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(iso, timeZone)}`
  const multiDay = eventDays(event.start, event.end, timeZone).length > 1
  const when = multiDay && !event.all_day ? `${at(event.start)} – ${at(event.end)}` : eventWhen(event, timeZone)

  return (
    <article className="tile event-details" aria-labelledby="event-details-title">
      <div className="event-details__head">
        <h3 id="event-details-title">{event.title}</h3>
        <Link to={closeHref} className="icon-button" aria-label="Close event details">
          ×
        </Link>
      </div>
      <dl className="event-details__fields">
        <div>
          <dt>When</dt>
          <dd>{when}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</dd>
        </div>
        {event.location && (
          <div>
            <dt>Where</dt>
            <dd>{event.location}</dd>
          </div>
        )}
        {event.department_name && (
          <div>
            <dt>Department</dt>
            <dd>{event.department_name}</dd>
          </div>
        )}
      </dl>
      {event.description && <p className="event-details__description">{event.description}</p>}
    </article>
  )
}
