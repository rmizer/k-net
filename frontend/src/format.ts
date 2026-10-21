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

/** A 24-hour "13:30" as "1:30 PM". */
export function clockTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
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

/** "just now", "4 min ago", "3 hr ago", "2 days ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * Up to two initials from a person's name: "Coach K" → "CK", "Jimmy Smith" → "JS",
 * "EJ" → "EJ", "Babes" → "B". Letters and digits only, so it's safe to put in HTML.
 */
export function initials(firstName: string, lastName = ''): string {
  const words = `${firstName} ${lastName}`
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) {
    const [word] = words
    // Keep short all-caps names like "EJ" whole.
    return word.length <= 3 && word === word.toUpperCase() ? word : word[0].toUpperCase()
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** "Hilton Westshore, Room 412", or whichever part is filled in. */
export function lodgingLabel(lodging: string, roomNumber = ''): string {
  const room = roomNumber.trim() ? `Room ${roomNumber.trim().replace(/^room\s*/i, '')}` : ''
  return [lodging.trim(), room].filter(Boolean).join(', ')
}

/** Link to a creator's profile on their platform, when we know both. */
export function profileUrl(platform: string, handle: string): string | null {
  if (!handle) return null
  const h = encodeURIComponent(handle.replace(/^@/, ''))
  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${h}/`
    case 'tiktok':
      return `https://www.tiktok.com/@${h}`
    case 'youtube':
      return `https://www.youtube.com/@${h}`
    case 'kick':
      return `https://kick.com/${h}`
    case 'twitch':
      return `https://www.twitch.tv/${h}`
    default:
      return null
  }
}

/** "Oct 12, 3:30 PM EDT" in the viewer's own time zone. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso))
}

/** ISO instant → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/** <input type="datetime-local"> value → ISO instant, or null when empty. */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

/** Milliseconds the time zone is ahead of UTC at a given instant. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utcMs
}

/** A wall-clock date and time in `timeZone` ("2026-10-05", "08:30") as an ISO instant. */
export function zonedIso(day: string, time: string, timeZone: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guess = Date.UTC(year, month - 1, date, hour, minute)
  // Two passes settle the offset across daylight-saving changes.
  const first = guess - zoneOffsetMs(guess, timeZone)
  return new Date(guess - zoneOffsetMs(first, timeZone)).toISOString()
}

/** "08:30" (24-hour) for an instant, in the given time zone. */
export function timeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  )
}
