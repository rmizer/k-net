import { Link } from 'react-router-dom'
import { formatTimeRange } from '../../format'
import type { CalendarEvent } from '../../types'
import { DashboardSection } from './DashboardSection'

interface DailyRundownProps {
  events: CalendarEvent[]
  today: string
  timeZone: string
}

export function DailyRundown({ events, today, timeZone }: DailyRundownProps) {
  return (
    <DashboardSection title="Daily Rundown">
      <div className="tile">
        {events.length === 0 ? (
          <p className="muted">Nothing on the schedule today.</p>
        ) : (
          <ul className="rundown">
            {events.map((event) => (
              <li key={event.id} className={event.event_type === 'influencer' ? 'is-influencer' : undefined}>
                <span className="rundown__time">
                  {event.all_day ? 'All day' : formatTimeRange(event.start, event.end, timeZone)}
                </span>
                <Link to={`/schedule?date=${today}&event=${event.id}`} className="rundown__title">
                  {event.title}
                </Link>
                {event.event_type === 'influencer' && <span className="badge badge--influencer">Influencer</span>}
                {event.location && <span className="rundown__location">{event.location}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardSection>
  )
}
