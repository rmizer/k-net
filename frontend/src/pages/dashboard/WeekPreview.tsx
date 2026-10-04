import { Link } from 'react-router-dom'
import { addDays, eventDays, formatDay, formatTime } from '../../format'
import type { CalendarEvent } from '../../types'
import '../../components/schedule/schedule.css'
import { DashboardSection } from './DashboardSection'

interface WeekPreviewProps {
  events: CalendarEvent[]
  weekStart: string
  today: string
  timeZone: string
  /** Staff see only their own schedule here. */
  ownScheduleOnly: boolean
}

export function WeekPreview({ events, weekStart, today, timeZone, ownScheduleOnly }: WeekPreviewProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const byDay = new Map<string, CalendarEvent[]>(days.map((day) => [day, []]))
  for (const event of events) {
    for (const day of eventDays(event.start, event.end, timeZone)) {
      byDay.get(day)?.push(event)
    }
  }

  return (
    <DashboardSection
      title={ownScheduleOnly ? 'Your Week' : 'This Week'}
      action={<Link to="/schedule#month">Monthly schedule</Link>}
    >
      <ol className="week">
        {days.map((day) => {
          const dayEvents = byDay.get(day) ?? []
          return (
            <li key={day} className={`week__day${day === today ? ' is-today' : ''}`}>
              <p className="week__date">
                <span>{formatDay(day, { weekday: 'short' })}</span>
                <strong>{formatDay(day, { month: 'short', day: 'numeric' })}</strong>
              </p>
              {dayEvents.length === 0 ? (
                <p className="week__empty">—</p>
              ) : (
                <ul className="week__events">
                  {dayEvents.map((event) => (
                    <li
                      key={event.id}
                      className={[
                        'week__event',
                        event.event_type === 'influencer' ? 'is-influencer' : '',
                        event.is_mine && !ownScheduleOnly ? 'is-mine' : '',
                      ].join(' ')}
                    >
                      <Link to={`/schedule?date=${day}&event=${event.id}`}>
                        <span className="week__time">{event.all_day ? 'All day' : formatTime(event.start, timeZone)}</span>
                        {event.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <p className="legend">
        <span className="legend__item legend__item--influencer">Influencer event</span>
        {!ownScheduleOnly && <span className="legend__item legend__item--mine">Yours</span>}
      </p>
    </DashboardSection>
  )
}
