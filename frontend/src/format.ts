// Date helpers. Event times are shown in the production's time zone (not the
// viewer's), so everyone sees the same call times wherever they are.

/** "YYYY-MM-DD" for an instant, in the given time zone. */
export function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  )
}

/** "8:00 AM" in the given time zone. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatTimeRange(start: string, end: string, timeZone: string): string {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`
}

// Calendar dates ("YYYY-MM-DD") are handled in UTC so DST never shifts the day.
function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

/** Formats a "YYYY-MM-DD" date, e.g. { weekday: 'short' } gives "Mon". */
export function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(parseDay(day))
}

/** The calendar days ("YYYY-MM-DD") an event touches, in the given time zone. */
export function eventDays(start: string, end: string, timeZone: string): string[] {
  const first = dayKey(start, timeZone)
  // An event ending exactly at midnight doesn't spill into the next day.
  const last = end > start ? dayKey(new Date(new Date(end).getTime() - 1).toISOString(), timeZone) : first
  const days = [first]
  while (days[days.length - 1] < last && days.length < 31) {
    days.push(addDays(days[days.length - 1], 1))
  }
  return days
}
