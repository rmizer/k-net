import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { dayKey, formatTimeRange } from '../../format'
import type { CalendarEvent } from '../../types'
import './schedule.css'

interface GanttChartProps {
  events: CalendarEvent[]
  /** The day shown, "YYYY-MM-DD" in the production's time zone. */
  day: string
  timeZone: string
  /** Where clicking an event goes. */
  eventHref: (event: CalendarEvent) => string
  selectedId?: number | null
}

const DAY_MINUTES = 24 * 60

/** Minutes after midnight on `day` (in the production's zone), clamped to the day. */
function minuteOfDay(iso: string, day: string, timeZone: string): number {
  const key = dayKey(iso, timeZone)
  if (key < day) return 0
  if (key > day) return DAY_MINUTES
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date(iso))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12a'
  if (hour === 12) return '12p'
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

/** Re-renders every minute so the "now" line keeps moving. */
function useNow() {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function eventWhen(event: CalendarEvent, timeZone: string) {
  return event.all_day ? 'All day' : formatTimeRange(event.start, event.end, timeZone)
}

export function eventClasses(base: string, event: CalendarEvent, selectedId?: number | null) {
  return [
    base,
    event.event_type === 'influencer' && 'is-influencer',
    event.is_mine && 'is-mine',
    event.id === selectedId && 'is-selected',
  ]
    .filter(Boolean)
    .join(' ')
}

/** One day's events as bars on a time axis. */
export function GanttChart({ events, day, timeZone, eventHref, selectedId }: GanttChartProps) {
  const now = useNow()

  const timed = events.map((event) => {
    const start = event.all_day ? 0 : minuteOfDay(event.start, day, timeZone)
    const end = event.all_day ? DAY_MINUTES : minuteOfDay(event.end, day, timeZone)
    return { event, start, end: Math.max(end, start + 15) } // Very short events still get a visible bar.
  })

  // The axis covers the day's events in whole hours, at least 8am–6pm.
  const scheduled = timed.filter((row) => !row.event.all_day)
  const firstHour = Math.min(8, ...scheduled.map((row) => Math.floor(row.start / 60)))
  const lastHour = Math.min(24, Math.max(18, ...scheduled.map((row) => Math.ceil(row.end / 60))))
  const span = (lastHour - firstHour) * 60
  const step = lastHour - firstHour > 12 ? 2 : 1
  const hours = Array.from({ length: Math.floor((lastHour - firstHour) / step) + 1 }, (_, i) => firstHour + i * step)
  const position = (minute: number) => (Math.min(Math.max(minute - firstHour * 60, 0), span) / span) * 100

  const nowMinute = dayKey(now, timeZone) === day ? minuteOfDay(now, day, timeZone) : null
  const showNow = nowMinute != null && nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60

  return (
    <div className="gantt" style={{ '--gantt-now': `${position(nowMinute ?? 0)}%` } as CSSProperties}>
      <div className="gantt__row gantt__row--axis" aria-hidden="true">
        <span />
        <div className="gantt__track">
          {hours.map((hour) => (
            <span key={hour} className="gantt__tick" style={{ left: `${position(hour * 60)}%` }}>
              {hourLabel(hour)}
            </span>
          ))}
          {showNow && <span className="gantt__now gantt__now--label">Now</span>}
        </div>
      </div>

      <ul className="gantt__rows">
        {timed.map(({ event, start, end }) => {
          const when = eventWhen(event, timeZone)
          return (
            <li key={event.id} className={eventClasses('gantt__row', event, selectedId)}>
              <div className="gantt__label">
                <Link to={eventHref(event)} className="gantt__title">
                  {event.title}
                </Link>
                <span className="gantt__meta">
                  {when}
                  {event.location && ` · ${event.location}`}
                </span>
              </div>
              <div className="gantt__track">
                {hours.map((hour) => (
                  <span key={hour} className="gantt__grid" style={{ left: `${position(hour * 60)}%` }} />
                ))}
                {showNow && <span className="gantt__now" aria-hidden="true" />}
                <Link
                  to={eventHref(event)}
                  className="gantt__bar"
                  style={{ left: `${position(start)}%`, width: `${position(end) - position(start)}%` }}
                  aria-label={`${event.title}, ${when}${event.location ? `, ${event.location}` : ''}`}
                  tabIndex={-1}
                >
                  <span className="gantt__tip" role="tooltip">
                    <strong>{when}</strong>
                    <span>{event.title}</span>
                    {event.location && <span className="muted">{event.location}</span>}
                  </span>
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
