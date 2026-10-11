import { addDays, dayKey, eventDays, formatDay, formatTime } from '../../format'
import type { CalendarEvent } from '../../types'

interface MonthCalendarProps {
  /** "YYYY-MM" */
  month: string
  events: CalendarEvent[]
  today: string
  selectedDay: string
  timeZone: string
  loading: boolean
  onSelectDay: (day: string) => void
  onMonthChange: (month: string) => void
}

const MAX_CHIPS = 3
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// The last two columns, Saturday and Sunday, get a light weekend tint.
const isWeekendColumn = (index: number) => index % 7 >= 5

/** The six Monday-first weeks that cover a month. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  const start = addDays(first, -weekday)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function shiftMonth(month: string, amount: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + amount, 1))
  return date.toISOString().slice(0, 7)
}

export function MonthCalendar(props: MonthCalendarProps) {
  const { month, events, today, selectedDay, timeZone, loading, onSelectDay, onMonthChange } = props
  const days = monthGrid(month)

  const byDay = new Map<string, CalendarEvent[]>(days.map((day) => [day, []]))
  for (const event of events) {
    for (const day of eventDays(event.start, event.end, timeZone)) {
      byDay.get(day)?.push(event)
    }
  }

  return (
    <div className={`month tile${loading ? ' is-loading' : ''}`}>
      <div className="month__toolbar">
        <button
          type="button"
          className="icon-button"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="month__title" aria-live="polite">
          {formatDay(`${month}-01`, { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          aria-label="Next month"
        >
          ›
        </button>
        {month !== today.slice(0, 7) && (
          <button type="button" className="text-button" onClick={() => onSelectDay(today)}>
            Today
          </button>
        )}
      </div>

      <div className="month__grid">
        {WEEKDAYS.map((name, index) => (
          <span
            key={name}
            className={`month__weekday${isWeekendColumn(index) ? ' is-weekend' : ''}`}
            aria-hidden="true"
          >
            {name}
          </span>
        ))}
        {days.map((day, index) => {
          const dayEvents = byDay.get(day) ?? []
          const classes = [
            'month__day',
            isWeekendColumn(index) && 'is-weekend',
            !day.startsWith(month) && 'is-outside',
            day === today && 'is-today',
            day === selectedDay && 'is-selected',
          ]
          const label = `${formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}, ${
            dayEvents.length === 0 ? 'no events' : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
          }`
          return (
            <button
              key={day}
              type="button"
              className={classes.filter(Boolean).join(' ')}
              onClick={() => onSelectDay(day)}
              aria-pressed={day === selectedDay}
              aria-label={label}
            >
              <span className="month__date" aria-hidden="true">
                {Number(day.slice(8))}
              </span>
              <span className="month__events" aria-hidden="true">
                {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                  <span
                    key={event.id}
                    className={[
                      'month__chip',
                      event.event_type === 'influencer' && 'is-influencer',
                      event.event_type === 'support' && 'is-support',
                      event.is_mine && 'is-mine',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {!event.all_day && (
                      <span className="month__chip-time">
                        {dayKey(event.start, timeZone) < day
                          ? `Until ${formatTime(event.end, timeZone)}` // Overnight, from the day before.
                          : formatTime(event.start, timeZone)}
                      </span>
                    )}
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > MAX_CHIPS && (
                  <span className="month__more">+{dayEvents.length - MAX_CHIPS} more</span>
                )}
              </span>
              {dayEvents.length > 0 && (
                <span className="month__count" aria-hidden="true">
                  {dayEvents.length}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
