import { GanttChart } from '../../components/schedule/GanttChart'
import { ScheduleLegend } from '../../components/schedule/ScheduleLegend'
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
          <>
            <GanttChart
              events={events}
              day={today}
              timeZone={timeZone}
              eventHref={(event) => `/schedule?date=${today}&event=${event.id}`}
            />
            <ScheduleLegend />
          </>
        )}
      </div>
    </DashboardSection>
  )
}
