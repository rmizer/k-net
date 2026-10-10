import { Link } from 'react-router-dom'
import type { CalendarEvent } from '../../types'
import { eventClasses, eventWhen } from './GanttChart'
import './schedule.css'

interface AgendaListProps {
  events: CalendarEvent[]
  timeZone: string
  eventHref: (event: CalendarEvent) => string
  selectedId?: number | null
}

/** One day's events as a list, in time order. */
export function AgendaList({ events, timeZone, eventHref, selectedId }: AgendaListProps) {
  return (
    <ul className="agenda">
      {events.map((event) => (
        <li key={event.id} className={eventClasses('agenda__item', event, selectedId)}>
          <span className="agenda__time">{eventWhen(event, timeZone)}</span>
          <span className="agenda__body">
            <Link to={eventHref(event)} className="agenda__title">
              {event.title}
            </Link>
            {event.event_type === 'influencer' && <span className="badge badge--influencer">Influencer</span>}
            {event.event_type === 'support' && <span className="badge badge--support">Support</span>}
            {(event.location || event.department_name) && (
              <span className="agenda__meta">
                {[event.location, event.department_name].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
